// GET  /api/duplicates -> { pairs[] }   scan + store pending flags   (TI-3)
// POST /api/duplicates { flagId, action: "merge" | "dismiss" } -> nothing changes until a recruiter confirms
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseBody, requireUser } from "@/lib/api-server";
import { findDuplicatePairs, type DupCandidate } from "@/lib/talent";
import type { ParsedResume } from "@/lib/types";

interface Side { application_id: string; name: string | null; email: string | null; job_title: string; status: string; created_at: string }
export interface DuplicatePair {
  flag_id: string;
  status: "pending" | "merged" | "dismissed";
  similarity: number | null;
  reason: string;          // strong signals (stored)
  context: string[];       // supporting info (computed on scan, pending flags only)
  same_job: boolean;
  a: Side;
  b: Side;
}

export async function GET() {
  const auth = await requireUser("recruiter");
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;

  // RLS: only applications to this recruiter's jobs (and their resumes) are visible.
  const { data: apps, error } = await supabase
    .from("applications_ranked")
    .select("id, candidate_id, job_id, job_title, status, created_at, candidate_name, candidate_email, resume_id");
  if (error) return jsonError(error.message, 500);
  const resumeIds = [...new Set((apps ?? []).map((a) => a.resume_id))];
  const { data: resumes } = resumeIds.length
    ? await supabase.from("resumes").select("id, parsed, embedding, raw_text").in("id", resumeIds)
    : { data: [] };
  const byResume = new Map((resumes ?? []).map((r) => [r.id, r]));

  const rows: DupCandidate[] = (apps ?? []).map((a) => {
    const r = byResume.get(a.resume_id);
    const parsed = r?.parsed as ParsedResume | null;
    return {
      application_id: a.id, candidate_id: a.candidate_id, job_id: a.job_id, created_at: a.created_at,
      email: parsed?.contact.email ?? null, phone: parsed?.contact.phone ?? null,
      embedding: r?.embedding, raw_text: r?.raw_text as string | null, name: a.candidate_name,
    };
  });
  const found = findDuplicatePairs(rows);
  const key = (a: string, b: string) => `${a}|${b}`;
  const foundBy = new Map(found.map((p) => [key(p.a.application_id, p.b.application_id), p]));

  // Store new pending flags; keep resolved ones; drop pending flags that no longer qualify.
  const { data: existing } = await supabase.from("duplicate_flags").select("id, application_a, application_b, status");
  const stale = (existing ?? []).filter((f) => f.status === "pending" && !foundBy.has(key(f.application_a, f.application_b))).map((f) => f.id);
  if (stale.length) await supabase.from("duplicate_flags").delete().in("id", stale);
  const known = new Set((existing ?? []).map((f) => key(f.application_a, f.application_b)));
  const fresh = found.filter((p) => !known.has(key(p.a.application_id, p.b.application_id)));
  if (fresh.length) {
    await supabase.from("duplicate_flags").insert(
      fresh.map((p) => ({ application_a: p.a.application_id, application_b: p.b.application_id, similarity: p.similarity, reason: p.reasons.join(" · ") })),
    );
  }

  const { data: flags } = await supabase.from("duplicate_flags").select("*").order("created_at", { ascending: false });
  const info = new Map((apps ?? []).map((a) => [a.id, a]));
  const side = (id: string): Side => {
    const a = info.get(id);
    return { application_id: id, name: a?.candidate_name ?? null, email: a?.candidate_email ?? null, job_title: a?.job_title ?? "", status: a?.status ?? "", created_at: a?.created_at ?? "" };
  };
  const pairs: DuplicatePair[] = (flags ?? []).map((f) => {
    const p = foundBy.get(key(f.application_a, f.application_b));
    return {
      flag_id: f.id, status: f.status, similarity: f.similarity, reason: f.reason ?? "",
      context: p?.context ?? [], same_job: info.get(f.application_a)?.job_id === info.get(f.application_b)?.job_id,
      a: side(f.application_a), b: side(f.application_b),
    };
  });
  return NextResponse.json({ pairs });
}

const Body = z.object({ flagId: z.string().uuid(), action: z.enum(["merge", "dismiss"]) });

export async function POST(req: Request) {
  const auth = await requireUser("recruiter");
  if (auth instanceof NextResponse) return auth;
  const body = await parseBody(req, Body);
  if (body instanceof NextResponse) return body;
  const { supabase } = auth;

  const { data: flag } = await supabase.from("duplicate_flags").select("*").eq("id", body.flagId).maybeSingle();
  if (!flag) return jsonError("Flag not found", 404);
  if (flag.status !== "pending") return jsonError("Already resolved", 409);

  let closed = false;
  if (body.action === "merge") {
    const { data: both } = await supabase.from("applications").select("id, job_id, status").in("id", [flag.application_a, flag.application_b]);
    const earlier = both?.find((x) => x.id === flag.application_a);
    const later = both?.find((x) => x.id === flag.application_b);
    // Same job: keep the earlier application, close the later one (audited, human-made status change).
    // Different jobs: only record that the two accounts are the same person — nobody is rejected for it.
    if (earlier && later && earlier.job_id === later.job_id && !["rejected", "selected"].includes(later.status)) {
      const { error } = await supabase.rpc("change_application_status", {
        p_application_id: flag.application_b, p_to_status: "rejected",
        p_reason: `Duplicate of an earlier application from the same person (confirmed by recruiter)`,
      });
      if (error) return jsonError("Could not close the duplicate: " + error.message, 400);
      closed = true;
    }
  }
  const { error } = await supabase.from("duplicate_flags").update({ status: body.action === "merge" ? "merged" : "dismissed" }).eq("id", flag.id);
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true, closed });
}
