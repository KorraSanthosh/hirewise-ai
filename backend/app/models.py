"""SQLAlchemy models mapped 1:1 onto the tables Prisma created (prisma/schema.prisma).

Attribute names intentionally equal the existing camelCase column names so the
same PostgreSQL database works unchanged (no migration, no data copy).
"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, deferred, mapped_column, relationship

from app.db.session import Base
from app.db.types import StringArray, VectorType


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _ts(**kw):
    return mapped_column(DateTime(), **kw)


class User(Base):
    __tablename__ = "User"
    id: Mapped[str] = mapped_column(Text, primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    passwordHash: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(Text, nullable=False, default="recruiter", server_default="recruiter")
    createdAt: Mapped[datetime] = _ts(nullable=False, default=_now, server_default=func.now())
    updatedAt: Mapped[datetime] = _ts(nullable=False, default=_now, onupdate=_now)

    jobs: Mapped[List["Job"]] = relationship(back_populates="user", cascade="all, delete-orphan", passive_deletes=True)
    candidates: Mapped[List["Candidate"]] = relationship(back_populates="user", cascade="all, delete-orphan", passive_deletes=True)


class Job(Base):
    __tablename__ = "Job"
    id: Mapped[str] = mapped_column(Text, primary_key=True, default=_uuid)
    userId: Mapped[str] = mapped_column(Text, ForeignKey("User.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    company: Mapped[Optional[str]] = mapped_column(Text)
    department: Mapped[Optional[str]] = mapped_column(Text)
    rawDescription: Mapped[str] = mapped_column(Text, nullable=False)
    requiredSkills: Mapped[list] = mapped_column(StringArray, default=list)
    preferredSkills: Mapped[list] = mapped_column(StringArray, default=list)
    responsibilities: Mapped[list] = mapped_column(StringArray, default=list)
    experienceYears: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    educationLevel: Mapped[str] = mapped_column(Text, nullable=False, default="Any", server_default="Any")
    seniority: Mapped[str] = mapped_column(Text, nullable=False, default="Any", server_default="Any")
    domain: Mapped[str] = mapped_column(Text, nullable=False, default="General", server_default="General")
    softSkills: Mapped[list] = mapped_column(StringArray, default=list)
    preferProductCompany: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    preferredDegrees: Mapped[list] = mapped_column(StringArray, default=list)
    preferredUniversities: Mapped[list] = mapped_column(StringArray, default=list)
    embedding = deferred(mapped_column(VectorType, nullable=True))
    createdAt: Mapped[datetime] = _ts(nullable=False, default=_now, server_default=func.now())
    updatedAt: Mapped[datetime] = _ts(nullable=False, default=_now, onupdate=_now)

    user: Mapped["User"] = relationship(back_populates="jobs")
    matches: Mapped[List["Match"]] = relationship(back_populates="job", cascade="all, delete-orphan", passive_deletes=True)


class Candidate(Base):
    __tablename__ = "Candidate"
    id: Mapped[str] = mapped_column(Text, primary_key=True, default=_uuid)
    userId: Mapped[str] = mapped_column(Text, ForeignKey("User.id", ondelete="CASCADE"), nullable=False)
    candidateId: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    email: Mapped[Optional[str]] = mapped_column(Text)
    phone: Mapped[Optional[str]] = mapped_column(Text)
    resumeUrl: Mapped[Optional[str]] = mapped_column(Text)
    rawResumeText: Mapped[str] = mapped_column(Text, nullable=False, default="")
    headline: Mapped[Optional[str]] = mapped_column(Text)
    summary: Mapped[Optional[str]] = mapped_column(Text)
    location: Mapped[Optional[str]] = mapped_column(Text)
    country: Mapped[Optional[str]] = mapped_column(Text)
    yearsOfExperience: Mapped[float] = mapped_column(Float, nullable=False, default=0.0, server_default="0")
    currentTitle: Mapped[Optional[str]] = mapped_column(Text)
    currentCompany: Mapped[Optional[str]] = mapped_column(Text)
    currentCompanySize: Mapped[Optional[str]] = mapped_column(Text)
    currentIndustry: Mapped[Optional[str]] = mapped_column(Text)
    seniority: Mapped[str] = mapped_column(Text, nullable=False, default="Mid", server_default="Mid")
    domain: Mapped[str] = mapped_column(Text, nullable=False, default="General", server_default="General")

    profileCompleteness: Mapped[float] = mapped_column(Float, nullable=False, default=0.0, server_default="0")
    signupDate: Mapped[Optional[datetime]] = _ts()
    lastActiveDate: Mapped[Optional[datetime]] = _ts()
    openToWork: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    profileViews30d: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    applications30d: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    recruiterResponse: Mapped[float] = mapped_column(Float, nullable=False, default=0.0, server_default="0")
    avgResponseTime: Mapped[float] = mapped_column(Float, nullable=False, default=0.0, server_default="0")
    connectionCount: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    endorsementsCount: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    noticePeriodDays: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    expectedSalaryMin: Mapped[float] = mapped_column(Float, nullable=False, default=0.0, server_default="0")
    expectedSalaryMax: Mapped[float] = mapped_column(Float, nullable=False, default=0.0, server_default="0")
    preferredWorkMode: Mapped[str] = mapped_column(Text, nullable=False, default="flexible", server_default="flexible")
    willingToRelocate: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    githubActivityScore: Mapped[float] = mapped_column(Float, nullable=False, default=-1.0, server_default="-1")
    searchAppearance30d: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    savedByRecruiters30d: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    interviewCompletion: Mapped[float] = mapped_column(Float, nullable=False, default=0.0, server_default="0")
    offerAcceptanceRate: Mapped[float] = mapped_column(Float, nullable=False, default=-1.0, server_default="-1")
    verifiedEmail: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    verifiedPhone: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    linkedinConnected: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")

    embedding = deferred(mapped_column(VectorType, nullable=True))
    anomalyStatus: Mapped[str] = mapped_column(Text, nullable=False, default="CLEAN", server_default="CLEAN")
    anomalyReasons: Mapped[list] = mapped_column(StringArray, default=list)
    createdAt: Mapped[datetime] = _ts(nullable=False, default=_now, server_default=func.now())
    updatedAt: Mapped[datetime] = _ts(nullable=False, default=_now, onupdate=_now)

    user: Mapped["User"] = relationship(back_populates="candidates")
    skills: Mapped[List["Skill"]] = relationship(back_populates="candidate", cascade="all, delete-orphan", passive_deletes=True)
    careerHistory: Mapped[List["CareerHistory"]] = relationship(back_populates="candidate", cascade="all, delete-orphan", passive_deletes=True)
    education: Mapped[List["Education"]] = relationship(back_populates="candidate", cascade="all, delete-orphan", passive_deletes=True)
    matches: Mapped[List["Match"]] = relationship(back_populates="candidate", cascade="all, delete-orphan", passive_deletes=True)


class CareerHistory(Base):
    __tablename__ = "CareerHistory"
    id: Mapped[str] = mapped_column(Text, primary_key=True, default=_uuid)
    candidateId: Mapped[str] = mapped_column(Text, ForeignKey("Candidate.id", ondelete="CASCADE"), nullable=False)
    company: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    startDate: Mapped[Optional[datetime]] = _ts()
    endDate: Mapped[Optional[datetime]] = _ts()
    durationMonths: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    isCurrent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    industry: Mapped[Optional[str]] = mapped_column(Text)
    companySize: Mapped[Optional[str]] = mapped_column(Text)
    description: Mapped[Optional[str]] = mapped_column(Text)
    candidate: Mapped["Candidate"] = relationship(back_populates="careerHistory")


class Education(Base):
    __tablename__ = "Education"
    id: Mapped[str] = mapped_column(Text, primary_key=True, default=_uuid)
    candidateId: Mapped[str] = mapped_column(Text, ForeignKey("Candidate.id", ondelete="CASCADE"), nullable=False)
    institution: Mapped[str] = mapped_column(Text, nullable=False)
    degree: Mapped[str] = mapped_column(Text, nullable=False)
    fieldOfStudy: Mapped[str] = mapped_column(Text, nullable=False)
    startYear: Mapped[Optional[int]] = mapped_column(Integer)
    endYear: Mapped[Optional[int]] = mapped_column(Integer)
    grade: Mapped[Optional[str]] = mapped_column(Text)
    tier: Mapped[str] = mapped_column(Text, nullable=False, default="unknown", server_default="unknown")
    candidate: Mapped["Candidate"] = relationship(back_populates="education")


class Skill(Base):
    __tablename__ = "Skill"
    id: Mapped[str] = mapped_column(Text, primary_key=True, default=_uuid)
    candidateId: Mapped[str] = mapped_column(Text, ForeignKey("Candidate.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    proficiency: Mapped[str] = mapped_column(Text, nullable=False, default="intermediate", server_default="intermediate")
    endorsements: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    durationMonths: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    candidate: Mapped["Candidate"] = relationship(back_populates="skills")


class Match(Base):
    __tablename__ = "Match"
    __table_args__ = (UniqueConstraint("jobId", "candidateId", name="Match_jobId_candidateId_key"),)
    id: Mapped[str] = mapped_column(Text, primary_key=True, default=_uuid)
    jobId: Mapped[str] = mapped_column(Text, ForeignKey("Job.id", ondelete="CASCADE"), nullable=False)
    candidateId: Mapped[str] = mapped_column(Text, ForeignKey("Candidate.id", ondelete="CASCADE"), nullable=False)
    overallScore: Mapped[float] = mapped_column(Float, nullable=False)
    semanticSimilarity: Mapped[float] = mapped_column(Float, nullable=False)
    skillMatchScore: Mapped[float] = mapped_column(Float, nullable=False)
    experienceScore: Mapped[float] = mapped_column(Float, nullable=False)
    educationScore: Mapped[float] = mapped_column(Float, nullable=False)
    domainScore: Mapped[float] = mapped_column(Float, nullable=False)
    careerProgressionScore: Mapped[float] = mapped_column(Float, nullable=False)
    availabilityScore: Mapped[float] = mapped_column(Float, nullable=False)
    strengths: Mapped[list] = mapped_column(StringArray, default=list)
    weaknesses: Mapped[list] = mapped_column(StringArray, default=list)
    missingSkills: Mapped[list] = mapped_column(StringArray, default=list)
    hiringRecommendation: Mapped[str] = mapped_column(Text, nullable=False, default="")
    improvementSuggestions: Mapped[list] = mapped_column(StringArray, default=list)
    recruiterNotes: Mapped[Optional[str]] = mapped_column(Text)
    recruiterStatus: Mapped[str] = mapped_column(Text, nullable=False, default="PENDING", server_default="PENDING")
    recruiterFeedbackScore: Mapped[Optional[float]] = mapped_column(Float)
    createdAt: Mapped[datetime] = _ts(nullable=False, default=_now, server_default=func.now())
    updatedAt: Mapped[datetime] = _ts(nullable=False, default=_now, onupdate=_now)

    job: Mapped["Job"] = relationship(back_populates="matches")
    candidate: Mapped["Candidate"] = relationship(back_populates="matches")
