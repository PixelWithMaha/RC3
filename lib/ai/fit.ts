// One evidence-based "fit" used everywhere a candidate sees a job (job page, jobs grid, recommendations),
// so the numbers always agree. Proven in work = full credit, listed only = 0.6, not found = 0.
// Required skills weigh by importance; preferred at half weight (same idea as MATCH-3).
import type { Job, ParsedResume, SkillRequirement } from "@/lib/types";
import { assessSkill, findSkillSpans, resumeSources, type SkillEvidence } from "./evidence";

export interface FitRow {
  req: SkillRequirement & { required: boolean };
  ev: SkillEvidence;
  related?: { skill: string; ev: SkillEvidence }; // no direct evidence, but a closely related skill is shown
}
export interface JobFit { fit: number; rows: FitRow[]; proven: string[]; listed: string[]; related: string[]; missing: string[]; requiredMissing: string[] }

const CREDIT = { proven: 1, listed: 0.6, none: 0 } as const;
const RELATED_CREDIT = { proven: 0.4, listed: 0.3, none: 0 } as const;

/** Adjacent skills that earn partial credit (mirrors the AI matcher's "partial" — e.g. MySQL for PostgreSQL). */
export const RELATED: Record<string, string[]> = {
  SQL: ["MySQL", "PostgreSQL", "SQLite", "SQL Server"],
  PostgreSQL: ["MySQL", "SQLite", "SQL Server"],
  MySQL: ["PostgreSQL", "SQLite", "SQL Server"],
  Database: ["PostgreSQL", "MySQL", "MongoDB", "SQLite", "SQL", "Redis"],
  MongoDB: ["Redis"],
  Django: ["Flask", "FastAPI"],
  Flask: ["Django", "FastAPI"],
  FastAPI: ["Flask", "Django"],
  "REST API": ["Flask", "Django", "FastAPI", "Express", "GraphQL"],
  JavaScript: ["TypeScript"],
  TypeScript: ["JavaScript"],
  React: ["Next.js", "React Native", "Vue.js", "Angular"],
  "Next.js": ["React"],
  "Vue.js": ["React", "Angular"],
  Docker: ["Docker Compose", "Kubernetes"],
  Kubernetes: ["Docker"],
  AWS: ["Google Cloud", "Azure"],
  "Google Cloud": ["AWS", "Azure"],
  Azure: ["AWS", "Google Cloud"],
  "CI/CD": ["GitHub Actions"],
  "GitHub Actions": ["CI/CD"],
  Pandas: ["NumPy", "Python"],
  Tableau: ["Excel"],
};

export function computeFit(job: Pick<Job, "required_skills" | "preferred_skills">, parsed: ParsedResume, rawText: string | null): JobFit {
  const sources = resumeSources(parsed, rawText);
  const rows: FitRow[] = [
    ...job.required_skills.map((s) => ({ ...s, required: true })),
    ...job.preferred_skills.map((s) => ({ ...s, required: false })),
  ].map((req) => {
    const own = parsed.skills.find((s) => findSkillSpans(s.name, req.name).length > 0 || findSkillSpans(req.name, s.name).length > 0);
    const ev = assessSkill(req.name, own?.excerpt ?? "", sources);
    if (ev.tier !== "none") return { req, ev };
    const key = Object.keys(RELATED).find((k) => findSkillSpans(k, req.name).length > 0);
    const candidates = (key ? RELATED[key] : []).map((skill) => {
      const o = parsed.skills.find((s) => findSkillSpans(s.name, skill).length > 0);
      return { skill, ev: assessSkill(skill, o?.excerpt ?? "", sources) };
    }).filter((c) => c.ev.tier !== "none").sort((a, b) => (a.ev.tier === "proven" ? -1 : 1) - (b.ev.tier === "proven" ? -1 : 1));
    return { req, ev, related: candidates[0] };
  });
  const w = (r: FitRow["req"]) => Math.max(1, r.importance) * (r.required ? 1 : 0.5);
  const total = rows.reduce((t, r) => t + w(r.req), 0);
  const credit = (r: FitRow) => (r.ev.tier !== "none" ? CREDIT[r.ev.tier] : r.related ? RELATED_CREDIT[r.related.ev.tier] : 0);
  const fit = total ? Math.round((rows.reduce((t, r) => t + w(r.req) * credit(r), 0) / total) * 100) : 0;
  const by = (t: SkillEvidence["tier"]) => rows.filter((r) => r.ev.tier === t && (t !== "none" || !r.related)).map((r) => r.req.name);
  return {
    fit, rows,
    proven: by("proven"), listed: by("listed"),
    related: rows.filter((r) => r.related).map((r) => `${r.req.name} (via ${r.related!.skill})`),
    missing: by("none"),
    requiredMissing: rows.filter((r) => r.req.required && r.ev.tier === "none" && !r.related).map((r) => r.req.name),
  };
}
