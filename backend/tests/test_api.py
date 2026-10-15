import io

from tests.conftest import register_login

JD = "We need a Python ML engineer to build embeddings based ranking systems for recruiters."


def test_auth_flow_and_roles(client):
    assert client.get("/api/jobs").status_code == 401
    rec = register_login(client, "recruiter")
    cand = register_login(client, "candidate")
    assert client.get("/api/auth/me", headers=rec).json()["role"] == "recruiter"
    assert client.post("/api/auth/register", json={"name": "x", "email": "recruiter@example.com", "password": "secret123", "role": "recruiter"}).status_code == 400
    assert client.post("/api/auth/register", json={"name": "x", "email": "a@b.co", "password": "secret123", "role": "admin"}).status_code == 400
    assert client.post("/api/auth/login", json={"email": "recruiter@example.com", "password": "wrong"}).status_code == 401
    # candidates cannot create jobs or see dashboard
    assert client.post("/api/jobs", json={"rawDescription": JD}, headers=cand).status_code == 403
    assert client.get("/api/dashboard/stats", headers=cand).status_code == 403


def test_job_crud_rank_and_dashboard(client):
    rec = register_login(client, "recruiter")
    r = client.post("/api/jobs", json={"rawDescription": JD, "title": "Senior ML", "seniority": "Senior"}, headers=rec)
    assert r.status_code == 201, r.text
    job = r.json()
    assert job["title"] == "Senior ML" and job["seniority"] == "Senior" and job["requiredSkills"] == ["Python", "Embeddings"]
    assert "embedding" not in job
    assert client.post("/api/jobs", json={"rawDescription": "short"}, headers=rec).status_code == 400

    # a candidate registers and uploads a resume -> matches are created
    cand = register_login(client, "candidate")
    pdf = io.BytesIO(b"%PDF-1.4 not a real pdf")
    assert client.post("/api/candidates/upload", files={"file": ("cv.pdf", pdf, "application/pdf")}, headers=cand).status_code == 422
    assert client.post("/api/candidates/upload", files={"file": ("cv.txt", io.BytesIO(b"x"), "text/plain")}, headers=cand).status_code == 400

    r = client.post(f"/api/jobs/{job['id']}/rank", json={}, headers=rec)
    assert r.status_code == 200 and r.json()["data"]["matchCount"] >= 1
    r = client.post(f"/api/jobs/{job['id']}/rank", json={"weights": {"semantic": .5, "skills": .5, "experience": .5, "education": .5, "career_progression": .5, "availability": .5}}, headers=rec)
    assert r.status_code == 400

    m = client.get(f"/api/matches?jobId={job['id']}", headers=rec).json()
    assert len(m) == 1
    mid = m[0]["id"]
    assert client.patch(f"/api/matches/{mid}", json={"recruiterStatus": "SHORTLISTED"}, headers=rec).json()["recruiterStatus"] == "SHORTLISTED"
    assert client.patch(f"/api/matches/{mid}", json={"recruiterStatus": "NOPE"}, headers=rec).status_code == 400
    ex = client.post(f"/api/matches/{mid}/explain", headers=rec).json()
    assert ex["data"]["explainability"]["strengths"] == ["Strong Python"]

    stats = client.get("/api/dashboard/stats", headers=rec).json()
    assert stats["totalCandidates"] == 1 and stats["activeJobs"] == 1 and stats["shortlisted"] == 1
    assert sum(x["candidates"] for x in client.get("/api/dashboard/analytics", headers=rec).json()["distribution"]) == 1
    assert len(client.get("/api/dashboard/candidates", headers=rec).json()) == 1
    cats = client.get("/api/dashboard/categories", headers=rec).json()
    assert sum(c["candidates"] for c in cats) == 1 and sum(c["shortlisted"] for c in cats) == 1
    only = client.get(f"/api/dashboard/candidates?category={cats[0]['category']}&status=SHORTLISTED", headers=rec).json()
    assert len(only) == 1 and only[0]["category"] == cats[0]["category"]
    assert client.get("/api/dashboard/candidates?status=REJECTED", headers=rec).json() == []

    # update + delete (cascades to matches)
    assert client.put(f"/api/jobs/{job['id']}", json={"company": "Redrob"}, headers=rec).json()["company"] == "Redrob"
    assert client.delete(f"/api/jobs/{job['id']}", headers=rec).status_code == 200
    assert client.get(f"/api/jobs/{job['id']}", headers=rec).status_code == 404
    assert client.get("/api/matches", headers=rec).json() == []


def test_candidate_resume_and_apply(client, monkeypatch):
    from app.api import candidates as cand_api
    monkeypatch.setattr(cand_api.pdf_parser, "parse_pdf", lambda b: "Python engineer resume text")
    rec = register_login(client, "recruiter")
    job = client.post("/api/jobs", json={"rawDescription": JD}, headers=rec).json()
    cand = register_login(client, "candidate")

    # applying without a resume is rejected
    assert client.post("/api/matches", json={"jobId": job["id"]}, headers=cand).status_code == 400

    r = client.post("/api/candidates/upload", files={"file": ("cv.pdf", io.BytesIO(b"x"), "application/pdf")}, headers=cand)
    assert r.status_code == 201, r.text
    assert r.json()["data"]["name"] == "Asa Rao"  # camel-case name fixer
    # same candidate uploads again -> still one profile
    client.post("/api/candidates/upload", files={"file": ("cv.pdf", io.BytesIO(b"x"), "application/pdf")}, headers=cand)

    prof = client.get("/api/candidates/profile", headers=cand).json()
    assert prof["skills"][0]["name"] == "Python" and len(prof["skills"]) == 1 and prof["careerHistory"][0]["isCurrent"] is True
    assert prof["anomalyStatus"] == "CLEAN" and len(prof["matches"]) == 1

    ap = client.post("/api/matches", json={"jobId": job["id"]}, headers=cand)
    assert ap.status_code == 201 and ap.json()["match"]["overallScore"] > 0
    mine = client.get("/api/matches", headers=cand).json()
    assert len(mine) == 1 and mine[0]["job"]["title"] == "ML Engineer"

    # another candidate cannot read this profile
    other = register_login(client, "candidate", "other@example.com")
    assert client.get(f"/api/candidates/{prof['id']}", headers=other).status_code == 403
    # recruiter can; and recruiter-evaluate creates a separate candidate
    assert client.get(f"/api/candidates/{prof['candidateId']}", headers=rec).status_code == 200
    from app.api import jobs as jobs_api
    monkeypatch.setattr(jobs_api.pdf_parser, "parse_pdf", lambda b: "Python person two")
    ev = client.post(f"/api/jobs/{job['id']}/evaluate", files={"file": ("a.pdf", io.BytesIO(b"x"), "application/pdf")}, headers=rec)
    assert ev.status_code == 201, ev.text
    assert ev.json()["data"]["candidate"]["skills"][0]["name"] == "Python"
    ev2 = client.post(f"/api/jobs/{job['id']}/evaluate", files={"file": ("b.pdf", io.BytesIO(b"x"), "application/pdf")}, headers=rec)
    assert ev2.json()["data"]["candidate"]["id"] != ev.json()["data"]["candidate"]["id"]


def test_url_normalisation():
    from app.core.config import Settings
    s = Settings(DATABASE_URL='"postgresql://u:p@localhost:5432/hirewise_db?schema=public"')
    assert s.sqlalchemy_url == "postgresql+psycopg2://u:p@localhost:5432/hirewise_db"


def test_recruiter_reupload_reuses_existing_candidate(client, monkeypatch):
    from app.services import pdf_parser
    rec = register_login(client, "recruiter")
    monkeypatch.setattr(pdf_parser, "parse_pdf", lambda b: "Jane Doe backend engineer resume text")
    up = lambda: client.post("/api/candidates/upload", files={"file": ("cv.pdf", io.BytesIO(b"%PDF"), "application/pdf")}, headers=rec)
    first, second = up(), up()
    assert first.status_code == 201 and second.status_code == 201
    assert first.json()["data"]["id"] == second.json()["data"]["id"]
    assert "already uploaded" in second.json()["message"]
