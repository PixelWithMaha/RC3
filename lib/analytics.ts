// AN-1..6: recruitment analytics computed from rows the recruiter can see (RLS-scoped).
import type { ApplicationEvent, ApplicationStatus, Interview, JobWithCounts, RankedApplication } from "@/lib/types";

export interface RecruiterAnalytics {
  kpis: { activeJobs: number; totalApplications: number; shortlisted: number; pendingReviews: number; upcomingInterviews: number };
  byJob: { jobId: string; title: string; applications: number; shortlisted: number }[];
  byStage: { status: ApplicationStatus; count: number }[];
  shortlistRate: number; // 0-100
  avgProcessingDays: number | null; // submitted -> final decision
  commonGaps: { skill: string; count: number; notMentioned: number; explicitlyLacking: number }[];
}

const STAGES: ApplicationStatus[] = ["submitted", "parsed", "ai_assessed", "recruiter_review", "shortlisted", "interview", "selected", "rejected"];
const REACHED_SHORTLIST = new Set<ApplicationStatus>(["shortlisted", "interview", "selected"]);

export function computeAnalytics(
  jobs: JobWithCounts[],
  apps: RankedApplication[],
  events: Pick<ApplicationEvent, "application_id" | "to_status" | "created_at" | "event_type">[],
  interviews: Pick<Interview, "scheduled_at" | "status">[],
  now = new Date(),
): RecruiterAnalytics {
  const everShortlisted = new Set(
    events.filter((e) => e.to_status && REACHED_SHORTLIST.has(e.to_status)).map((e) => e.application_id),
  );
  for (const a of apps) if (REACHED_SHORTLIST.has(a.status)) everShortlisted.add(a.id);

  // Processing time: first event (submitted) -> first final decision event
  const firstAt = new Map<string, number>();
  const decidedAt = new Map<string, number>();
  for (const e of [...events].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const t = new Date(e.created_at).getTime();
    if (!firstAt.has(e.application_id)) firstAt.set(e.application_id, t);
    if ((e.to_status === "selected" || e.to_status === "rejected") && !decidedAt.has(e.application_id)) decidedAt.set(e.application_id, t);
  }
  const durations = [...decidedAt].map(([id, t]) => t - (firstAt.get(id) ?? t));

  const gapMap = new Map<string, { skill: string; count: number; notMentioned: number; explicitlyLacking: number }>();
  for (const a of apps) {
    for (const g of a.ai_explanation?.gaps ?? []) {
      const key = g.skill.toLowerCase();
      const row = gapMap.get(key) ?? { skill: g.skill, count: 0, notMentioned: 0, explicitlyLacking: 0 };
      row.count++;
      if (g.type === "explicitly_lacking") row.explicitlyLacking++;
      else row.notMentioned++;
      gapMap.set(key, row);
    }
  }

  return {
    kpis: {
      activeJobs: jobs.filter((j) => j.status === "open").length,
      totalApplications: apps.length,
      shortlisted: apps.filter((a) => REACHED_SHORTLIST.has(a.status)).length,
      pendingReviews: apps.filter((a) => ["submitted", "parsed", "ai_assessed", "recruiter_review"].includes(a.status)).length,
      upcomingInterviews: interviews.filter((i) => i.status === "scheduled" && new Date(i.scheduled_at) >= now).length,
    },
    byJob: jobs.map((j) => ({
      jobId: j.id,
      title: j.title,
      applications: apps.filter((a) => a.job_id === j.id).length,
      shortlisted: apps.filter((a) => a.job_id === j.id && everShortlisted.has(a.id)).length,
    })),
    byStage: STAGES.map((status) => ({ status, count: apps.filter((a) => a.status === status).length })),
    shortlistRate: apps.length ? Math.round((everShortlisted.size / apps.length) * 1000) / 10 : 0,
    avgProcessingDays: durations.length
      ? Math.round((durations.reduce((s, d) => s + d, 0) / durations.length / 86_400_000) * 10) / 10
      : null,
    commonGaps: [...gapMap.values()].sort((a, b) => b.count - a.count).slice(0, 8),
  };
}
