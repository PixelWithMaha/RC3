import { describe, expect, it } from "vitest";
import { computeAnalytics } from "@/lib/analytics";
import type { JobWithCounts, RankedApplication } from "@/lib/types";

const job = (id: string, status: "open" | "closed") => ({ id, title: id, status } as JobWithCounts);
const app = (id: string, job_id: string, status: RankedApplication["status"], gaps: { skill: string; type: "not_mentioned" | "explicitly_lacking" }[] = []) =>
  ({ id, job_id, status, ai_explanation: { gaps } } as unknown as RankedApplication);
const ev = (application_id: string, to_status: RankedApplication["status"], day: number) =>
  ({ application_id, to_status, event_type: "status_change" as const, created_at: new Date(Date.UTC(2026, 10, day)).toISOString() });

describe("computeAnalytics", () => {
  const apps = [
    app("a1", "j1", "interview", [{ skill: "Docker", type: "not_mentioned" }]),
    app("a2", "j1", "rejected", [{ skill: "Docker", type: "explicitly_lacking" }, { skill: "Django", type: "not_mentioned" }]),
    app("a3", "j1", "ai_assessed", [{ skill: "docker", type: "not_mentioned" }]),
  ];
  const events = [ev("a1", "submitted", 1), ev("a1", "shortlisted", 2), ev("a2", "submitted", 1), ev("a2", "rejected", 4)];
  const r = computeAnalytics([job("j1", "open"), job("j2", "closed")], apps, events,
    [{ scheduled_at: "2099-01-01T10:00:00Z", status: "scheduled" }, { scheduled_at: "2020-01-01T10:00:00Z", status: "scheduled" }]);

  it("computes KPIs", () => {
    expect(r.kpis).toEqual({ activeJobs: 1, totalApplications: 3, shortlisted: 1, pendingReviews: 1, upcomingInterviews: 1 });
  });
  it("computes shortlist rate and processing time from the audit trail", () => {
    expect(r.shortlistRate).toBe(33.3);
    expect(r.avgProcessingDays).toBe(3);
  });
  it("aggregates common gaps case-insensitively, split by type", () => {
    expect(r.commonGaps[0]).toEqual({ skill: "Docker", count: 3, notMentioned: 2, explicitlyLacking: 1 });
  });
  it("counts applications by stage", () => {
    expect(r.byStage.find((s) => s.status === "rejected")?.count).toBe(1);
  });
});
