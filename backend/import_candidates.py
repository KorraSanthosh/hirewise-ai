"""Import candidates from the hackathon candidates.jsonl into the app database (no Gemini needed).

Examples (run from the backend folder with the venv active):
  python import_candidates.py --dry-run
  python import_candidates.py                                  # default tech roles, 300 per title
  python import_candidates.py --per-title 1000
  python import_candidates.py --titles "Backend Engineer,Data Engineer,Data Analyst" --per-title 500
  python import_candidates.py --all-titles --per-title 150     # include non-tech roles too

Candidates already in the database (same candidateId, e.g. CAND_0000123) are skipped, so it is safe to re-run.
Embeddings are not created; ranking then drops the semantic component and re-weights the rest (see ranking.py).
"""
import argparse
import json
import os
import sys
from collections import Counter
from typing import Dict, List

from sqlalchemy import select

from app import models  # noqa: F401
from app.db.session import SessionLocal
from app.models import Candidate, CareerHistory, Education, Skill, User
from app.services import anomaly
from app.services.matching import _parse_date

DEFAULT_FILE = os.path.join(os.path.dirname(__file__), "..", "data ", "India_runs_data_and_ai_challenge", "candidates.jsonl")
TECH_TITLES = [
    "Software Engineer", "Backend Engineer", "Full Stack Developer", "Frontend Engineer", "Java Developer",
    ".NET Developer", "Mobile Developer", "Cloud Engineer", "DevOps Engineer", "QA Engineer",
    "Data Engineer", "Data Analyst", "Analytics Engineer", "Data Scientist", "Machine Learning Engineer",
    "ML Engineer", "AI Engineer", "Senior Machine Learning Engineer", "Junior ML Engineer", "Research Scientist",
]


def seniority(title: str) -> str:
    t = (title or "").lower()
    if any(k in t for k in ("senior", "lead", "principal", "staff", "head", "architect")):
        return "Senior"
    if any(k in t for k in ("junior", "intern", "associate", "trainee")):
        return "Junior"
    return "Mid"


def to_candidate(d: dict, user_id: str) -> Candidate:
    p, sig = d.get("profile", {}), d.get("redrob_signals", {})
    skills = [Skill(name=s["name"], proficiency=s.get("proficiency", "intermediate"), endorsements=int(s.get("endorsements") or 0),
                    durationMonths=int(s.get("duration_months") or 0)) for s in d.get("skills", [])]
    career = [CareerHistory(company=j.get("company") or "Unknown", title=j.get("title") or "", startDate=_parse_date(j.get("start_date")),
                            endDate=_parse_date(j.get("end_date")), durationMonths=int(j.get("duration_months") or 0),
                            isCurrent=bool(j.get("is_current")), industry=j.get("industry"), companySize=j.get("company_size"),
                            description=j.get("description")) for j in d.get("career_history", [])]
    edu = [Education(institution=e.get("institution") or "", degree=e.get("degree") or "", fieldOfStudy=e.get("field_of_study") or "",
                     startYear=e.get("start_year"), endYear=e.get("end_year"), grade=e.get("grade"), tier=e.get("tier") or "unknown")
           for e in d.get("education", [])]
    sal = sig.get("expected_salary_range_inr_lpa") or {}
    text = "\n".join([p.get("headline", ""), p.get("summary", "")] + [f"{j.get('title','')} at {j.get('company','')}: {j.get('description','')}" for j in d.get("career_history", [])])
    cand = Candidate(
        userId=user_id, candidateId=d["candidate_id"], name=p.get("anonymized_name") or d["candidate_id"], rawResumeText=text,
        headline=p.get("headline"), summary=p.get("summary"), location=p.get("location"), country=p.get("country"),
        yearsOfExperience=float(p.get("years_of_experience") or 0), currentTitle=p.get("current_title"),
        currentCompany=p.get("current_company"), currentCompanySize=p.get("current_company_size"),
        currentIndustry=p.get("current_industry"), seniority=seniority(p.get("current_title", "")),
        profileCompleteness=float(sig.get("profile_completeness_score") or 0), signupDate=_parse_date(sig.get("signup_date")),
        lastActiveDate=_parse_date(sig.get("last_active_date")), openToWork=bool(sig.get("open_to_work_flag")),
        profileViews30d=int(sig.get("profile_views_received_30d") or 0), applications30d=int(sig.get("applications_submitted_30d") or 0),
        recruiterResponse=float(sig.get("recruiter_response_rate") or 0), avgResponseTime=float(sig.get("avg_response_time_hours") or 0),
        connectionCount=int(sig.get("connection_count") or 0), endorsementsCount=int(sig.get("endorsements_received") or 0),
        noticePeriodDays=int(sig.get("notice_period_days") or 0), expectedSalaryMin=float(sal.get("min") or 0),
        expectedSalaryMax=float(sal.get("max") or 0), preferredWorkMode=sig.get("preferred_work_mode") or "flexible",
        willingToRelocate=bool(sig.get("willing_to_relocate")), githubActivityScore=float(sig.get("github_activity_score", -1)),
        searchAppearance30d=int(sig.get("search_appearance_30d") or 0), savedByRecruiters30d=int(sig.get("saved_by_recruiters_30d") or 0),
        interviewCompletion=float(sig.get("interview_completion_rate") or 0), offerAcceptanceRate=float(sig.get("offer_acceptance_rate", -1)),
        verifiedEmail=bool(sig.get("verified_email")), verifiedPhone=bool(sig.get("verified_phone")),
        linkedinConnected=bool(sig.get("linkedin_connected")), skills=skills, careerHistory=career, education=edu,
    )
    pro = sum(c.durationMonths for c in career if anomaly.is_professional_experience(c))
    res = anomaly.check_candidate({
        "yearsOfExperience": max(cand.yearsOfExperience, pro / 12), "skills": skills, "careerHistory": career, "education": edu,
        "noticePeriodDays": cand.noticePeriodDays, "openToWork": cand.openToWork, "lastActiveDate": cand.lastActiveDate,
        "profileCompleteness": cand.profileCompleteness, "connectionCount": cand.connectionCount})
    cand.anomalyStatus, cand.anomalyReasons = res["status"], res["reasons"]
    return cand


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--file", default=DEFAULT_FILE)
    ap.add_argument("--titles", help="comma-separated current_title values to import (default: tech roles)")
    ap.add_argument("--all-titles", action="store_true", help="import every title (still capped by --per-title)")
    ap.add_argument("--per-title", type=int, default=300, help="max candidates per title (default 300)")
    ap.add_argument("--owner-email", help="user that will own the candidates (default: first recruiter/admin)")
    ap.add_argument("--dry-run", action="store_true", help="only report what would be imported")
    a = ap.parse_args()

    wanted = None if a.all_titles else {t.strip().lower() for t in (a.titles.split(",") if a.titles else TECH_TITLES)}
    taken: Counter = Counter()
    picked: List[dict] = []
    with open(a.file, encoding="utf-8") as f:
        for line in f:
            d = json.loads(line)
            t = d["profile"]["current_title"]
            if (wanted is None or t.lower() in wanted) and taken[t] < a.per_title:
                taken[t] += 1
                picked.append(d)
    print(f"Selected {len(picked)} candidates from {len(taken)} titles:")
    for t, n in taken.most_common():
        print(f"   {n:5d}  {t}")
    if a.dry_run:
        return

    db = SessionLocal()
    try:
        q = select(User).where(User.email == a.owner_email) if a.owner_email else select(User).where(User.role.in_(["recruiter", "admin"])).order_by(User.createdAt)
        owner = db.execute(q).scalars().first()
        if not owner:
            sys.exit("No recruiter user found. Register a recruiter in the app first (or pass --owner-email).")
        have = set(db.execute(select(Candidate.candidateId)).scalars())
        added = 0
        for i in range(0, len(picked), 200):
            batch = [to_candidate(d, owner.id) for d in picked[i:i + 200] if d["candidate_id"] not in have]
            db.add_all(batch)
            db.commit()
            added += len(batch)
            print(f"   ...{added} added", end="\r", flush=True)
        print(f"\nDone: {added} new candidates added (owner: {owner.email}); {len(picked) - added} already existed.")
        print("Next: open Rankings, pick your job and click 'Re-rank candidates'.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
