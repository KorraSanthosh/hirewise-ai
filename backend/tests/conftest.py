import os

os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", "sqlite://")  # default in-memory SQLite; set TEST_DATABASE_URL to run against a scratch Postgres
os.environ["GEMINI_API_KEY"] = ""

import pytest
from fastapi.testclient import TestClient

from app.db.session import Base, SessionLocal, engine
from app.main import app
from app.services import gemini


@pytest.fixture(autouse=True)
def db_reset():
    if engine.dialect.name == "postgresql":  # tables come from the Prisma schema; just empty them
        with engine.begin() as c:
            c.exec_driver_sql('TRUNCATE "Match","Skill","Education","CareerHistory","Candidate","Job","User" CASCADE')
    else:
        Base.metadata.drop_all(engine)
        Base.metadata.create_all(engine)
    yield


@pytest.fixture()
def client():
    return TestClient(app)


@pytest.fixture()
def db():
    s = SessionLocal()
    yield s
    s.close()


def _vec(seed: float):
    return [seed, 1.0 - seed] + [0.0] * 766


@pytest.fixture(autouse=True)
def fake_gemini(monkeypatch):
    monkeypatch.setattr(gemini, "generate_embedding", lambda text: _vec(0.9 if "python" in text.lower() else 0.1))
    monkeypatch.setattr(gemini, "parse_job_description", lambda t: gemini.ParsedJob(
        title="ML Engineer", rawDescription=t, requiredSkills=["Python", "Embeddings"], preferredSkills=["LoRA"],
        experienceYears=5, preferProductCompany=True))
    monkeypatch.setattr(gemini, "parse_resume", lambda t: gemini.ParsedCandidate(
        profile=gemini.ParsedProfile(anonymizedName="AsaRao", headline="ML Engineer", yearsOfExperience=6, currentTitle="ML Engineer", currentCompany="Acme"),
        careerHistory=[gemini.ParsedCareer(company="Acme", title="Senior ML Engineer", startDate="2020-01-01", durationMonths=60, isCurrent=True)],
        education=[gemini.ParsedEducation(institution="IIT", degree="B.Tech", fieldOfStudy="Computer Science", startYear=2014, endYear=2018, tier="tier_1")],
        skills=[gemini.ParsedSkill(name="Python", proficiency="expert", endorsements=3, durationMonths=60)]))
    monkeypatch.setattr(gemini, "generate_match_explanation", lambda c, j, s: gemini.MatchExplanation(
        strengths=["Strong Python"], weaknesses=["No LoRA"], missingSkills=["Embeddings"], hiringRecommendation="Hire.", improvementSuggestions=["Add LoRA"]))


def register_login(client, role="recruiter", email=None):
    email = email or f"{role}@example.com"
    r = client.post("/api/auth/register", json={"name": f"Test {role}", "email": email, "password": "secret123", "role": role})
    assert r.status_code == 201, r.text
    r = client.post("/api/auth/login", json={"email": email, "password": "secret123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['accessToken']}"}
