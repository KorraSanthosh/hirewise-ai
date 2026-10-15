from datetime import datetime, timedelta

from app.services import anomaly
from app.services.ranking import CandidateScoringInput, JobScoringInput, cosine_score, score_candidate, skill_score


def test_cosine_and_skills():
    assert cosine_score([1, 0], [1, 0]) == 100.0
    assert cosine_score([1, 0], [0, 1]) == 0.0
    assert skill_score([{"name": "Python"}], ["python", "go"], []) == (0.5 * 0.8 + 1.0 * 0.2) * 100


def test_good_candidate_scores_high_and_honeypot_zero():
    job = JobScoringInput(experienceYears=5, requiredSkills=["python"], preferredSkills=[])
    good = CandidateScoringInput(yearsOfExperience=6, skills=[{"name": "Python", "proficiency": "expert", "durationMonths": 40}],
                                 careerHistory=[{"company": "Acme", "title": "Engineer", "durationMonths": 60, "startDate": datetime(2020, 1, 1)}],
                                 education=[{"institution": "IIT", "degree": "B", "fieldOfStudy": "Computer Science", "tier": "tier_1", "startYear": 2014, "endYear": 2018}],
                                 noticePeriodDays=15, openToWork=True, lastActiveDate=datetime.utcnow() - timedelta(days=3),
                                 profileCompleteness=90, connectionCount=100, recruiterResponseRate=0.9)
    assert score_candidate(good, job, semantic=80)["overallScore"] > 0.6
    bad = CandidateScoringInput(**{**good.__dict__, "yearsOfExperience": 2,
                                   "careerHistory": [{"company": "X", "title": "Eng", "durationMonths": 200, "startDate": datetime(2005, 1, 1)}]})
    r = score_candidate(bad, job, semantic=80)
    assert r["anomalyStatus"] == "HIGH" and r["overallScore"] == 0.0


def test_anomaly_levels():
    base = {"yearsOfExperience": 5, "skills": [], "careerHistory": [], "education": [{"institution": "I"}], "connectionCount": 5}
    assert anomaly.check_candidate(base)["status"] == "CLEAN"
    inflated = {**base, "skills": [{"name": f"s{i}", "proficiency": "expert", "durationMonths": 0} for i in range(5)]}
    assert anomaly.check_candidate(inflated)["status"] == "MEDIUM"
    assert anomaly.check_candidate({**base, "education": []})["status"] == "LOW"


def test_role_fit_without_embeddings_prefers_matching_role():
    from app.services.ranking import CandidateScoringInput as C, JobScoringInput as J, score_candidate

    def cand(title, skills):
        return C(yearsOfExperience=5, skills=[{"name": s} for s in skills], title=title, noticePeriodDays=30, openToWork=True,
                 profileCompleteness=90, connectionCount=200, recruiterResponseRate=.8)
    job = J(experienceYears=3, title="Backend Engineer", requiredSkills=["Python", "Django", "PostgreSQL"], text="Build APIs and microservices")
    be = score_candidate(cand("Backend Developer", ["Python", "Django", "PostgreSQL"]), job)
    ds = score_candidate(cand("Data Scientist", ["Python", "Pandas", "Statistics"]), job)
    assert be["overallScore"] > ds["overallScore"]
    assert be["semanticSimilarity"] > ds["semanticSimilarity"]
