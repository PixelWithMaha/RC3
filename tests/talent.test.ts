import { describe, expect, it } from "vitest";
import { buildCounterfactual, cosine, documentSimilarity, findDuplicatePairs, normEmail, normPhone, parseVector, recommendJobs, type DupCandidate } from "@/lib/talent";
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
  const raw = "Skills: Python, Django, Kubernetes\nBuilt Django APIs. ShopAPI: Django + Docker";
  it("ranks by evidence fit, skips applied/closed jobs, and only recommends jobs with real evidence", () => {
    const recs = recommendJobs(
      [job("1", "Backend", ["Python", "Django", "Docker"]), job("2", "Rust", ["Rust", "Wasm"]), job("3", "Closed", ["Python"], { status: "closed" }), job("4", "Applied", ["Python"])],
      { parsed: resume, raw_text: raw }, [], new Set(["4"]),
    );
    expect(recs.map((r) => r.job.id)).toEqual(["1", "2"]);
    expect(recs[0].eligible).toBe(true);
    expect(recs[1]).toMatchObject({ eligible: false, fit: 0, missing: ["Rust", "Wasm"] });
  });
  it("similarity alone can't make a job look like a fit", () => {
    const [r] = recommendJobs([{ ...job("1", "Rust", ["Rust"]), embedding: "[1,0]" }], { parsed: resume, raw_text: raw, embedding: "[1,0]" });
    expect(r.score).toBeLessThanOrEqual(15);
    expect(r.eligible).toBe(false);
  });
  it("adds a small interest boost", () => {
    const [a] = recommendJobs([job("1", "Data platform", ["Python"])], { parsed: resume, raw_text: raw }, ["data"]);
    const [b] = recommendJobs([job("1", "Data platform", ["Python"])], { parsed: resume, raw_text: raw }, []);
    expect(a.score - b.score).toBe(5);
  });
});

describe("duplicates (TI-3)", () => {
  const resumeA = "Ayesha Khan backend engineer with 5 years building Python web services. Built REST APIs in Django and PostgreSQL serving 80k daily users. Containerized every service with Docker.";
  const resumeB = "Hamza Tariq backend developer with 4 years of experience. Designed Django services on Postgres and deployed them with Docker on AWS for a fintech startup.";
  const row = (id: string, cand: string, o: Partial<DupCandidate> = {}): DupCandidate =>
    ({ application_id: id, candidate_id: cand, job_id: "j1", created_at: `2026-11-0${id}`, email: null, phone: null, raw_text: resumeB, ...o });

  it("normalizes email and phone", () => {
    expect(normEmail(" Sara+jobs@Example.com ")).toBe("sara@example.com");
    expect(normPhone("+92 (300) 111-0001")).toBe(normPhone("0300 1110001"));
  });
  it("document similarity separates a copy from a different person's resume", () => {
    expect(documentSimilarity(resumeA, resumeA)).toBe(1);
    expect(documentSimilarity(resumeA, resumeB)!).toBeLessThan(0.2);
  });
  it("flags strong signals only, never embedding similarity alone", () => {
    const pairs = findDuplicatePairs([
      row("1", "c1", { email: "sara@x.com" }), row("2", "c2", { email: "SARA@x.com" }),
      row("3", "c3", { phone: "0300 1234567", raw_text: resumeA }), row("4", "c4", { phone: "+92 300 1234567", raw_text: "x" }),
      row("5", "c5", { raw_text: resumeA, embedding: "[1,0]" }), row("6", "c6", { raw_text: resumeA + " Also mentors juniors.", embedding: "[1,0]" }),
      row("7", "c7", { raw_text: "unrelated text about frontend react work", embedding: "[1,0]" }),
    ]);
    const ids = pairs.map((p) => `${p.a.application_id}-${p.b.application_id}`);
    expect(ids).toEqual(expect.arrayContaining(["1-2", "3-4", "5-6"]));
    expect(ids.some((x) => x.includes("7"))).toBe(false); // identical embedding, different document → not flagged
    expect(pairs.find((p) => p.a.application_id === "5")!.reasons[0]).toMatch(/identical/);
  });
  it("keeps one pair per pair of accounts, preferring the same job", () => {
    const pairs = findDuplicatePairs([
      row("1", "c1", { email: "a@x.com", job_id: "j1" }), row("2", "c1", { email: "a@x.com", job_id: "j2" }),
      row("3", "c2", { email: "a@x.com", job_id: "j2" }),
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ sameJob: true });
    expect([pairs[0].a.application_id, pairs[0].b.application_id].sort()).toEqual(["2", "3"]);
  });
});
