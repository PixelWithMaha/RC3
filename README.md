# RC3 — Recruitment & Talent Intelligence Platform

AI-assisted hiring where **every score points back to a line in the resume**. Recruiters see matched skills, gaps and evidence; the AI only recommends — every shortlist, rejection and decision is a recruiter action written to an audit trail.

**Live:** _add your Vercel URL here_ · **Spec:** [`PRD-2.md`](PRD-2.md)

## Features
| Area | What it does | PRD |
|---|---|---|
| Auth & roles | Email/password, role picked at sign-up, role-guarded `/recruiter` and `/candidate`, RLS on every table | AUTH-1..8 |
| Jobs | CRUD, close/reopen, required/preferred skills with importance, **AI extraction from free-text JD**, job embeddings | JOB-1..8 |
| Resume parsing | PDF → text (`unpdf`) → Gemini structured JSON → skill normalization (JS→JavaScript) → **every excerpt verified against raw text** → embeddings + chunks; candidate can correct | RES-1..8 |
| Matching | Fairness-stripped resume → per-skill assessment (semantic) → **weighted score in code** (50/25/15/10) → gaps split into *missing evidence* vs *confirmed absence*, learning suggestions, unverified claims downgraded | MATCH-1..6, GAP-1..5 |
| Pipeline | Apply, ranked applicants + filters, manual status changes, private notes, score override with reason, full audit trail | PIPE-1..6 |
| Interviews | Role + project questions per difficulty with answer guidelines (edit/remove/regenerate), conflict-aware scheduling, structured feedback, final decision | QUES, INT |
| Analytics | KPIs, applications by job/stage, shortlist rate, processing time, common gaps | AN-1..6 |
| Talent intelligence | Natural-language semantic search over pgvector resume chunks with evidence; fairness stripping; hallucination flags | TI-1/2/7/8 |

## Architecture
```
Next.js (App Router, TS) ── app/candidate/*, app/recruiter/*   UI (shadcn + Tailwind, Recharts)
        │                    lib/api.ts                          data functions the UI calls
        ├── app/api/*  (server only, zod + session/role checks)
        │     resume/parse · job/extract · jobs · match · questions · interviews/check-conflict · search
        │     └── lib/ai/  gemini client (structured JSON, retry on fallback model) · prompts · fairness
        │                  · verify (hallucination check) · normalize · scoring · match builder
        └── Supabase: Postgres + RLS · Auth · Storage (private `resumes`) · pgvector (768-d)
```
Key safeguards, enforced in the **database**, not just the UI:
- RLS on all tables; candidates can never read notes, interview feedback, overrides or other candidates.
- A trigger blocks the AI/service role from setting `shortlisted / rejected / interview / selected`; only the job owner can.
- Every status change writes an `application_events` row automatically.
- AI results are stored once (parse at upload, match at apply, explicit re-score) — never computed on page load.

## Setup
```bash
npm install
cp .env.example .env.local      # fill in Supabase + Gemini keys
```
1. In the Supabase SQL editor run [`supabase/schema.sql`](supabase/schema.sql).
2. Authentication → Sign In / Providers → turn **Confirm email** off (for the demo) and save.
3. Authentication → URL Configuration → add your local and Vercel URLs.
4. `npm run dev` → http://localhost:3000

Vercel: set the same four env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY`).

## Demo data
One command seeds everything through the **real** app routes (Gemini parses and scores; nothing is hardcoded):
```bash
npm run dev                                         # in another terminal (or set SEED_BASE_URL to your Vercel URL)
DEMO_PASSWORD='choose-one' npm run seed:all
```
It creates (re-runnable, existing rows are reused):
- **Recruiters:** `recruiter@rc3.demo` (Backend Developer, Data Analyst) · `talent@rc3.demo` (Frontend Developer, DevOps Engineer)
- **Candidates** with parsed PDF resumes from `public/demo/`: ayesha, bilal, hina, zara, omar, usman `@rc3.demo`
- **9 applications**, each AI-scored; on the non-demo jobs a few recruiter actions (shortlists, one rejection, one scheduled interview)
- The **Backend Developer** job keeps the official trio (strong / partial / weak) at *AI assessed*, ready for the live demo

| Resume | Expected result for "Backend Developer (Python, Django, PostgreSQL, Docker)" |
|---|---|
| `strong-ayesha-khan.pdf` | All four matched with excerpts |
| `partial-bilal-ahmed.pdf` | Python matched, Flask/MySQL partial, Docker **missing evidence** |
| `weak-hina-raza.pdf` | Frontend only, "No backend experience" → **confirmed absence** |

Other commands: `npm run seed:pdfs` (regenerate PDFs), `npm run seed:accounts` (accounts only).

## Demo script (PRD §12)
1. Sign in as the recruiter → **Jobs → New job** → paste the JD → **Extract with AI** → publish.
2. Sign in as each candidate → **Resume** → upload their PDF → review parsed skills → **Jobs** → apply.
3. Recruiter → the job → ranked applicants → open the top one: score breakdown, excerpts, gaps.
4. **Shortlist** with a note → **Generate** questions → schedule an interview (try an overlapping slot to see the conflict warning).
5. **Dashboard** updates; try **Talent search**: "Python developers with REST API experience".

## Tests
```bash
npm test
```
Unit tests cover scoring weights, excerpt verification, fairness stripping (score unchanged when protected attributes change), skill normalization, interview conflict detection, match building, job extraction and analytics.
