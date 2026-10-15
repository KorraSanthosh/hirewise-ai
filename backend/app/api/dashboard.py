from datetime import datetime, timedelta, timezone

from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import recruiter_or_admin
from app.db.session import get_db
from app.models import Candidate, Job, Match, User
from app.services.categories import CATEGORIES, role_category
from app.services.photos import photo_url

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"], dependencies=[Depends(recruiter_or_admin)])


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    week_ago = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=7)
    avg = db.execute(select(func.avg(Match.overallScore))).scalar() or 0
    return {
        "totalCandidates": db.execute(select(func.count(Candidate.id))).scalar(),
        "activeJobs": db.execute(select(func.count(Job.id))).scalar(),
        "averageAIScore": round(float(avg) * 100, 1),
        "shortlisted": db.execute(select(func.count(Match.id)).where(Match.recruiterStatus == "SHORTLISTED")).scalar(),
        "recentUploads": db.execute(select(func.count(Candidate.id)).where(Candidate.createdAt >= week_ago)).scalar(),
    }


@router.get("/analytics")
def analytics(db: Session = Depends(get_db)):
    def count(*conds):
        return db.execute(select(func.count(Match.id)).where(*conds)).scalar()

    pipeline = [{"stage": s.capitalize(), "candidates": count(Match.recruiterStatus == s)} for s in ("PENDING", "SHORTLISTED", "REJECTED")]
    dist = [
        {"range": "90–100", "candidates": count(Match.overallScore >= 0.90, Match.overallScore <= 1.0)},
        {"range": "80–89", "candidates": count(Match.overallScore >= 0.80, Match.overallScore < 0.90)},
        {"range": "70–79", "candidates": count(Match.overallScore >= 0.70, Match.overallScore < 0.80)},
        {"range": "60–69", "candidates": count(Match.overallScore >= 0.60, Match.overallScore < 0.70)},
        {"range": "Below 60", "candidates": count(Match.overallScore < 0.60)},
    ]
    return {"pipeline": pipeline, "distribution": dist}


def _best_match_per_candidate(db: Session):
    """One row per candidate: their best-scoring match, with skills loaded (used for role grouping)."""
    rows = db.execute(select(Match).order_by(Match.overallScore.desc())
                      .options(selectinload(Match.candidate).selectinload(Candidate.skills))).scalars().all()
    seen, out = set(), []
    for m in rows:
        if m.candidateId in seen:
            continue
        seen.add(m.candidateId)
        out.append(m)
    return out


def _cat(m: Match) -> str:
    return role_category(m.candidate.currentTitle or "", [s.name for s in m.candidate.skills])


@router.get("/categories")
def categories(db: Session = Depends(get_db)):
    """Role-wise overview: how many candidates, how many shortlisted and the average score per role category."""
    agg = {c: {"category": c, "candidates": 0, "shortlisted": 0, "pending": 0, "rejected": 0, "_sum": 0.0, "topScore": 0.0} for c in CATEGORIES}
    for m in _best_match_per_candidate(db):
        a = agg[_cat(m)]
        a["candidates"] += 1
        a["_sum"] += m.overallScore
        a["topScore"] = max(a["topScore"], m.overallScore * 100)
        key = {"SHORTLISTED": "shortlisted", "REJECTED": "rejected"}.get(m.recruiterStatus, "pending")
        a[key] += 1
    out = []
    for a in agg.values():
        if a["candidates"]:
            a["avgScore"] = round(a.pop("_sum") / a["candidates"] * 100, 1)
            a["topScore"] = round(a["topScore"], 1)
            out.append(a)
    return sorted(out, key=lambda a: (-a["candidates"], a["category"]))


@router.get("/candidates")
def top_candidates(category: Optional[str] = None, status: Optional[str] = None, limit: int = 10, db: Session = Depends(get_db)):
    """Top matches, optionally filtered by role category and recruiter status (SHORTLISTED / PENDING / REJECTED)."""
    limit = max(1, min(limit, 100))
    if not category and not status:
        rows = db.execute(select(Match).order_by(Match.overallScore.desc()).limit(limit)
                          .options(selectinload(Match.candidate).selectinload(Candidate.skills))).scalars().all()
    else:
        rows = _best_match_per_candidate(db)
        if category:
            rows = [m for m in rows if _cat(m) == category]
        if status:
            rows = [m for m in rows if m.recruiterStatus == status.upper()]
        rows = rows[:limit]
    return [{
        "matchId": m.id, "candidateId": m.candidateId, "name": m.candidate.name,
        "yearsOfExperience": m.candidate.yearsOfExperience, "overallScore": m.overallScore * 100,
        "recruiterStatus": m.recruiterStatus, "currentTitle": m.candidate.currentTitle,
        "currentCompany": m.candidate.currentCompany, "category": _cat(m), "photoUrl": photo_url(m.candidateId), "createdAt": m.createdAt.isoformat() + "Z",
    } for m in rows]
