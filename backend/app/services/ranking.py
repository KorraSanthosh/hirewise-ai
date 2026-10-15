"""Hybrid candidate scoring (port of src/services/ranking.service.ts).

Weights, bands and penalties are read from app/config/scoring_config.json
(a copy of scripts/config.json), so the old tuning carries over unchanged.
"""
import json
import math
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any, Dict, List, Optional

from app.core.config import settings
from app.services import anomaly

DEFAULT_CONFIG: Dict[str, Any] = {
    "weights": {"semantic": 0.20, "skills": 0.25, "experience": 0.20, "education": 0.10, "career_progression": 0.15, "availability": 0.10},
    "anomaly_penalties": {"HIGH": 0.0, "MEDIUM": 0.70, "LOW": 0.95, "CLEAN": 1.0},
    "consulting_filter": {
        "companies": ["tcs", "infosys", "wipro", "accenture", "cognizant", "capgemini", "tata consultancy services", "mindtree", "tech mahindra"],
        "penalty_multiplier": 0.50,
    },
    "experience_bands": {"target_min": 5.0, "target_max": 9.0, "under_qualified_penalty_per_year": 15.0, "over_qualified_penalty_per_year": 5.0},
    "education_scoring": {
        "tier_1": 100.0, "tier_2": 80.0, "tier_3": 60.0, "tier_4": 40.0, "unknown": 40.0, "cs_major_boost": 20.0,
        "cs_majors": ["computer science", "data science", "machine learning", "artificial intelligence", "mathematics", "statistics", "information technology"],
    },
    "availability_rules": {
        "notice_period_days": [{"limit": 30, "multiplier": 1.0}, {"limit": 60, "multiplier": 0.9}, {"limit": 90, "multiplier": 0.8}, {"limit": 180, "multiplier": 0.5}],
        "last_active_days": [{"limit": 30, "multiplier": 1.0}, {"limit": 90, "multiplier": 0.9}, {"limit": 180, "multiplier": 0.75}, {"limit": 9999, "multiplier": 0.5}],
        "response_rates": [{"limit": 0.70, "multiplier": 1.0}, {"limit": 0.30, "multiplier": 0.85}, {"limit": 0.00, "multiplier": 0.60}],
    },
}
WEIGHT_KEYS = ("semantic", "skills", "experience", "education", "career_progression", "availability")


@lru_cache(maxsize=1)
def load_config() -> Dict[str, Any]:
    cfg = json.loads(json.dumps(DEFAULT_CONFIG))
    path = settings.SCORING_CONFIG
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                for k, v in json.load(f).items():
                    cfg[k] = v
        except (OSError, ValueError):
            pass
    return cfg


@dataclass
class CandidateScoringInput:
    yearsOfExperience: float = 0.0
    skills: List[Any] = field(default_factory=list)
    careerHistory: List[Any] = field(default_factory=list)
    education: List[Any] = field(default_factory=list)
    noticePeriodDays: int = 0
    openToWork: bool = False
    lastActiveDate: Optional[datetime] = None
    profileCompleteness: float = 0.0
    connectionCount: int = 0
    recruiterResponseRate: float = 0.0
    embedding: Optional[List[float]] = None
    title: str = ""
    text: str = ""


@dataclass
class JobScoringInput:
    experienceYears: int = 0
    requiredSkills: List[str] = field(default_factory=list)
    preferredSkills: List[str] = field(default_factory=list)
    preferProductCompany: bool = False
    embedding: Optional[List[float]] = None
    title: str = ""
    text: str = ""


def _g(o, k, d=None):
    return o.get(k, d) if isinstance(o, dict) else getattr(o, k, d)


RELATED_ROLES = {
    "ML / AI Engineer": {"Data Scientist", "Data Engineer"},
    "Data Scientist": {"ML / AI Engineer", "Data / BI Analyst", "Data Engineer"},
    "Data Engineer": {"Data Scientist", "Backend / Full-stack", "Data / BI Analyst", "DevOps / Cloud", "ML / AI Engineer"},
    "Data / BI Analyst": {"Data Scientist", "Data Engineer"},
    "Backend / Full-stack": {"Frontend / UI", "DevOps / Cloud", "Data Engineer"},
    "Frontend / UI": {"Backend / Full-stack"},
    "DevOps / Cloud": {"Backend / Full-stack", "Data Engineer"},
}
_STOP = set("a an and are as at be by for from has have in is it of on or our that the their this to we will with you your "
            "years year experience work team strong good ability skills skill required preferred knowledge using use such "
            "etc plus role job candidate looking hiring build building working".split())


def _tokens(text: str):
    import re
    return [t for t in re.findall(r"[a-z0-9][a-z0-9\+#\.]*", (text or "").lower()) if len(t) > 1 and t not in _STOP]


def _bag(title: str, skills, text: str):
    from collections import Counter
    bag = Counter()
    for t in _tokens(title):
        bag[t] += 3.0
    for sk in skills:
        n = norm_skill(sk)
        if n:
            bag[n] += 2.0
            for t in _tokens(n):
                bag[t] += 1.0
    for t in _tokens(text):
        bag[t] += 1.0
    return {k: math.sqrt(v) for k, v in bag.items()}


def lexical_fit(cand: "CandidateScoringInput", job: "JobScoringInput") -> Optional[float]:
    """Free, local stand-in for the semantic score when embeddings are missing: role-category match (50%)
    plus keyword/skill cosine (50%). Returns None when there is no text to compare."""
    from app.services.categories import role_category
    cskills = [(_g(s, "name", "") or "") for s in cand.skills]
    if not (job.title or job.text or job.requiredSkills) or not (cand.title or cand.text or cskills):
        return None
    jskills = list(job.requiredSkills) + list(job.preferredSkills)
    jcat = role_category(job.title, job.requiredSkills)
    ccat = role_category(cand.title, cskills)
    cat = 100.0 if jcat == ccat and jcat != "Other" else 45.0 if ccat in RELATED_ROLES.get(jcat, set()) else 0.0
    if jcat == "Other":
        cat = 50.0
    a, b = _bag(job.title, jskills, job.text), _bag(cand.title, cskills, cand.text)
    dot = sum(v * b.get(k, 0.0) for k, v in a.items())
    na, nb = math.sqrt(sum(v * v for v in a.values())), math.sqrt(sum(v * v for v in b.values()))
    cos = dot / (na * nb) if na and nb else 0.0
    return min(100.0, 0.5 * cat + 0.5 * min(100.0, cos * 300.0))


def cosine_score(u, v) -> float:
    if not u or not v or len(u) != len(v):
        return 0.0
    dot = sum(a * b for a, b in zip(u, v))
    nu = math.sqrt(sum(a * a for a in u))
    nv = math.sqrt(sum(b * b for b in v))
    if nu == 0 or nv == 0:
        return 0.0
    return min(100.0, max(0.0, dot / (nu * nv) * 100.0))


SKILL_ALIASES = {
    "ml": "machine learning", "dl": "deep learning", "ai": "artificial intelligence",
    "nlp": "natural language processing", "cv": "computer vision", "llm": "large language models",
    "llms": "large language models", "genai": "generative ai", "gen ai": "generative ai",
    "stats": "statistics", "statistical analysis": "statistics", "statistical modeling": "statistics",
    "sklearn": "scikit-learn", "scikit learn": "scikit-learn", "tf": "tensorflow", "torch": "pytorch",
    "k8s": "kubernetes", "js": "javascript", "py": "python", "python3": "python",
    "postgres": "postgresql", "psql": "postgresql", "mongo": "mongodb", "powerbi": "power bi",
    "ms excel": "excel", "microsoft excel": "excel", "mlops": "mlops", "ml ops": "mlops",
    "data viz": "data visualization", "eda": "exploratory data analysis", "ab testing": "a/b testing",
    "a b testing": "a/b testing", "aws cloud": "aws", "amazon web services": "aws",
    "gcp": "google cloud", "google cloud platform": "google cloud", "node": "node.js", "nodejs": "node.js",
    "reactjs": "react", "react.js": "react", "rest api": "rest apis", "restful apis": "rest apis",
}


def norm_skill(name: str) -> str:
    n = (name or "").lower().strip().replace("_", " ")
    return SKILL_ALIASES.get(n, n)


def skill_score(cand_skills, required, preferred) -> float:
    have = {norm_skill(_g(s, "name", "") or "") for s in cand_skills}
    req = [norm_skill(s) for s in required if s and s.strip()]
    pref = [norm_skill(s) for s in preferred if s and s.strip()]
    if not req and not pref:
        return 100.0
    rs = sum(1 for s in req if s in have) / len(req) if req else 1.0
    ps = sum(1 for s in pref if s in have) / len(pref) if pref else 1.0
    return (rs * 0.80 + ps * 0.20) * 100.0


def experience_score(cand: CandidateScoringInput, job: JobScoringInput, cfg) -> float:
    bands = cfg["experience_bands"]
    yoe = cand.yearsOfExperience
    lo, hi = bands["target_min"], bands["target_max"]
    if job.experienceYears > 0:
        lo = job.experienceYears
        hi = lo + (bands["target_max"] - bands["target_min"])
    score = 100.0
    if yoe < lo:
        score -= (lo - yoe) * bands["under_qualified_penalty_per_year"]
    elif yoe > hi:
        score -= (yoe - hi) * bands["over_qualified_penalty_per_year"]
    score = max(0.0, score)
    if job.preferProductCompany:
        firms = [c.lower().strip() for c in cfg["consulting_filter"]["companies"]]
        has_c = has_p = False
        for role in cand.careerHistory:
            comp = (_g(role, "company", "") or "").lower().strip()
            if any(f in comp for f in firms):
                has_c = True
            else:
                has_p = True
        if has_c and not has_p:
            score *= cfg["consulting_filter"]["penalty_multiplier"]
    return score


def education_score(education, cfg) -> float:
    if not education:
        return 40.0
    es = cfg["education_scoring"]
    tiers = {k: es[k] for k in ("tier_1", "tier_2", "tier_3", "tier_4", "unknown")}
    majors = [m.lower().strip() for m in es["cs_majors"]]
    best = 0.0
    for sch in education:
        base = tiers.get((_g(sch, "tier", "unknown") or "unknown").lower().strip(), tiers["unknown"])
        field_ = (_g(sch, "fieldOfStudy", "") or "").lower().strip()
        if any(m in field_ for m in majors):
            base += es["cs_major_boost"]
        best = max(best, base)
    return min(100.0, best)


def domain_score(cand: CandidateScoringInput, job: JobScoringInput) -> float:
    terms = ["ai", "ml", "nlp", "data", "cloud", "search", "vector", "vision", "deep learning", "found founding", "product", "saas"]
    jd_text = (" ".join(job.requiredSkills) + " " + " ".join(job.preferredSkills)).lower()
    hist = " ".join(f"{_g(j, 'title', '')} {_g(j, 'company', '')}" for j in cand.careerHistory).lower()
    n = sum(1 for t in terms if t in jd_text and t in hist)
    return min(100.0, max(0.0, 50.0 + n * 5.0))


def career_progression_score(history) -> float:
    if not history:
        return 50.0
    avg = sum((_g(j, "durationMonths", 0) or 0) for j in history) / len(history)
    tenure = 100.0 if avg >= 36 else 90.0 if avg >= 24 else 70.0 if avg >= 12 else 40.0

    def key(j):
        d = _g(j, "startDate")
        if isinstance(d, str):
            try:
                d = datetime.fromisoformat(d.replace("Z", "+00:00")).replace(tzinfo=None)
            except ValueError:
                d = None
        return d.timestamp() if isinstance(d, datetime) else 0

    kws = ["lead", "senior", "head", "architect", "principal", "manager", "director"]
    prog, prev = 0, -1
    for j in sorted(history, key=key):
        title = (_g(j, "title", "") or "").lower()
        level = 0
        for i, kw in enumerate(kws):
            if kw in title:
                level = i + 1
                break
        if level > prev and prev != -1:
            prog += 1
        prev = max(prev, level)
    progression = min(100.0, 50.0 + prog * 25.0)
    return tenure * 0.60 + progression * 0.40


def availability_score(cand: CandidateScoringInput, cfg) -> float:
    rules = cfg["availability_rules"]
    notice_m = 0.50
    for r in rules["notice_period_days"]:
        if cand.noticePeriodDays <= r["limit"]:
            notice_m = r["multiplier"]
            break
    days = 365
    if cand.lastActiveDate:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        days = math.ceil(abs((now - cand.lastActiveDate.replace(tzinfo=None)).total_seconds()) / 86400)
    elif cand.openToWork:
        days = 15
    active_m = 0.50
    for r in rules["last_active_days"]:
        if days <= r["limit"]:
            active_m = r["multiplier"]
            break
    resp_m = 0.60
    for r in rules["response_rates"]:
        if cand.recruiterResponseRate >= r["limit"]:
            resp_m = r["multiplier"]
            break
    return notice_m * active_m * resp_m * 100.0


def score_candidate(cand: CandidateScoringInput, job: JobScoringInput,
                    custom_weights: Optional[Dict[str, float]] = None,
                    semantic: Optional[float] = None) -> Dict[str, float]:
    """`semantic` lets the caller pass a similarity computed in SQL (pgvector) instead of in Python."""
    cfg = load_config()
    weights = {k: cfg["weights"].get(k, DEFAULT_CONFIG["weights"][k]) for k in WEIGHT_KEYS}
    if custom_weights:
        weights.update({k: v for k, v in custom_weights.items() if k in WEIGHT_KEYS and v is not None})

    # Semantic similarity is only meaningful when both vectors exist; otherwise drop it and renormalise the other
    # weights (so candidates imported without embeddings are not unfairly pushed down by a 0 semantic score).
    if semantic is None:
        sem_ok = bool(cand.embedding and job.embedding and len(cand.embedding) == len(job.embedding))
        sem = cosine_score(cand.embedding, job.embedding) if sem_ok else 0.0
    else:
        sem_ok = semantic >= 0
        sem = semantic if sem_ok else 0.0
    if not sem_ok:
        lex = lexical_fit(cand, job)
        if lex is not None:
            sem, sem_ok = lex, True
    if not sem_ok:
        others = [k for k in WEIGHT_KEYS if k != "semantic"]
        total_all, total_others = sum(weights[k] for k in WEIGHT_KEYS), sum(weights[k] for k in others)
        scale = (total_all / total_others) if total_others > 0 else 0.0
        weights = {k: (0.0 if k == "semantic" else weights[k] * scale) for k in WEIGHT_KEYS}
    sk = skill_score(cand.skills, job.requiredSkills, job.preferredSkills)
    ex = experience_score(cand, job, cfg)
    ed = education_score(cand.education, cfg)
    dm = domain_score(cand, job)
    cp = career_progression_score(cand.careerHistory)
    av = availability_score(cand, cfg)

    base = (sem * weights["semantic"] + sk * weights["skills"] + ex * weights["experience"]
            + ed * weights["education"] + cp * weights["career_progression"] + av * weights["availability"])

    pro_months = sum((_g(j, "durationMonths", 0) or 0) for j in cand.careerHistory if anomaly.is_professional_experience(j))
    adj_yoe = max(cand.yearsOfExperience, pro_months / 12)
    res = anomaly.check_candidate({
        "yearsOfExperience": adj_yoe, "skills": cand.skills, "careerHistory": cand.careerHistory,
        "education": cand.education, "noticePeriodDays": cand.noticePeriodDays, "openToWork": cand.openToWork,
        "lastActiveDate": cand.lastActiveDate, "profileCompleteness": cand.profileCompleteness,
        "connectionCount": cand.connectionCount,
    })
    penalty = cfg["anomaly_penalties"].get(res["status"], 1.0)
    overall = min(1.0, max(0.0, base * penalty / 100.0))
    return {
        "overallScore": overall, "semanticSimilarity": sem, "skillMatchScore": sk, "experienceScore": ex,
        "educationScore": ed, "domainScore": dm, "careerProgressionScore": cp, "availabilityScore": av,
        "anomalyStatus": res["status"], "anomalyReasons": res["reasons"],
    }
