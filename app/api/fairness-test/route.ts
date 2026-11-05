// POST /api/fairness-test { applicationId } -> counterfactual result   (TI-7)
// Changes name, gender, age, contact, nationality, religion… and re-scores BOTH versions through the
// same pipeline. Stripping happens before the model, so the scores should match.
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseBody, requireUser } from "@/lib/api-server";
import { anonymizeResume } from "@/lib/ai/fairness";
import { runMatch } from "@/lib/ai/run-match";
import { buildCounterfactual } from "@/lib/talent";
import type { Job, ParsedResume } from "@/lib/types";

export const maxDuration = 60;
const Body = z.object({ applicationId: z.string().uuid() });

export interface FairnessTestResponse {
  original_score: number;
  altered_score: number;
  stored_score: number | null;
  difference: number;
  inputs_identical: boolean;
  attributes_changed: string[];
  altered_preview: { name: string | null; email: string | null; location: string | null; summary: string | null };
}

export async function POST(req: Request) {
  const auth = await requireUser("recruiter");
  if (auth instanceof NextResponse) return auth;
  const body = await parseBody(req, Body);
  if (body instanceof NextResponse) return body;

  const { data: app } = await auth.supabase
    .from("applications")
    .select("id, ai_score, jobs(*), resumes(raw_text, parsed)")
    .eq("id", body.applicationId)
    .maybeSingle();
  if (!app) return jsonError("Application not found", 404);
  const job = app.jobs as unknown as Job;
  const resume = app.resumes as unknown as { raw_text: string | null; parsed: ParsedResume | null };
  if (!resume?.parsed || !resume.raw_text) return jsonError("Resume has no parsed data", 422);

  const { altered, attributes_changed } = buildCounterfactual(resume.parsed);
  const inputs_identical = JSON.stringify(anonymizeResume(altered)) === JSON.stringify(anonymizeResume(resume.parsed));
  try {
    const [orig, alt] = await Promise.all([
      runMatch(job, resume.parsed, resume.raw_text),
      runMatch(job, altered, resume.raw_text),
    ]);
    const res: FairnessTestResponse = {
      original_score: orig.ai_score,
      altered_score: alt.ai_score,
      stored_score: app.ai_score,
      difference: Math.round((alt.ai_score - orig.ai_score) * 10) / 10,
      inputs_identical,
      attributes_changed,
      altered_preview: { name: altered.name, email: altered.contact.email, location: altered.contact.location, summary: altered.summary },
    };
    return NextResponse.json(res);
  } catch (err) {
    console.error("[fairness-test] AI failure", err);
    return jsonError("Fairness test failed (AI unavailable). Please retry.", 502);
  }
}
