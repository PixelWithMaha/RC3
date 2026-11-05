// POST /api/search  { query, jobId? } -> { results[] }   (TI-1/2)
// Semantic search over embedded resume chunks; RLS limits results to the recruiter's own applicants.
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseBody, requireUser } from "@/lib/api-server";
import { embedTexts, toPgVector } from "@/lib/ai/gemini";
import type { SearchResult } from "@/lib/types";

export const maxDuration = 30;

const Body = z.object({ query: z.string().trim().min(3).max(300), jobId: z.string().uuid().optional() });

export async function POST(req: Request) {
  const auth = await requireUser("recruiter");
  if (auth instanceof NextResponse) return auth;
  const body = await parseBody(req, Body);
  if (body instanceof NextResponse) return body;

  let vector: string;
  try {
    [vector] = (await embedTexts([body.query], "RETRIEVAL_QUERY")).map(toPgVector);
  } catch (err) {
    console.error("[search] embedding failure", err);
    return jsonError("Search is temporarily unavailable. Please retry.", 502);
  }

  const { data: chunks, error } = await auth.supabase.rpc("match_resume_chunks", {
    query_embedding: vector,
    match_count: 60,
    p_job_id: body.jobId ?? null,
  });
  if (error) return jsonError(error.message, 500);

  // Group chunks by resume: best similarity + up to 3 evidence passages.
  const byResume = new Map<string, { candidate_id: string; similarity: number; evidence: string[] }>();
  for (const c of (chunks ?? []) as { resume_id: string; candidate_id: string; chunk_text: string; similarity: number }[]) {
    if (c.similarity < 0.45) continue;
    const g = byResume.get(c.resume_id) ?? { candidate_id: c.candidate_id, similarity: 0, evidence: [] };
    g.similarity = Math.max(g.similarity, c.similarity);
    if (g.evidence.length < 3) g.evidence.push(c.chunk_text.slice(0, 400));
    byResume.set(c.resume_id, g);
  }
  const top = [...byResume.entries()].sort((a, b) => b[1].similarity - a[1].similarity).slice(0, 10);
  const ids = [...new Set(top.map(([, g]) => g.candidate_id))];
  const { data: profiles } = ids.length
    ? await auth.supabase.from("profiles").select("id, full_name, email").in("id", ids)
    : { data: [] };

  const results: SearchResult[] = top.map(([resume_id, g]) => ({
    candidate: profiles?.find((p) => p.id === g.candidate_id) ?? { id: g.candidate_id, full_name: null, email: null },
    resume_id,
    similarity: Math.round(g.similarity * 1000) / 1000,
    evidence: g.evidence,
  }));
  return NextResponse.json({ results });
}
