// Turns model output into a stored, explainable result. Score + verification happen here, in code.
import type { Job, MatchExplanation, MatchedSkill, ScoreBreakdown, SkillGap } from "@/lib/types";
import type { MatchOutput } from "./prompts";
import { sameSkill } from "./normalize";
import { computeSkillsScore, computeWeightedScore, type SkillAssessment } from "./scoring";
import { verifyExcerpt } from "./verify";

type JobReqs = Pick<Job, "required_skills" | "preferred_skills">;

export function buildMatchResult(job: JobReqs, out: MatchOutput, rawText: string) {
  const reqs = [
    ...job.required_skills.map((s) => ({ ...s, required: true })),
    ...job.preferred_skills.map((s) => ({ ...s, required: false })),
  ];
  const matched: MatchedSkill[] = [];
  const gaps: SkillGap[] = [];
  const unsupported: string[] = [];
  const assessments: SkillAssessment[] = [];

  for (const r of reqs) {
    const a = out.requirements.find((x) => sameSkill(x.skill, r.name));
    let status = a?.status ?? "not_mentioned";
    const verified = verifyExcerpt(a?.excerpt, rawText);
    // Hallucination guard: a claimed match whose excerpt isn't in the resume earns at most partial credit.
    if ((status === "full" || status === "partial") && !verified) {
      unsupported.push(`${r.name}: “${a?.excerpt ?? ""}” not found in resume`);
      if (status === "full") status = "partial";
    }
    if (status === "explicitly_lacking" && !verified) status = "not_mentioned"; // can't confirm absence without proof
    assessments.push({ skill: r.name, status });

    if (status === "full" || status === "partial") {
      matched.push({ skill: r.name, resume_skill: a?.resume_skill ?? null, strength: status, excerpt: a?.excerpt ?? "", verified });
    }
    if (status !== "full") {
      gaps.push({
        skill: r.name,
        type: status === "explicitly_lacking" ? "explicitly_lacking" : "not_mentioned",
        required: r.required,
        learning_suggestion: a?.learning_suggestion || `Build and document a project using ${r.name}.`,
        ...(status === "explicitly_lacking" ? { excerpt: a?.excerpt, verified } : {}),
      });
    }
  }
  // Partial matches still appear as gaps so the recruiter sees what's not fully proven.
  for (const g of gaps) if (matched.some((m) => m.skill === g.skill)) g.type = "not_mentioned";

  const score_breakdown: ScoreBreakdown = {
    skills: computeSkillsScore(job.required_skills, job.preferred_skills, assessments) ?? clamp(out.experience_score),
    experience: clamp(out.experience_score),
    projects: clamp(out.project_score),
    qualifications: clamp(out.qualification_score),
  };
  const ai_explanation: MatchExplanation = {
    summary: out.summary,
    matched,
    gaps,
    experience_note: out.experience_note,
    project_note: out.project_note,
    qualification_note: out.qualification_note,
    unsupported_claims: unsupported,
  };
  return { ai_score: computeWeightedScore(score_breakdown), score_breakdown, ai_explanation };
}

const clamp = (n: number) => Math.round(Math.min(100, Math.max(0, Number.isFinite(n) ? n : 0)));
