import { describe, expect, it } from "vitest";
import { normalizeSkill, normalizeSkillList, sameSkill } from "@/lib/ai/normalize";

describe("skill normalization", () => {
  it.each([
    ["JS", "JavaScript"],
    ["ReactJS", "React"],
    ["react.js", "React"],
    ["Postgres", "PostgreSQL"],
    ["node.js", "Node.js"],
    ["k8s", "Kubernetes"],
    ["RESTful API", "REST API"],
    ["C++", "C++"],
    ["golang", "Go"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeSkill(input)).toBe(expected);
  });
  it("keeps unknown skills as-is (trimmed)", () => {
    expect(normalizeSkill("  Celery ")).toBe("Celery");
  });
  it("dedupes equivalent skills, preferring a verified entry", () => {
    const out = normalizeSkillList([
      { name: "Postgres", excerpt: "x", verified: false },
      { name: "PostgreSQL", excerpt: "y", verified: true },
      { name: "Python", excerpt: "z", verified: true },
    ]);
    expect(out.map((s) => s.name)).toEqual(["PostgreSQL", "Python"]);
    expect(out[0].excerpt).toBe("y");
  });
  it("sameSkill compares canonical forms", () => {
    expect(sameSkill("postgres", "PostgreSQL")).toBe(true);
    expect(sameSkill("Java", "JavaScript")).toBe(false);
  });
});
