import { describe, expect, it } from "vitest";
import { DEFAULT_WEIGHTS, computeStability, rankOf, rebalance, weightedTotal, type Weights } from "@/lib/ranking";

const b = (skills: number, experience: number, projects: number, qualifications: number) => ({ skills, experience, projects, qualifications });

describe("weights", () => {
  it("default weighted total matches the MATCH-3 formula", () => {
    expect(weightedTotal(b(80, 92, 88, 78), DEFAULT_WEIGHTS)).toBe(84);
  });
  it("rebalance keeps the total at 100 and the others in proportion", () => {
    const w = rebalance(DEFAULT_WEIGHTS, 0, 20);
    expect(w.reduce((a, x) => a + x, 0)).toBe(100);
    expect(w[0]).toBe(20);
    expect(w[1]).toBeGreaterThan(w[2]);
    expect(rebalance([100, 0, 0, 0], 0, 40)).toEqual([40, 20, 20, 20]);
    expect(rebalance(DEFAULT_WEIGHTS, 2, 150)).toEqual([0, 0, 100, 0]);
  });
});

describe("ranking", () => {
  const items = [
    { id: "skills-star", breakdown: b(100, 40, 70, 60) },
    { id: "veteran", breakdown: b(60, 100, 70, 80) },
    { id: "weak", breakdown: b(20, 20, 20, 20) },
  ];
  it("re-ranks when the recruiter's priorities change", () => {
    expect(rankOf(items, DEFAULT_WEIGHTS)).toEqual({ "skills-star": 1, veteran: 2, weak: 3 });
    const expHeavy: Weights = [20, 60, 10, 10];
    expect(rankOf(items, expHeavy)).toEqual({ veteran: 1, "skills-star": 2, weak: 3 });
  });
  it("stability flags a close race and names the rival and the driver", () => {
    const s = computeStability(items, DEFAULT_WEIGHTS);
    expect(s.applicable).toBe(true);
    expect(s.topId).toBe("skills-star");
    expect(s.ranges.weak).toEqual({ best: 3, worst: 3 });
    if (s.holdPct < 1) {
      expect(s.rivalId).toBe("veteran");
      expect(s.driver).toBe("Experience");
    }
  });
  it("is stable when one candidate dominates, and not applicable for one", () => {
    const s = computeStability([{ id: "a", breakdown: b(99, 99, 99, 99) }, { id: "b", breakdown: b(10, 10, 10, 10) }], DEFAULT_WEIGHTS);
    expect(s).toMatchObject({ badge: "Stable", holdPct: 1 });
    expect(computeStability([{ id: "a", breakdown: b(1, 1, 1, 1) }], DEFAULT_WEIGHTS).applicable).toBe(false);
  });
});
