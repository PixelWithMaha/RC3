import { describe, expect, it } from "vitest";
import { buildMatchResult } from "@/lib/ai/match";

const job = {
  required_skills: [
    { name: "Python", importance: 5 }, { name: "Django", importance: 5 },
    { name: "PostgreSQL", importance: 4 }, { name: "Docker", importance: 4 },
  ],
  preferred_skills: [],
};
const raw = "Built REST services in Django backed by Postgres. Automated reports with Python scripts. I have no Docker experience yet.";
const base = { experience_score: 80, project_score: 70, qualification_score: 60, experience_note: "", project_note: "", qualification_note: "", summary: "s" };
const req = (skill: string, status: "full" | "partial" | "not_mentioned" | "explicitly_lacking", excerpt = "") =>
  ({ skill, status, resume_skill: skill, excerpt, learning_suggestion: "learn " + skill });

describe("buildMatchResult", () => {
  it("scores in code, verifies excerpts and separates missing vs absent", () => {
    const r = buildMatchResult(job, {
      ...base,
      requirements: [
        req("Python", "full", "Automated reports with Python scripts."),
        req("Django", "full", "Built REST services in Django"),
        req("Postgres", "full", "backed by Postgres"), // alias
        req("Docker", "explicitly_lacking", "I have no Docker experience yet."),
      ],
    }, raw);
    expect(r.score_breakdown.skills).toBe(77.8); // 14/18
    expect(r.ai_score).toBe(0.5 * 77.8 + 0.25 * 80 + 0.15 * 70 + 0.1 * 60);
    expect(r.ai_explanation.matched.every((m) => m.verified)).toBe(true);
    expect(r.ai_explanation.gaps).toEqual([expect.objectContaining({ skill: "Docker", type: "explicitly_lacking", verified: true })]);
  });

  it("downgrades hallucinated matches and flags them as unsupported", () => {
    const r = buildMatchResult(job, {
      ...base,
      requirements: [req("Docker", "full", "Deployed Kubernetes clusters with Docker on AWS")],
    }, raw);
    const docker = r.ai_explanation.matched.find((m) => m.skill === "Docker");
    expect(docker).toMatchObject({ strength: "partial", verified: false });
    expect(r.ai_explanation.unsupported_claims).toHaveLength(1);
    // missing skills the model skipped are reported as not_mentioned
    expect(r.ai_explanation.gaps.find((g) => g.skill === "Python")?.type).toBe("not_mentioned");
  });

  it("can't confirm an absence without a verified excerpt", () => {
    const r = buildMatchResult(job, { ...base, requirements: [req("Docker", "explicitly_lacking", "says no docker")] }, raw);
    expect(r.ai_explanation.gaps.find((g) => g.skill === "Docker")?.type).toBe("not_mentioned");
  });
});
