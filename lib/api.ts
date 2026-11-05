// Data functions the UI calls (browser side). lib/mock-api.ts must keep the same signatures.
// AI work always goes through app/api/* routes; nothing here touches AI keys.
import { createClient } from "@/lib/supabase/client";
import type {
  Profile,
  ApplicationEvent, ApplicationStatus, CandidateInterview, ConflictCheckResponse, Difficulty, Interview,
  InterviewFeedback, InterviewQuestion, InterviewType, Job, SearchResult, JobExtraction, JobStatus, JobWithCounts,
  MatchResponse, Notification, ParseResumeResponse, ParsedResume, RankedApplication, RecruiterNote, Resume,
} from "@/lib/types";
import type { JobCreateInput, JobUpdateInput } from "@/lib/validation";
import { computeAnalytics, type RecruiterAnalytics } from "@/lib/analytics";

async function postJSON<T>(url: string, body: unknown, method: "POST" | "PATCH" = "POST"): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({ error: "Unexpected server response" }));
  if (!res.ok && !("parse_status" in data)) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

// ---------------------------------------------------------------- Resumes (RES-1..8)

/** Latest resume for the signed-in candidate, or null. */
export async function getMyResume(): Promise<Resume | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("resumes")
    .select("*")
    .eq("candidate_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Resume | null;
}

/**
 * Uploads a PDF to the private bucket, creates the resume row, then parses it.
 * Returns the resume id plus the parse result. On parse failure the row stays with
 * parse_status 'failed' | 'empty' and an error message — call parseResume(id) to retry.
 */
export async function uploadResume(file: File): Promise<{ resumeId: string } & ParseResumeResponse> {
  const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const ext = /\.docx$/i.test(file.name) || file.type === DOCX ? "docx" : /\.pdf$/i.test(file.name) || file.type === "application/pdf" ? "pdf" : null;
  if (!ext) throw new Error("Unsupported file type. Please upload a PDF or DOCX resume.");
  if (file.size > 5 * 1024 * 1024) throw new Error("File too large. Maximum size is 5 MB.");

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("resumes")
    .upload(path, file, { contentType: ext === "pdf" ? "application/pdf" : DOCX, upsert: false });
  if (upErr) throw new Error("Upload failed: " + upErr.message);

  const { data: row, error: insErr } = await supabase
    .from("resumes")
    .insert({ candidate_id: user.id, file_path: path, file_name: file.name })
    .select("id")
    .single();
  if (insErr || !row) throw new Error("Could not save resume: " + (insErr?.message ?? "unknown error"));

  const result = await parseResume(row.id);
  return { resumeId: row.id, ...result };
}

/** (Re)parse an uploaded resume. Never throws for parse failures — check parse_status / error. */
export async function parseResume(resumeId: string): Promise<ParseResumeResponse> {
  return postJSON<ParseResumeResponse>("/api/resume/parse", { resumeId });
}

/** RES-6: candidate saves corrected parsed data; marks the resume as verified. */
export async function saveParsedResume(resumeId: string, parsed: ParsedResume): Promise<Resume> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("resumes")
    .update({ parsed, is_verified: true })
    .eq("id", resumeId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Resume;
}

/** Short-lived signed URL for viewing the PDF (private bucket). */
export async function getResumeFileUrl(filePath: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from("resumes").createSignedUrl(filePath, 60 * 10);
  if (error || !data) throw new Error(error?.message ?? "Could not create link");
  return data.signedUrl;
}

// ---------------------------------------------------------------- Jobs (JOB-1..8)

const JOB_COLUMNS =
  "id, recruiter_id, title, department, location, type, salary_min, salary_max, description, required_skills, preferred_skills, min_experience_years, qualifications, status, created_at, updated_at";

/** JOB-7: AI extracts requirements from a free-text description. Recruiter reviews before saving. */
export async function extractJobRequirements(description: string): Promise<JobExtraction> {
  return postJSON<JobExtraction>("/api/job/extract", { description });
}

/** JOB-1: create (validated + embedded server-side). */
export async function createJob(input: JobCreateInput): Promise<Job> {
  return postJSON<Job>("/api/jobs", input);
}

/** JOB-2: edit. Re-embeds server-side when content changes. */
export async function updateJob(id: string, input: JobUpdateInput): Promise<Job> {
  return postJSON<Job>(`/api/jobs/${id}`, input, "PATCH");
}

/** JOB-3: close / reopen (no AI call). */
export async function setJobStatus(id: string, status: JobStatus): Promise<Job> {
  const supabase = createClient();
  const { data, error } = await supabase.from("jobs").update({ status }).eq("id", id).select(JOB_COLUMNS).single();
  if (error || !data) throw new Error(error?.message ?? "Could not update job");
  return data as Job;
}

/** JOB-6: recruiter's own vacancies with applicant counts, newest first. */
export async function getRecruiterJobs(): Promise<JobWithCounts[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("jobs_with_counts")
    .select(JOB_COLUMNS + ", applicant_count, shortlisted_count")
    .eq("recruiter_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as JobWithCounts[];
}

/** Open vacancies for candidates, newest first. */
export async function getOpenJobs(): Promise<Job[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("jobs")
    .select(JOB_COLUMNS)
    .eq("status", "open")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Job[];
}

/** Single job (RLS: open jobs, or the recruiter's own). Null if not found / not visible. */
export async function getJob(id: string): Promise<Job | null> {
  const supabase = createClient();
  const { data, error } = await supabase.from("jobs").select(JOB_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Job | null;
}

// ---------------------------------------------------------------- Applications: candidate (PIPE-1/2)

async function requireUserId(): Promise<string> {
  const { data: { user } } = await createClient().auth.getUser();
  if (!user) throw new Error("Not signed in");
  return user.id;
}

/**
 * PIPE-1: apply with the latest successfully parsed resume, then score once (MATCH-1..3).
 * If scoring fails the application still exists; `matchError` explains and a recruiter can re-score.
 */
export async function applyToJob(jobId: string): Promise<{ applicationId: string; match: MatchResponse | null; matchError?: string }> {
  const supabase = createClient();
  const userId = await requireUserId();
  const { data: resume } = await supabase
    .from("resumes")
    .select("id")
    .eq("candidate_id", userId)
    .eq("parse_status", "success")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!resume) throw new Error("Upload and parse your resume before applying.");

  const { data: app, error } = await supabase
    .from("applications")
    .insert({ job_id: jobId, candidate_id: userId, resume_id: resume.id })
    .select("id")
    .single();
  if (error || !app) {
    throw new Error(error?.code === "23505" ? "You have already applied to this job." : "Could not apply: " + (error?.message ?? "unknown error"));
  }
  try {
    const match = await postJSON<MatchResponse>("/api/match", { applicationId: app.id });
    return { applicationId: app.id, match };
  } catch (e) {
    return { applicationId: app.id, match: null, matchError: (e as Error).message };
  }
}

/** PIPE-2: my applications with job title + status (override fields are always null for candidates). */
export async function getMyApplications(): Promise<RankedApplication[]> {
  const userId = await requireUserId();
  const { data, error } = await createClient()
    .from("applications_ranked")
    .select("*")
    .eq("candidate_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as RankedApplication[];
}

/** Candidate-safe status history (no reasons). */
export async function getMyApplicationTimeline(applicationId: string): Promise<{ to_status: ApplicationStatus; created_at: string }[]> {
  const { data, error } = await createClient().rpc("get_my_application_timeline", { p_application_id: applicationId });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getMyInterviews(): Promise<CandidateInterview[]> {
  const { data, error } = await createClient().rpc("get_my_interviews");
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ---------------------------------------------------------------- Applications: recruiter (MATCH-4..6, PIPE-3..5)

export interface ApplicantFilters {
  minScore?: number;
  status?: ApplicationStatus;
  skill?: string; // matched skill name
  sort?: "score" | "newest";
}

/** MATCH-4/5: ranked applicants for a job (effective score = override ?? AI score). */
export async function getJobApplicants(jobId: string, f: ApplicantFilters = {}): Promise<RankedApplication[]> {
  let q = createClient().from("applications_ranked").select("*").eq("job_id", jobId);
  if (f.status) q = q.eq("status", f.status);
  if (f.minScore != null) q = q.gte("effective_score", f.minScore);
  q = f.sort === "newest"
    ? q.order("created_at", { ascending: false })
    : q.order("effective_score", { ascending: false, nullsFirst: false });
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  let rows = (data ?? []) as RankedApplication[];
  if (f.skill) {
    const k = f.skill.toLowerCase();
    rows = rows.filter((r) => r.ai_explanation?.matched.some((m) => m.skill.toLowerCase() === k));
  }
  return rows;
}

/** Application detail incl. the parsed resume (recruiter view). */
export async function getApplication(applicationId: string): Promise<(RankedApplication & { resume: Pick<Resume, "id" | "file_path" | "file_name" | "parsed" | "is_verified"> | null }) | null> {
  const supabase = createClient();
  const { data, error } = await supabase.from("applications_ranked").select("*").eq("id", applicationId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const { data: resume } = await supabase
    .from("resumes")
    .select("id, file_path, file_name, parsed, is_verified")
    .eq("id", data.resume_id)
    .maybeSingle();
  return { ...(data as RankedApplication), resume };
}

/** GAP-5 / explicit re-score (recruiter). */
export async function rescoreApplication(applicationId: string): Promise<MatchResponse> {
  return postJSON<MatchResponse>("/api/match", { applicationId });
}

/** PIPE-3: manual status change; the DB validates the transition and writes the audit event. */
export async function changeApplicationStatus(applicationId: string, to: ApplicationStatus, reason?: string): Promise<void> {
  const { error } = await createClient().rpc("change_application_status", {
    p_application_id: applicationId,
    p_to_status: to,
    p_reason: reason ?? null,
  });
  if (error) throw new Error(error.message);
}

/** MATCH-6: override with a mandatory reason (logged in the audit trail). */
export async function overrideScore(applicationId: string, score: number, reason: string): Promise<void> {
  const { error } = await createClient().rpc("override_application_score", {
    p_application_id: applicationId,
    p_score: score,
    p_reason: reason,
  });
  if (error) throw new Error(error.message);
}

/** PIPE-5: full audit trail (recruiter only via RLS). */
export async function getApplicationEvents(applicationId: string): Promise<ApplicationEvent[]> {
  const { data, error } = await createClient()
    .from("application_events")
    .select("*")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ApplicationEvent[];
}

/** PIPE-4: private recruiter notes. */
export async function getNotes(applicationId: string): Promise<RecruiterNote[]> {
  const { data, error } = await createClient()
    .from("recruiter_notes")
    .select("*")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as RecruiterNote[];
}

export async function addNote(applicationId: string, note: string): Promise<RecruiterNote> {
  const trimmed = note.trim();
  if (!trimmed) throw new Error("Note is empty");
  const userId = await requireUserId();
  const { data, error } = await createClient()
    .from("recruiter_notes")
    .insert({ application_id: applicationId, recruiter_id: userId, note: trimmed.slice(0, 5000) })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not save note");
  return data as RecruiterNote;
}

// ---------------------------------------------------------------- Notifications (INT-6)
export async function getNotifications(): Promise<Notification[]> {
  const { data, error } = await createClient()
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return (data ?? []) as Notification[];
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await createClient().from("notifications").update({ read: true }).eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------- Interview questions (QUES-1..4)

/** Returns stored questions, generating them on first call. regenerate=true replaces them. */
export async function generateQuestions(applicationId: string, opts: { difficulty?: Difficulty; regenerate?: boolean } = {}): Promise<InterviewQuestion[]> {
  const r = await postJSON<{ questions: InterviewQuestion[] }>("/api/questions", { applicationId, ...opts });
  return r.questions;
}

export async function getQuestions(applicationId: string): Promise<InterviewQuestion[]> {
  const { data, error } = await createClient().from("interview_questions").select("*").eq("application_id", applicationId).order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as InterviewQuestion[];
}

export async function updateQuestion(id: string, patch: Partial<Pick<InterviewQuestion, "question" | "answer_guideline" | "difficulty">>): Promise<void> {
  const { error } = await createClient().from("interview_questions").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteQuestion(id: string): Promise<void> {
  const { error } = await createClient().from("interview_questions").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------- Interviews (INT-1..5)

export interface ScheduleInput {
  applicationId: string;
  candidateId: string;
  scheduledAt: string; // ISO with offset
  durationMin: number;
  interviewerName: string;
  interviewerId?: string | null;
  type: InterviewType;
}

export async function checkInterviewConflict(i: Omit<ScheduleInput, "applicationId" | "type"> & { excludeInterviewId?: string }): Promise<ConflictCheckResponse> {
  return postJSON<ConflictCheckResponse>("/api/interviews/check-conflict", {
    interviewerId: i.interviewerId ?? null,
    interviewerName: i.interviewerName,
    candidateId: i.candidateId,
    start: i.scheduledAt,
    duration: i.durationMin,
    excludeInterviewId: i.excludeInterviewId,
  });
}

/**
 * INT-1: schedule. Returns conflicts instead of saving unless force=true (UI shows the warning first).
 * Moves a shortlisted application to "interview" (recruiter action, audited).
 */
export async function scheduleInterview(input: ScheduleInput, force = false): Promise<{ interview: Interview | null; conflicts: ConflictCheckResponse }> {
  const conflicts = await checkInterviewConflict(input);
  if (conflicts.conflict && !force) return { interview: null, conflicts };
  const supabase = createClient();
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("interviews")
    .insert({
      application_id: input.applicationId,
      scheduled_at: input.scheduledAt,
      duration_min: input.durationMin,
      interviewer_name: input.interviewerName,
      interviewer_id: input.interviewerId ?? null,
      type: input.type,
      created_by: userId,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not schedule interview");
  const { data: app } = await supabase.from("applications").select("status").eq("id", input.applicationId).single();
  if (app?.status === "shortlisted") await changeApplicationStatus(input.applicationId, "interview", "Interview scheduled");
  return { interview: data as Interview, conflicts };
}

/** INT-2: interviews for one application, or all of the recruiter's interviews (with job + candidate). */
export async function getInterviews(applicationId?: string): Promise<(Interview & { job_title: string | null; candidate_name: string | null })[]> {
  let q = createClient()
    .from("interviews")
    .select("*, applications(jobs(title), profiles(full_name))")
    .order("scheduled_at", { ascending: true });
  if (applicationId) q = q.eq("application_id", applicationId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const { applications: a, ...rest } = row as Interview & { applications: { jobs: { title: string } | null; profiles: { full_name: string | null } | null } | null };
    return { ...rest, job_title: a?.jobs?.title ?? null, candidate_name: a?.profiles?.full_name ?? null };
  });
}

/** INT-4: structured feedback; marks the interview done. */
export async function saveInterviewFeedback(interviewId: string, feedback: InterviewFeedback): Promise<void> {
  for (const k of ["technical", "communication", "problem_solving", "culture_fit"] as const) {
    if (!(feedback[k] >= 1 && feedback[k] <= 5)) throw new Error(`${k} rating must be 1-5`);
  }
  const { error } = await createClient().from("interviews").update({ feedback, status: "done" }).eq("id", interviewId);
  if (error) throw new Error(error.message);
}

export async function cancelInterview(interviewId: string): Promise<void> {
  const { error } = await createClient().from("interviews").update({ status: "cancelled" }).eq("id", interviewId);
  if (error) throw new Error(error.message);
}

// INT-5: final decision = changeApplicationStatus(id, "selected" | "rejected", reason) — DB enforces job owner.

// ---------------------------------------------------------------- Talent search (TI-1/2)
export async function searchTalent(query: string, jobId?: string): Promise<SearchResult[]> {
  const r = await postJSON<{ results: SearchResult[] }>("/api/search", { query, jobId });
  return r.results;
}

// ---------------------------------------------------------------- Analytics (AN-1..6)
export async function getRecruiterAnalytics(): Promise<RecruiterAnalytics> {
  const supabase = createClient();
  const [jobs, apps, events, interviews] = await Promise.all([
    getRecruiterJobs(),
    supabase.from("applications_ranked").select("*"),
    supabase.from("application_events").select("application_id, to_status, created_at, event_type").eq("event_type", "status_change"),
    supabase.from("interviews").select("scheduled_at, status"),
  ]);
  for (const r of [apps, events, interviews]) if (r.error) throw new Error(r.error.message);
  const userId = await requireUserId();
  const mine = ((apps.data ?? []) as RankedApplication[]).filter((a) => a.recruiter_id === userId);
  return computeAnalytics(jobs, mine, events.data ?? [], interviews.data ?? []);
}

/** Everything the recruiter dashboard needs, in one round of parallel queries (RLS-scoped). */
export async function getRecruiterDashboard() {
  const supabase = createClient();
  const userId = await requireUserId();
  const [jobs, apps, events, interviews] = await Promise.all([
    getRecruiterJobs(),
    supabase.from("applications_ranked").select("*").eq("recruiter_id", userId).order("created_at", { ascending: false }),
    supabase.from("application_events").select("application_id, to_status, created_at, event_type").eq("event_type", "status_change"),
    getInterviews(),
  ]);
  for (const r of [apps, events]) if (r.error) throw new Error(r.error.message);
  const rows = (apps.data ?? []) as RankedApplication[];
  const ev = (events.data ?? []) as Pick<ApplicationEvent, "application_id" | "to_status" | "created_at" | "event_type">[];
  return { jobs, apps: rows, events: ev, interviews, analytics: computeAnalytics(jobs, rows, ev, interviews) };
}

// ---------------------------------------------------------------- P2: fairness, recommendations, duplicates, profile
export type { FairnessTestResponse } from "@/app/api/fairness-test/route";
import type { FairnessTestResponse } from "@/app/api/fairness-test/route";

/** TI-7: counterfactual test — protected attributes changed, both versions re-scored. */
export async function runFairnessTest(applicationId: string): Promise<FairnessTestResponse> {
  return postJSON<FairnessTestResponse>("/api/fairness-test", { applicationId });
}

export interface JobRecommendation { job: Job; score: number; reason: string; matched: string[]; missing: string[] }

/** TI-4: open jobs ranked for the signed-in candidate (excludes jobs already applied to). */
export async function getRecommendations(): Promise<{ jobs: JobRecommendation[]; needsResume?: boolean }> {
  const res = await fetch("/api/recommendations");
  const data = await res.json().catch(() => ({ error: "Unexpected server response" }));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

export type { DuplicatePair } from "@/app/api/duplicates/route";
import type { DuplicatePair } from "@/app/api/duplicates/route";

/** TI-3: detect possible duplicate applicants (stored as pending flags). */
export async function getDuplicates(): Promise<DuplicatePair[]> {
  const res = await fetch("/api/duplicates");
  const data = await res.json().catch(() => ({ error: "Unexpected server response" }));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data.pairs;
}

/** Recruiter confirms (merge = close the later application) or dismisses a flag. */
export async function resolveDuplicate(flagId: string, action: "merge" | "dismiss"): Promise<void> {
  await postJSON("/api/duplicates", { flagId, action });
}

// ---------------------------------------------------------------- Profile
export async function getMyProfile(): Promise<Profile> {
  const userId = await requireUserId();
  const { data, error } = await createClient().from("profiles").select("*").eq("id", userId).single();
  if (error || !data) throw new Error(error?.message ?? "Profile not found");
  return data as Profile;
}

/** Name, phone and interests only — role can't be changed (DB trigger). */
export async function updateMyProfile(patch: { full_name: string; phone: string | null; interests: string[] }): Promise<Profile> {
  const full_name = patch.full_name.trim().slice(0, 120);
  if (!full_name) throw new Error("Name is required");
  const phone = patch.phone?.trim() || null;
  if (phone && !/^[+()\d\s-]{7,20}$/.test(phone)) throw new Error("Phone number looks invalid");
  const interests = [...new Set(patch.interests.map((i) => i.trim()).filter(Boolean))].slice(0, 20).map((i) => i.slice(0, 40));
  const userId = await requireUserId();
  const { data, error } = await createClient().from("profiles").update({ full_name, phone, interests }).eq("id", userId).select("*").single();
  if (error || !data) throw new Error(error?.message ?? "Could not save profile");
  return data as Profile;
}
