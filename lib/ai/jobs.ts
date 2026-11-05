// Job helpers: clean AI extraction (JOB-7) and build embedding text (JOB-8).
import type { Job, JobExtraction, SkillRequirement } from "@/lib/types";
import type { JobExtractOutput } from "./prompts";
import { normalizeSkill, skillKey } from "./normalize";

const clampImportance = (n: number) => Math.min(5, Math.max(1, Math.round(Number.isFinite(n) ? n : 3)));

function cleanSkills(list: { name: string; importance: number }[], exclude: Set<string>): SkillRequirement[] {
  const out: SkillRequirement[] = [];
  for (const s of list) {
    const name = normalizeSkill(s.name);
    const key = skillKey(name);
    if (!name || exclude.has(key)) continue;
    exclude.add(key);
    out.push({ name, importance: clampImportance(s.importance) });
  }
  return out;
}

/** Normalize names, clamp importance, dedupe; a skill in both lists stays required only. */
export function cleanJobExtraction(out: JobExtractOutput): JobExtraction {
  const seen = new Set<string>();
  const required_skills = cleanSkills(out.required_skills, seen);
  const preferred_skills = cleanSkills(out.preferred_skills, seen);
  const years = Number(out.min_experience_years);
  return {
    required_skills,
    preferred_skills,
    min_experience_years: Number.isFinite(years) ? Math.min(50, Math.max(0, years)) : 0,
    qualifications: [...new Set(out.qualifications.map((q) => q.trim()).filter(Boolean))],
  };
}

type JobForEmbedding = Pick<
  Job,
  "title" | "description" | "required_skills" | "preferred_skills" | "min_experience_years" | "qualifications"
> & { department?: string | null };

export function jobEmbeddingText(j: JobForEmbedding): string {
  return [
    `Job title: ${j.title}`,
    j.department ? `Department: ${j.department}` : "",
    j.required_skills.length ? "Required skills: " + j.required_skills.map((s) => s.name).join(", ") : "",
    j.preferred_skills.length ? "Preferred skills: " + j.preferred_skills.map((s) => s.name).join(", ") : "",
    j.min_experience_years ? `Minimum experience: ${j.min_experience_years} years` : "",
    j.qualifications.length ? "Qualifications: " + j.qualifications.join("; ") : "",
    j.description,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 8000);
}

/** Fields whose change requires a new embedding. */
export const EMBEDDING_FIELDS = [
  "title", "department", "description", "required_skills", "preferred_skills", "min_experience_years", "qualifications",
] as const;
