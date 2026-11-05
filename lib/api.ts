// Data functions the UI calls (browser side). lib/mock-api.ts must keep the same signatures.
// AI work always goes through app/api/* routes; nothing here touches AI keys.
import { createClient } from "@/lib/supabase/client";
import type { ParseResumeResponse, ParsedResume, Resume } from "@/lib/types";

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({ error: "Unexpected server response" }));
  if (!res.ok && !("parse_status" in data)) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

// ---------------------------------------------------------------- Resumes (RES-1..8)

/** Latest resume for the signed-in candidate, or null. */
export async function getMyResume(): Promise<Resume | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("resumes")
    .select("*")
    .eq("candidate_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Resume | null;
}

/**
 * Uploads a PDF to the private bucket, creates the resume row, then parses it.
 * Returns the resume id plus the parse result. On parse failure the row stays with
 * parse_status 'failed' | 'empty' and an error message — call parseResume(id) to retry.
 */
export async function uploadResume(file: File): Promise<{ resumeId: string } & ParseResumeResponse> {
  if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
    throw new Error("Unsupported file type. Please upload a PDF resume.");
  }
  if (file.size > 5 * 1024 * 1024) throw new Error("File too large. Maximum size is 5 MB.");

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const path = `${user.id}/${crypto.randomUUID()}.pdf`;
  const { error: upErr } = await supabase.storage
    .from("resumes")
    .upload(path, file, { contentType: "application/pdf", upsert: false });
  if (upErr) throw new Error("Upload failed: " + upErr.message);

  const { data: row, error: insErr } = await supabase
    .from("resumes")
    .insert({ candidate_id: user.id, file_path: path, file_name: file.name })
    .select("id")
    .single();
  if (insErr || !row) throw new Error("Could not save resume: " + (insErr?.message ?? "unknown error"));

  const result = await parseResume(row.id);
  return { resumeId: row.id, ...result };
}

/** (Re)parse an uploaded resume. Never throws for parse failures — check parse_status / error. */
export async function parseResume(resumeId: string): Promise<ParseResumeResponse> {
  return postJSON<ParseResumeResponse>("/api/resume/parse", { resumeId });
}

/** RES-6: candidate saves corrected parsed data; marks the resume as verified. */
export async function saveParsedResume(resumeId: string, parsed: ParsedResume): Promise<Resume> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("resumes")
    .update({ parsed, is_verified: true })
    .eq("id", resumeId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Resume;
}

/** Short-lived signed URL for viewing the PDF (private bucket). */
export async function getResumeFileUrl(filePath: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from("resumes").createSignedUrl(filePath, 60 * 10);
  if (error || !data) throw new Error(error?.message ?? "Could not create link");
  return data.signedUrl;
}
