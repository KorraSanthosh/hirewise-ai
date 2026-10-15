# HireWise AI — AI-Powered Candidate Ranking System

HireWise AI is a modern, enterprise-ready candidate semantic matching and ranking application designed for recruiters. By utilizing advanced LLM semantic parsing and vector similarity, HireWise AI eliminates simple keyword matching in favor of deep suitability analysis, recruiter-aligned explainability, and comprehensive skill-gap visualizations.

---

## 🚀 Key Features
- **Semantic Job Description Analysis**: Extracts required skills, soft skills, seniority, responsibilities, education, and domain context from raw text.
- **Deep Candidate Profiling**: Automatically parses PDF/CSV resumes, extracts structured work history, projects, certifications, and technical capabilities using Google Gemini API.
- **Hybrid Ranking Engine**: Blends vector embeddings cosine similarity (`text-embedding-004`) with rules (experience duration, seniority tiers, skills overlap, projects context) for highly accurate scoring.
- **Explainable AI (XAI)**: Generates actionable reports explaining *why* a candidate ranks where they do (Strengths, Weaknesses, Missing Skills, Hiring Recommendation, and Improvement Suggestions).
- **Recruiter Dashboard & Analytics**: Features a candidate leaderboard, comparative radar charts, hiring funnel analytics, and interactive search/filtering.

---

## 🛠️ Technology Stack
- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Framer Motion
- **Backend**: Next.js App Router API Routes, Prisma ORM, PostgreSQL + `pgvector`
- **AI Engine**: Google Gemini API, `text-embedding-004` Embeddings, custom Hybrid Ranker
- **Utility & Charts**: Recharts, React Hook Form, Zod, TanStack Table, PDF-parse, CSV-parse

---

## 📁 Repository Structure
```
hirewise-ai/
├── docs/                    # Architecture and API documentation
├── public/                  # Static assets
└── src/
    ├── app/                 # Next.js App router (pages, layouts, API endpoints)
    ├── components/          # Reusable UI elements (dashboard, radar charts, tables)
    ├── core/                # Core constants, configurations, custom error boundaries
    ├── domain/              # Pure interfaces defining domain data models
    ├── hooks/               # Custom React hooks
    ├── lib/                 # Singletons and clients (Prisma, Gemini API)
    ├── schemas/             # Zod validation schemas
    ├── services/            # Core business services (ranking, parsing, analytics)
    └── types/               # Type declarations
```

---

## ⚙️ Installation & Development

### 1. Prerequisites
- Node.js (v18.x or later)
- PostgreSQL (with `pgvector` extension installed)
- Google Gemini API Key

### 2. Environment Setup
Create a `.env` file in the root directory:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/hirewise_db?schema=public"
GEMINI_API_KEY="your_google_gemini_api_key"
NEXTAUTH_SECRET="your_nextauth_jwt_secret"
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Database Setup
```bash
npx prisma db push
```

### 5. Running the Application
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the recruiter console.
