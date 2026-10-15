from typing import Optional

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user, recruiter_or_admin
from app.core.errors import NotFoundError, ValidationError
from app.db.session import get_db
from app.models import Candidate, Job, Match, User
from app.schemas import JobCreateIn, JobUpdateIn, RankIn
from app.services import matching, pdf_parser
from app.services.serializers import ser

router = APIRouter(prefix="/api/jobs", tags=["jobs"])

OVERRIDES = ("experienceYears", "educationLevel", "seniority", "domain")


def _get_job(db: Session, job_id: str) -> Job:
    job = db.get(Job, job_id)
    if not job:
        raise NotFoundError("Job not found")
    return job


@router.get("")
def list_jobs(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return [ser(j) for j in db.execute(select(Job).order_by(Job.createdAt.desc())).scalars()]


@router.post("", status_code=201)
def create_job(body: JobCreateIn, db: Session = Depends(get_db), user: User = Depends(recruiter_or_admin)):
    job = matching.create_job(db, user.id, body.rawDescription, {"title": body.title, "company": body.company, "department": body.department})
    changed = False
    for k in OVERRIDES:
        v = getattr(body, k)
        if v is not None:
            setattr(job, k, v)
            changed = True
    if changed:
        db.commit()
        db.refresh(job)
    return ser(job)


@router.post("/upload", status_code=201)
def upload_job(body: JobCreateIn, db: Session = Depends(get_db), user: User = Depends(recruiter_or_admin)):
    job = matching.create_job(db, user.id, body.rawDescription, {"title": body.title, "company": body.company, "department": body.department})
    return {"success": True, "message": "Job Description parsed and created successfully.",
            "data": ser(job, only=["id", "title", "company", "department", "requiredSkills", "experienceYears"])}


@router.get("/{job_id}")
def get_job(job_id: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return ser(_get_job(db, job_id))


@router.put("/{job_id}")
def update_job(job_id: str, body: JobUpdateIn, db: Session = Depends(get_db), _: User = Depends(recruiter_or_admin)):
    job = _get_job(db, job_id)
    reparse = body.rawDescription is not None and body.rawDescription != job.rawDescription
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(job, k, v)
    if reparse:
        matching.reparse_job(db, job, body.rawDescription)
    db.commit()
    db.refresh(job)
    return ser(job)


@router.delete("/{job_id}")
def delete_job(job_id: str, db: Session = Depends(get_db), _: User = Depends(recruiter_or_admin)):
    db.delete(_get_job(db, job_id))
    db.commit()
    return {"message": "Job deleted successfully"}


@router.post("/{job_id}/rank")
def rank_job(job_id: str, body: Optional[RankIn] = None, limit: int = 200, db: Session = Depends(get_db), _: User = Depends(recruiter_or_admin)):
    _get_job(db, job_id)
    weights = None
    if body and body.weights:
        try:
            body.weights.validate_sum()
        except ValueError as exc:
            raise ValidationError(str(exc))
        weights = {k: v for k, v in body.weights.model_dump().items() if v is not None}
    count = matching.run_job_matching(db, job_id, weights)
    rows = db.execute(
        select(Match).where(Match.jobId == job_id).order_by(Match.overallScore.desc()).limit(max(1, min(limit, 1000)))
        .options(selectinload(Match.candidate))
    ).scalars().all()
    return {
        "success": True, "message": f"Successfully calculated matching scores for {count} candidates.",
        "data": {"jobId": job_id, "matchCount": count, "matches": [
            {"rank": i + 1, "id": m.id,
             "candidate": ser(m.candidate, only=["id", "candidateId", "name", "headline", "yearsOfExperience", "location", "anomalyStatus"]),
             "scores": {"overall": m.overallScore, "semantic": m.semanticSimilarity, "skills": m.skillMatchScore,
                        "experience": m.experienceScore, "education": m.educationScore, "domain": m.domainScore,
                        "careerProgression": m.careerProgressionScore, "availability": m.availabilityScore},
             "strengths": m.strengths, "weaknesses": m.weaknesses, "hiringRecommendation": m.hiringRecommendation}
            for i, m in enumerate(rows)]},
    }


@router.post("/{job_id}/evaluate", status_code=201)
async def evaluate_resume(job_id: str, file: UploadFile = File(...), db: Session = Depends(get_db), user: User = Depends(recruiter_or_admin)):
    _get_job(db, job_id)
    if not (file.filename or "").lower().endswith(".pdf") and file.content_type != "application/pdf":
        raise ValidationError("Only PDF files are supported for resume uploads.")
    text = pdf_parser.parse_pdf(await file.read())
    cand = matching.create_candidate_profile(db, user, text, reuse_existing=False)
    match = db.execute(
        select(Match).where(Match.jobId == job_id, Match.candidateId == cand.id)
        .options(selectinload(Match.candidate).selectinload(Candidate.skills),
                 selectinload(Match.candidate).selectinload(Candidate.careerHistory),
                 selectinload(Match.candidate).selectinload(Candidate.education))
    ).scalar_one_or_none()
    if not match:
        raise NotFoundError("Failed to retrieve match evaluation results.")
    return {"success": True, "message": "Resume evaluated successfully.",
            "data": ser(match, {"candidate": {"skills": None, "careerHistory": None, "education": None}})}
