"""Honeypot / trap detection (port of src/services/anomaly.service.ts)."""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

NON_PROFESSIONAL = [
    "volunteer", "volunteering", "ngo", "foundation", "charity", "nonprofit", "non-profit", "social work",
    "student organization", "student activities", "student activity", "campus activity", "campus activities",
    "student club", "club", "society", "campus ambassador", "student lead", "student representative",
    "campus leader", "extracurricular", "chapter lead", "student chapter", "university chapter",
    "open source", "open-source", "summer of code", "contributor",
    "community organization", "community service",
]


def _dt(v: Any) -> Optional[datetime]:
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.replace(tzinfo=None)
    try:
        return datetime.fromisoformat(str(v).replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        return None


def _get(o: Any, k: str, default=None):
    return o.get(k, default) if isinstance(o, dict) else getattr(o, k, default)


def is_professional_experience(job: Any) -> bool:
    t = (_get(job, "title", "") or "").lower()
    c = (_get(job, "company", "") or "").lower()
    return not any(k in t or k in c for k in NON_PROFESSIONAL)


def check_candidate(cand: Dict[str, Any]) -> Dict[str, Any]:
    reasons: List[str] = []
    status = "CLEAN"
    yoe = float(cand.get("yearsOfExperience") or 0)
    yoe_months = yoe * 12
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    career = cand.get("careerHistory") or []
    education = cand.get("education") or []
    skills = cand.get("skills") or []

    # ---- HIGH: chronologically / mathematically impossible
    for job in career:
        if not is_professional_experience(job):
            continue
        company = _get(job, "company")
        if (_get(job, "durationMonths", 0) or 0) > yoe_months + 2:
            status = "HIGH"
            reasons.append(f"Stated job duration at '{company}' ({_get(job, 'durationMonths')}m) exceeds total years of experience ({yoe}y)")
        start, end = _dt(_get(job, "startDate")), _dt(_get(job, "endDate"))
        if start and end and start > end:
            status = "HIGH"
            reasons.append(f"Logical Date Mismatch: Job at '{company}' start date ({start.date()}) occurs after end date ({end.date()})")
        if start and start > now:
            status = "HIGH"
            reasons.append(f"Future Work History: Job at '{company}' start date is in the future ({start.date()})")

    for edu in education:
        sy, ey = _get(edu, "startYear"), _get(edu, "endYear")
        if sy and ey and sy > ey:
            status = "HIGH"
            reasons.append(f"Logical Education Mismatch: Degree at '{_get(edu, 'institution')}' starts ({sy}) after it ends ({ey})")

    work_years = [d.year for d in (_dt(_get(j, "startDate")) for j in career if is_professional_experience(j)) if d]
    edu_years = [y for y in (_get(e, "startYear") for e in education) if isinstance(y, int) and y > 1900]
    if work_years and edu_years and min(edu_years) - min(work_years) > 6:
        status = "HIGH"
        reasons.append(f"Chronological Conflict: Stated work history started in {min(work_years)}, but university education didn't begin until {min(edu_years)}")

    if status == "HIGH":
        return {"status": status, "reasons": reasons}

    # ---- MEDIUM: suspicious
    zero = [s for s in skills if (_get(s, "proficiency", "") or "").lower() in ("expert", "advanced") and (_get(s, "durationMonths", 0) or 0) == 0]
    if len(zero) >= 5:
        status = "MEDIUM"
        reasons.append(f"Skill Inflation Trap: Candidate lists {len(zero)} expert/advanced skills with 0 months of active usage")
    notice = cand.get("noticePeriodDays") or 0
    if notice >= 120 and cand.get("openToWork"):
        status = "MEDIUM"
        reasons.append(f"Availability Conflict: Candidate is marked 'Open to Work' but has a notice period of {notice} days")
    total = sum((_get(j, "durationMonths", 0) or 0) for j in career if is_professional_experience(j))
    if total > yoe_months + 24:
        status = "MEDIUM"
        reasons.append(f"Experience Cumulative Overlap: Cumulative job history durations ({total}m) significantly exceed stated YOE ({yoe}y)")
    if status == "MEDIUM":
        return {"status": status, "reasons": reasons}

    # ---- LOW: warnings
    pc = cand.get("profileCompleteness")
    if pc is not None and pc < 50:
        status = "LOW"
        reasons.append(f"Incomplete Profile: Stated completeness is under 50% ({pc}%)")
    la = _dt(cand.get("lastActiveDate"))
    if la:
        days = abs((now - la).days)
        if days > 180:
            status = "LOW"
            reasons.append(f"Inactive Account: Stated last active date was {days} days ago")
    if len(education) == 0:
        status = "LOW"
        reasons.append("Missing Education: Profile lists no formal education history")
    if cand.get("connectionCount") == 0:
        status = "LOW"
        reasons.append("Unconnected Profile: Profile has zero connections on the network")
    return {"status": status, "reasons": reasons}
