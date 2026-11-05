// MATCH-3: weighted score computed in code, never by the LLM.
import type { ScoreBreakdown, SkillRequirement } from "@/lib/types";
import { sameSkill } from "./normalize";

export const WEIGHTS = { skills: 0.5, experience: 0.25, projects: 0.15, qualifications: 0.1 } as const;

const clamp = (n: number) => Math.min(100, Math.max(0, Number.isFinite(n) ? n : 0));
const round1 = (n: number) => Math.round(n * 10) / 10;

export function computeWeightedScore(b: ScoreBreakdown): number {
  return round1(
    WEIGHTS.skills * clamp(b.skills) +
      WEIGHTS.experience * clamp(b.experience) +
      WEIGHTS.projects * clamp(b.projects) +
      WEIGHTS.qualifications * clamp(b.qualifications),
  );
}

export type SkillAssessment = {
  skill: string;
  status: "full" | "partial" | "not_mentioned" | "explicitly_lacking";
};

const CREDIT: Record<SkillAssessment["status"], number> = {
  full: 1,
  partial: 0.5,
  not_mentioned: 0,
  explicitly_lacking: 0,
};

/**
 * Skills sub-score: each required skill weighted by importance (1-5),
 * preferred skills at half weight. Returns null when the job lists no skills.
 */
export function computeSkillsScore(
  required: SkillRequirement[],
  preferred: SkillRequirement[],
  assessments: SkillAssessment[],
): number | null {
  const reqs = [
    ...required.map((r) => ({ name: r.name, w: clampImportance(r.importance) })),
    ...preferred.map((r) => ({ name: r.name, w: clampImportance(r.importance) * 0.5 })),
  ];
  const total = reqs.reduce((s, r) => s + r.w, 0);
  if (total === 0) return null;
  const earned = reqs.reduce((s, r) => {
    const a = assessments.find((x) => sameSkill(x.skill, r.name));
    return s + r.w * (a ? CREDIT[a.status] : 0);
  }, 0);
  return round1((earned / total) * 100);
}

function clampImportance(i: number): number {
  return Math.min(5, Math.max(1, Math.round(i || 1)));
}
