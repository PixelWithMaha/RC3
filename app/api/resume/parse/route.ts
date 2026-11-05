// POST /api/resume/parse  { resumeId } -> { parsed, parse_status, error? }
// RES-1/3/4/5/7/8, TI-2, TI-8. Runs once at upload; results are stored, never recomputed on page load.
import { NextResponse } from "next/server";
import { z } from "zod";
import { extractText, getDocumentProxy } from "unpdf";
import { jsonError, parseBody, requireUser } from "@/lib/api-server";
import { AIError, embedTexts, generateJSON, toPgVector } from "@/lib/ai/gemini";
import { RESUME_PARSE_JSON_SCHEMA, RESUME_PARSE_SYSTEM, ResumeParseZ, resumeParsePrompt } from "@/lib/ai/prompts";
import {
  MAX_RESUME_BYTES,
  MIN_TEXT_CHARS,
  buildParsedResume,
  chunkText,
  cleanText,
  isPdf,
  resumeEmbeddingText,
} from "@/lib/ai/resume";
import type { ParseResumeResponse, ParseStatus } from "@/lib/types";

export const maxDuration = 60;

const Body = z.object({ resumeId: z.string().uuid() });

export async function POST(req: Request) {
  const auth = await requireUser("candidate");
  if (auth instanceof NextResponse) return auth;
  const body = await parseBody(req, Body);
  if (body instanceof NextResponse) return body;
  const { supabase, user } = auth;

  // RLS guarantees candidates only see their own resumes; check explicitly too.
  const { data: resume } = await supabase
    .from("resumes")
    .select("id, candidate_id, file_path, file_name")
    .eq("id", body.resumeId)
    .single();
  if (!resume || resume.candidate_id !== user.id) return jsonError("Resume not found", 404);

  const fail = async (status: ParseStatus, message: string, http: number, rawText?: string) => {
    await supabase
      .from("resumes")
      .update({ parse_status: status, parse_error: message, ...(rawText !== undefined ? { raw_text: rawText } : {}) })
      .eq("id", resume.id);
    const res: ParseResumeResponse = { parsed: null, parse_status: status, error: message };
    return NextResponse.json(res, { status: http });
  };

  // 1. Type check by name (RES-7). DOCX is P2.
  if (!/\.pdf$/i.test(resume.file_name)) {
    return fail("failed", "Unsupported file type. Please upload a PDF resume.", 415);
  }

  // 2. Download from the private bucket
  const { data: blob, error: dlErr } = await supabase.storage.from("resumes").download(resume.file_path);
  if (dlErr || !blob) return fail("failed", "Could not read the uploaded file. Please upload it again.", 404);
  if (blob.size > MAX_RESUME_BYTES) return fail("failed", "File too large. Maximum size is 5 MB.", 413);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (!isPdf(bytes)) return fail("failed", "This file is not a valid PDF.", 415);

  // 3. Extract text
  let rawText: string;
  try {
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    rawText = cleanText(Array.isArray(text) ? text.join("\n") : text);
  } catch {
    return fail("failed", "Could not read this PDF. It may be corrupted or password-protected.", 422);
  }
  if (rawText.replace(/\s/g, "").length < MIN_TEXT_CHARS) {
    return fail(
      "empty",
      "No extractable text found. The PDF may be a scanned image — please upload a text-based PDF.",
      422,
      rawText,
    );
  }

  // 4. LLM structured extraction (retries once internally)
  let parsed;
  try {
    const out = await generateJSON({
      system: RESUME_PARSE_SYSTEM,
      prompt: resumeParsePrompt(rawText.slice(0, 30_000)),
      jsonSchema: RESUME_PARSE_JSON_SCHEMA,
      zod: ResumeParseZ,
    });
    // 5. Normalize skills + verify every excerpt against the raw text (in code)
    parsed = buildParsedResume(out, rawText);
  } catch (err) {
    console.error("[resume/parse] AI failure", err);
    const msg = err instanceof AIError ? "AI parsing failed. Please retry." : "Parsing failed. Please retry.";
    return fail("failed", msg, 502, rawText);
  }

  // 6. Embeddings: whole resume + chunks. Non-fatal — parse result is still saved.
  let resumeEmbedding: string | null = null;
  let chunkRows: { resume_id: string; chunk_index: number; chunk_text: string; embedding: string }[] = [];
  try {
    const chunks = chunkText(rawText);
    const vectors = await embedTexts([resumeEmbeddingText(parsed), ...chunks], "RETRIEVAL_DOCUMENT");
    resumeEmbedding = toPgVector(vectors[0]);
    chunkRows = chunks.map((chunk_text, i) => ({
      resume_id: resume.id,
      chunk_index: i,
      chunk_text,
      embedding: toPgVector(vectors[i + 1]),
    }));
  } catch (err) {
    console.error("[resume/parse] embedding failure (non-fatal)", err);
  }

  // 7. Persist (RES-5)
  const { error: upErr } = await supabase
    .from("resumes")
    .update({
      raw_text: rawText,
      parsed,
      parse_status: "success",
      parse_error: null,
      is_verified: false,
      embedding: resumeEmbedding,
    })
    .eq("id", resume.id);
  if (upErr) {
    console.error("[resume/parse] save failure", upErr);
    return jsonError("Could not save parsed resume. Please retry.", 500, { parse_status: "failed" });
  }

  if (chunkRows.length) {
    await supabase.from("resume_chunks").delete().eq("resume_id", resume.id);
    const { error: chErr } = await supabase.from("resume_chunks").insert(chunkRows);
    if (chErr) console.error("[resume/parse] chunk insert failure (non-fatal)", chErr);
  }

  const res: ParseResumeResponse = { parsed, parse_status: "success" };
  return NextResponse.json(res);
}
