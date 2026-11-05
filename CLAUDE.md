# CLAUDE.md — RC3 Recruitment & Talent Intelligence Platform

Read `PRD.md` first. It is the source of truth: every requirement has an ID (AUTH-1, RES-3, MATCH-2…) and a priority (P0/P1/P2). Reference IDs in commits.

## Context
- Hackathon, **5 hours total**, 2-person team. Speed and reliability beat feature count.
- The judges run the **official demo scenario** (PRD §12): Backend Developer job (Python, Django, PostgreSQL, Docker) → 3 candidates apply → AI scores with evidence and gaps → recruiter shortlists one → generates interview questions → schedules interview → dashboard updates. **This flow must never break.**
- Rubric (PRD §1.1): architecture/completeness 30, AI & matching 25, resume parsing 15, UI 15, innovation/testing/security/deployment 15.

## Stack
- Next.js App Router + TypeScript, created from the official `with-supabase` template (auth, SSR clients and middleware already exist — reuse them, don't rewrite).
- Tailwind + shadcn/ui for all UI. Recharts for charts.
- Supabase: Postgres, Auth, Storage (private `resumes` bucket), pgvector.
- AI: Gemini via `@google/genai`, key in `GEMINI_API_KEY` (server only). Use structured JSON output. Embedding dimension in the schema must match the embedding model used.
- PDF text: `unpdf`. Validation: `zod`. Tests: `vitest`.

## Rules
- **Build P0 first, in demo-flow order.** Don't start P1/P2 until the demo flow works end to end.
- **No hardcoded AI responses.** Every AI feature calls the real model. Mock data only in `lib/mock-api.ts` for UI development.
- **Secrets:** never put the Gemini key or Supabase secret key in client code or `NEXT_PUBLIC_` vars. All AI calls live in `app/api/*` route handlers.
- **Security:** RLS on every table. Candidates must never see recruiter notes, interview feedback, other candidates, or recruiter pages. Check session + role in every API route. Validate input with zod.
- **Human in control:** AI never changes application status to shortlisted/rejected/selected. Only recruiter button actions do. Every status change writes an `application_events` row.
- **AI results are stored, not recomputed:** parse once at upload, match once at apply (plus explicit "re-score"). Never call the AI on page load.
- **Weighted score is computed in code** (`0.5 skills + 0.25 experience + 0.15 projects + 0.10 qualifications`), not by the LLM.
- **Hallucination check in code:** every excerpt the AI returns is checked against the raw resume text; not found → `verified: false`, shown with an "Unverified" badge.
- **Fairness:** strip name, contact, address, gender, age/DOB, religion, marital status, nationality, photo references before any scoring call.
- **Every page has loading, empty and error states.** AI failures retry once, then show a clear message.
- Keep it simple: no extra services, no separate backend server, no new libraries unless needed.

## Structure
```
app/                 pages (candidate/*, recruiter/*, auth)
app/api/             route handlers (resume/parse, job/extract, match, questions, search, ...)
lib/supabase/        clients from the template
lib/ai/              gemini client, prompts, scoring, verification, fairness
lib/api.ts           data functions the UI calls
lib/mock-api.ts      same signatures with fake data
lib/types.ts         shared types
supabase/schema.sql  full schema + RLS (run in Supabase SQL editor)
supabase/seed.sql    demo data
tests/               vitest unit tests
```

## Tests to have (rubric: testing)
Scoring weights, excerpt verification, fairness stripping (score unchanged when protected attributes change), skill normalization, interview conflict detection.

## Workflow
- Branches: `frontend` and `backend`; merge to `main` often; `main` auto-deploys to Vercel.
- After each feature: run `npm run build` and fix type errors before committing.
