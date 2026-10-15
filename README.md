# HireWise AI

AI-powered hiring platform. **Recruiters** get an explainable, role-wise ranked shortlist; **candidates** upload a resume, keep a full profile (with photo) and see how they match every job.

It also contains the ranking pipeline used for the **Redrob Data & AI Challenge** hackathon (100,000-candidate pool).

> Current app = **FastAPI backend + React frontend** (`backend/`, `frontend/`). The earlier Next.js/Prisma app is kept in `src/`, `prisma/` for reference only; both share the same PostgreSQL + pgvector database (`hirewise_db`).

---

## Features

### Recruiter
- Dashboard: stats, analytics, **Browse by role** cards (ML / AI Engineer, Data Scientist, Data Engineer, Data / BI Analyst, Backend / Full-stack, Frontend / UI, DevOps / Cloud, Product / Management, Other) and a status filter (new, shortlisted, rejected …).
- Jobs: paste or upload a job description → Gemini parses skills, seniority, domain; an embedding is stored.
- Rankings: per-job ranked candidates with score breakdown (semantic, skills, experience, education, career, availability), anomaly flags and an AI explanation (strengths, gaps, recommendation).
- Upload resumes (PDF); **duplicate resumes are detected and reused** instead of creating a second profile.
- Role-specific ranking: an ML job ranks ML engineers first, a Backend job ranks backend engineers first – even before embeddings exist (lexical role-fit fallback).

### Candidate
- Separate **Recruiter / Candidate** selector on the login page.
- My profile: personal & job details, availability & preferences, skills, experience, education, platform signals, **profile photo** (upload / change / remove).
- Upload / update resume → profile is filled automatically by Gemini.
- Available jobs and My applications (match score per job).
- Time-aware animated greeting (morning / afternoon / evening / night), Light / Dark / System theme.

---

## Tech stack

| Layer | Tech |
|---|---|
| Backend | Python 3.10+, FastAPI, SQLAlchemy 2.0, Pydantic v2, pydantic-settings, PyJWT, bcrypt, pypdf |
| Database | PostgreSQL + **pgvector** (`Vector(768)`, cosine `<=>`) |
| AI | Google Gemini (`google-genai`): JSON-schema generation for resume/JD parsing and explanations, `embed_content` (768-dim) for embeddings |
| Frontend | React 18, Vite 5, TypeScript (strict), react-router v6, recharts, lucide-react, plain CSS variables |
| Tests | pytest + FastAPI TestClient |

---

## How ranking works

Final score = weighted sum, multiplied by an anomaly multiplier.

| Component | Weight |
|---|---|
| Semantic similarity (resume vs job embeddings) | 0.40 |
| Skills match (with alias normalisation) | 0.20 |
| Experience | 0.15 |
| Education | 0.10 |
| Career progression | 0.05 |
| Availability | 0.05 |

(Domain fit is computed for display but is not part of the sum; the maximum overall score is therefore 0.95.)

- **Anomaly multipliers:** HIGH = 0 (excluded), MEDIUM = 0.70, LOW = 0.95, CLEAN = 1.
- **No embedding yet?** `lexical_fit` (50 % role-category match + 50 % keyword/skill cosine) stands in for the semantic score. If that is impossible, weights are renormalised.
- **Role category** is decided by a title regex first, then skill sets (needs ≥ 2 skill hits).

## Gemini handling
- Default model `gemini-3.8-flash` with fallbacks `gemini-3.5-flash, gemini-3.1-flash-lite, gemini-flash-latest` (set via `GEMINI_MODEL`, `GEMINI_FALLBACK_MODELS`).
- Retries with 2 s / 4 s / 8 s back-off on 429 / 503 / 504 / timeouts; 120 s client timeout.
- Placeholder / invalid keys give a clear error. Run `python check_gemini.py` to diagnose a key.
- Free-tier embedding quota is small → `embed_candidates.py` batches, pauses and resumes safely.

---

## Project layout

```
backend/
  app/
    main.py                 FastAPI app, serves built frontend
    models.py, schemas.py   DB models (existing Prisma tables) and API schemas
    api/                    auth, candidates (+photo), jobs, matches, dashboard
    services/               gemini, ranking, matching, categories, anomaly, pdf_parser, photos
    core/ config/ db/       settings, security, DB session
  tests/                    pytest suite (scoring, API, categories, photos)
  import_candidates.py      import tech-role candidates from the 100k hackathon file
  embed_candidates.py       embed jobs + best-ranked candidates (quota-safe)
  check_gemini.py           test key, models, embeddings
  check_duplicates.py       report duplicate resumes and their scores
frontend/
  src/pages/                Login/Register, Dashboard, Jobs, Rankings, Evaluate,
                            CandidateProfile, UploadResume, Applications
  src/components/           Layout, Greeting, Avatar, ThemeToggle, ui
scripts/                    hackathon ranking pipeline (rank.py, scorers.py, anomaly.py, …)
docs/                       ARCHITECTURE.md, HACKATHON_ANALYSIS.md, legacy Next.js README
start-hirewise.command      one-click macOS launcher
submission_v2.csv           final hackathon submission (ranked 100k pool)
```

---

## Run it

### Prerequisites
Python 3.10+, Node 18+, PostgreSQL with the `pgvector` extension and a database (default `hirewise_db`) that already has the tables (created by `prisma/schema.prisma`).

### 1. Configure
```bash
cp backend/.env.example backend/.env
# edit DATABASE_URL, JWT_SECRET, GEMINI_API_KEY
```
Never commit `.env` – it is git-ignored.

### 2. One click (macOS)
Double-click `start-hirewise.command` → app at **http://localhost:8000**.

### 3. Manual
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000

# frontend dev mode (optional)
cd ../frontend && npm install && npm run dev      # http://localhost:5173
# production build served by the backend
npm run build
```

### 4. Tests
```bash
cd backend && python -m pytest -q
cd ../frontend && npx tsc -b
```

### 5. Load the hackathon pool (optional)
```bash
cd backend
python import_candidates.py --dry-run          # preview
python import_candidates.py --per-title 300    # import tech-role candidates
python embed_candidates.py --top 300           # embed best-ranked (quota-safe, repeatable)
```
Then open each job → **Re-rank candidates**.

---

## API (all under `/api`)

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Candidates | `POST /candidates/upload`, `GET /candidates/{id}` (`profile` = own), `GET/POST/DELETE /candidates/{id}/photo` |
| Jobs | `GET/POST /jobs`, `POST /jobs/upload`, `GET/PUT/DELETE /jobs/{id}`, `POST /jobs/{id}/rank`, `POST /jobs/{id}/evaluate` |
| Matches | `GET/POST /matches`, `PATCH /matches/{id}`, `POST /matches/{id}/explain` |
| Dashboard | `GET /dashboard/stats`, `/analytics`, `/categories`, `/candidates?category=&status=&limit=` |

Interactive docs: http://localhost:8000/docs

## Profile photos
Stored as files in `backend/uploads/photos/<id>.<ext>` (JPG/PNG/WebP, max 2 MB), not in the database; the folder is git-ignored. Photos are served publicly by unguessable candidate id so `<img>` works without a token.

## Hackathon (Redrob Data & AI Challenge)
`scripts/` holds the offline pipeline that scored the 100k pool (`rank.py`, `scorers.py`, `anomaly.py`); results are in `submission_v2.csv`. Analysis and limitations: `docs/HACKATHON_ANALYSIS.md`. The raw 466 MB `candidates.jsonl` is **not** in git – place it under `data /India_runs_data_and_ai_challenge/` to reproduce.

## Security notes
JWT auth with bcrypt-hashed passwords, role checks on every route (candidates can only touch their own record), uploads validated by magic bytes and size. Keep `.env` and API keys out of git.
