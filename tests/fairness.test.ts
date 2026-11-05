import { describe, expect, it } from "vitest";
import { anonymizeResume, scrubText } from "@/lib/ai/fairness";
import { computeWeightedScore } from "@/lib/ai/scoring";
import type { ParsedResume } from "@/lib/types";

const base: ParsedResume = {
  name: "Aisha Khan",
  contact: { email: "aisha@example.com", phone: "+92 300 1234567", location: "Lahore, Pakistan", links: ["https://github.com/aisha"] },
  summary: "Aisha Khan is a backend developer. She has 4 years of Python experience. Gender: Female. Religion: Islam.",
  total_experience_years: 4,
  skills: [{ name: "Python", excerpt: "Python, Django", verified: true }],
  education: [{ institution: "LUMS", degree: "BSc", field: "CS", start: "2014", end: "2018", excerpt: "BSc CS LUMS", verified: true }],
  experience: [{ title: "Backend Developer", company: "Acme", start: "2018", end: "2022", description: "Built Django APIs from 2018 - 2022. Contact aisha@example.com", excerpt: "Built Django APIs", verified: true }],
  projects: [{ name: "Shop API", description: "Django + PostgreSQL + Docker", technologies: ["Django"], excerpt: "Shop API", verified: true }],
};

// Counterfactual: same professional content, different protected attributes
const altered: ParsedResume = {
  ...base,
  name: "John Smith",
  contact: { email: "john@example.org", phone: "+1 415 555 0199", location: "Austin, USA", links: [] },
  summary: "John Smith is a backend developer. He has 4 years of Python experience. Gender: Male. Religion: Christianity.",
  experience: [{ ...base.experience[0], description: "Built Django APIs from 2018 - 2022. Contact john@example.org" }],
};

describe("fairness stripping", () => {
  it("removes name, contact, location and links", () => {
    const a = anonymizeResume(base);
    const json = JSON.stringify(a);
    expect(json).not.toMatch(/Aisha|Khan|aisha@example\.com|1234567|Lahore|github\.com/i);
    expect(a).not.toHaveProperty("name");
    expect(a).not.toHaveProperty("contact");
  });
  it("redacts labeled protected attributes and gendered pronouns", () => {
    const s = scrubText("Gender: Female. Date of Birth: 01/02/1995. Marital Status: Married. She is 29 years old.");
    expect(s).not.toMatch(/female|1995|married|\bshe\b|29 years old/i);
  });
  it("keeps professional content such as date ranges", () => {
    expect(scrubText("Worked 2018 - 2022 on Django")).toContain("2018 - 2022");
    expect(scrubText("Helped address performance issues")).toContain("address performance issues");
  });
  it("produces identical scoring input when only protected attributes change", () => {
    expect(JSON.stringify(anonymizeResume(altered))).toBe(JSON.stringify(anonymizeResume(base)));
  });
  it("score is unchanged under the counterfactual (deterministic scoring path)", () => {
    const score = (p: ParsedResume) => {
      const a = anonymizeResume(p);
      // deterministic stand-in for sub-scores derived from anonymized input
      const skills = a.skills.length * 25;
      return computeWeightedScore({ skills, experience: (a.total_experience_years ?? 0) * 20, projects: a.projects.length * 50, qualifications: a.education.length * 100 });
    };
    expect(score(altered)).toBe(score(base));
  });
});
