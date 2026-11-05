// Skill evidence for the candidate resume screen: where each skill is mentioned and how strongly.
// "Proven" = mentioned in experience or a project; "Listed" = only in a skills list / excerpt;
// "None" = not found anywhere in the resume text (recruiter will verify).
import type { ParsedResume } from "@/lib/types";
import { normalizeSkill, sameSkill } from "./normalize";

export type Tier = "proven" | "listed" | "none";
export interface Source { label: string; text: string; work: boolean }
export interface SkillEvidence { name: string; tier: Tier; mentions: Source[]; best: Source | null }

const TOKEN = /[A-Za-z0-9+#][A-Za-z0-9+#./-]*/g;

/** Character ranges in `text` that refer to `skill` (aliases included: "Postgres" → PostgreSQL). */
export function findSkillSpans(text: string, skill: string): [number, number][] {
  const toks: { s: number; e: number; w: string }[] = [];
  for (const m of text.matchAll(TOKEN)) {
    const w = m[0].replace(/[./-]+$/, "");
    if (w) toks.push({ s: m.index!, e: m.index! + w.length, w });
  }
  const spans: [number, number][] = [];
  for (let i = 0; i < toks.length; i++) {
    // Longest phrase first: a longer known skill ("Django REST Framework") swallows its prefix ("Django").
    for (let n = 3; n >= 1; n--) {
      if (i + n > toks.length) continue;
      const phrase = toks.slice(i, i + n).map((t) => t.w).join(" ");
      if (sameSkill(phrase, skill)) {
        spans.push([toks[i].s, toks[i + n - 1].e]);
        i += n - 1;
        break;
      }
      if (n > 1 && isKnownSkill(phrase)) {
        i += n - 1;
        break;
      }
    }
  }
  return spans;
}

export const mentions = (text: string, skill: string) => findSkillSpans(text, skill).length > 0;

/** Every passage of the resume a skill can be proven from. */
export function resumeSources(p: ParsedResume, rawText: string | null): Source[] {
  const out: Source[] = [];
  for (const e of p.experience) {
    const label = `Experience · ${e.company ?? e.title}`;
    for (const line of splitLines(e.description || e.excerpt)) out.push({ label, text: line, work: true });
  }
  for (const pr of p.projects) {
    out.push({ label: `Project · ${pr.name}`, text: [pr.description, pr.technologies.join(", ")].filter(Boolean).join(" — "), work: true });
  }
  for (const line of (rawText ?? "").split("\n")) {
    if (/^\s*(technical\s+)?skills?\b/i.test(line)) out.push({ label: "Skills section", text: line.trim(), work: false });
  }
  return out;
}

export function assessSkill(name: string, excerpt: string, sources: Source[]): SkillEvidence {
  const m = sources.filter((s) => mentions(s.text, name));
  if (!m.length && excerpt && mentions(excerpt, name)) m.push({ label: "Resume", text: excerpt, work: false });
  const work = m.filter((s) => s.work);
  return { name, mentions: m, best: work[0] ?? m[0] ?? null, tier: work.length ? "proven" : m.length ? "listed" : "none" };
}

const GROUPS: Record<string, string[]> = {
  "Languages & frameworks": ["Python", "JavaScript", "TypeScript", "Java", "Go", "C#", "C++", "Ruby", "PHP", "Rust", "Kotlin", "Swift", "Django", "Django REST Framework", "Flask", "FastAPI", "React", "React Native", "Next.js", "Vue.js", "Angular", "Node.js", "Express", "Celery", "HTML", "CSS", "Tailwind CSS", "REST API", "GraphQL", "Spring"],
  Data: ["PostgreSQL", "MySQL", "SQLite", "SQL Server", "MongoDB", "Redis", "SQL", "Machine Learning", "Pandas", "NumPy", "Tableau", "Excel", "Statistics"],
  "DevOps & cloud": ["Docker", "Docker Compose", "Kubernetes", "AWS", "Google Cloud", "Azure", "CI/CD", "GitHub Actions", "Git", "GitHub", "Linux", "Terraform"],
};
export const GROUP_ORDER = [...Object.keys(GROUPS), "Other"];
const KNOWN = Object.values(GROUPS).flat();
function isKnownSkill(phrase: string): boolean {
  return normalizeSkill(phrase) !== phrase.trim() || KNOWN.some((k) => sameSkill(k, phrase));
}
export function skillGroup(name: string): string {
  const n = normalizeSkill(name);
  return Object.entries(GROUPS).find(([, list]) => list.some((x) => sameSkill(x, n)))?.[0] ?? "Other";
}

function splitLines(t: string): string[] {
  return t.split(/(?<=[.!?])\s+|\n+|\s+-\s+/).map((s) => s.trim()).filter((s) => s.length > 3);
}
