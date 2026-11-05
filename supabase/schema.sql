-- =============================================================================
-- RC3 Recruitment & Talent Intelligence Platform — full schema + RLS
-- Run in the Supabase SQL editor (idempotent-ish: safe to re-run on a fresh DB).
-- Embedding dimension 768 = gemini-embedding-001 with outputDimensionality 768.
-- =============================================================================

create extension if not exists vector with schema extensions;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

-- AUTH-3: role chosen at sign-up, stored here
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        text not null default 'candidate' check (role in ('recruiter', 'candidate')),
  full_name   text,
  email       text,
  phone       text,
  interests   text[] not null default '{}',
  created_at  timestamptz not null default now()
);

-- JOB-1..8
create table if not exists public.jobs (
  id                    uuid primary key default gen_random_uuid(),
  recruiter_id          uuid not null references public.profiles (id) on delete cascade,
  title                 text not null check (char_length(title) between 1 and 200),
  department            text,
  location              text,
  type                  text not null default 'full-time'
                        check (type in ('full-time', 'part-time', 'internship', 'contract', 'remote')),
  salary_min            numeric,
  salary_max            numeric,
  description           text not null default '',
  required_skills       jsonb not null default '[]',   -- [{name, importance 1-5}]
  preferred_skills      jsonb not null default '[]',   -- [{name, importance 1-5}]
  min_experience_years  numeric not null default 0,
  qualifications        text[] not null default '{}',
  status                text not null default 'open' check (status in ('open', 'closed')),
  embedding             extensions.vector(768),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (salary_min is null or salary_max is null or salary_min <= salary_max)
);

-- RES-1..8
create table if not exists public.resumes (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references public.profiles (id) on delete cascade,
  file_path     text not null,          -- storage path: <candidate_id>/<file>
  file_name     text not null,
  raw_text      text,
  parsed        jsonb,                  -- ParsedResume (lib/types.ts)
  is_verified   boolean not null default false,   -- RES-6: candidate reviewed/corrected
  parse_status  text not null default 'pending'
                check (parse_status in ('pending', 'success', 'failed', 'empty')),
  parse_error   text,
  embedding     extensions.vector(768),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- TI-2: semantic resume search
create table if not exists public.resume_chunks (
  id          uuid primary key default gen_random_uuid(),
  resume_id   uuid not null references public.resumes (id) on delete cascade,
  chunk_index int not null default 0,
  chunk_text  text not null,
  embedding   extensions.vector(768),
  created_at  timestamptz not null default now()
);

-- PIPE-1..6, MATCH-2/3
create table if not exists public.applications (
  id               uuid primary key default gen_random_uuid(),
  job_id           uuid not null references public.jobs (id) on delete cascade,
  candidate_id     uuid not null references public.profiles (id) on delete cascade,
  resume_id        uuid not null references public.resumes (id) on delete restrict,
  status           text not null default 'submitted' check (status in (
                     'submitted', 'parsed', 'ai_assessed', 'recruiter_review',
                     'shortlisted', 'rejected', 'interview', 'selected')),
  ai_score         numeric check (ai_score between 0 and 100),
  score_breakdown  jsonb,       -- {skills, experience, projects, qualifications}
  ai_explanation   jsonb,       -- MatchExplanation (lib/types.ts)
  semantic_similarity numeric,  -- cosine(job.embedding, resume.embedding), supporting signal
  match_error      text,        -- last AI failure message (retry via re-score)
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (job_id, candidate_id)
);

-- MATCH-6: recruiter score overrides live in their own table so candidates never see them
create table if not exists public.score_overrides (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null references public.applications (id) on delete cascade,
  recruiter_id    uuid not null references public.profiles (id) on delete cascade,
  original_score  numeric,
  override_score  numeric not null check (override_score between 0 and 100),
  reason          text not null check (char_length(reason) between 1 and 1000),
  created_at      timestamptz not null default now()
);

-- PIPE-5: audit trail (append-only)
create table if not exists public.application_events (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null references public.applications (id) on delete cascade,
  event_type      text not null default 'status_change'
                  check (event_type in ('status_change', 'score_override', 'rescore')),
  from_status     text,
  to_status       text,
  changed_by      uuid references public.profiles (id) on delete set null,  -- null = system/AI
  reason          text,
  created_at      timestamptz not null default now()
);

-- PIPE-4: private recruiter notes
create table if not exists public.recruiter_notes (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null references public.applications (id) on delete cascade,
  recruiter_id    uuid not null references public.profiles (id) on delete cascade,
  note            text not null check (char_length(note) between 1 and 5000),
  created_at      timestamptz not null default now()
);

-- QUES-1..4
create table if not exists public.interview_questions (
  id                uuid primary key default gen_random_uuid(),
  application_id    uuid not null references public.applications (id) on delete cascade,
  difficulty        text not null check (difficulty in ('beginner', 'intermediate', 'advanced')),
  category          text not null check (category in ('role', 'project')),
  question          text not null,
  answer_guideline  text not null default '',
  created_at        timestamptz not null default now()
);

-- INT-1..5
create table if not exists public.interviews (
  id                uuid primary key default gen_random_uuid(),
  application_id    uuid not null references public.applications (id) on delete cascade,
  scheduled_at      timestamptz not null,
  duration_min      int not null default 60 check (duration_min between 5 and 480),
  interviewer_name  text not null,
  interviewer_id    uuid references public.profiles (id) on delete set null,
  type              text not null default 'technical'
                    check (type in ('technical', 'hr', 'culture', 'final')),
  status            text not null default 'scheduled' check (status in ('scheduled', 'done', 'cancelled')),
  feedback          jsonb,   -- InterviewFeedback (lib/types.ts)
  created_by        uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now()
);

-- TI-3 (P2)
create table if not exists public.duplicate_flags (
  id             uuid primary key default gen_random_uuid(),
  application_a  uuid not null references public.applications (id) on delete cascade,
  application_b  uuid not null references public.applications (id) on delete cascade,
  similarity     numeric,
  reason         text,
  status         text not null default 'pending' check (status in ('pending', 'merged', 'dismissed')),
  created_at     timestamptz not null default now(),
  unique (application_a, application_b)
);

-- INT-6: simulated notifications
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  message     text not null,
  link        text,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------
create index if not exists jobs_recruiter_idx            on public.jobs (recruiter_id);
create index if not exists jobs_status_idx               on public.jobs (status);
create index if not exists resumes_candidate_idx         on public.resumes (candidate_id);
create index if not exists resume_chunks_resume_idx      on public.resume_chunks (resume_id);
create index if not exists applications_job_idx          on public.applications (job_id);
create index if not exists applications_candidate_idx    on public.applications (candidate_id);
create index if not exists applications_resume_idx       on public.applications (resume_id);
create index if not exists score_overrides_app_idx       on public.score_overrides (application_id, created_at desc);
create index if not exists application_events_app_idx    on public.application_events (application_id, created_at);
create index if not exists recruiter_notes_app_idx       on public.recruiter_notes (application_id);
create index if not exists interview_questions_app_idx   on public.interview_questions (application_id);
create index if not exists interviews_app_idx            on public.interviews (application_id);
create index if not exists interviews_time_idx           on public.interviews (scheduled_at);
create index if not exists notifications_user_idx        on public.notifications (user_id, created_at desc);
create index if not exists resume_chunks_embedding_idx
  on public.resume_chunks using hnsw (embedding extensions.vector_cosine_ops);
create index if not exists resumes_embedding_idx
  on public.resumes using hnsw (embedding extensions.vector_cosine_ops);

-- -----------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER to avoid RLS recursion; fixed search_path)
-- -----------------------------------------------------------------------------
create or replace function public.is_recruiter()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'recruiter');
$$;

create or replace function public.is_job_owner(p_job_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.jobs where id = p_job_id and recruiter_id = auth.uid());
$$;

create or replace function public.recruiter_can_access_application(p_application_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.applications a
    join public.jobs j on j.id = a.job_id
    where a.id = p_application_id and j.recruiter_id = auth.uid()
  );
$$;

create or replace function public.recruiter_can_access_resume(p_resume_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.applications a
    join public.jobs j on j.id = a.job_id
    where a.resume_id = p_resume_id and j.recruiter_id = auth.uid()
  );
$$;

create or replace function public.recruiter_can_access_candidate(p_candidate_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.applications a
    join public.jobs j on j.id = a.job_id
    where a.candidate_id = p_candidate_id and j.recruiter_id = auth.uid()
  );
$$;

create or replace function public.recruiter_can_access_resume_path(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.resumes r
    join public.applications a on a.resume_id = r.id
    join public.jobs j on j.id = a.job_id
    where r.file_path = p_path and j.recruiter_id = auth.uid()
  );
$$;

-- jwt role: 'authenticated' (user session), 'service_role' (server admin client), null (SQL editor)
create or replace function public.current_jwt_role()
returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
$$;

-- -----------------------------------------------------------------------------
-- Profiles trigger on sign-up (AUTH-3)
-- Frontend: supabase.auth.signUp({ email, password, options: { data: { role, full_name } } })
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, role, full_name, email)
  values (
    new.id,
    case when new.raw_user_meta_data ->> 'role' = 'recruiter' then 'recruiter' else 'candidate' end,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users cannot change their own role after sign-up
create or replace function public.prevent_role_change()
returns trigger language plpgsql as $$
begin
  if new.role is distinct from old.role and public.current_jwt_role() = 'authenticated' then
    raise exception 'Role cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_role_change on public.profiles;
create trigger profiles_prevent_role_change
  before update on public.profiles
  for each row execute function public.prevent_role_change();

-- updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists jobs_updated_at on public.jobs;
create trigger jobs_updated_at before update on public.jobs
  for each row execute function public.set_updated_at();
drop trigger if exists resumes_updated_at on public.resumes;
create trigger resumes_updated_at before update on public.resumes
  for each row execute function public.set_updated_at();
drop trigger if exists applications_updated_at on public.applications;
create trigger applications_updated_at before update on public.applications
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Application pipeline: transitions, human-in-control guard, audit trail (PIPE-5/6)
-- -----------------------------------------------------------------------------
-- System (AI) transitions: submitted -> parsed -> ai_assessed (service role only)
-- Human transitions: everything else (job-owner recruiter only)
create or replace function public.is_valid_transition(p_from text, p_to text)
returns boolean language sql immutable as $$
  select case p_from
    when 'submitted'        then p_to in ('parsed', 'ai_assessed', 'recruiter_review', 'shortlisted', 'rejected')
    when 'parsed'           then p_to in ('ai_assessed', 'recruiter_review', 'shortlisted', 'rejected')
    when 'ai_assessed'      then p_to in ('recruiter_review', 'shortlisted', 'rejected')
    when 'recruiter_review' then p_to in ('shortlisted', 'rejected')
    when 'shortlisted'      then p_to in ('interview', 'rejected', 'recruiter_review')
    when 'interview'        then p_to in ('selected', 'rejected')
    else false
  end;
$$;

create or replace function public.guard_application_status()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_role text := public.current_jwt_role();
begin
  if new.status = old.status then
    return new;
  end if;
  if not public.is_valid_transition(old.status, new.status) then
    raise exception 'Invalid status transition: % -> %', old.status, new.status;
  end if;
  if new.status in ('parsed', 'ai_assessed') then
    -- system-only states
    if v_role = 'authenticated' then
      raise exception 'Status % can only be set by the system', new.status;
    end if;
  else
    -- human-in-control: AI / service role can never shortlist, reject, advance or select
    if v_role = 'service_role' then
      raise exception 'Status % requires a recruiter action', new.status;
    end if;
    if v_role = 'authenticated' and not public.is_job_owner(new.job_id) then
      raise exception 'Only the job owner can change this application status';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists applications_guard_status on public.applications;
create trigger applications_guard_status
  before update of status on public.applications
  for each row execute function public.guard_application_status();

create or replace function public.log_application_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_job_title text;
begin
  select title into v_job_title from public.jobs where id = new.job_id;

  if tg_op = 'INSERT' then
    insert into public.application_events (application_id, from_status, to_status, changed_by, reason)
    values (new.id, null, new.status, auth.uid(), 'Application submitted');
    insert into public.notifications (user_id, message, link)
    select j.recruiter_id, 'New application for ' || j.title, '/recruiter/applications/' || new.id
    from public.jobs j where j.id = new.job_id;
  elsif new.status is distinct from old.status then
    insert into public.application_events (application_id, from_status, to_status, changed_by, reason)
    values (new.id, old.status, new.status, auth.uid(),
            nullif(current_setting('app.status_reason', true), ''));
    -- INT-6 simulated notification to the candidate (status only, never the reason)
    if new.status in ('shortlisted', 'rejected', 'interview', 'selected') then
      insert into public.notifications (user_id, message, link)
      values (new.candidate_id,
              'Your application for ' || coalesce(v_job_title, 'a job') || ' is now ' || new.status,
              '/candidate/applications');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists applications_log_event on public.applications;
create trigger applications_log_event
  after insert or update of status on public.applications
  for each row execute function public.log_application_event();

-- Recruiter status change with reason (PIPE-3). RLS + guard trigger enforce ownership.
create or replace function public.change_application_status(
  p_application_id uuid, p_to_status text, p_reason text default null)
returns public.applications language plpgsql security invoker set search_path = '' as $$
declare
  v_app public.applications;
begin
  perform set_config('app.status_reason', coalesce(p_reason, ''), true);
  update public.applications set status = p_to_status
  where id = p_application_id
  returning * into v_app;
  if v_app.id is null then
    raise exception 'Application not found or not permitted';
  end if;
  return v_app;
end;
$$;

-- MATCH-6: score override with reason, logged in the audit trail
create or replace function public.override_application_score(
  p_application_id uuid, p_score numeric, p_reason text)
returns public.score_overrides language plpgsql security definer set search_path = '' as $$
declare
  v_app public.applications;
  v_prev numeric;
  v_row public.score_overrides;
begin
  if not public.recruiter_can_access_application(p_application_id) then
    raise exception 'Not permitted';
  end if;
  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception 'A reason is required';
  end if;
  select * into v_app from public.applications where id = p_application_id;
  select override_score into v_prev from public.score_overrides
    where application_id = p_application_id order by created_at desc limit 1;

  insert into public.score_overrides (application_id, recruiter_id, original_score, override_score, reason)
  values (p_application_id, auth.uid(), coalesce(v_prev, v_app.ai_score), p_score, p_reason)
  returning * into v_row;

  insert into public.application_events (application_id, event_type, from_status, to_status, changed_by, reason)
  values (p_application_id, 'score_override', v_app.status, v_app.status, auth.uid(),
          'Score override ' || coalesce(round(coalesce(v_prev, v_app.ai_score), 1)::text, '—')
          || ' → ' || round(p_score, 1)::text || ': ' || p_reason);
  return v_row;
end;
$$;

-- Notify candidate when an interview is scheduled (INT-6)
create or replace function public.notify_interview_scheduled()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, message, link)
  select a.candidate_id,
         'Interview scheduled for ' || j.title || ' on ' || to_char(new.scheduled_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC',
         '/candidate/applications'
  from public.applications a join public.jobs j on j.id = a.job_id
  where a.id = new.application_id;
  return new;
end;
$$;

drop trigger if exists interviews_notify on public.interviews;
create trigger interviews_notify
  after insert on public.interviews
  for each row execute function public.notify_interview_scheduled();

-- -----------------------------------------------------------------------------
-- Candidate-safe read functions (no recruiter reasons, notes or feedback)
-- -----------------------------------------------------------------------------
create or replace function public.get_my_application_timeline(p_application_id uuid)
returns table (to_status text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select e.to_status, e.created_at
  from public.application_events e
  join public.applications a on a.id = e.application_id
  where e.application_id = p_application_id
    and a.candidate_id = auth.uid()
    and e.event_type = 'status_change'
  order by e.created_at;
$$;

create or replace function public.get_my_interviews()
returns table (id uuid, application_id uuid, job_title text, scheduled_at timestamptz,
               duration_min int, type text, status text)
language sql stable security definer set search_path = '' as $$
  select i.id, i.application_id, j.title, i.scheduled_at, i.duration_min, i.type, i.status
  from public.interviews i
  join public.applications a on a.id = i.application_id
  join public.jobs j on j.id = a.job_id
  where a.candidate_id = auth.uid()
  order by i.scheduled_at;
$$;

-- -----------------------------------------------------------------------------
-- Semantic search (TI-1/2) and similarity (MATCH-1). SECURITY INVOKER → RLS applies.
-- -----------------------------------------------------------------------------
create or replace function public.match_resume_chunks(
  query_embedding extensions.vector(768),
  match_count int default 30,
  p_job_id uuid default null)
returns table (chunk_id uuid, resume_id uuid, candidate_id uuid, chunk_text text, similarity float)
language sql stable security invoker set search_path = '' as $$
  select c.id, c.resume_id, r.candidate_id, c.chunk_text,
         1 - (c.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.resume_chunks c
  join public.resumes r on r.id = c.resume_id
  where c.embedding is not null
    and (p_job_id is null or exists (
      select 1 from public.applications a where a.resume_id = r.id and a.job_id = p_job_id))
  order by c.embedding operator(extensions.<=>) query_embedding
  limit least(match_count, 200);
$$;

create or replace function public.resume_job_similarity(p_resume_id uuid, p_job_id uuid)
returns float language sql stable security invoker set search_path = '' as $$
  select 1 - (r.embedding operator(extensions.<=>) j.embedding)
  from public.resumes r, public.jobs j
  where r.id = p_resume_id and j.id = p_job_id
    and r.embedding is not null and j.embedding is not null;
$$;

-- -----------------------------------------------------------------------------
-- Views (security_invoker → callers' RLS applies)
-- -----------------------------------------------------------------------------
-- JOB-6: vacancies with applicant counts
create or replace view public.jobs_with_counts with (security_invoker = true) as
select j.*,
       (select count(*) from public.applications a where a.job_id = j.id)::int as applicant_count,
       (select count(*) from public.applications a where a.job_id = j.id and a.status = 'shortlisted')::int as shortlisted_count
from public.jobs j;

-- MATCH-4/6: applications with effective score (override wins). Candidates see override = null.
create or replace view public.applications_ranked with (security_invoker = true) as
select a.*,
       o.override_score,
       o.reason as override_reason,
       coalesce(o.override_score, a.ai_score) as effective_score,
       j.title as job_title,
       j.recruiter_id,
       p.full_name as candidate_name,
       p.email as candidate_email
from public.applications a
join public.jobs j on j.id = a.job_id
left join public.profiles p on p.id = a.candidate_id
left join lateral (
  select s.override_score, s.reason from public.score_overrides s
  where s.application_id = a.id order by s.created_at desc limit 1
) o on true;

-- -----------------------------------------------------------------------------
-- Row Level Security (AUTH-5)
-- -----------------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.jobs                enable row level security;
alter table public.resumes             enable row level security;
alter table public.resume_chunks       enable row level security;
alter table public.applications        enable row level security;
alter table public.score_overrides     enable row level security;
alter table public.application_events  enable row level security;
alter table public.recruiter_notes     enable row level security;
alter table public.interview_questions enable row level security;
alter table public.interviews          enable row level security;
alter table public.duplicate_flags     enable row level security;
alter table public.notifications       enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or (public.is_recruiter() and public.recruiter_can_access_candidate(id)));
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- jobs: anyone signed in reads open jobs; recruiters manage their own
drop policy if exists jobs_select on public.jobs;
create policy jobs_select on public.jobs for select to authenticated
  using (status = 'open' or recruiter_id = auth.uid());
drop policy if exists jobs_insert on public.jobs;
create policy jobs_insert on public.jobs for insert to authenticated
  with check (recruiter_id = auth.uid() and public.is_recruiter());
drop policy if exists jobs_update on public.jobs;
create policy jobs_update on public.jobs for update to authenticated
  using (recruiter_id = auth.uid()) with check (recruiter_id = auth.uid());
drop policy if exists jobs_delete on public.jobs;
create policy jobs_delete on public.jobs for delete to authenticated
  using (recruiter_id = auth.uid());

-- resumes: candidate owns; recruiter reads resumes attached to their jobs
drop policy if exists resumes_select on public.resumes;
create policy resumes_select on public.resumes for select to authenticated
  using (candidate_id = auth.uid() or public.recruiter_can_access_resume(id));
drop policy if exists resumes_insert on public.resumes;
create policy resumes_insert on public.resumes for insert to authenticated
  with check (candidate_id = auth.uid() and not public.is_recruiter()
              and file_path like auth.uid()::text || '/%');
drop policy if exists resumes_update on public.resumes;
create policy resumes_update on public.resumes for update to authenticated
  using (candidate_id = auth.uid()) with check (candidate_id = auth.uid());
drop policy if exists resumes_delete on public.resumes;
create policy resumes_delete on public.resumes for delete to authenticated
  using (candidate_id = auth.uid());

-- resume_chunks
drop policy if exists resume_chunks_select on public.resume_chunks;
create policy resume_chunks_select on public.resume_chunks for select to authenticated
  using (exists (select 1 from public.resumes r where r.id = resume_id and r.candidate_id = auth.uid())
         or public.recruiter_can_access_resume(resume_id));
drop policy if exists resume_chunks_write on public.resume_chunks;
create policy resume_chunks_write on public.resume_chunks for all to authenticated
  using (exists (select 1 from public.resumes r where r.id = resume_id and r.candidate_id = auth.uid()))
  with check (exists (select 1 from public.resumes r where r.id = resume_id and r.candidate_id = auth.uid()));

-- applications: candidate reads own + applies; only job owner updates (status via RPC)
drop policy if exists applications_select on public.applications;
create policy applications_select on public.applications for select to authenticated
  using (candidate_id = auth.uid() or public.is_job_owner(job_id));
drop policy if exists applications_insert on public.applications;
create policy applications_insert on public.applications for insert to authenticated
  with check (
    candidate_id = auth.uid()
    and status = 'submitted'
    and ai_score is null and score_breakdown is null and ai_explanation is null
    and exists (select 1 from public.resumes r where r.id = resume_id and r.candidate_id = auth.uid())
    and exists (select 1 from public.jobs j where j.id = job_id and j.status = 'open')
  );
drop policy if exists applications_update on public.applications;
create policy applications_update on public.applications for update to authenticated
  using (public.is_job_owner(job_id)) with check (public.is_job_owner(job_id));

-- score_overrides: recruiter only (writes go through override_application_score)
drop policy if exists score_overrides_select on public.score_overrides;
create policy score_overrides_select on public.score_overrides for select to authenticated
  using (public.recruiter_can_access_application(application_id));

-- application_events: recruiter only (candidates use get_my_application_timeline)
drop policy if exists application_events_select on public.application_events;
create policy application_events_select on public.application_events for select to authenticated
  using (public.recruiter_can_access_application(application_id));

-- recruiter_notes: private to job-owner recruiters
drop policy if exists recruiter_notes_select on public.recruiter_notes;
create policy recruiter_notes_select on public.recruiter_notes for select to authenticated
  using (public.recruiter_can_access_application(application_id));
drop policy if exists recruiter_notes_insert on public.recruiter_notes;
create policy recruiter_notes_insert on public.recruiter_notes for insert to authenticated
  with check (recruiter_id = auth.uid() and public.recruiter_can_access_application(application_id));
drop policy if exists recruiter_notes_modify on public.recruiter_notes;
create policy recruiter_notes_modify on public.recruiter_notes for delete to authenticated
  using (recruiter_id = auth.uid());

-- interview_questions: recruiter only
drop policy if exists interview_questions_all on public.interview_questions;
create policy interview_questions_all on public.interview_questions for all to authenticated
  using (public.recruiter_can_access_application(application_id))
  with check (public.recruiter_can_access_application(application_id));

-- interviews: recruiter only (candidates use get_my_interviews, which hides feedback)
drop policy if exists interviews_all on public.interviews;
create policy interviews_all on public.interviews for all to authenticated
  using (public.recruiter_can_access_application(application_id))
  with check (public.recruiter_can_access_application(application_id));

-- duplicate_flags: recruiter owning both applications
drop policy if exists duplicate_flags_all on public.duplicate_flags;
create policy duplicate_flags_all on public.duplicate_flags for all to authenticated
  using (public.recruiter_can_access_application(application_a)
         and public.recruiter_can_access_application(application_b))
  with check (public.recruiter_can_access_application(application_a)
              and public.recruiter_can_access_application(application_b));

-- notifications: own only (inserted by triggers)
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Storage: private `resumes` bucket. Path convention: <candidate_id>/<uuid>.pdf
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumes', 'resumes', false, 5242880,
        array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists resumes_storage_candidate_rw on storage.objects;
create policy resumes_storage_candidate_rw on storage.objects for all to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists resumes_storage_recruiter_read on storage.objects;
create policy resumes_storage_recruiter_read on storage.objects for select to authenticated
  using (bucket_id = 'resumes' and public.recruiter_can_access_resume_path(name));

-- -----------------------------------------------------------------------------
-- Grants for RPCs
-- -----------------------------------------------------------------------------
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.change_application_status(uuid, text, text) to authenticated;
grant execute on function public.override_application_score(uuid, numeric, text) to authenticated;
grant execute on function public.get_my_application_timeline(uuid) to authenticated;
grant execute on function public.get_my_interviews() to authenticated;
grant execute on function public.match_resume_chunks(extensions.vector, int, uuid) to authenticated, service_role;
grant execute on function public.resume_job_similarity(uuid, uuid) to authenticated, service_role;
