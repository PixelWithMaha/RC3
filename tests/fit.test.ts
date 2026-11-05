import { describe, expect, it } from "vitest";
import { computeFit } from "@/lib/ai/fit";
import type { ParsedResume } from "@/lib/types";

const parsed: ParsedResume = {
  name: null, contact: { email: null, phone: null, location: null, links: [] }, summary: null, total_experience_years: 3,
  skills: [{ name: "Python", excerpt: "", verified: true }, { name: "Flask", excerpt: "", verified: true }, { name: "MySQL", excerpt: "", verified: true }],
  education: [],
  experience: [{ title: "Engineer", company: "DataBridge", start: null, end: null, description: "Built REST endpoints in Flask backed by MySQL.", excerpt: "", verified: true }],
  projects: [],
};
const raw = "Skills: Python, Flask, MySQL\nBuilt REST endpoints in Flask backed by MySQL.";
const job = (req: [string, number][]) => ({ required_skills: req.map(([name, importance]) => ({ name, importance })), preferred_skills: [] });

describe("computeFit", () => {
  it("gives full credit for proven skills and partial for related ones", () => {
    const f = computeFit(job([["Flask", 5], ["Django", 5], ["SQL", 4]]), parsed, raw);
    expect(f.proven).toEqual(["Flask"]);
    expect(f.related).toEqual(["Django (via Flask)", "SQL (via MySQL)"]);
    expect(f.fit).toBe(Math.round(((5 + 0.4 * 5 + 0.4 * 4) / 14) * 100));
    expect(f.requiredMissing).toEqual([]);
  });
  it("counts truly absent skills as missing", () => {
    const f = computeFit(job([["Kubernetes", 5], ["Python", 1]]), parsed, raw);
    expect(f.requiredMissing).toEqual(["Kubernetes"]);
    expect(f.fit).toBe(Math.round((0.6 / 6) * 100)); // Python only listed
  });
});
