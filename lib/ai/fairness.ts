// TI-7: strip protected / irrelevant attributes before any scoring call.
import type { ParsedResume } from "@/lib/types";

/** Anonymized resume sent to the scoring model: no name, contact, address or links. */
export interface AnonymizedResume {
  summary: string | null;
  total_experience_years: number | null;
  skills: { name: string; excerpt: string }[];
  education: { institution: string; degree: string | null; field: string | null; start: string | null; end: string | null; excerpt: string }[];
  experience: { title: string; company: string | null; start: string | null; end: string | null; description: string; excerpt: string }[];
  projects: { name: string; description: string; technologies: string[]; excerpt: string }[];
}

const REDACT = "[redacted]";

// Labeled personal attributes: "Gender: Female", "DOB - 1990-01-01", "Religion: ...", etc.
const LABELED =
  /\b(gender|sex|date of birth|d\.?o\.?b\.?|birth ?date|age|religion|religious affiliation|marital status|nationality|citizenship|ethnicity|race|caste|address|residence|home address|photo|photograph|picture|father'?s name|mother'?s name|spouse)\s*[:\-–]\s*[^\n,;|]*/gi;
const PERSONAL_PHRASES =
  /\b(born (?:on|in) [^\n,;|]*|(?:single|married|divorced|widowed)\b(?= *(?:[,;|\n]|$))|(?:male|female)\b(?= *(?:[,;|\n]|$)))/gi;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
// Phone-like runs with at least 9 digits (so "2018 - 2022" date ranges survive)
const PHONE = /\+?\d[\d\s().-]{7,}\d/g;
const redactPhone = (m: string) => (m.replace(/\D/g, "").length >= 9 ? REDACT : m);
const URL = /\b(?:https?:\/\/|www\.)\S+|\b(?:linkedin|github)\.com\/\S+/gi;
const AGE_PHRASE = /\b\d{2}\s*(?:years?|yrs?)\s*old\b/gi;
const PRONOUN_TITLES = /\b(mr|mrs|ms|miss|mx)\.?\s+(?=[A-Z])/g;
const GENDERED_WORDS = /\b(he|she|him|her|his|hers|himself|herself)\b/gi;

/** Scrubs free text of contact details, labeled personal attributes, and the candidate's name. */
export function scrubText(text: string, name?: string | null): string {
  // Contact details first, so a name inside an email/URL can't break the match.
  let t = text.replace(EMAIL, REDACT).replace(URL, REDACT);
  if (name) {
    for (const part of name.split(/\s+/).filter((p) => p.length >= 2)) {
      t = t.replace(new RegExp(`\\b${escapeRegExp(part)}\\b`, "gi"), "[candidate]");
    }
  }
  return t
    .replace(LABELED, REDACT)
    .replace(PERSONAL_PHRASES, REDACT)
    .replace(AGE_PHRASE, REDACT)
    .replace(PHONE, redactPhone)
    .replace(PRONOUN_TITLES, "")
    .replace(GENDERED_WORDS, "they");
}

export function anonymizeResume(p: ParsedResume): AnonymizedResume {
  const s = (x: string) => scrubText(x, p.name);
  const sn = (x: string | null) => (x == null ? null : s(x));
  return {
    summary: sn(p.summary),
    total_experience_years: p.total_experience_years,
    skills: p.skills.map((k) => ({ name: k.name, excerpt: s(k.excerpt) })),
    education: p.education.map((e) => ({
      institution: s(e.institution), degree: sn(e.degree), field: sn(e.field),
      start: e.start, end: e.end, excerpt: s(e.excerpt),
    })),
    experience: p.experience.map((e) => ({
      title: s(e.title), company: sn(e.company), start: e.start, end: e.end,
      description: s(e.description), excerpt: s(e.excerpt),
    })),
    projects: p.projects.map((pr) => ({
      name: s(pr.name), description: s(pr.description), technologies: pr.technologies, excerpt: s(pr.excerpt),
    })),
  };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
