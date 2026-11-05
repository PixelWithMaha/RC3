import { describe, expect, it } from "vitest";
import { buildCounterfactual, cosine, findDuplicatePairs, normEmail, normPhone, parseVector, recommendJobs } from "@/lib/talent";
import { anonymizeResume } from "@/lib/ai/fairness";
import type { Job, ParsedResume } from "@/lib/types";

const resume: ParsedResume = {
  name: "Ayesha Khan",
  contact: { email: "ayesha@example.com", phone: "+92 300 1110001", location: "Karachi", links: [] },
  summary: "Ayesha is a backend engineer. She builds Python services.",
  total_experience_years: 5,
  skills: [{ name: "Python", excerpt: "Python", verified: true }, { name: "Django", excerpt: "Django", verified: true }, { name: "Kubernetes", excerpt: "x", verified: false }],
  education: [],
  experience: [{ title: "Backend Developer", company: "Nimbus", start: "2021", end: "2025", description: "She built Django APIs.", excerpt: "Django APIs", verified: true }],
  projects: [{ name: "ShopAPI", description: "Django + Docker", technologies: ["Docker"], excerpt: "ShopAPI", verified: true }],
};

describe("counterfactual (TI-7)", () => {
  it("changes protected attributes but the anonymized scoring input stays identical", () => {
    const { altered, attributes_changed } = buildCounterfactual(resume);
    expect(altered.name).not.toBe(resume.name);
    expect(altered.contact.email).not.toBe(resume.contact.email);
    expect(attributes_changed).toContain("gender");
    expect(JSON.stringify(anonymizeResume(altered))).toBe(JSON.stringify(anonymizeResume(resume)));
  });
});

describe("vectors", () => {
  it("parses pgvector strings and computes cosine", () => {
    expect(parseVector("[1,0,0]")).toEqual([1, 0, 0]);
    expect(parseVector("nope")).toBeNull();
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
  });
});

const job = (id: string, title: string, req: string[], extra: Partial<Job> = {}) =>
  ({ id, title, status: "open", department: null, description: "", required_skills: req.map((name) => ({ name, importance: 4 })), preferred_skills: [], ...extra } as unknown as Job);

describe("recommendations (TI-4)", () => {
  it("ranks by verified skills + project tech, skips applied/closed jobs, ignores unverified skills", () => {
    const recs = recommendJobs(
      [job("1", "Backend", ["Python", "Django", "Docker"]), job("2", "DevOps", ["Kubernetes"]), job("3", "Closed", ["Python"], { status: "closed" }), job("4", "Applied", ["Python"])],
      { parsed: resume }, [], new Set(["4"]),
    );
    expect(recs.map((r) => r.job.id)).toEqual(["1", "2"]);
    expect(recs[0].matched).toEqual(["Python", "Django", "Docker"]);
    expect(recs[1].missing).toEqual(["Kubernetes"]); // unverified skill doesn't count
  });
  it("adds a small interest boost", () => {
    const [a] = recommendJobs([job("1", "Data platform", ["Rust"])], { parsed: resume }, ["data"]);
    const [b] = recommendJobs([job("1", "Data platform", ["Rust"])], { parsed: resume }, []);
    expect(a.score).toBeGreaterThan(b.score);
  });
});

describe("duplicates (TI-3)", () => {
  const row = (id: string, cand: string, email: string | null, phone: string | null, embedding?: string) =>
    ({ application_id: id, candidate_id: cand, job_id: "j", created_at: `2026-11-0${id}`, email, phone, embedding });
  it("normalizes email and phone", () => {
    expect(normEmail(" Sara+jobs@Example.com ")).toBe("sara@example.com");
    expect(normPhone("+92 (300) 111-0001")).toBe(normPhone("0300 1110001"));
  });
  it("flags same email/phone or near-identical resumes across different accounts", () => {
    const pairs = findDuplicatePairs([
      row("1", "c1", "sara@x.com", null), row("2", "c2", "SARA@x.com", null),
      row("3", "c3", null, "0300 1234567"), row("4", "c4", null, "+92 300 1234567"),
      row("5", "c5", null, null, "[1,0,0]"), row("6", "c6", null, null, "[0.999,0.01,0]"),
      row("7", "c1", "sara@x.com", null),
    ]);
    const ids = pairs.map((p) => `${p.a.application_id}-${p.b.application_id}`);
    expect(ids).toContain("1-2");
    expect(ids).toContain("3-4");
    expect(ids).toContain("5-6");
    expect(ids).not.toContain("1-7"); // same account
  });
});
