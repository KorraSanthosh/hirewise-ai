"""Matching orchestration (port of src/services/matching.service.ts) on SQLAlchemy + pgvector."""
import random
import re
from datetime import datetime
from typing import Dict, List, Optional

from sqlalchemy import select, text
from sqlalchemy.orm import Session, selectinload

from app.core.errors import NotFoundError
from app.models import CareerHistory, Candidate, Education, Job, Match, Skill, User
from app.services import anomaly, gemini
from app.services.ranking import CandidateScoringInput, JobScoringInput, cosine_score, score_candidate

CHUNK = 500


# ---------------------------------------------------------------- helpers
def _clean_str(v) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    return None if s.lower() in ("", "null", "undefined") else s


def _parse_date(v) -> Optional[datetime]:
    s = _clean_str(v)
    if not s or s.lower() in ("present", "current"):
        return None
    for fmt in ("%Y-%m-%d", "%Y-%m", "%Y", "%b %Y", "%B %Y", "%m/%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        return None


def format_candidate_name(name: str) -> str:
    if not name:
        return ""
    name = re.sub(r"([a-z])([A-Z])", r"\1 \2", name)
    name = re.sub(r"([A-Z])([A-Z][a-z])", r"\1 \2", name)
    return name.strip()


def _vec_literal(vec: List[float]) -> str:
    return "[" + ",".join(repr(float(x)) for x in vec) + "]"


def candidate_input(c: Candidate) -> CandidateScoringInput:
    return CandidateScoringInput(
        yearsOfExperience=c.yearsOfExperience, skills=list(c.skills), careerHistory=list(c.careerHistory),
        education=list(c.education), noticePeriodDays=c.noticePeriodDays, openToWork=c.openToWork,
        lastActiveDate=c.lastActiveDate, profileCompleteness=c.profileCompleteness,
        connectionCount=c.connectionCount, recruiterResponseRate=c.recruiterResponse,
        title=c.currentTitle or "",
        text=" ".join([c.headline or "", c.summary or ""] + [(h.title or "") for h in c.careerHistory]),
    )


def job_input(j: Job, embedding: Optional[List[float]]) -> JobScoringInput:
    return JobScoringInput(
        experienceYears=j.experienceYears, requiredSkills=list(j.requiredSkills or []),
        preferredSkills=list(j.preferredSkills or []), preferProductCompany=j.preferProductCompany,
        embedding=embedding, title=j.title or "", text=(j.rawDescription or "")[:2500],
    )


def _rule_based_text(cand: Candidate, job: Job, b: dict):
    strengths, weaknesses, missing = [], [], []
    have = {s.name.lower().strip() for s in cand.skills}
    for req in job.requiredSkills or []:
        if req.lower().strip() not in have:
            missing.append(req)
    if b["skillMatchScore"] >= 80:
        strengths.append("Technical skill alignment is exceptionally strong.")
    if b["experienceScore"] >= 90:
        strengths.append(f"Stated {cand.yearsOfExperience} YOE matches target band.")
    if b["educationScore"] >= 80:
        strengths.append("Candidate attended a premier academic institution.")
    if cand.noticePeriodDays >= 90:
        weaknesses.append(f"Notice period of {cand.noticePeriodDays} days poses transition risk.")
    if b["experienceScore"] < 60:
        weaknesses.append("Experience falls outside the optimal range requested in the JD.")
    if missing:
        weaknesses.append(f"Missing some required skills: {', '.join(missing[:3])}.")
    rec = (f"Candidate {cand.name} exhibits an overall fit of {b['overallScore'] * 100:.1f}%. "
           f"Key skills are {', '.join(s.name for s in cand.skills[:3])}.")
    return strengths, weaknesses, missing, rec


def _apply_scores(m: Match, b: dict):
    for k in ("overallScore", "semanticSimilarity", "skillMatchScore", "experienceScore", "educationScore",
              "domainScore", "careerProgressionScore", "availabilityScore"):
        setattr(m, k, b[k])


# ---------------------------------------------------------------- embeddings / pgvector
def get_embedding(db: Session, model, row_id: str) -> Optional[List[float]]:
    return db.execute(select(model.embedding).where(model.id == row_id)).scalar_one_or_none()


def semantic_scores_for_job(db: Session, job_vec: Optional[List[float]]) -> Dict[str, float]:
    """candidate.id -> cosine similarity (0..100). Uses pgvector's `<=>` operator inside Postgres."""
    if not job_vec:
        return {}
    if db.bind.dialect.name == "postgresql":
        rows = db.execute(
            text('SELECT "id", 1 - ("embedding" <=> CAST(:v AS vector)) AS sim FROM "Candidate" WHERE "embedding" IS NOT NULL'),
            {"v": _vec_literal(job_vec)},
        ).all()
        return {r[0]: min(100.0, max(0.0, float(r[1]) * 100.0)) for r in rows}
    rows = db.execute(select(Candidate.id, Candidate.embedding).where(Candidate.embedding.is_not(None))).all()
    return {r[0]: cosine_score(r[1], job_vec) for r in rows}


# ---------------------------------------------------------------- job creation
def create_job(db: Session, user_id: str, raw_description: str, meta: Optional[dict] = None) -> Job:
    meta = meta or {}
    parsed = gemini.parse_job_description(raw_description)
    embedding = gemini.generate_embedding(raw_description)
    job = Job(
        userId=user_id,
        title=meta.get("title") or parsed.title or "Untitled Role",
        company=meta.get("company") or parsed.company or "Unknown Company",
        department=meta.get("department") or parsed.department or "General",
        rawDescription=raw_description,
        requiredSkills=parsed.requiredSkills, preferredSkills=parsed.preferredSkills,
        responsibilities=parsed.responsibilities, experienceYears=parsed.experienceYears,
        educationLevel=parsed.educationLevel, seniority=parsed.seniority, domain=parsed.domain,
        softSkills=parsed.softSkills, preferProductCompany=parsed.preferProductCompany,
        preferredDegrees=parsed.preferredDegrees, preferredUniversities=parsed.preferredUniversities,
        embedding=embedding,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def reparse_job(db: Session, job: Job, raw_description: str) -> None:
    parsed = gemini.parse_job_description(raw_description)
    job.requiredSkills = parsed.requiredSkills
    job.preferredSkills = parsed.preferredSkills
    job.responsibilities = parsed.responsibilities
    job.softSkills = parsed.softSkills
    job.preferProductCompany = parsed.preferProductCompany
    job.preferredDegrees = parsed.preferredDegrees
    job.preferredUniversities = parsed.preferredUniversities
    job.embedding = gemini.generate_embedding(raw_description)


# ---------------------------------------------------------------- candidate creation
def _unique_candidate_id(db: Session) -> str:
    for _ in range(10):
        cid = f"CAND_{random.randint(1000000, 9999999)}"
        if db.execute(select(Candidate.id).where(Candidate.candidateId == cid)).first() is None:
            return cid
    raise RuntimeError("Failed to generate a unique candidate ID after 10 attempts.")


def find_duplicate_resume(db: Session, raw_resume_text: str) -> Optional[Candidate]:
    """An earlier candidate record created from exactly the same resume text, if any."""
    return db.execute(select(Candidate).where(Candidate.rawResumeText == raw_resume_text).order_by(Candidate.createdAt)).scalars().first()


def create_candidate_profile(db: Session, user: User, raw_resume_text: str, *, reuse_existing: bool) -> Candidate:
    """Parse a resume with Gemini and store the profile.

    reuse_existing=True  -> a candidate-role user updates their own single profile (original behaviour)
    reuse_existing=False -> a recruiter/admin upload always creates a new candidate record
    """
    existing = None
    if reuse_existing:
        existing = db.execute(select(Candidate).where(Candidate.userId == user.id)).scalars().first()

    parsed = gemini.parse_resume(raw_resume_text)
    embedding = gemini.generate_embedding(raw_resume_text)
    p = parsed.profile
    summary = _clean_str(p.summary)
    fields = dict(
        name=format_candidate_name(p.anonymizedName or (existing.name if existing else "")),
        rawResumeText=raw_resume_text, headline=p.headline, summary=summary, location=p.location,
        country=p.country, yearsOfExperience=float(p.yearsOfExperience or 0), currentTitle=p.currentTitle,
        currentCompany=p.currentCompany, currentCompanySize=p.currentCompanySize, currentIndustry=p.currentIndustry,
        profileCompleteness=100.0 if existing else 85.0, openToWork=True,
    )
    if existing:
        db.query(Skill).filter(Skill.candidateId == existing.id).delete()
        db.query(CareerHistory).filter(CareerHistory.candidateId == existing.id).delete()
        db.query(Education).filter(Education.candidateId == existing.id).delete()
        for k, v in fields.items():
            setattr(existing, k, v)
        if existing.connectionCount == 0:  # skeleton profile created at registration: give it the same signal defaults
            existing.noticePeriodDays, existing.connectionCount = 30, 150
            existing.recruiterResponse, existing.avgResponseTime = 0.85, 24.0
        cand = existing
    else:
        cand = Candidate(
            userId=user.id, candidateId=_unique_candidate_id(db), email=user.email if user.role == "candidate" else None,
            noticePeriodDays=30, connectionCount=150, recruiterResponse=0.85, avgResponseTime=24.0, **fields,
        )
        db.add(cand)
        db.flush()
    cand.embedding = embedding

    for s in parsed.skills:
        db.add(Skill(candidateId=cand.id, name=s.name, proficiency=s.proficiency, endorsements=s.endorsements or 0, durationMonths=s.durationMonths or 0))
    for ch in parsed.careerHistory:
        start = _parse_date(ch.startDate)
        end = _parse_date(ch.endDate)
        is_current = bool(ch.isCurrent)
        if end is None:
            is_current = True
        db.add(CareerHistory(
            candidateId=cand.id, company=_clean_str(ch.company) or "Unknown Company", title=_clean_str(ch.title) or "Unknown Title",
            startDate=start, endDate=end, durationMonths=ch.durationMonths or 0, isCurrent=is_current,
            industry=_clean_str(ch.industry), companySize=_clean_str(ch.companySize), description=_clean_str(ch.description),
        ))
    for e in parsed.education:
        db.add(Education(candidateId=cand.id, institution=e.institution, degree=e.degree, fieldOfStudy=e.fieldOfStudy,
                         startYear=e.startYear, endYear=e.endYear, grade=e.grade, tier=e.tier if e.tier in ("tier_1", "tier_2", "tier_3", "tier_4") else "unknown"))
    db.flush()
    db.refresh(cand)

    res = anomaly.check_candidate({
        "yearsOfExperience": cand.yearsOfExperience, "skills": cand.skills, "careerHistory": cand.careerHistory,
        "education": cand.education, "noticePeriodDays": cand.noticePeriodDays, "openToWork": cand.openToWork,
        "profileCompleteness": cand.profileCompleteness, "connectionCount": cand.connectionCount,
    })
    cand.anomalyStatus, cand.anomalyReasons = res["status"], res["reasons"]
    db.commit()
    db.refresh(cand)
    run_candidate_matching(db, cand.id)
    return cand


# ---------------------------------------------------------------- matching
def run_job_matching(db: Session, job_id: str, custom_weights: Optional[Dict[str, float]] = None) -> int:
    job = db.get(Job, job_id)
    if not job:
        raise NotFoundError(f"Job Description with ID {job_id} was not found.")
    job_vec = get_embedding(db, Job, job_id)
    jin = job_input(job, job_vec)
    sem = semantic_scores_for_job(db, job_vec)
    existing = {m.candidateId: m for m in db.execute(select(Match).where(Match.jobId == job_id)).scalars()}

    cand_ids = [r[0] for r in db.execute(select(Candidate.id).order_by(Candidate.id)).all()]
    count = 0
    for i in range(0, len(cand_ids), CHUNK):
        chunk = cand_ids[i:i + CHUNK]
        cands = db.execute(
            select(Candidate).where(Candidate.id.in_(chunk))
            .options(selectinload(Candidate.skills), selectinload(Candidate.careerHistory), selectinload(Candidate.education))
        ).scalars().all()
        for cand in cands:
            b = score_candidate(candidate_input(cand), jin, custom_weights, semantic=sem.get(cand.id, -1.0) if job_vec else -1.0)
            m = existing.get(cand.id)
            if m is None:
                strengths, weaknesses, missing, rec = _rule_based_text(cand, job, b)
                m = Match(jobId=job.id, candidateId=cand.id, strengths=strengths, weaknesses=weaknesses, missingSkills=missing,
                          hiringRecommendation=rec,
                          improvementSuggestions=["Consider highlighting missing technical projects in your resume.",
                                                  "Connect credentials or GitHub profile to improve verification signals."],
                          **{k: b[k] for k in ("overallScore", "semanticSimilarity", "skillMatchScore", "experienceScore",
                                               "educationScore", "domainScore", "careerProgressionScore", "availabilityScore")})
                db.add(m)
                existing[cand.id] = m
            else:
                _apply_scores(m, b)  # keep recruiter status/notes and any Gemini-written explanation
            count += 1
        db.commit()
        db.expire_all()
    return count


def run_candidate_matching(db: Session, candidate_row_id: str, only_job_id: Optional[str] = None) -> int:
    cand = db.execute(
        select(Candidate).where(Candidate.id == candidate_row_id)
        .options(selectinload(Candidate.skills), selectinload(Candidate.careerHistory), selectinload(Candidate.education))
    ).scalar_one_or_none()
    if not cand:
        raise NotFoundError(f"Candidate not found for ID: {candidate_row_id}")
    cand_vec = get_embedding(db, Candidate, cand.id)
    cin = candidate_input(cand)
    cin.embedding = cand_vec
    existing = {m.jobId: m for m in db.execute(select(Match).where(Match.candidateId == cand.id)).scalars()}
    count = 0
    jobs_q = select(Job) if not only_job_id else select(Job).where(Job.id == only_job_id)
    for job in db.execute(jobs_q).scalars().all():
        b = score_candidate(cin, job_input(job, get_embedding(db, Job, job.id)))
        strengths, weaknesses, missing, rec = _rule_based_text(cand, job, b)
        m = existing.get(job.id)
        if m is None:
            m = Match(jobId=job.id, candidateId=cand.id, **{k: b[k] for k in (
                "overallScore", "semanticSimilarity", "skillMatchScore", "experienceScore", "educationScore",
                "domainScore", "careerProgressionScore", "availabilityScore")})
            db.add(m)
        else:
            _apply_scores(m, b)
        m.strengths, m.weaknesses, m.missingSkills, m.hiringRecommendation = strengths, weaknesses, missing, rec
        count += 1
    db.commit()
    return count
