"""Create Gemini embeddings for candidates (and jobs) that do not have one yet, in batches.

Why: imported candidates have no embeddings, so ranking uses a keyword role-fit score. Embeddings add true semantic similarity.
Safe to stop (Ctrl+C) and re-run: each batch is saved, and only rows without an embedding are processed.

Examples (backend folder, venv active):
  python embed_candidates.py --top 300                      # the 300 best-ranked candidates across all jobs
  python embed_candidates.py --job-id <JOB_ID> --top 500    # the 500 best for one job (Rankings page URL has jobId=...)
  python embed_candidates.py --all                          # everyone without an embedding (slow, uses much quota)
  python embed_candidates.py --top 300 --dry-run
After it finishes, open Rankings and click "Re-rank candidates".
"""
import argparse
import time
from typing import List, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import defer

from app import models  # noqa: F401
from app.db.session import SessionLocal
from app.models import Candidate, Job, Match
from app.core.errors import AIError
from app.services import gemini

MAX_CHARS = 2000  # shorter text = fewer tokens per request (free tier has a tokens-per-minute limit)


def _has_embedding_clause(model):
    return model.embedding.is_not(None)


def ids_to_embed(db, job_id: Optional[str], top: Optional[int]) -> List[str]:
    done = set(db.execute(select(Candidate.id).where(_has_embedding_clause(Candidate))).scalars())
    q = select(Match.candidateId, func.max(Match.overallScore).label("s")).group_by(Match.candidateId).order_by(func.max(Match.overallScore).desc())
    if job_id:
        q = select(Match.candidateId, Match.overallScore.label("s")).where(Match.jobId == job_id).order_by(Match.overallScore.desc())
    ranked = [r[0] for r in db.execute(q).all()]
    seen, out = set(), []
    for cid in ranked:
        if cid not in done and cid not in seen:
            seen.add(cid)
            out.append(cid)
    if not job_id:  # candidates never ranked come last
        rest = [c for c in db.execute(select(Candidate.id).order_by(Candidate.createdAt)).scalars() if c not in done and c not in seen]
        out += rest
    return out[:top] if top else out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--top", type=int, default=300, help="how many candidates to embed (best-ranked first); default 300")
    ap.add_argument("--all", action="store_true", help="embed every candidate that has no embedding")
    ap.add_argument("--job-id", help="rank candidates by their score for this job")
    ap.add_argument("--batch", type=int, default=20, help="texts per API request (max 100); default 20")
    ap.add_argument("--pause", type=float, default=25.0, help="seconds to wait between requests; default 25 (free-tier friendly)")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    batch = max(1, min(a.batch, 100))

    db = SessionLocal()
    try:
        # jobs first (few, and they drive the semantic score)
        for j in db.execute(select(Job).options(defer(Job.embedding))).scalars().all():
            if db.execute(select(Job.id).where(Job.id == j.id, Job.embedding.is_not(None))).first() is None and not a.dry_run:
                j.embedding = gemini.generate_embedding(j.rawDescription[:MAX_CHARS])
                db.commit()
                print(f"Embedded job: {j.title}")
        ids = ids_to_embed(db, a.job_id, None if a.all else a.top)
        print(f"{len(ids)} candidates to embed (batch size {batch}).")
        if a.dry_run or not ids:
            return
        t0, done = time.time(), 0
        for i in range(0, len(ids), batch):
            chunk = ids[i:i + batch]
            cands = db.execute(select(Candidate).where(Candidate.id.in_(chunk)).options(defer(Candidate.embedding))).scalars().all()
            texts = [(c.rawResumeText or f"{c.headline or ''} {c.summary or ''}")[:MAX_CHARS] or c.name for c in cands]
            vecs = None
            for attempt in range(1, 9):  # rate limit (429) / overload: wait a minute and retry the same batch
                try:
                    vecs = gemini.generate_embeddings_batch(texts)
                    break
                except AIError as exc:
                    print(f"  Gemini is rate-limiting or busy ({str(exc)[:90]}). Waiting 65s, then retrying (attempt {attempt}/8)...", flush=True)
                    time.sleep(65)
            if vecs is None:
                print("Still limited after several waits - likely the free daily quota. Progress is saved; run the same command later (or tomorrow).")
                return
            for c, v in zip(cands, vecs):
                c.embedding = v
            db.commit()
            done += len(cands)
            rate = done / max(time.time() - t0, 1e-6)
            print(f"  {done}/{len(ids)} embedded  (~{(len(ids) - done) / rate / 60:.1f} min left)", flush=True)
            time.sleep(a.pause)
        print(f"Done: {done} candidates embedded. Now open Rankings and click 'Re-rank candidates'.")
    except KeyboardInterrupt:
        print("\nStopped. Progress is saved; run the same command again to continue.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
