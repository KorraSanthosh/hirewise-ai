# Architecture & Design Document: HireWise AI

This document provides a comprehensive view of the architectural principles, data flow, and design patterns utilized in **HireWise AI**.

## 1. Design Philosophy
HireWise AI strictly adheres to **Clean Architecture** and the **SOLID Principles** to ensure the project remains modular, scalable, testable, and maintainable.

### Separation of Concerns
1. **App Router & Presentation Layer (`src/app`, `src/components`, `src/hooks`)**: Handles the user interface, routing, and user interactions. No business logic or database queries live in this layer.
2. **Services Layer (`src/services`)**: Contains the business logic of the application (e.g. executing the ranking mathematics, initiating LLM parsing via Gemini, compiling analytics).
3. **Domain Layer (`src/domain`)**: Defines framework-independent entities and models. If we switch frameworks, database adapters, or AI libraries, these core definitions remain unchanged.
4. **Data Layer (`src/lib`)**: Handles data persistence (Prisma ORM connected to PostgreSQL + pgvector) and external API integrations (Google Gemini Client).

---

## 2. Core Pipelines & Workflows

### Candidate Parsing Pipeline
```
[Resume PDF/CSV Upload] ──> [Text Extraction] ──> [Gemini Structuring Prompt] ──> [JSON Schema Validation] ──> [Save to DB]
                                                                                                        │
                                                                                                        └──> [Generate Embedding (text-embedding-004)]
```

### Hybrid Ranking Pipeline
```
                    ┌─── [Calculate Skill Similarity Score (Jaccard Overlay)] ──┐
                    ├─── [Calculate Experience & Seniority Gap Scores] ──────────┤
[Recruiter Matches] ├─── [Calculate Education Rank Matching Score] ──────────────┼───> [Weighted Scoring Aggregate]
                    ├─── [Calculate Project & Domain Suitability via LLM] ───────┤
                    └─── [Calculate Cosine Similarity of Embeddings via SQL] ────┘
```

---

## 3. Technology Rationale

### Next.js 15 & React
- **App Router**: Enables server-side rendering (SSR), static site generation (SSG), and streamable Server Components to render dashboards and candidate profiles instantly.
- **Server Actions & API Routes**: Modern API structure, unified routing, and native support for server-side operations (like database interactions and PDF parsing) without requiring a separate backend.

### PostgreSQL & pgvector
- **Vector Search Native to DB**: Storing 768-dimension vectors from Gemini's `text-embedding-004` directly in PostgreSQL avoids the complexity and latency of syncing a separate vector database (e.g. Pinecone).
- **Prisma Integration**: Utilizes PostgreSQL extensions seamlessly, supporting vector operations directly through SQL client extensions or raw query mapping.

### Google Gemini API
- **Gemini 1.5/2.0 Pro/Flash**: Exceptionally large context window and high extraction accuracy. The structured output generation (JSON mode) ensures that resume parses match our exact TypeScript schemas every single time.
- **text-embedding-004**: State-of-the-art embedding model capturing deep semantic meaning in professional profiles, matching job roles, domains, and transferrable skills accurately.
