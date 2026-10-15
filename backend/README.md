# HireWise AI — FastAPI backend

Replaces the Next.js API routes. It talks to the **same PostgreSQL + pgvector database** the Prisma app used —
the SQLAlchemy models in `app/models.py` map 1:1 onto the existing tables (`User`, `Job`, `Candidate`, `CareerHistory`,
`Education`, `Skill`, `Match`), so there is no migration and no data copy.

## Run
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # or just keep using the repo-root .env: DATABASE_URL and GEMINI_API_KEY are read from it
uvicorn app.main:app --reload --port 8000
```
Interactive API docs: http://localhost:8000/docs

* `DATABASE_URL` — Prisma-style URLs work as-is (`?schema=public` is stripped).
* `JWT_SECRET` — falls back to `NEXTAUTH_SECRET` from the root `.env`.
* **Existing users keep working**: password hashes are bcrypt (`bcryptjs` ↔ `bcrypt` compatible). Tokens are new, so users sign in again once.
* The scoring weights/bands live in `app/config/scoring_config.json` (copy of `scripts/config.json`).
* Never run `app.db.init_db` against the Postgres database (it refuses to); that script is for fresh SQLite dev DBs only.

## Tests
```bash
pytest -q     # uses in-memory SQLite and a faked Gemini - no network, no real DB
```

## API (same paths as before, plus `/api/auth/login|me`)
| Method & path | Who | Notes |
|---|---|---|
| POST `/api/auth/register`, `/api/auth/login`; GET `/api/auth/me` | public / any | JWT bearer auth replaces NextAuth |
| GET/POST `/api/jobs`; GET/PUT/DELETE `/api/jobs/{id}` | any / recruiter+admin | POST parses the JD with Gemini and stores a pgvector embedding |
| POST `/api/jobs/upload` | recruiter+admin | same as POST `/api/jobs`, legacy response shape |
| POST `/api/jobs/{id}/rank` | recruiter+admin | optional `{weights}`; semantic score computed in SQL with pgvector `<=>` |
| POST `/api/jobs/{id}/evaluate` | recruiter+admin | multipart PDF → new candidate → match |
| GET/POST `/api/matches`, PATCH `/api/matches/{id}`, POST `/api/matches/{id}/explain` | by role | |
| POST `/api/candidates/upload`, GET `/api/candidates/{id\|candidateId\|userId\|profile}` | by role | |
| GET `/api/dashboard/stats\|analytics\|candidates` | recruiter+admin | |

## Intentional behaviour changes vs. the Next.js app
* `rank`, `explain` (which were unauthenticated) now require recruiter/admin.
* A recruiter/admin resume upload now creates a **new** candidate each time (before it overwrote the recruiter's single candidate row).
* Candidate "apply" and resume evaluation score only that candidate instead of re-scoring the whole pool.
* Ranking/matches responses are capped (`limit`, default 200 / 500) so a 100k pool doesn't produce a 100k-row response.
