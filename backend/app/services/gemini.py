"""Google Gemini integration (port of src/services/gemini.service.ts) using the google-genai SDK."""
import json
import time
from typing import List, Optional, Type, TypeVar

from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.errors import AIError

T = TypeVar("T", bound=BaseModel)


# ---- structured-output models (same shape as src/types/domain.ts) ----
class ParsedSkill(BaseModel):
    name: str
    proficiency: str = "intermediate"
    endorsements: int = 0
    durationMonths: int = 0


class ParsedCareer(BaseModel):
    company: str
    title: str
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    durationMonths: int = 0
    isCurrent: bool = False
    industry: Optional[str] = None
    companySize: Optional[str] = None
    description: Optional[str] = None


class ParsedEducation(BaseModel):
    institution: str
    degree: str
    fieldOfStudy: str
    startYear: Optional[int] = None
    endYear: Optional[int] = None
    grade: Optional[str] = None
    tier: str = "unknown"


class ParsedProfile(BaseModel):
    anonymizedName: str
    headline: Optional[str] = None
    summary: Optional[str] = None
    location: Optional[str] = None
    country: Optional[str] = None
    yearsOfExperience: float = 0
    currentTitle: Optional[str] = None
    currentCompany: Optional[str] = None
    currentCompanySize: Optional[str] = None
    currentIndustry: Optional[str] = None


class ParsedCandidate(BaseModel):
    profile: ParsedProfile
    careerHistory: List[ParsedCareer] = Field(default_factory=list)
    education: List[ParsedEducation] = Field(default_factory=list)
    skills: List[ParsedSkill] = Field(default_factory=list)


class ParsedJob(BaseModel):
    title: str = "Untitled Role"
    company: Optional[str] = None
    department: Optional[str] = None
    rawDescription: str = ""
    requiredSkills: List[str] = Field(default_factory=list)
    preferredSkills: List[str] = Field(default_factory=list)
    responsibilities: List[str] = Field(default_factory=list)
    experienceYears: int = 0
    educationLevel: str = "Any"
    seniority: str = "Any"
    domain: str = "General"
    softSkills: List[str] = Field(default_factory=list)
    preferProductCompany: bool = False
    preferredDegrees: List[str] = Field(default_factory=list)
    preferredUniversities: List[str] = Field(default_factory=list)


class MatchExplanation(BaseModel):
    strengths: List[str] = Field(default_factory=list)
    weaknesses: List[str] = Field(default_factory=list)
    missingSkills: List[str] = Field(default_factory=list)
    hiringRecommendation: str = ""
    improvementSuggestions: List[str] = Field(default_factory=list)


_client = None


def _models() -> List[str]:
    extra = [m.strip() for m in (settings.GEMINI_FALLBACK_MODELS or "").split(",") if m.strip()]
    return [settings.GEMINI_MODEL] + [m for m in extra if m != settings.GEMINI_MODEL]


def _get_client():
    global _client
    if _client is None:
        if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY.lower().startswith(("mock", "your_", "changeme")):
            raise AIError("GEMINI_API_KEY is missing or still a placeholder. Put a real key in .env (get one free at https://aistudio.google.com/apikey) and restart the server.")
        from google import genai

        from google.genai import types as _t

        _client = genai.Client(api_key=settings.GEMINI_API_KEY, http_options=_t.HttpOptions(timeout=120000))  # 120s
    return _client


def _status(exc: Exception) -> Optional[int]:
    return getattr(exc, "code", None) or getattr(exc, "status_code", None)


def _with_retry(op, label: str):
    """Exponential backoff on 429/503 (2s, 4s, 8s), as in the original service."""
    delays = [2, 4, 8]
    for attempt in range(4):
        try:
            return op()
        except AIError:
            raise
        except Exception as exc:
            msg = str(exc).lower()
            status = _status(exc)
            transient = status in (429, 503, 504) or any(s in msg for s in ("429", "503", "504", "deadline", "timed out", "timeout", "resource exhausted", "rate limit", "overloaded", "unavailable"))
            if transient and attempt < 3:
                time.sleep(delays[attempt])
                continue
            if "api_key_invalid" in msg or "api key not valid" in msg or (status in (401, 403) and "key" in msg):
                raise AIError("The Gemini API key is invalid. Put a real key in .env as GEMINI_API_KEY "
                              "(create one free at https://aistudio.google.com/apikey) and restart the server.") from exc
            if transient:
                raise AIError("AI processing is temporarily unavailable. Please try again in a few minutes.") from exc
            raise AIError(f"{label} failed: {exc}") from exc
    raise AIError("AI processing is temporarily unavailable. Please try again in a few minutes.")


def _generate_json(prompt: str, model_cls: Type[T], label: str) -> T:
    from google.genai import types

    client = _get_client()

    def call_model(model: str):
        try:
            resp = client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_json_schema=model_cls.model_json_schema(),
                ),
            )
        except Exception as exc:
            if _status(exc) == 400:  # schema rejected -> fall back to prompt-described JSON
                resp = client.models.generate_content(
                    model=model,
                    contents=prompt + "\n\nReturn ONLY valid JSON matching this JSON schema:\n" + json.dumps(model_cls.model_json_schema()),
                    config=types.GenerateContentConfig(response_mime_type="application/json"),
                )
            else:
                raise
        text = resp.text
        if not text:
            raise ValueError(f"Empty response received from Gemini during {label}.")
        return text

    last: Optional[AIError] = None
    text = None
    for model in _models():  # main model first, then backups if it is overloaded / retired
        try:
            text = _with_retry(lambda m=model: call_model(m), label)
            break
        except AIError as exc:
            last = exc
            if "invalid" in str(exc).lower() and "key" in str(exc).lower():
                raise
    if text is None:
        raise last or AIError(f"{label} failed.")
    try:
        return model_cls.model_validate(json.loads(text))
    except Exception as exc:
        raise AIError(f"{label} returned invalid JSON: {exc}") from exc


def generate_embedding(text: str) -> List[float]:
    from google.genai import types

    client = _get_client()

    def call():
        resp = client.models.embed_content(
            model=settings.GEMINI_EMBED_MODEL,
            contents=text,
            config=types.EmbedContentConfig(output_dimensionality=settings.EMBED_DIM),
        )
        vals = resp.embeddings[0].values if resp.embeddings else None
        if not vals:
            raise ValueError("Embedding generation returned empty values.")
        return [float(v) for v in vals]

    return _with_retry(call, "Gemini embedding generation")


def generate_embeddings_batch(texts: List[str]) -> List[List[float]]:
    """Embed many texts in one request (the API accepts a list). Returns one vector per input, in order."""
    from google.genai import types

    client = _get_client()

    def call():
        resp = client.models.embed_content(
            model=settings.GEMINI_EMBED_MODEL,
            contents=texts,
            config=types.EmbedContentConfig(output_dimensionality=settings.EMBED_DIM),
        )
        embs = resp.embeddings or []
        if len(embs) != len(texts) or any(not e.values for e in embs):
            raise ValueError("Batch embedding returned a different number of vectors than requested.")
        return [[float(v) for v in e.values] for e in embs]

    return _with_retry(call, "Gemini batch embedding")


def parse_resume(resume_text: str) -> ParsedCandidate:
    prompt = f"""
You are an expert recruitment parser. Analyze the following candidate resume text and extract all details according to the required schema.
Format the yearsOfExperience as a number. For education, categorize the school tier as either 'tier_1', 'tier_2', 'tier_3', 'tier_4', or 'unknown' (e.g. tier_1 for IITs, BITS, top tier universities; tier_2 for NITs, respectable state colleges; etc.).
If dates are incomplete, estimate or leave null. If details are missing, return null or empty lists, but adhere strictly to the schema structure.
For skills, estimate the active durationMonths based on the resume timeline, and assign a proficiency level ('beginner', 'intermediate', 'advanced', 'expert').

For careerHistory, extract all professional experiences, internships, training programs, roles, or volunteer/club involvements. If there is no dedicated 'Work Experience' or 'Employment' heading, look under sections like 'Achievements', 'Social Engagements and Experience', 'Experience', 'Volunteering', etc. to find these entries and parse them. Ensure to clean and format their company/organization and title names.

Resume Text:
{resume_text}
"""
    return _generate_json(prompt, ParsedCandidate, "Gemini resume parsing")


def parse_job_description(jd_text: str) -> ParsedJob:
    prompt = f"""
You are an expert recruitment parser. Analyze the following Job Description (JD) text and extract all parameters and preferences into the specified JSON structure.
Be thorough in extracting required vs. preferred technical skills, educational degrees, and universities (e.g., IIT, NIT, tier 1 colleges).
Estimate the minimum experienceYears required. Set preferProductCompany to true if there is any indication of preferring startups or product development over IT services/consulting.

Job Description:
{jd_text}
"""
    return _generate_json(prompt, ParsedJob, "Gemini job description parsing")


def generate_match_explanation(candidate: dict, job: dict, scores: dict) -> MatchExplanation:
    prompt = f"""
You are an expert recruiter and talent consultant. Write an Explainable AI (XAI) feedback report for the candidate based on their matching metrics against the job description.
Do not use generic empty sentences. Ground your feedback on specific facts (e.g., years of experience, current title, named skills, anomalies, or notice periods).

Job Title: {job['title']}
Job Description Overview:
{job['rawDescription'][:1500]}

Candidate Name: {candidate['name']}
Candidate Summary: {candidate.get('summary') or candidate.get('headline') or ''}
Key Resume Details:
{(candidate.get('rawResumeText') or '')[:2000]}

Scoring Metrics Breakdown (0.0 to 100.0 scale):
- Overall Fit Score: {scores['overallScore'] * 100:.1f}
- Semantic Resume Similarity: {scores['semanticSimilarity']:.1f}
- Technical Skill Match: {scores['skillMatchScore']:.1f}
- Experience & Seniority Score: {scores['experienceScore']:.1f}
- Education & College Score: {scores['educationScore']:.1f}
- Domain Alignment Score: {scores['domainScore']:.1f}
- Career Progression/Stability: {scores['careerProgressionScore']:.1f}
- Availability & Engagement Score: {scores['availabilityScore']:.1f}

Generate:
1. strengths (2-4 points citing facts)
2. weaknesses (1-3 points highlighting gaps or risks)
3. missingSkills (specific technical skills from the JD missing in the resume)
4. hiringRecommendation (a concise 2-3 sentence recruiter synthesis of final suitability)
5. improvementSuggestions (actionable suggestions for the candidate)
"""
    return _generate_json(prompt, MatchExplanation, "Gemini explainability report generation")
