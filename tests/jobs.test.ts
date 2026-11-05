import { describe, expect, it } from "vitest";
import { cleanJobExtraction, jobEmbeddingText } from "@/lib/ai/jobs";
import { JobCreateZ, JobExtractRequestZ } from "@/lib/validation";

describe("cleanJobExtraction", () => {
  it("normalizes names, clamps importance and dedupes across lists", () => {
    const r = cleanJobExtraction({
      required_skills: [
        { name: "python", importance: 5 },
        { name: "Postgres", importance: 9 },
        { name: "PostgreSQL", importance: 3 },
        { name: "Docker", importance: 0 },
      ],
      preferred_skills: [
        { name: "postgresql", importance: 2 }, // already required -> dropped
        { name: "k8s", importance: 2.6 },
      ],
      min_experience_years: -1,
      qualifications: [" BSc Computer Science ", "BSc Computer Science", ""],
    });
    expect(r.required_skills).toEqual([
      { name: "Python", importance: 5 },
      { name: "PostgreSQL", importance: 5 },
      { name: "Docker", importance: 1 },
    ]);
    expect(r.preferred_skills).toEqual([{ name: "Kubernetes", importance: 3 }]);
    expect(r.min_experience_years).toBe(0);
    expect(r.qualifications).toEqual(["BSc Computer Science"]);
  });
});

describe("job validation", () => {
  const base = { title: "Backend Developer", type: "full-time" as const };
  it("applies defaults", () => {
    const j = JobCreateZ.parse(base);
    expect(j).toMatchObject({ status: "open", required_skills: [], min_experience_years: 0 });
  });
  it("rejects bad importance, type and salary range", () => {
    expect(JobCreateZ.safeParse({ ...base, required_skills: [{ name: "Python", importance: 7 }] }).success).toBe(false);
    expect(JobCreateZ.safeParse({ ...base, type: "freelance" }).success).toBe(false);
    expect(JobCreateZ.safeParse({ ...base, salary_min: 100, salary_max: 50 }).success).toBe(false);
  });
  it("requires a meaningful description for extraction", () => {
    expect(JobExtractRequestZ.safeParse({ description: "python" }).success).toBe(false);
  });
});

describe("jobEmbeddingText", () => {
  it("includes title and skills", () => {
    const t = jobEmbeddingText({
      title: "Backend Developer", description: "Build APIs", min_experience_years: 2, qualifications: [],
      required_skills: [{ name: "Python", importance: 5 }], preferred_skills: [],
    });
    expect(t).toContain("Backend Developer");
    expect(t).toContain("Required skills: Python");
  });
});
