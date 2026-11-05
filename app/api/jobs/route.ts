// POST /api/jobs  JobCreateInput -> Job   (JOB-1/4/5/8)
// Server route so input is validated with zod and the job embedding is computed with the server-only key.
import { NextResponse } from "next/server";
import { JOB_COLUMNS, jsonError, parseBody, requireUser } from "@/lib/api-server";
import { JobCreateZ } from "@/lib/validation";
import { computeJobEmbedding } from "@/lib/ai/embed-job";

export const maxDuration = 30;


export async function POST(req: Request) {
  const auth = await requireUser("recruiter");
  if (auth instanceof NextResponse) return auth;
  const input = await parseBody(req, JobCreateZ);
  if (input instanceof NextResponse) return input;

  const embedding = await computeJobEmbedding(input);
  const { data, error } = await auth.supabase
    .from("jobs")
    .insert({ ...input, recruiter_id: auth.user.id, embedding })
    .select(JOB_COLUMNS)
    .single();
  if (error || !data) {
    console.error("[jobs] insert failure", error);
    return jsonError("Could not create job: " + (error?.message ?? "unknown error"), 400);
  }
  return NextResponse.json(data, { status: 201 });
}
