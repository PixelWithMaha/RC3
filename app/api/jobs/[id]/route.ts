// PATCH /api/jobs/:id  JobUpdateInput -> Job   (JOB-2/3/8)
// Re-embeds only when content fields change (closing/reopening does not call the AI).
import { NextResponse } from "next/server";
import { z } from "zod";
import { JOB_COLUMNS, jsonError, parseBody, requireUser } from "@/lib/api-server";
import { JobUpdateZ } from "@/lib/validation";
import { EMBEDDING_FIELDS } from "@/lib/ai/jobs";
import type { Job } from "@/lib/types";
import { computeJobEmbedding } from "@/lib/ai/embed-job";

export const maxDuration = 30;


export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser("recruiter");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return jsonError("Invalid job id", 400);
  const input = await parseBody(req, JobUpdateZ);
  if (input instanceof NextResponse) return input;

  const { data: current } = await auth.supabase.from("jobs").select(JOB_COLUMNS).eq("id", id).single();
  if (!current || current.recruiter_id !== auth.user.id) return jsonError("Job not found", 404);

  const merged = { ...(current as Job), ...input } as Job;
  if (
    merged.salary_min != null && merged.salary_max != null && merged.salary_min > merged.salary_max
  ) {
    return jsonError("Minimum salary must be ≤ maximum", 400);
  }

  const contentChanged = EMBEDDING_FIELDS.some(
    (f) => f in input && JSON.stringify(input[f as keyof typeof input]) !== JSON.stringify(current[f]),
  );
  const update: Record<string, unknown> = { ...input };
  if (contentChanged) {
    const embedding = await computeJobEmbedding(merged);
    if (embedding) update.embedding = embedding;
  }

  const { data, error } = await auth.supabase.from("jobs").update(update).eq("id", id).select(JOB_COLUMNS).single();
  if (error || !data) {
    console.error("[jobs] update failure", error);
    return jsonError("Could not update job: " + (error?.message ?? "unknown error"), 400);
  }
  return NextResponse.json(data);
}
