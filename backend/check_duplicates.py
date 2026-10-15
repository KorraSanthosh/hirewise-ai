"""Explain why two uploads of the same resume show different scores.
Run from the backend folder (venv active):   python check_duplicates.py
It lists candidates created from identical resume text and compares their embeddings and per-job semantic scores."""
from collections import defaultdict

from sqlalchemy import select

from app import models  # noqa: F401
from app.db.session import SessionLocal
from app.models import Candidate, Job, Match

db = SessionLocal()
groups = defaultdict(list)
for c in db.execute(select(Candidate).order_by(Candidate.createdAt)).scalars():
    if c.rawResumeText:
        groups[c.rawResumeText].append(c)
dups = sorted([g for g in groups.values() if len(g) > 1], key=lambda g: max(c.createdAt for c in g), reverse=True)  # newest first
print(f"{len(dups)} group(s) of candidates share identical resume text (showing the newest 5).")
if not dups:
    print("No two candidates share identical resume text. If you uploaded 'the same' resume twice, the files differ slightly "
          "(different text extracted), so different embeddings and scores are expected.")
jobs = {j.id: j.title for j in db.execute(select(Job)).scalars()}
for g in dups[:5]:
    print(f"\n=== {len(g)} candidates with identical resume text ===")
    vecs = []
    for c in g:
        v = db.execute(select(Candidate.embedding).where(Candidate.id == c.id)).scalar()
        vecs.append(v)
        print(f"  {c.candidateId}  {c.name[:18]:18s} created {c.createdAt:%Y-%m-%d %H:%M}  title={c.currentTitle!r}  skills={len(c.skills)}  embedding={'yes' if v else 'NO'}")
    if all(vecs):
        print("  embeddings identical:", all(max(abs(a - b) for a, b in zip(vecs[0], v)) < 1e-6 for v in vecs[1:]))
    for jid, title in jobs.items():
        row = []
        for c in g:
            m = db.execute(select(Match).where(Match.jobId == jid, Match.candidateId == c.id)).scalars().first()
            row.append(f"{m.semanticSimilarity:6.2f}/{m.overallScore * 100:5.1f}" if m else "   none    ")
        print(f"  job {title[:28]:28s} semantic/overall per copy: " + "  |  ".join(row))
print("\nTip: click 'Re-rank candidates' on the job to recompute every copy with the current job embedding.")
