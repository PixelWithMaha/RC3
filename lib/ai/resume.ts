// Resume post-processing: normalization (RES-4), excerpt verification (RES-8/TI-8), chunking (TI-2).
import type { ParsedResume } from "@/lib/types";
import type { ResumeParseOutput } from "./prompts";
import { normalizeSkill, normalizeSkillList } from "./normalize";
import { verifyExcerpt } from "./verify";

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
export const MIN_TEXT_CHARS = 80;

/** Turns raw model output into a ParsedResume; `verified` is always computed here, never by the model. */
export function buildParsedResume(out: ResumeParseOutput, rawText: string): ParsedResume {
  const v = <T extends { excerpt: string }>(x: T) => ({ ...x, verified: verifyExcerpt(x.excerpt, rawText) });
  return {
    name: out.name?.trim() || null,
    contact: {
      email: out.contact.email,
      phone: out.contact.phone,
      location: out.contact.location,
      links: out.contact.links,
    },
    summary: out.summary,
    total_experience_years:
      out.total_experience_years != null && out.total_experience_years >= 0 ? out.total_experience_years : null,
    skills: normalizeSkillList(out.skills.map(v)),
    education: out.education.filter((e) => e.institution || e.degree).map(v),
    experience: out.experience.filter((e) => e.title || e.company).map(v),
    projects: out.projects
      .filter((p) => p.name || p.description)
      .map((p) => v({ ...p, technologies: [...new Set(p.technologies.map(normalizeSkill).filter(Boolean))] })),
  };
}

/** Clean extracted PDF text: drop null bytes, collapse runs of blank lines/spaces. */
export function cleanText(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Split text into ~maxChars chunks on paragraph/line boundaries with a small overlap. */
export function chunkText(text: string, maxChars = 900, overlap = 150, maxChunks = 60): string[] {
  const parts = text.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let cur = "";
  for (const part of parts) {
    // hard-split very long lines
    const pieces = part.length > maxChars ? part.match(new RegExp(`[\\s\\S]{1,${maxChars}}`, "g")) ?? [] : [part];
    for (const piece of pieces) {
      if (cur && cur.length + piece.length + 1 > maxChars) {
        chunks.push(cur);
        cur = cur.slice(-overlap) + "\n" + piece;
      } else {
        cur = cur ? cur + "\n" + piece : piece;
      }
    }
  }
  if (cur.trim()) chunks.push(cur);
  return chunks.slice(0, maxChunks);
}

/** Compact text used for the whole-resume embedding (skills + roles + projects + summary). */
export function resumeEmbeddingText(p: ParsedResume): string {
  return [
    p.summary ?? "",
    "Skills: " + p.skills.map((s) => s.name).join(", "),
    ...p.experience.map((e) => `${e.title}${e.company ? " at " + e.company : ""}: ${e.description}`),
    ...p.projects.map((pr) => `Project ${pr.name}: ${pr.description} (${pr.technologies.join(", ")})`),
    ...p.education.map((e) => [e.degree, e.field, e.institution].filter(Boolean).join(", ")),
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 8000);
}

export function isPdf(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // %PDF
}

/** DOCX is a ZIP container: "PK\x03\x04". */
export function isDocx(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}
