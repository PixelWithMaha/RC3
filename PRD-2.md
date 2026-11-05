# PRD — Recruitment & Talent Intelligence Platform (RC3)

**Team:** 2 members (Frontend + Backend) · **Time budget:** 5 hours · **Repo:** github.com/PixelWithMaha/RC3

---

## 1. Product Overview

An AI-powered recruitment platform where recruiters publish jobs, process resumes, evaluate job-related qualifications, shortlist applicants, schedule interviews and understand recruitment activity.

**Core principles (from the brief):**
- **Semantic matching**, not simple keyword matching.
- **Explainable recommendations** — every score shows matched skills, gaps and resume evidence.
- **Human in control** — AI only recommends; every hiring decision (shortlist, reject, advance, select) is a manual recruiter action.
- **Real AI** — hardcoded AI responses do not count. Every AI feature calls a real LLM / embedding model.

---

## 1.1 Evaluation Rubric (100 marks) — build toward this

| Criterion | Marks | What earns it here |
|---|---|---|
| Architecture & functional completeness | 30 | Clean structure (`app/`, `lib/`, `app/api/`), every P0 requirement working end to end, the official demo flow never breaks |
| AI implementation & matching quality | 25 | Real LLM + embeddings, semantic (not keyword) matching, weighted explainable score, verified evidence, missing-vs-absent gaps |
| Resume parsing & extraction | 15 | Accurate structured extraction, skill normalization, excerpts per skill, candidate corrections, graceful failures (empty/scanned/wrong type) |
| UI & experience | 15 | Consistent shadcn UI, clear role dashboards, loading/empty/error states, score breakdown that is easy to read |
| Innovation, testing, security & deployment | 15 | Talent search + hallucination flags + fairness test (innovation); unit tests for scoring, excerpt verification, fairness stripping, conflict detection (testing); RLS + server-only keys + zod (security); live Vercel URL (deployment) |

---

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind + shadcn/ui |
| Backend logic | Next.js Route Handlers (`app/api/*`) — server-only, holds AI keys |
| Database | Supabase Postgres |
| Auth | Supabase Auth (email/password, sessions via cookies) |
| File storage | Supabase Storage (`resumes` bucket, private) |
| Semantic search | pgvector extension in Supabase |
| PDF parsing | `unpdf` (or `pdf-parse`); DOCX optional via `mammoth` |
| LLM | Gemini or OpenAI (structured JSON output) |
| Embeddings | Same provider's embedding model (dimension set in schema to match) |
| Charts | Recharts |
| Deploy | Vercel |

---

## 3. User Roles

| Role | Can do |
|---|---|
| **Recruiter** | Manage vacancies, review candidates, shortlist applications, schedule interviews, record feedback & final decisions, view analytics, use talent search |
| **Candidate** | Maintain profile, upload resume, review/correct parsed data, apply for jobs, track application status, see recommended jobs |

Role is chosen at sign-up and stored in `profiles.role`.

---

## 4. Functional Requirements

Priority: **P0** = must demo · **P1** = should build · **P2** = if time permits.

### 4.1 Authentication & Access Control — P0
| ID | Requirement |
|---|---|
| AUTH-1 | Recruiter registration, login, logout |
| AUTH-2 | Candidate registration, login, logout |
| AUTH-3 | Role selected at sign-up, stored in `profiles` |
| AUTH-4 | Role-based dashboards: `/recruiter/*` and `/candidate/*` |
| AUTH-5 | Authorization: candidates cannot access recruiter-only data or pages (middleware route guard **and** Supabase RLS) |
| AUTH-6 | Secure password handling (Supabase Auth hashing; never store passwords ourselves) |
| AUTH-7 | Session management (Supabase SSR cookies, auto refresh in middleware) |
| AUTH-8 | Input validation on all forms and API routes (zod) |

**Acceptance:** A logged-in candidate visiting `/recruiter/...` is redirected; an API call for another user's data returns nothing (RLS).

### 4.2 Job Posting & Management — P0
| ID | Requirement |
|---|---|
| JOB-1 | Create job with title, department, location, type (full-time/part-time/internship/contract/remote), salary, description |
| JOB-2 | Edit job |
| JOB-3 | Close and reopen job (`status: open/closed`) |
| JOB-4 | Specify **required** and **preferred** skills, each with **importance** (1–5) |
| JOB-5 | Specify minimum experience (years) and qualifications |
| JOB-6 | List vacancies with **applicant counts** |
| JOB-7 | **AI extraction of requirements from free-text description** → auto-fills skills, importance, experience, qualifications (recruiter reviews before saving) |
| JOB-8 | Store job embedding for semantic matching and talent pool discovery |

### 4.3 Resume Upload & Parsing — P0
| ID | Requirement |
|---|---|
| RES-1 | Upload PDF resume (stored in Supabase Storage) |
| RES-2 | DOCX support (optional, P2) |
| RES-3 | Extract: name, contact info (email, phone, links), skills, education, relevant experience, projects |
| RES-4 | **Normalize equivalent terms** (JS → JavaScript, ReactJS → React, Postgres → PostgreSQL) via prompt + small alias map |
| RES-5 | Store structured result as JSON + raw text + embedding |
| RES-6 | **Candidate can view and correct** parsed fields; corrected data is marked `verified` |
| RES-7 | Graceful handling of: unsupported file type, empty resume / no extractable text (e.g. scanned image), file too large, AI parsing failure → clear error message, no crash, retry option |
| RES-8 | Each extracted skill stores a **source excerpt** from the resume (feeds hallucination check) |

### 4.4 Candidate Matching — P0
| ID | Requirement |
|---|---|
| MATCH-1 | Compare candidate evidence with job requirements using **semantic similarity** (embeddings + LLM reasoning), not only exact keywords |
| MATCH-2 | Produce an **explainable job-relevance score (0–100)** with matched skills, gaps and supporting evidence |
| MATCH-3 | Weighted scoring: **skills 50%, experience 25%, project relevance 15%, qualifications 10%** (LLM gives sub-scores 0–100; weighted total computed in code, not by LLM) |
| MATCH-4 | Rank applicants per job for recruiter review |
| MATCH-5 | Manual filters (min score, status, skill) and sorting |
| MATCH-6 | **Recruiter override** of score/rank with a reason (logged in audit trail) |

**Scoring formula:** `total = 0.5*skills + 0.25*experience + 0.15*projects + 0.10*qualifications`
Skills sub-score weights each required skill by its importance; preferred skills count at half weight.

### 4.5 Skill Gap & Explainability — P0
| ID | Requirement |
|---|---|
| GAP-1 | Distinguish **missing evidence** (`not_mentioned`) from **confirmed absence** (`explicitly_lacking`) for each gap |
| GAP-2 | Show supporting **resume excerpts** for each matched skill and claim |
| GAP-3 | Plain-language explanation for each recommendation |
| GAP-4 | Suggest **learning areas** for gaps |
| GAP-5 | **Recruiter can correct extracted skills** (add/remove/edit) → score can be recomputed |

### 4.6 Application Pipeline — P0
| ID | Requirement |
|---|---|
| PIPE-1 | Candidate submits application (one per job) |
| PIPE-2 | Candidate views application status |
| PIPE-3 | Recruiter views applications, and **manually** shortlists, rejects or advances |
| PIPE-4 | Recruiter adds **private notes** (never visible to candidate) |
| PIPE-5 | **Audit trail** of every status change: from, to, who, when, reason |
| PIPE-6 | States: `submitted → parsed → ai_assessed → recruiter_review → shortlisted / rejected → interview → selected / rejected` |

`submitted → parsed → ai_assessed` are automatic system transitions; all others are recruiter actions.

### 4.7 Interview Question Generation — P1
| ID | Requirement |
|---|---|
| QUES-1 | Generate role-specific questions at **beginner / intermediate / advanced** difficulty |
| QUES-2 | Generate questions about the **candidate's own projects** |
| QUES-3 | Provide **answer guidelines** for each question |
| QUES-4 | Recruiter can **edit, remove and regenerate** questions |

### 4.8 Interview Scheduling & Feedback — P1
| ID | Requirement |
|---|---|
| INT-1 | Schedule date, time, duration, interviewer, interview type (technical / HR / culture / final) |
| INT-2 | Show interview schedules (list per recruiter, per application) |
| INT-3 | **Flag scheduling conflicts** (same interviewer or same candidate, overlapping time) |
| INT-4 | Store **structured feedback**: ratings (technical, communication, problem solving, culture fit, 1–5), strengths, concerns, recommendation |
| INT-5 | Only authorized recruiters (job owner) record **final decisions** (selected / rejected) |
| INT-6 | Notifications **simulated** (in-app notification row / toast) |

### 4.9 Recruitment Analytics — P1
| ID | Requirement |
|---|---|
| AN-1 | KPI cards: active jobs, total applications, shortlisted, pending reviews, upcoming interviews |
| AN-2 | Chart: applications by job |
| AN-3 | Chart: applications by stage (funnel) |
| AN-4 | **Application-to-shortlist rate** |
| AN-5 | **Average processing time** (submitted → final decision, from audit trail) |
| AN-6 | **Common skill gaps** across applicants (top N, per job and overall) |

### 4.10 Advanced Talent Intelligence
| ID | Requirement | Priority |
|---|---|---|
| TI-1 | **Natural-language talent search** (e.g. "Python developers with REST API experience") → matching applicants with resume evidence | P1 |
| TI-2 | **Semantic resume search** — resume text chunks embedded and indexed (pgvector); finds candidates even with different wording | P1 |
| TI-3 | **Duplicate application detection** — normalized email/phone + document embedding similarity; recruiter **confirms before merging** | P2 |
| TI-4 | **Resume-to-job recommendations** for candidates using verified skills, interests and project experience | P2 |
| TI-5 | **Talent pool discovery** — when a job is published, search previously reviewed applicants, respecting permissions and data retention | P2 |
| TI-6 | **Candidate comparison** — side-by-side evidence, missing info and score explanations for selected applicants | P2 |
| TI-7 | **Fairness & bias safeguards** — strip protected/irrelevant attributes (name, gender, age, DOB, photo, religion, marital status, nationality, address) before scoring; **counterfactual test** button that changes such attributes and shows the score is unchanged | P1 (stripping) / P2 (test) |
| TI-8 | **AI hallucination verification** — every extracted skill and generated claim links to an actual resume excerpt; excerpts not found in the raw text are **flagged "unverified"** for manual review | P0 |

---

## 5. Data Model (Supabase)

```
profiles            id (=auth.users.id), role ('recruiter'|'candidate'), full_name, email, phone,
                    interests text[], created_at

jobs                id, recruiter_id → profiles, title, department, location, type, salary_min,
                    salary_max, description, required_skills jsonb [{name, importance}],
                    preferred_skills jsonb [{name, importance}], min_experience_years,
                    qualifications text[], status ('open'|'closed'), embedding vector(N),
                    created_at, updated_at

resumes             id, candidate_id → profiles, file_path, file_name, raw_text,
                    parsed jsonb {name, contact, skills[{name, excerpt, verified}], education[],
                    experience[], projects[]}, is_verified bool, parse_status
                    ('pending'|'success'|'failed'|'empty'), parse_error, embedding vector(N),
                    created_at, updated_at

resume_chunks       id, resume_id → resumes, chunk_text, embedding vector(N)   -- semantic search

applications        id, job_id → jobs, candidate_id → profiles, resume_id → resumes,
                    status, ai_score numeric, score_breakdown jsonb
                    {skills, experience, projects, qualifications},
                    ai_explanation jsonb {summary, matched[{skill, excerpt, verified}],
                    gaps[{skill, type, learning_suggestion}], unsupported_claims[]},
                    override_score numeric, override_reason, created_at, updated_at
                    UNIQUE(job_id, candidate_id)

application_events  id, application_id, from_status, to_status, changed_by → profiles,
                    reason, created_at                                     -- audit trail

recruiter_notes     id, application_id, recruiter_id, note, created_at     -- private

interview_questions id, application_id, difficulty ('beginner'|'intermediate'|'advanced'),
                    category ('role'|'project'), question, answer_guideline, created_at

interviews          id, application_id, scheduled_at, duration_min, interviewer_name,
                    interviewer_id, type, status ('scheduled'|'done'|'cancelled'),
                    feedback jsonb {technical, communication, problem_solving,
                    culture_fit, strengths, concerns, recommendation}, created_at

duplicate_flags     id, application_a, application_b, similarity, reason,
                    status ('pending'|'merged'|'dismissed')                -- P2

notifications       id, user_id, message, read bool, created_at            -- simulated
```

### RLS rules (summary)
- Candidates: read/write only their own `profiles`, `resumes`, `applications`; read `jobs` where `status='open'`; read their own `application_events` status only.
- Candidates can **never** read `recruiter_notes`, `interview_questions`, `interviews.feedback`, `score_breakdown` overrides or other candidates' data.
- Recruiters: full access to jobs they own and the applications/resumes linked to those jobs.

---

## 6. API Contracts (`app/api/*`, server-side)

| Route | Method | Input | Output |
|---|---|---|---|
| `/api/resume/parse` | POST | `{ resumeId }` | `{ parsed, parse_status, error? }` — downloads PDF, extracts text, LLM → JSON, verifies excerpts, embeds, saves chunks |
| `/api/job/extract` | POST | `{ description }` | `{ required_skills, preferred_skills, min_experience_years, qualifications }` |
| `/api/match` | POST | `{ applicationId }` | `{ ai_score, score_breakdown, ai_explanation }` — fairness strip → LLM → weighted score → excerpt verification |
| `/api/questions` | POST | `{ applicationId, difficulty?, regenerate? }` | `{ questions[] }` |
| `/api/search` | POST | `{ query, jobId? }` | `{ results[{ candidate, resume_id, similarity, evidence[] }] }` |
| `/api/interviews/check-conflict` | POST | `{ interviewerId, candidateId, start, duration }` | `{ conflict: bool, with? }` |
| `/api/duplicates` | GET | — | `{ pairs[] }` (P2) |
| `/api/recommendations` | GET | candidate session | `{ jobs[{ job, score, reason }] }` (P2) |
| `/api/fairness-test` | POST | `{ applicationId }` | `{ original_score, altered_score, attributes_changed }` (P2) |

All routes: validate input with zod, check session + role, return `{ error }` with proper status codes.

---

## 7. AI Design

**Resume parsing prompt:** return strict JSON; normalize skill names; for every skill/experience/project include a short **verbatim excerpt** from the resume.

**Hallucination check (code, not AI):** normalize whitespace/case, check `rawText.includes(excerpt)`. Not found → `verified: false`, shown with a ⚠ "Unverified — review manually" badge.

**Matching prompt:** inputs = job requirements + anonymized parsed resume. Output = sub-scores (0–100 each), matched skills with excerpts, gaps labeled `not_mentioned` or `explicitly_lacking`, learning suggestions, short summary. Use semantic equivalence (e.g. "built REST endpoints in Flask" satisfies "REST API").

**Semantic similarity:** cosine similarity between job embedding and resume embedding shown as a supporting signal; resume chunks power talent search.

**Fairness stripping:** remove name, contact, address, gender, age/DOB, photo refs, religion, marital status, nationality before any scoring call.

**Failure handling:** AI timeout / invalid JSON → retry once → mark `parse_status='failed'` with message; app keeps working.

---

## 8. Pages

**Public:** `/` landing · `/login` · `/sign-up` (role picker)

**Candidate:** `/candidate` dashboard (status overview, recommended jobs) · `/candidate/profile` · `/candidate/resume` (upload + edit parsed data + unverified flags) · `/candidate/jobs` (open jobs) · `/candidate/jobs/[id]` (details + apply) · `/candidate/applications` (status tracker)

**Recruiter:** `/recruiter` (analytics dashboard) · `/recruiter/jobs` (list + applicant counts) · `/recruiter/jobs/new` & `/[id]/edit` (with "Extract with AI") · `/recruiter/jobs/[id]` (ranked applicants, filters) · `/recruiter/applications/[id]` (score breakdown, evidence, gaps, notes, status actions, audit timeline, questions, schedule) · `/recruiter/interviews` (schedule list) · `/recruiter/search` (NL talent search) · `/recruiter/compare` (P2) · `/recruiter/duplicates` (P2)

---

## 9. Non-Functional Requirements
- **Security:** AI and Supabase secret keys only on the server; RLS on every table; zod validation.
- **Privacy:** private notes and feedback never exposed to candidates; resumes in a private bucket with signed URLs.
- **Reliability:** graceful errors and loading states everywhere; no blank screens.
- **Usability:** clean responsive UI (shadcn), toasts for actions, skeleton loaders.
- **Explainability:** no score is shown without its breakdown and evidence.
- **Human control:** no automatic shortlist/reject — UI buttons only.

---

## 10. Work Split

| Frontend (Member A) | Backend (Member B) |
|---|---|
| Layouts, nav, role-based route guards | Schema SQL, RLS, storage bucket, pgvector, seed data |
| Auth pages with role picker | `profiles` trigger on sign-up |
| Candidate pages: resume upload/edit, jobs, apply, status | `/api/resume/parse` + PDF extraction + embeddings |
| Recruiter jobs CRUD + AI extract button | `/api/job/extract`, `/api/match` (scoring, fairness, verification) |
| Ranked applicants, application detail, pipeline actions, notes, timeline | Status-change function writing `application_events` |
| Questions UI, interview scheduling, feedback form | `/api/questions`, conflict check |
| Analytics charts, talent search page | `/api/search`, analytics queries, P2 routes |

**Contract:** `lib/api.ts` (real) and `lib/mock-api.ts` (fake, same signatures). Frontend builds on mocks, then swaps.

---

## 11. Timeline (5 hours)

| Time | Milestone |
|---|---|
| 0:00–0:30 | PRD, schema, API contract, repo + Vercel ready |
| 0:30–2:00 | P0 core: auth/roles, jobs, resume parse, apply |
| 2:00–2:45 | Matching + explainability + pipeline; **first integration & deploy** |
| 2:45–3:45 | P1: questions, interviews, analytics, talent search |
| 3:45–4:15 | P2 picks (comparison, duplicates, recommendations, fairness test) |
| 4:15–4:30 | **Feature freeze**, seed demo data, bug fixes |
| 4:30–5:00 | Demo rehearsal, README, final deploy check |

---

## 12. Demo Script

### Official final demonstration scenario (from the brief)
A recruiter posts a **Backend Developer** vacancy requiring **Python, Django, PostgreSQL and Docker**. **Three candidates** apply with resumes. The system extracts evidence, produces job-relevance scores with explanations, identifies missing evidence, and presents candidates for human review. The recruiter **shortlists one** applicant, **generates interview questions**, **schedules an interview**, and sees the **dashboard update**.

**Success criterion:** reliable end-to-end workflow, meaningful AI, transparent evidence-based recommendations, solid engineering — *not* the most features. → **This exact flow is P0 and must never break. Rehearse it on the deployed URL.**

Demo resumes to prepare:
- **Strong:** Python, Django, PostgreSQL, Docker all with project evidence
- **Partial:** Python + Flask + MySQL (semantic near-matches), no Docker mentioned → "missing evidence"
- **Weak:** frontend-focused (React/JS), states "no backend experience" → "confirmed absence"

### Full walkthrough
1. Sign up as recruiter → paste a free-text JD → **AI extracts requirements** → publish.
2. Sign up as candidate → upload PDF → show parsed data, **normalized skills**, a corrected field.
3. Apply → recruiter sees **ranked list** → open application: score breakdown, matched skills with **excerpts**, gaps (not mentioned vs lacking), learning suggestions, **unverified** flag.
4. Shortlist with a note → show **audit trail** → generate **interview questions** → schedule interview, show **conflict warning** → record feedback + final decision.
5. **Talent search:** "Python developers with REST API experience" → results with evidence.
6. Analytics dashboard → funnel, shortlist rate, common skill gaps.
7. Explain fairness stripping (and run counterfactual test if built).

---

## 13. Requirements Checklist

- [ ] AUTH-1…8 — registration, login, logout, roles, guards, RLS, secure passwords, sessions, validation
- [ ] JOB-1…8 — create/edit/close/reopen, skills+importance, experience, qualifications, counts, AI extraction
- [ ] RES-1…8 — PDF upload, (DOCX), extraction, normalization, storage, candidate corrections, error handling, excerpts
- [ ] MATCH-1…6 — semantic matching, explainable score, weights, ranking, filters, overrides
- [ ] GAP-1…5 — missing vs absent, excerpts, explanations, learning areas, recruiter corrections
- [ ] PIPE-1…6 — apply, status view, manual actions, private notes, audit trail, states
- [ ] QUES-1…4 — difficulties, project questions, guidelines, edit/remove/regenerate
- [ ] INT-1…6 — schedule, list, conflicts, structured feedback, final decision, simulated notifications
- [ ] AN-1…6 — KPIs, by job, by stage, shortlist rate, processing time, common gaps
- [ ] TI-1…8 — NL search, semantic search, duplicates, recommendations, talent pool, comparison, fairness, hallucination check
- [ ] No hardcoded AI responses anywhere
