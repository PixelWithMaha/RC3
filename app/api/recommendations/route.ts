// GET /api/recommendations -> { jobs: [{ job, score, reason, matched, missing }] }   (TI-4)
// Same evidence-based fit as the job page, plus a little resume↔job meaning and interests. No AI call.
import { NextResponse } from "next/server";
import { JOB_COLUMNS, jsonError, requireUser } from "@/lib/api-server";
import { recommendJobs } from "@/lib/talent";
import type { Job, ParsedResume } from "@/lib/types";

export async function GET() {
  const auth = await requireUser("candidate");
  if (auth instanceof NextResponse) return auth;
  const { supabase, user, profile } = auth;

  const [resume, jobs, apps] = await Promise.all([
    supabase.from("resumes").select("parsed, raw_text, embedding").eq("candidate_id", user.id).eq("parse_status", "success")
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("jobs").select(`${JOB_COLUMNS}, embedding`).eq("status", "open"),
    supabase.from("applications").select("job_id").eq("candidate_id", user.id),
  ]);
  if (jobs.error) return jsonError(jobs.error.message, 500);
  if (!resume.data?.parsed) return NextResponse.json({ jobs: [], needsResume: true });

  const recs = recommendJobs(
    (jobs.data ?? []) as (Job & { embedding: unknown })[],
    { parsed: resume.data.parsed as ParsedResume, raw_text: resume.data.raw_text as string | null, embedding: resume.data.embedding },
    profile.interests ?? [],
    new Set((apps.data ?? []).map((a) => a.job_id)),
  ).filter((r) => r.eligible).slice(0, 5); // never recommend a job the resume shows no evidence for
  // Don't ship embeddings to the browser
  return NextResponse.json({ jobs: recs.map((r) => ({ ...r, job: { ...r.job, embedding: undefined } })) });
}
