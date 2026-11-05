import { describe, expect, it } from "vitest";
import { WEIGHTS, computeSkillsScore, computeWeightedScore } from "@/lib/ai/scoring";

describe("computeWeightedScore", () => {
  it("weights sum to 1", () => {
    expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
  it("applies 50/25/15/10 weights", () => {
    expect(computeWeightedScore({ skills: 100, experience: 0, projects: 0, qualifications: 0 })).toBe(50);
    expect(computeWeightedScore({ skills: 0, experience: 100, projects: 0, qualifications: 0 })).toBe(25);
    expect(computeWeightedScore({ skills: 0, experience: 0, projects: 100, qualifications: 0 })).toBe(15);
    expect(computeWeightedScore({ skills: 0, experience: 0, projects: 0, qualifications: 100 })).toBe(10);
    expect(computeWeightedScore({ skills: 80, experience: 60, projects: 70, qualifications: 50 })).toBe(70.5);
  });
  it("clamps out-of-range and NaN sub-scores", () => {
    expect(computeWeightedScore({ skills: 150, experience: -20, projects: NaN, qualifications: 100 })).toBe(60);
  });
});

describe("computeSkillsScore", () => {
  const required = [
    { name: "Python", importance: 5 },
    { name: "Django", importance: 4 },
    { name: "PostgreSQL", importance: 4 },
    { name: "Docker", importance: 3 },
  ];
  it("is 100 when every required skill is fully matched", () => {
    const a = required.map((r) => ({ skill: r.name, status: "full" as const }));
    expect(computeSkillsScore(required, [], a)).toBe(100);
  });
  it("weights by importance and gives partial half credit", () => {
    const a = [
      { skill: "Python", status: "full" as const },
      { skill: "Django", status: "partial" as const },
      { skill: "Postgres", status: "partial" as const }, // alias normalized
      { skill: "Docker", status: "not_mentioned" as const },
    ];
    // (5 + 2 + 2 + 0) / 16
    expect(computeSkillsScore(required, [], a)).toBe(56.3);
  });
  it("counts preferred skills at half weight", () => {
    const a = [{ skill: "Python", status: "full" as const }];
    // required Python w5 earned; preferred AWS importance 4 -> w2 not earned
    expect(computeSkillsScore([{ name: "Python", importance: 5 }], [{ name: "AWS", importance: 4 }], a)).toBe(71.4);
  });
  it("returns null when the job lists no skills", () => {
    expect(computeSkillsScore([], [], [])).toBeNull();
  });
});
