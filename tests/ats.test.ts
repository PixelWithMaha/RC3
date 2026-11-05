import { describe, expect, it } from "vitest";
import { atsChecks, bullet, docToText, realSkills, safeRewrite } from "@/lib/ai/ats";

const raw = "Skills: Python, Flask, MySQL\nBuilt REST endpoints in Flask backed by MySQL for 40 warehouses.";
const vocab = ["Python", "Flask", "MySQL", "Docker", "Kubernetes"];

describe("ATS truthfulness", () => {
  it("accepts a faithful rewrite and rejects invented skills or numbers", () => {
    expect(safeRewrite("Developed REST APIs with Flask and MySQL serving 40 warehouses", raw, vocab)).toBe(true);
    expect(safeRewrite("Developed Flask APIs deployed with Docker", raw, vocab)).toBe(false);
    expect(safeRewrite("Developed Flask APIs for 400 warehouses", raw, vocab)).toBe(false);
  });
  it("falls back to the original line when a rewrite isn't safe", () => {
    const b = bullet("Built Kubernetes clusters", "Built REST endpoints in Flask backed by MySQL for 40 warehouses.", raw, vocab);
    expect(b.kept).toBe("original");
    expect(b.text).toMatch(/^Built REST endpoints/);
  });
  it("keeps only skills the resume really mentions", () => {
    expect(realSkills(["python", "Docker", "Postgres", "Flask", "Python"], raw)).toEqual(["Python", "Flask"]);
  });
});

describe("ATS checks", () => {
  const base = { hasName: true, hasEmail: true, hasPhone: true, sections: { summary: true, skills: true, experience: true, education: true }, skills: ["Python", "Flask", "MySQL", "Git", "Linux"], dates: ["2021 – 2025"] };
  it("scores a well-formed document highly and explains failures", () => {
    const good = atsChecks({ ...base, bullets: ["Built APIs", "Designed schemas", "Automated reports"] });
    expect(good.score).toBe(100);
    const bad = atsChecks({ ...base, hasPhone: false, bullets: ["the dashboard was made by me with lots of long words that go on and on and on and on and on and on and on and on and on and on and on"] });
    expect(bad.checks.find((c) => c.id === "contact")!.detail).toBe("Missing: phone");
    expect(bad.score).toBeLessThan(70);
  });
  it("counts job keyword coverage only for skills present", () => {
    const r = atsChecks({ ...base, bullets: ["Built APIs", "Led team", "Shipped app"], jobSkills: ["Python", "Docker"] });
    expect(r.checks.find((c) => c.id === "keywords")!.detail).toBe("1 of 2 job skills (only ones you have)");
  });
});

it("plain-text export uses standard headings", () => {
  const t = docToText({ name: "Sara Ali", contact: ["s@x.com", "+92 300 0000000"], summary: "Backend developer.", skills: [{ category: "Languages", items: ["Python"] }],
    experience: [{ title: "Engineer", company: "Acme", dates: "2021 – 2025", bullets: [{ text: "Built APIs", original: "x", kept: "rewritten" }] }], projects: [], education: [{ line: "BSc CS, NUST", dates: "2017 – 2021" }] });
  expect(t).toContain("SUMMARY\nBackend developer.");
  expect(t).toContain("EXPERIENCE\nEngineer, Acme | 2021 – 2025\n- Built APIs");
  expect(t).toContain("EDUCATION\nBSc CS, NUST | 2017 – 2021");
});
