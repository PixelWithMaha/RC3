// Shared types — mirror supabase/schema.sql. Frontend + backend contract.

export const EMBEDDING_DIM = 768;

export type Role = "recruiter" | "candidate";

export interface Profile {
  id: string;
  role: Role;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  interests: string[];
  created_at: string;
}

// ---------------------------------------------------------------- Jobs
export const JOB_TYPES = ["full-time", "part-time", "internship", "contract", "remote"] as const;
export type JobType = (typeof JOB_TYPES)[number];
export type JobStatus = "open" | "closed";

export interface SkillRequirement {
  name: string;
  importance: number; // 1-5
}

export interface Job {
  id: string;
  recruiter_id: string;
  title: string;
  department: string | null;
  location: string | null;
  type: JobType;
  salary_min: number | null;
  salary_max: number | null;
  description: string;
  required_skills: SkillRequirement[];
  preferred_skills: SkillRequirement[];
  min_experience_years: number;
  qualifications: string[];
  status: JobStatus;
  created_at: string;
  updated_at: string;
}

/** jobs_with_counts view (JOB-6) */
export interface JobWithCounts extends Job {
  applicant_count: number;
  shortlisted_count: number;
}

export type JobInput = Omit<Job, "id" | "recruiter_id" | "created_at" | "updated_at">;

/** /api/job/extract output (JOB-7) */
export interface JobExtraction {
  required_skills: SkillRequirement[];
  preferred_skills: SkillRequirement[];
  min_experience_years: number;
  qualifications: string[];
}

// ---------------------------------------------------------------- Resumes
export type ParseStatus = "pending" | "success" | "failed" | "empty";

/** Every AI-extracted item carries a verbatim excerpt; `verified` is computed in code (TI-8). */
export interface Evidence {
  excerpt: string;
  verified: boolean;
}

export interface ParsedSkill extends Evidence {
  name: string; // normalized (RES-4)
}

export interface ParsedEducation extends Evidence {
  institution: string;
  degree: string | null;
  field: string | null;
  start: string | null;
  end: string | null;
}

export interface ParsedExperience extends Evidence {
  title: string;
  company: string | null;
  start: string | null;
  end: string | null;
  description: string;
}

export interface ParsedProject extends Evidence {
  name: string;
  description: string;
  technologies: string[];
}

export interface ParsedContact {
  email: string | null;
  phone: string | null;
  location: string | null;
  links: string[];
}

export interface ParsedResume {
  name: string | null;
  contact: ParsedContact;
  summary: string | null;
  total_experience_years: number | null;
  skills: ParsedSkill[];
  education: ParsedEducation[];
  experience: ParsedExperience[];
  projects: ParsedProject[];
}

export interface Resume {
  id: string;
  candidate_id: string;
  file_path: string;
  file_name: string;
  raw_text: string | null;
  parsed: ParsedResume | null;
  is_verified: boolean;
  parse_status: ParseStatus;
  parse_error: string | null;
  created_at: string;
  updated_at: string;
}

/** /api/resume/parse output */
export interface ParseResumeResponse {
  parsed: ParsedResume | null;
  parse_status: ParseStatus;
  error?: string;
}

// ---------------------------------------------------------------- Applications
export const APPLICATION_STATUSES = [
  "submitted",
  "parsed",
  "ai_assessed",
  "recruiter_review",
  "shortlisted",
  "rejected",
  "interview",
  "selected",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/** Statuses only a recruiter button may set (human in control). */
export const HUMAN_STATUSES: ApplicationStatus[] = [
  "recruiter_review",
  "shortlisted",
  "rejected",
  "interview",
  "selected",
];

export interface ScoreBreakdown {
  skills: number;
  experience: number;
  projects: number;
  qualifications: number;
}

export type GapType = "not_mentioned" | "explicitly_lacking";

export interface MatchedSkill extends Evidence {
  skill: string; // job requirement name
  resume_skill: string | null; // what the candidate actually has (semantic match)
  strength: "full" | "partial";
}

export interface SkillGap {
  skill: string;
  type: GapType; // GAP-1
  required: boolean;
  learning_suggestion: string; // GAP-4
  excerpt?: string; // for explicitly_lacking: where the resume says so
  verified?: boolean;
}

export interface MatchExplanation {
  summary: string; // GAP-3
  matched: MatchedSkill[];
  gaps: SkillGap[];
  experience_note: string;
  project_note: string;
  qualification_note: string;
  unsupported_claims: string[]; // AI claims whose excerpts were not found in the resume
}

export interface Application {
  id: string;
  job_id: string;
  candidate_id: string;
  resume_id: string;
  status: ApplicationStatus;
  ai_score: number | null;
  score_breakdown: ScoreBreakdown | null;
  ai_explanation: MatchExplanation | null;
  semantic_similarity: number | null;
  match_error: string | null;
  created_at: string;
  updated_at: string;
}

/** applications_ranked view: override fields are null for candidates (RLS). */
export interface RankedApplication extends Application {
  override_score: number | null;
  override_reason: string | null;
  effective_score: number | null;
  job_title: string;
  recruiter_id: string;
  candidate_name: string | null;
  candidate_email: string | null;
}

/** /api/match output */
export interface MatchResponse {
  ai_score: number;
  score_breakdown: ScoreBreakdown;
  ai_explanation: MatchExplanation;
  semantic_similarity: number | null;
}

export type EventType = "status_change" | "score_override" | "rescore";

export interface ApplicationEvent {
  id: string;
  application_id: string;
  event_type: EventType;
  from_status: ApplicationStatus | null;
  to_status: ApplicationStatus | null;
  changed_by: string | null; // null = system/AI
  reason: string | null;
  created_at: string;
}

export interface RecruiterNote {
  id: string;
  application_id: string;
  recruiter_id: string;
  note: string;
  created_at: string;
}

// ---------------------------------------------------------------- Interviews
export type Difficulty = "beginner" | "intermediate" | "advanced";
export type QuestionCategory = "role" | "project";

export interface InterviewQuestion {
  id: string;
  application_id: string;
  difficulty: Difficulty;
  category: QuestionCategory;
  question: string;
  answer_guideline: string;
  created_at: string;
}

export type InterviewType = "technical" | "hr" | "culture" | "final";
export type InterviewStatus = "scheduled" | "done" | "cancelled";

export interface InterviewFeedback {
  technical: number; // 1-5
  communication: number;
  problem_solving: number;
  culture_fit: number;
  strengths: string;
  concerns: string;
  recommendation: "strong_hire" | "hire" | "no_hire" | "strong_no_hire";
}

export interface Interview {
  id: string;
  application_id: string;
  scheduled_at: string;
  duration_min: number;
  interviewer_name: string;
  interviewer_id: string | null;
  type: InterviewType;
  status: InterviewStatus;
  feedback: InterviewFeedback | null;
  created_by: string | null;
  created_at: string;
}

/** get_my_interviews() — candidate-safe, no feedback */
export interface CandidateInterview {
  id: string;
  application_id: string;
  job_title: string;
  scheduled_at: string;
  duration_min: number;
  type: InterviewType;
  status: InterviewStatus;
}

export interface ConflictCheckResponse {
  conflict: boolean;
  with?: { interview_id: string; scheduled_at: string; duration_min: number; reason: "interviewer" | "candidate" }[];
}

// ---------------------------------------------------------------- Talent intelligence
export interface SearchResult {
  candidate: { id: string; full_name: string | null; email: string | null };
  resume_id: string;
  similarity: number;
  evidence: string[];
}

export interface Notification {
  id: string;
  user_id: string;
  message: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

/** Standard error body for every API route */
export interface ApiError {
  error: string;
}
