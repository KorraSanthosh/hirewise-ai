from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.core.errors import ForbiddenError, NotFoundError, ValidationError
from app.db.session import get_db
from app.models import Candidate, Match, User
from app.services import matching, pdf_parser, photos
from app.services.serializers import ser

router = APIRouter(prefix="/api/candidates", tags=["candidates"])


@router.post("/upload", status_code=201)
async def upload_resume(file: UploadFile = File(...), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not (file.filename or "").lower().endswith(".pdf") and file.content_type != "application/pdf":
        raise ValidationError("Only PDF files are supported for candidate resume uploads.")
    text = pdf_parser.parse_pdf(await file.read())
    # candidates keep one profile (updated in place); recruiters/admins create a new record per resume
    if user.role != "candidate":
        dup = matching.find_duplicate_resume(db, text)
        if dup:  # same resume uploaded again: reuse the existing record instead of creating a twin with its own scores
            matching.run_candidate_matching(db, dup.id)
            return {"success": True, "message": "This resume was already uploaded - the existing profile was reused (no duplicate created) and its matches were refreshed.",
                    "data": ser(dup, only=["id", "candidateId", "name", "headline", "location", "yearsOfExperience"])}
    cand = matching.create_candidate_profile(db, user, text, reuse_existing=(user.role == "candidate"))
    return {"success": True, "message": "Resume parsed and candidate profile created successfully.",
            "data": ser(cand, only=["id", "candidateId", "name", "headline", "location", "yearsOfExperience"])}


def _own_or_staff(db: Session, user: User, candidate_id: str) -> Candidate:
    lookup = user.id if candidate_id == "profile" else candidate_id
    cand = db.execute(select(Candidate).where(or_(Candidate.id == lookup, Candidate.candidateId == lookup, Candidate.userId == lookup))).scalars().first()
    if not cand:
        raise NotFoundError("Candidate not found")
    if user.role == "candidate" and cand.userId != user.id:
        raise ForbiddenError("Forbidden")
    return cand


@router.get("/{candidate_id}/photo", include_in_schema=False)
def get_photo(candidate_id: str):
    """Served without a token so <img> tags work; the URL contains the candidate's unguessable id."""
    found = photos.find_photo(candidate_id)
    if not found:
        raise NotFoundError("No photo")
    return FileResponse(found[0], media_type=found[1], headers={"Cache-Control": "public, max-age=86400"})


@router.post("/{candidate_id}/photo", status_code=201)
async def upload_photo(candidate_id: str, file: UploadFile = File(...), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cand = _own_or_staff(db, user, candidate_id)
    url = photos.save_photo(cand.id, await file.read())
    return {"success": True, "message": "Profile photo updated.", "data": {"photoUrl": url}}


@router.delete("/{candidate_id}/photo")
def remove_photo(candidate_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cand = _own_or_staff(db, user, candidate_id)
    photos.delete_photo(cand.id)
    return {"success": True, "message": "Profile photo removed."}


@router.get("/{candidate_id}")
def get_candidate(candidate_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    lookup = user.id if candidate_id == "profile" else candidate_id
    cand = db.execute(
        select(Candidate).where(or_(Candidate.id == lookup, Candidate.candidateId == lookup, Candidate.userId == lookup))
        .options(selectinload(Candidate.skills), selectinload(Candidate.education), selectinload(Candidate.careerHistory),
                 selectinload(Candidate.matches).selectinload(Match.job))
    ).scalars().first()
    if not cand:
        raise NotFoundError("Candidate not found")
    if user.role == "candidate" and cand.userId != user.id:
        raise ForbiddenError("Forbidden")
    out = ser(cand, {"skills": None, "education": None, "careerHistory": None, "matches": {"job": None}})
    out["photoUrl"] = photos.photo_url(cand.id)
    return out
