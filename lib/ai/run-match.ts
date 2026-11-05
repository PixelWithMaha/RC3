// Server-only: the single scoring path used by /api/match and /api/fairness-test.
import type { Job, ParsedResume } from "@/lib/types";
import { generateJSON } from "./gemini";
import { anonymizeResume } from "./fairness";
import { buildMatchResult } from "./match";
import { MATCH_JSON_SCHEMA, MATCH_SYSTEM, MatchZ, matchPrompt } from "./prompts";

export function jobForModel(job: Job) {
  return {
    title: job.title,
    description: job.description.slice(0, 6000),
    required_skills: job.required_skills,
    preferred_skills: job.preferred_skills,
    min_experience_years: job.min_experience_years,
    qualifications: job.qualifications,
  };
}

/** TI-7 fairness strip → Gemini assessment → weighted score + verification in code. */
export async function runMatch(job: Job, parsed: ParsedResume, rawText: string) {
  const out = await generateJSON({
    system: MATCH_SYSTEM,
    prompt: matchPrompt(jobForModel(job), anonymizeResume(parsed)),
    jsonSchema: MATCH_JSON_SCHEMA,
    zod: MatchZ,
    temperature: 0,
  });
  return buildMatchResult(job, out, rawText);
}
