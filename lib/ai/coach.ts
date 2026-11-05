// Resume coach verification (in code). The model may only REPHRASE what the resume already says.
// Every suggestion is checked: the original must be verbatim in the resume, and any skill or
// number in the rewrite that the resume never mentions is flagged as a new (possibly false) claim.
import { findSkillSpans, KNOWN_SKILLS } from "./evidence";
import { normalizeSkill, sameSkill } from "./normalize";
import { verifyExcerpt } from "./verify";

export interface RawSuggestion { section: "experience" | "project" | "summary" | "skills"; original: string; rewrite: string; target_skills: string[]; why: string }
export interface CheckedSuggestion extends RawSuggestion {
  original_found: boolean;
  new_skills: string[];   // skills named in the rewrite but nowhere in the resume
  new_numbers: string[];  // figures in the rewrite that the resume never states
  borrowed_skills: string[]; // skills the resume lists elsewhere, newly attached to THIS line → candidate must confirm
  emphasized: string[];   // target job skills the rewrite shows that the resume genuinely has
  status: "safe" | "confirm" | "check";
}

const NUM = /\b\d+(?:[.,]\d+)?\s*(?:%|k\b|m\b|x\b|\+)?/gi;
const numbersIn = (t: string) => [...t.matchAll(NUM)].map((m) => m[0].replace(/\s+/g, "").toLowerCase());

/** Skills a text names, from a vocabulary (job skills + resume skills + common skills). */
export function skillsIn(text: string, vocabulary: string[]): string[] {
  const out: string[] = [];
  for (const v of vocabulary) if (findSkillSpans(text, v).length && !out.some((o) => sameSkill(o, v))) out.push(normalizeSkill(v));
  return out;
}

export function checkSuggestion(s: RawSuggestion, rawText: string, vocabulary: string[]): CheckedSuggestion {
  const vocab = [...new Set([...vocabulary, ...KNOWN_SKILLS])];
  const inResume = (skill: string) => findSkillSpans(rawText, skill).length > 0;
  const named = skillsIn(s.rewrite, vocab);
  const new_skills = named.filter((k) => !inResume(k));
  const resumeNums = new Set(numbersIn(rawText));
  const new_numbers = [...new Set(numbersIn(s.rewrite).filter((n) => !resumeNums.has(n)))];
  const emphasized = s.target_skills.map(normalizeSkill).filter((k) => named.some((n) => sameSkill(n, k)) && inResume(k));
  const original_found = s.section === "summary" ? true : verifyExcerpt(s.original, rawText);
  const borrowed_skills = s.section === "summary" ? [] : named.filter((k) => inResume(k) && !findSkillSpans(s.original, k).length);
  const status = !original_found || new_skills.length || new_numbers.length ? "check" : borrowed_skills.length ? "confirm" : "safe";
  return { ...s, original_found, new_skills, new_numbers, borrowed_skills, emphasized, status };
}

/**
 * Job skills proven in work lines (experience/projects) before vs. after the suggestions.
 * A rewrite can only move a skill the resume already has (e.g. from the skills list) into a work line;
 * it can never add a skill the resume doesn't mention at all.
 */
export function coverage(jobSkills: string[], workText: string, rawText: string, rewrites: string[]) {
  const proven = (t: string, k: string) => findSkillSpans(t, k).length > 0;
  const before = jobSkills.filter((k) => proven(workText, k));
  const after = jobSkills.filter((k) => before.includes(k) || (proven(rawText, k) && rewrites.some((r) => proven(r, k))));
  const absent = jobSkills.filter((k) => !proven(rawText, k));
  return { before, after, absent, total: jobSkills.length };
}
