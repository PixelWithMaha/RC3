// POST /api/resume/coach { jobId } -> tailored rewrite suggestions, verified in code.
// The model only rephrases existing lines; checkSuggestion() flags any new skill, number or unfound original.
import { NextResponse } from "next/server";
import { z } from "zod";
import { JOB_COLUMNS, jsonError, parseBody, requireUser } from "@/lib/api-server";
import { generateJSON } from "@/lib/ai/gemini";
import { scrubText } from "@/lib/ai/fairness";
import { findSkillSpans, resumeSources } from "@/lib/ai/evidence";
import { checkSuggestion, coverage, type CheckedSuggestion } from "@/lib/ai/coach";
import { COACH_JSON_SCHEMA, COACH_SYSTEM, CoachZ, coachPrompt } from "@/lib/ai/prompts";
import type { Job, ParsedResume } from "@/lib/types";

export const maxDuration = 60;
const Body = z.object({ jobId: z.string().uuid() });

export interface CoachResponse {
  job: { id: string; title: string };
  suggestions: CheckedSuggestion[];
  summary: { text: string; new_skills: string[]; new_numbers: string[] } | null;
  honest_gaps: { skill: string; advice: string }[];
  coverage: { before: string[]; after: string[]; absent: string[]; total: number };
  dropped: number; // suggestions whose "original" wasn't in the resume
}

export async function POST(req: Request) {
  const auth = await requireUser("candidate");
  if (auth instanceof NextResponse) return auth;
  const body = await parseBody(req, Body);
  if (body instanceof NextResponse) return body;
  const { supabase, user } = auth;

  const [{ data: job }, { data: resume }] = await Promise.all([
    supabase.from("jobs").select(JOB_COLUMNS).eq("id", body.jobId).maybeSingle(),
    supabase.from("resumes").select("parsed, raw_text").eq("candidate_id", user.id).eq("parse_status", "success")
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!job) return jsonError("Job not found", 404);
  if (!resume?.parsed || !resume.raw_text) return jsonError("Upload and parse your resume first.", 422);
  const parsed = resume.parsed as ParsedResume;
  const rawText = resume.raw_text as string;
  const j = job as Job;

  // Only work lines + summary are sent, scrubbed of personal details (fairness applies here too).
  const sources = resumeSources(parsed, rawText).filter((s) => s.work);
  const lines = [
    ...(parsed.summary ? [{ section: "summary", text: scrubText(parsed.summary, parsed.name) }] : []),
    ...sources.map((s) => ({ section: s.label.startsWith("Project") ? "project" : "experience", where: s.label, text: scrubText(s.text, parsed.name) })),
  ];
  const jobSkills = [...j.required_skills, ...j.preferred_skills].map((s) => s.name);
  const vocabulary = [...jobSkills, ...parsed.skills.map((s) => s.name)];

  let out;
  try {
    out = await generateJSON({
      system: COACH_SYSTEM,
      prompt: coachPrompt({ title: j.title, required_skills: j.required_skills, preferred_skills: j.preferred_skills, description: j.description.slice(0, 3000) }, lines, parsed.skills.map((s) => s.name)),
      jsonSchema: COACH_JSON_SCHEMA,
      zod: CoachZ,
      temperature: 0.3,
    });
  } catch (err) {
    console.error("[resume/coach] AI failure", err);
    return jsonError("The coach is busy right now. Please retry in a moment.", 502);
  }

  const checked = out.suggestions.filter((s) => s.section !== "summary").map((s) => checkSuggestion(s, rawText, vocabulary));
  const kept = checked.filter((s) => s.original_found && s.original.trim() !== s.rewrite.trim()).slice(0, 6);
  const sum = out.summary_rewrite.trim() ? checkSuggestion({ section: "summary", original: parsed.summary ?? "", rewrite: out.summary_rewrite, target_skills: [], why: "" }, rawText, vocabulary) : null;
  // Gaps the model claims must really be absent from the resume (no false discouragement either).
  const honest_gaps = out.honest_gaps.filter((g) => g.skill.trim() && !findSkillSpans(rawText, g.skill).length);
  const workText = sources.map((s) => s.text).join("\n");
  const res: CoachResponse = {
    job: { id: j.id, title: j.title },
    suggestions: kept,
    summary: sum ? { text: sum.rewrite, new_skills: sum.new_skills, new_numbers: sum.new_numbers } : null,
    honest_gaps,
    coverage: coverage(jobSkills, workText, rawText, kept.filter((s) => s.status !== "check").map((s) => s.rewrite)),
    dropped: checked.length - kept.length,
  };
  return NextResponse.json(res);
}
