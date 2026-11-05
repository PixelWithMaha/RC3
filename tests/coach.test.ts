import { describe, expect, it } from "vitest";
import { checkSuggestion, coverage } from "@/lib/ai/coach";

const raw = `Backend developer. Built REST endpoints in Django backed by Postgres for 40 warehouses.
Wrote Python scripts for reporting.
Skills: Python, Django, Docker`;
const vocab = ["Python", "Django", "PostgreSQL", "Docker", "REST API", "Kubernetes"];
const base = { section: "experience" as const, why: "w", target_skills: ["REST API", "PostgreSQL"] };

describe("checkSuggestion", () => {
  it("accepts a faithful rephrase that uses the job's words", () => {
    const c = checkSuggestion({ ...base, original: "Built REST endpoints in Django backed by Postgres for 40 warehouses.", rewrite: "Designed and built REST APIs in Django on PostgreSQL serving 40 warehouses." }, raw, vocab);
    expect(c.status).toBe("safe");
    expect(c.new_skills).toEqual([]);
    expect(c.emphasized).toEqual(["REST API", "PostgreSQL"]);
  });
  it("flags invented skills and metrics", () => {
    const c = checkSuggestion({ ...base, original: "Wrote Python scripts for reporting.", rewrite: "Automated reporting with Python on Kubernetes, cutting time by 60%." }, raw, vocab);
    expect(c.status).toBe("check");
    expect(c.new_skills).toEqual(["Kubernetes"]);
    expect(c.new_numbers).toEqual(["60%"]);
  });
  it("asks the candidate to confirm a listed skill newly attached to a line", () => {
    const c = checkSuggestion({ ...base, original: "Wrote Python scripts for reporting.", rewrite: "Wrote Python reporting scripts packaged with Docker." }, raw, vocab);
    expect(c.status).toBe("confirm");
    expect(c.borrowed_skills).toEqual(["Docker"]);
  });
  it("flags an 'original' that isn't actually in the resume", () => {
    const c = checkSuggestion({ ...base, original: "Led a team of 12 engineers.", rewrite: "Led a team of 12 engineers." }, raw, vocab);
    expect(c.original_found).toBe(false);
    expect(c.status).toBe("check");
  });
});

describe("coverage", () => {
  const work = "Built REST endpoints in Django backed by Postgres. Wrote Python scripts for reporting.";
  it("moves listed skills into work lines but never counts absent ones", () => {
    const c = coverage(["Python", "Docker", "Kubernetes"], work, raw, ["Python scripts shipped with Docker on Kubernetes"]);
    expect(c.before).toEqual(["Python"]);
    expect(c.after).toEqual(["Python", "Docker"]);
    expect(c.absent).toEqual(["Kubernetes"]);
  });
});
