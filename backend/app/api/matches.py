from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user, recruiter_or_admin, require_roles
from app.core.errors import NotFoundError, ValidationError
from app.db.session import get_db
from app.models import Candidate, Job, Match, User
from app.schemas import ApplyIn, MatchPatchIn
from app.services import gemini, matching
from app.services.photos import photo_url
from app.services.serializers import ser

router = APIRouter(prefix="/api/matches", tags=["matches"])


@router.get("")
def list_matches(jobId: Optional[str] = None, limit: int = 500, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = select(Match).order_by(Match.overallScore.desc()).options(
        selectinload(Match.candidate).selectinload(Candidate.skills), selectinload(Match.job))
    if user.role == "candidate":
        cand = db.execute(select(Candidate).where(Candidate.userId == user.id)).scalars().first()
        if not cand:
            return []
        q = q.where(Match.candidateId == cand.id)
    else:
        if jobId:
            q = q.where(Match.jobId == jobId)
        q = q.limit(max(1, min(limit, 2000)))
    out = []
    for m in db.execute(q).scalars():
        d = ser(m, {"candidate": {"skills": None}, "job": None})
        if d.get("candidate"):
            d["candidate"]["photoUrl"] = photo_url(m.candidateId)
        out.append(d)
    return out


@router.post("", status_code=201)
def apply_for_job(body: ApplyIn, db: Session = Depends(get_db), user: User = Depends(require_roles("candidate"))):
    cand = db.execute(select(Candidate).where(Candidate.userId == user.id)).scalars().first()
    if not cand or not (cand.rawResumeText or "").strip():
        raise ValidationError("No resume profile found. Please upload your resume first.")
    if not db.get(Job, body.jobId):
        raise NotFoundError("Job not found")
    matching.run_candidate_matching(db, cand.id, only_job_id=body.jobId)
    match = db.execute(select(Match).where(Match.jobId == body.jobId, Match.candidateId == cand.id)).scalar_one()
    return {"success": True, "match": ser(match)}


@router.patch("/{match_id}")
def update_match(match_id: str, body: MatchPatchIn, db: Session = Depends(get_db), _: User = Depends(recruiter_or_admin)):
    data = body.model_dump(exclude_none=True)
    if not data:
        raise ValidationError("Either recruiterStatus or recruiterNotes must be provided")
    match = db.get(Match, match_id)
    if not match:
        raise NotFoundError("Match not found")
    for k, v in data.items():
        setattr(match, k, v)
    db.commit()
    db.refresh(match)
    return ser(match)


@router.post("/{match_id}/explain")
def explain_match(match_id: str, db: Session = Depends(get_db), _: User = Depends(recruiter_or_admin)):
    match = db.execute(select(Match).where(Match.id == match_id).options(selectinload(Match.candidate), selectinload(Match.job))).scalar_one_or_none()
    if not match:
        raise NotFoundError(f"Match report with ID {match_id} was not found.")
    scores = {k: getattr(match, k) for k in ("overallScore", "semanticSimilarity", "skillMatchScore", "experienceScore",
                                              "educationScore", "domainScore", "careerProgressionScore", "availabilityScore")}
    exp = gemini.generate_match_explanation(
        {"name": match.candidate.name, "headline": match.candidate.headline, "summary": match.candidate.summary, "rawResumeText": match.candidate.rawResumeText},
        {"title": match.job.title, "rawDescription": match.job.rawDescription}, scores)
    match.strengths, match.weaknesses, match.missingSkills = exp.strengths, exp.weaknesses, exp.missingSkills
    match.hiringRecommendation, match.improvementSuggestions = exp.hiringRecommendation, exp.improvementSuggestions
    db.commit()
    db.refresh(match)
    return {"success": True, "message": "Explainable AI report generated successfully.", "data": {
        "id": match.id,
        "candidate": ser(match.candidate, only=["id", "candidateId", "name", "headline"]),
        "job": ser(match.job, only=["id", "title", "company"]),
        "scores": {"overall": match.overallScore, "semantic": match.semanticSimilarity, "skills": match.skillMatchScore,
                   "experience": match.experienceScore, "education": match.educationScore, "domain": match.domainScore,
                   "careerProgression": match.careerProgressionScore, "availability": match.availabilityScore},
        "explainability": {"strengths": match.strengths, "weaknesses": match.weaknesses, "missingSkills": match.missingSkills,
                           "hiringRecommendation": match.hiringRecommendation, "improvementSuggestions": match.improvementSuggestions}}}
