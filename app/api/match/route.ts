// POST /api/match  { applicationId } -> MatchResponse   (MATCH-1..3, GAP-1..4, TI-7, TI-8)
// Runs once at apply (candidate) or on explicit re-score (job-owner recruiter). Never on page load.
// Fairness strip → Gemini assessment → weighted score in code → excerpt verification → stored.
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseBody, requireUser } from "@/lib/api-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runMatch } from "@/lib/ai/run-match";
import type { Job, MatchResponse, ParsedResume } from "@/lib/types";

export const maxDuration = 60;

const Body = z.object({ applicationId: z.string().uuid() });

export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const body = await parseBody(req, Body);
  if (body instanceof NextResponse) return body;

  // Authorization via the user's own RLS view: candidate sees own application, recruiter sees own job's.
  const { data: visible } = await auth.supabase
    .from("applications")
    .select("id, candidate_id, job_id")
    .eq("id", body.applicationId)
    .maybeSingle();
  if (!visible) return jsonError("Application not found", 404);
  const isCandidate = auth.profile.role === "candidate" && visible.candidate_id === auth.user.id;
  const isRecruiter = auth.profile.role === "recruiter";
  if (!isCandidate && !isRecruiter) return jsonError("Forbidden", 403);

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return jsonError("Server is missing SUPABASE_SECRET_KEY", 500);
  }

  const { data: app } = await admin
    .from("applications")
    .select("id, status, ai_score, job_id, resume_id, jobs(*), resumes(raw_text, parsed, parse_status)")
    .eq("id", body.applicationId)
    .single();
  const job = app?.jobs as unknown as Job | null;
  const resume = app?.resumes as unknown as { raw_text: string | null; parsed: ParsedResume | null; parse_status: string } | null;
  if (!app || !job || !resume) return jsonError("Application data incomplete", 404);
  if (isCandidate && app.ai_score != null) return jsonError("Already scored", 409); // candidates can't re-roll
  if (resume.parse_status !== "success" || !resume.parsed || !resume.raw_text) {
    return jsonError("Resume has not been parsed successfully", 422);
  }

  // System transition submitted → parsed (resume is parsed)
  if (app.status === "submitted") {
    await admin.from("applications").update({ status: "parsed" }).eq("id", app.id);
    app.status = "parsed";
  }

  // TI-7: only anonymized evidence reaches the model (see lib/ai/run-match.ts)
  let result;
  try {
    result = await runMatch(job, resume.parsed, resume.raw_text);
  } catch (err) {
    console.error("[match] AI failure", err);
    await admin.from("applications").update({ match_error: "AI scoring failed. Use re-score to retry." }).eq("id", app.id);
    return jsonError("AI scoring failed. Please retry.", 502);
  }

  // MATCH-1 supporting signal: embedding cosine similarity
  const { data: sim } = await admin.rpc("resume_job_similarity", { p_resume_id: app.resume_id, p_job_id: app.job_id });
  const semantic_similarity = typeof sim === "number" ? Math.round(sim * 1000) / 1000 : null;

  const update: Record<string, unknown> = { ...result, semantic_similarity, match_error: null };
  if (app.status === "parsed") update.status = "ai_assessed"; // never touches human statuses
  const { error } = await admin.from("applications").update(update).eq("id", app.id);
  if (error) {
    console.error("[match] save failure", error);
    return jsonError("Could not save score", 500);
  }

  if (isRecruiter && app.ai_score != null) {
    await admin.from("application_events").insert({
      application_id: app.id,
      event_type: "rescore",
      from_status: app.status,
      to_status: app.status,
      changed_by: auth.user.id,
      reason: `Re-scored: ${app.ai_score} → ${result.ai_score}`,
    });
  }

  const res: MatchResponse = { ...result, semantic_similarity };
  return NextResponse.json(res);
}
