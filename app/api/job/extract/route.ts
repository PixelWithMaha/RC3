// POST /api/job/extract  { description } -> JobExtraction (JOB-7)
// Recruiter reviews the result before saving; nothing is persisted here.
import { NextResponse } from "next/server";
import { jsonError, parseBody, requireUser } from "@/lib/api-server";
import { generateJSON } from "@/lib/ai/gemini";
import { JOB_EXTRACT_JSON_SCHEMA, JOB_EXTRACT_SYSTEM, JobExtractZ, jobExtractPrompt } from "@/lib/ai/prompts";
import { cleanJobExtraction } from "@/lib/ai/jobs";
import { JobExtractRequestZ } from "@/lib/validation";
import type { JobExtraction } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const auth = await requireUser("recruiter");
  if (auth instanceof NextResponse) return auth;
  const body = await parseBody(req, JobExtractRequestZ);
  if (body instanceof NextResponse) return body;

  try {
    const out = await generateJSON({
      system: JOB_EXTRACT_SYSTEM,
      prompt: jobExtractPrompt(body.description),
      jsonSchema: JOB_EXTRACT_JSON_SCHEMA,
      zod: JobExtractZ,
      timeoutMs: 45_000,
    });
    const result: JobExtraction = cleanJobExtraction(out);
    if (!result.required_skills.length && !result.preferred_skills.length) {
      return jsonError("No skills could be found in this description. Add more detail or enter them manually.", 422);
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("[job/extract] AI failure", err);
    return jsonError("AI extraction failed. Please retry or enter requirements manually.", 502);
  }
}
