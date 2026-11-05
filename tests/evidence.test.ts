import { describe, expect, it } from "vitest";
import { assessSkill, findSkillSpans, skillGroup, type Source } from "@/lib/ai/evidence";

describe("findSkillSpans", () => {
  it("finds aliases and multi-word skills", () => {
    const t = "Built REST APIs in Django and Postgres, shipped JS dashboards.";
    const at = (skill: string) => findSkillSpans(t, skill).map(([s, e]) => t.slice(s, e));
    expect(at("PostgreSQL")).toEqual(["Postgres"]);
    expect(at("JavaScript")).toEqual(["JS"]);
    expect(at("REST API")).toEqual(["REST APIs"]);
    expect(at("Docker")).toEqual([]);
  });
  it("does not match a skill inside a longer one", () => {
    expect(findSkillSpans("Django REST Framework", "Django")).toEqual([]);
  });
});

describe("assessSkill", () => {
  const sources: Source[] = [
    { label: "Experience · Nimbus", text: "Built REST APIs in Django and PostgreSQL.", work: true },
    { label: "Skills section", text: "Skills: Python, Django, Redis", work: false },
  ];
  it("tiers skills by where the evidence is", () => {
    expect(assessSkill("Django", "", sources).tier).toBe("proven");
    expect(assessSkill("Redis", "", sources).tier).toBe("listed");
    expect(assessSkill("Kubernetes", "", sources).tier).toBe("none");
  });
  it("prefers work evidence as the best source", () => {
    expect(assessSkill("Django", "", sources).best?.label).toBe("Experience · Nimbus");
  });
});

it("groups skills by category", () => {
  expect(skillGroup("Postgres")).toBe("Data");
  expect(skillGroup("k8s")).toBe("DevOps & cloud");
  expect(skillGroup("Figma")).toBe("Other");
});
