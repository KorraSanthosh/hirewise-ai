import random

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.errors import AuthError, ValidationError
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models import Candidate, User
from app.schemas import LoginIn, RegisterIn

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _public(u: User) -> dict:
    return {"id": u.id, "name": u.name, "email": u.email, "role": u.role}


@router.post("/register", status_code=201)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    role = body.role.lower()
    if role not in ("recruiter", "candidate"):
        raise ValidationError("Only recruiter and candidate roles are publicly registrable.")
    email = body.email.strip().lower()
    if db.execute(select(User.id).where(User.email == email)).first():
        raise ValidationError("A user with this email address already exists.")
    user = User(name=body.name, email=email, passwordHash=hash_password(body.password), role=role)
    db.add(user)
    db.flush()
    if role == "candidate":  # skeleton profile, as the old app did
        db.add(Candidate(userId=user.id, candidateId=f"CAND_{random.randint(1000000, 9999999)}", name=user.name,
                         email=user.email, rawResumeText="", headline="Candidate Profile",
                         summary="Awaiting resume import and profile setup."))
    db.commit()
    return {"message": "Registration successful", "user": _public(user)}


@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.execute(select(User).where(User.email == body.email.strip().lower())).scalar_one_or_none()
    if not user or not user.passwordHash or not verify_password(body.password, user.passwordHash):
        raise AuthError("Invalid email or password.")
    return {"accessToken": create_access_token(user.id, user.role), "tokenType": "bearer", "user": _public(user)}


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return _public(user)
