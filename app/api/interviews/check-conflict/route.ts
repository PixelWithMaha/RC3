// POST /api/interviews/check-conflict -> { conflict, with? }   (INT-3)
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseBody, requireUser } from "@/lib/api-server";
import { findConflicts } from "@/lib/interviews";
import type { ConflictCheckResponse } from "@/lib/types";

const Body = z
  .object({
    interviewerId: z.string().uuid().nullish(),
    interviewerName: z.string().trim().max(120).nullish(),
    candidateId: z.string().uuid(),
    start: z.string().datetime({ offset: true }),
    duration: z.number().int().min(5).max(480),
    excludeInterviewId: z.string().uuid().optional(),
  })
  .refine((b) => b.interviewerId || b.interviewerName, { message: "interviewerId or interviewerName is required" });

export async function POST(req: Request) {
  const auth = await requireUser("recruiter");
  if (auth instanceof NextResponse) return auth;
  const body = await parseBody(req, Body);
  if (body instanceof NextResponse) return body;

  const start = new Date(body.start);
  const from = new Date(start.getTime() - 24 * 3600_000).toISOString();
  const to = new Date(start.getTime() + 24 * 3600_000).toISOString();
  const { data, error } = await auth.supabase
    .from("interviews")
    .select("id, scheduled_at, duration_min, interviewer_id, interviewer_name, status, applications(candidate_id)")
    .gte("scheduled_at", from)
    .lte("scheduled_at", to);
  if (error) return jsonError(error.message, 500);

  const conflicts = findConflicts(
    { id: body.excludeInterviewId, start, durationMin: body.duration, interviewerId: body.interviewerId, interviewerName: body.interviewerName, candidateId: body.candidateId },
    (data ?? []).map((i) => ({
      id: i.id,
      start: i.scheduled_at,
      durationMin: i.duration_min,
      interviewerId: i.interviewer_id,
      interviewerName: i.interviewer_name,
      candidateId: (i.applications as unknown as { candidate_id: string } | null)?.candidate_id,
      status: i.status,
    })),
  );
  const res: ConflictCheckResponse = conflicts.length ? { conflict: true, with: conflicts } : { conflict: false };
  return NextResponse.json(res);
}
