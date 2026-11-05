// POST /api/questions  { applicationId, difficulty?, regenerate? } -> { questions[] }   (QUES-1..4)
// Stored once; returned from the DB unless regenerate=true.
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseBody, requireUser } from "@/lib/api-server";
import { generateJSON } from "@/lib/ai/gemini";
import { anonymizeResume } from "@/lib/ai/fairness";
import { QUESTIONS_JSON_SCHEMA, QUESTIONS_SYSTEM, QuestionsZ, questionsPrompt } from "@/lib/ai/prompts";
import type { Difficulty, Job, MatchExplanation, ParsedResume } from "@/lib/types";

export const maxDuration = 60;

const Body = z.object({
  applicationId: z.string().uuid(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  regenerate: z.boolean().optional(),
});

export async function POST(req: Request) {
  const auth = await requireUser("recruiter");
  if (auth instanceof NextResponse) return auth;
  const body = await parseBody(req, Body);
  if (body instanceof NextResponse) return body;
  const { supabase } = auth;

  // RLS: only the job owner sees the application, its resume and questions.
  const { data: app } = await supabase
    .from("applications")
    .select("id, ai_explanation, jobs(title, required_skills, preferred_skills, min_experience_years), resumes(parsed)")
    .eq("id", body.applicationId)
    .maybeSingle();
  if (!app) return jsonError("Application not found", 404);

  const difficulties: Difficulty[] = body.difficulty ? [body.difficulty] : ["beginner", "intermediate", "advanced"];
  const existing = async () => {
    let q = supabase.from("interview_questions").select("*").eq("application_id", app.id);
    if (body.difficulty) q = q.eq("difficulty", body.difficulty);
    return (await q.order("created_at")).data ?? [];
  };

  if (!body.regenerate) {
    const rows = await existing();
    if (rows.length) return NextResponse.json({ questions: rows });
  }

  const parsed = (app.resumes as unknown as { parsed: ParsedResume | null } | null)?.parsed;
  if (!parsed) return jsonError("Resume has no parsed data", 422);
  const gaps = (app.ai_explanation as MatchExplanation | null)?.gaps.map((g) => ({ skill: g.skill, type: g.type })) ?? [];

  let out;
  try {
    out = await generateJSON({
      system: QUESTIONS_SYSTEM,
      prompt: questionsPrompt(app.jobs as unknown as Partial<Job>, anonymizeResume(parsed), gaps, difficulties),
      jsonSchema: QUESTIONS_JSON_SCHEMA,
      zod: QuestionsZ,
      temperature: 0.6,
    });
  } catch (err) {
    console.error("[questions] AI failure", err);
    return jsonError("Question generation failed. Please retry.", 502);
  }

  const rows = out.questions
    .filter((q) => difficulties.includes(q.difficulty))
    .map((q) => ({ ...q, application_id: app.id }));
  if (!rows.length) return jsonError("No questions generated. Please retry.", 502);

  let del = supabase.from("interview_questions").delete().eq("application_id", app.id);
  if (body.difficulty) del = del.eq("difficulty", body.difficulty);
  await del;
  const { error } = await supabase.from("interview_questions").insert(rows);
  if (error) return jsonError("Could not save questions: " + error.message, 500);
  return NextResponse.json({ questions: await existing() });
}
