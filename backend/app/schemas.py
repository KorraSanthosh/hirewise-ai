from typing import Dict, Optional

from pydantic import BaseModel, Field, field_validator


class RegisterIn(BaseModel):
    name: str = Field(min_length=1)
    email: str = Field(min_length=3)
    password: str = Field(min_length=6)
    role: str


class LoginIn(BaseModel):
    email: str
    password: str


class JobCreateIn(BaseModel):
    rawDescription: str = Field(min_length=20)
    title: Optional[str] = None
    company: Optional[str] = None
    department: Optional[str] = None
    experienceYears: Optional[int] = None
    educationLevel: Optional[str] = None
    seniority: Optional[str] = None
    domain: Optional[str] = None


class JobUpdateIn(BaseModel):
    rawDescription: Optional[str] = None
    title: Optional[str] = None
    company: Optional[str] = None
    department: Optional[str] = None
    experienceYears: Optional[int] = None
    educationLevel: Optional[str] = None
    seniority: Optional[str] = None
    domain: Optional[str] = None


class RankWeights(BaseModel):
    semantic: Optional[float] = Field(None, ge=0, le=1)
    skills: Optional[float] = Field(None, ge=0, le=1)
    experience: Optional[float] = Field(None, ge=0, le=1)
    education: Optional[float] = Field(None, ge=0, le=1)
    career_progression: Optional[float] = Field(None, ge=0, le=1)
    availability: Optional[float] = Field(None, ge=0, le=1)

    def validate_sum(self) -> None:
        vals = [v for v in self.model_dump().values() if v is not None]
        if len(vals) == 6 and abs(sum(vals) - 1.0) >= 0.01:
            raise ValueError("Invalid weights provided. Sum of weights must equal 1.0.")


class RankIn(BaseModel):
    weights: Optional[RankWeights] = None


class MatchPatchIn(BaseModel):
    recruiterStatus: Optional[str] = None
    recruiterNotes: Optional[str] = None

    @field_validator("recruiterStatus")
    @classmethod
    def _status(cls, v):
        if v is not None and v not in ("PENDING", "SHORTLISTED", "REJECTED"):
            raise ValueError("Invalid recruiter status")
        return v


class ApplyIn(BaseModel):
    jobId: str
