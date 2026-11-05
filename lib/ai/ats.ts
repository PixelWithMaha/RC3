// ATS-friendly resume: a plain, single-column, standard-heading document built from the candidate's
// OWN resume. The model only rewrites wording; code enforces truthfulness and fills in contact details.
import type { ParsedResume } from "@/lib/types";
import { findSkillSpans, KNOWN_SKILLS } from "./evidence";
import { normalizeSkill, sameSkill } from "./normalize";

export interface AtsBullet { text: string; original: string; kept: "rewritten" | "original" }
export interface AtsDoc {
  name: string;
  contact: string[];                         // from parsed data, never from the model
  summary: string;
  skills: { category: string; items: string[] }[];
  experience: { title: string; company: string | null; dates: string; bullets: AtsBullet[] }[];
  projects: { name: string; bullets: AtsBullet[] }[];
  education: { line: string; dates: string }[];
}

const NUM = /\b\d+(?:[.,]\d+)?\s*(?:%|k\b|m\b|x\b|\+)?/gi;
const nums = (t: string) => [...t.matchAll(NUM)].map((m) => m[0].replace(/\s+/g, "").toLowerCase());

/** A rewrite is acceptable only if every skill and number it states already appears in the resume text. */
export function safeRewrite(rewrite: string, rawText: string, vocabulary: string[]): boolean {
  const vocab = [...new Set([...vocabulary, ...KNOWN_SKILLS])];
  const raw = new Set(nums(rawText));
  const newNumber = nums(rewrite).some((n) => !raw.has(n));
  const newSkill = vocab.some((k) => findSkillSpans(rewrite, k).length > 0 && findSkillSpans(rawText, k).length === 0);
  return !newNumber && !newSkill && rewrite.trim().length > 3;
}

export function bullet(rewrite: string | undefined, original: string, rawText: string, vocabulary: string[]): AtsBullet {
  const r = (rewrite ?? "").trim().replace(/^[-•*]\s*/, "");
  return r && safeRewrite(r, rawText, vocabulary) ? { text: r, original, kept: "rewritten" } : { text: original, original, kept: "original" };
}

/** Skills the resume really mentions, normalized and de-duplicated (invented ones dropped). */
export function realSkills(candidates: string[], rawText: string): string[] {
  const out: string[] = [];
  for (const c of candidates) {
    const n = normalizeSkill(c);
    if (n && findSkillSpans(rawText, n).length && !out.some((o) => sameSkill(o, n))) out.push(n);
  }
  return out;
}

export const dateRange = (s: string | null, e: string | null) => [s, e].filter(Boolean).join(" – ");
export function contactLine(p: ParsedResume): string[] {
  return [p.contact.email, p.contact.phone, p.contact.location, ...p.contact.links].filter((x): x is string => !!x && !!x.trim());
}

/** Split a free-text description into bullet sentences. */
export function sentences(t: string): string[] {
  return t.split(/(?<=[.!?])\s+|\n+|\s+-\s+|•/).map((s) => s.trim().replace(/^[-•*]\s*/, "")).filter((s) => s.length > 3);
}

// ---------------------------------------------------------------- ATS checks (computed in code)
export interface AtsCheck { id: string; label: string; pass: boolean; detail: string }
const VERBS = /^(built|led|designed|developed|created|implemented|delivered|managed|improved|reduced|increased|automated|launched|engineered|optimized|optimised|wrote|shipped|migrated|maintained|analysed|analyzed|tuned|containerized|containerised|integrated|configured|deployed|owned|drove|established|streamlined|architected|coordinated|tested|researched|mentored|collaborated|supported|produced|ran|worked)\b/i;

export function atsChecks(input: {
  hasName: boolean; hasEmail: boolean; hasPhone: boolean;
  sections: { summary: boolean; skills: boolean; experience: boolean; education: boolean };
  bullets: string[]; dates: string[]; skills: string[]; jobSkills?: string[];
}): { score: number; checks: AtsCheck[] } {
  const b = input.bullets;
  const verbShare = b.length ? b.filter((x) => VERBS.test(x)).length / b.length : 0;
  const longShare = b.length ? b.filter((x) => x.split(/\s+/).length > 32).length / b.length : 0;
  const dateOk = input.dates.filter(Boolean).every((d) => /^(\w{3,9}\s)?\d{4}(\s?[–-]\s?((\w{3,9}\s)?\d{4}|present|current|now))?$/i.test(d.trim()));
  const jobs = input.jobSkills ?? [];
  const covered = jobs.filter((k) => input.skills.some((s) => sameSkill(s, k)));
  const checks: AtsCheck[] = [
    { id: "contact", label: "Name, email and phone at the top", pass: input.hasName && input.hasEmail && input.hasPhone, detail: [!input.hasName && "name", !input.hasEmail && "email", !input.hasPhone && "phone"].filter(Boolean).join(", ") ? `Missing: ${[!input.hasName && "name", !input.hasEmail && "email", !input.hasPhone && "phone"].filter(Boolean).join(", ")}` : "Found" },
    { id: "sections", label: "Standard section headings", pass: Object.values(input.sections).every(Boolean), detail: Object.entries(input.sections).filter(([, v]) => !v).map(([k]) => k).join(", ") ? `Missing: ${Object.entries(input.sections).filter(([, v]) => !v).map(([k]) => k).join(", ")}` : "Summary, Skills, Experience, Education" },
    { id: "skills", label: "Dedicated skills list", pass: input.skills.length >= 5, detail: `${input.skills.length} skills listed` },
    { id: "bullets", label: "Experience written as bullet points", pass: b.length >= 3, detail: `${b.length} bullets` },
    { id: "verbs", label: "Bullets start with action verbs", pass: verbShare >= 0.6, detail: `${Math.round(verbShare * 100)}% of bullets` },
    { id: "length", label: "Concise bullets (under ~30 words)", pass: longShare <= 0.2, detail: `${Math.round((1 - longShare) * 100)}% concise` },
    { id: "dates", label: "Consistent date format", pass: dateOk && input.dates.filter(Boolean).length > 0, detail: dateOk ? "e.g. 2021 – 2025" : "Mixed or unclear dates" },
    { id: "layout", label: "Single column, no tables or graphics", pass: true, detail: "Plain text layout" },
  ];
  if (jobs.length) checks.push({ id: "keywords", label: "Job keywords in skills", pass: covered.length / jobs.length >= 0.6, detail: `${covered.length} of ${jobs.length} job skills (only ones you have)` });
  const score = Math.round((checks.filter((c) => c.pass).length / checks.length) * 100);
  return { score, checks };
}

/** ATS checks for the resume as parsed (the "before"). */
export function checksForParsed(p: ParsedResume, rawText: string, jobSkills?: string[]) {
  const bullets = p.experience.flatMap((e) => (/\n|•|^\s*-/m.test(e.description) ? sentences(e.description) : [e.description])).filter(Boolean);
  const raw = rawText.toLowerCase();
  return atsChecks({
    hasName: !!p.name, hasEmail: !!p.contact.email, hasPhone: !!p.contact.phone,
    sections: { summary: /summary|profile|objective/.test(raw), skills: /skills/.test(raw), experience: /experience|employment|work history/.test(raw), education: /education/.test(raw) },
    bullets, dates: [...p.experience, ...p.education].map((x) => dateRange(x.start, x.end)), skills: p.skills.map((s) => s.name), jobSkills,
  });
}

export function checksForDoc(d: AtsDoc, jobSkills?: string[]) {
  return atsChecks({
    hasName: !!d.name, hasEmail: d.contact.some((c) => c.includes("@")), hasPhone: d.contact.some((c) => /\d{7,}/.test(c.replace(/\D/g, ""))),
    sections: { summary: !!d.summary, skills: d.skills.length > 0, experience: d.experience.length > 0, education: d.education.length > 0 },
    bullets: d.experience.flatMap((e) => e.bullets.map((b) => b.text)), dates: [...d.experience.map((e) => e.dates), ...d.education.map((e) => e.dates)],
    skills: d.skills.flatMap((s) => s.items), jobSkills,
  });
}

/** Plain-text export (what an ATS sees). */
export function docToText(d: AtsDoc): string {
  const L: string[] = [d.name.toUpperCase(), d.contact.join(" | "), ""];
  if (d.summary) L.push("SUMMARY", d.summary, "");
  if (d.skills.length) L.push("SKILLS", ...d.skills.map((s) => `${s.category}: ${s.items.join(", ")}`), "");
  if (d.experience.length) {
    L.push("EXPERIENCE");
    for (const e of d.experience) L.push(`${e.title}${e.company ? `, ${e.company}` : ""}${e.dates ? ` | ${e.dates}` : ""}`, ...e.bullets.map((b) => `- ${b.text}`), "");
  }
  if (d.projects.length) {
    L.push("PROJECTS");
    for (const p of d.projects) L.push(p.name, ...p.bullets.map((b) => `- ${b.text}`), "");
  }
  if (d.education.length) L.push("EDUCATION", ...d.education.map((e) => `${e.line}${e.dates ? ` | ${e.dates}` : ""}`));
  return L.join("\n").trim() + "\n";
}
