// POST /api/resume/ats { jobId? } -> ATS-friendly version of the candidate's own resume + before/after checks.
// The model only rewrites wording; code drops invented skills/numbers and fills in contact details itself.
import { NextResponse } from "next/server";
import { z } from "zod";
import { JOB_COLUMNS, jsonError, parseBody, requireUser } from "@/lib/api-server";
import { generateJSON } from "@/lib/ai/gemini";
import { scrubText } from "@/lib/ai/fairness";
import { bullet, checksForDoc, checksForParsed, contactLine, dateRange, realSkills, safeRewrite, sentences, type AtsCheck, type AtsDoc } from "@/lib/ai/ats";
import { skillGroup } from "@/lib/ai/evidence";
import { ATS_JSON_SCHEMA, ATS_SYSTEM, AtsZ, atsPrompt } from "@/lib/ai/prompts";
import type { Job, ParsedResume } from "@/lib/types";

export const maxDuration = 60;
const Body = z.object({ jobId: z.string().uuid().optional() });

export interface AtsResponse {
  doc: AtsDoc;
  before: { score: number; checks: AtsCheck[] };
  after: { score: number; checks: AtsCheck[] };
  kept_original: number;   // bullets where the AI rewrite was rejected and your own wording was kept
  removed_skills: string[]; // skills the AI suggested that aren't in your resume
  job: { id: string; title: string } | null;
}

export async function POST(req: Request) {
  const auth = await requireUser("candidate");
  if (auth instanceof NextResponse) return auth;
  const body = await parseBody(req, Body);
  if (body instanceof NextResponse) return body;
  const { supabase, user } = auth;

  const [{ data: resume }, jobRes] = await Promise.all([
    supabase.from("resumes").select("parsed, raw_text").eq("candidate_id", user.id).eq("parse_status", "success").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    body.jobId ? supabase.from("jobs").select(JOB_COLUMNS).eq("id", body.jobId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!resume?.parsed || !resume.raw_text) return jsonError("Upload and parse your resume first.", 422);
  const p = resume.parsed as ParsedResume;
  const raw = resume.raw_text as string;
  const job = (jobRes.data as Job | null) ?? null;
  const jobSkills = job ? [...job.required_skills, ...job.preferred_skills].map((s) => s.name) : undefined;
  const vocabulary = [...p.skills.map((s) => s.name), ...(jobSkills ?? [])];

  // Numbered source sentences, scrubbed of personal details (contact is filled in by code, not the model).
  const exp = p.experience.map((e, i) => ({ index: i, title: e.title, company: e.company, sentences: sentences(e.description || e.excerpt) }));
  const proj = p.projects.map((pr, i) => ({ index: i, name: pr.name, technologies: pr.technologies, sentences: sentences(pr.description || pr.excerpt) }));
  const input = {
    summary: p.summary ? scrubText(p.summary, p.name) : null,
    skills: p.skills.map((s) => s.name),
    experience: exp.map((e) => ({ ...e, sentences: e.sentences.map((s, k) => ({ n: k, text: scrubText(s, p.name) })) })),
    projects: proj.map((x) => ({ ...x, sentences: x.sentences.map((s, k) => ({ n: k, text: scrubText(s, p.name) })) })),
  };

  let out;
  try {
    out = await generateJSON({
      system: ATS_SYSTEM,
      prompt: atsPrompt(input, job ? { title: job.title, skills: jobSkills } : null),
      jsonSchema: ATS_JSON_SCHEMA, zod: AtsZ, temperature: 0.2,
    });
  } catch (err) {
    console.error("[resume/ats] AI failure", err);
    return jsonError("The ATS formatter is busy right now. Please retry in a moment.", 502);
  }

  let keptOriginal = 0;
  const mapBullets = (srcs: string[], rewrites: { source: number; text: string }[]) => {
    // One bullet per source sentence; the rewrite is used only if it's provably faithful.
    return srcs.map((orig, k) => {
      const r = rewrites.find((x) => x.source === k);
      const b = bullet(r?.text, orig, raw, vocabulary);
      if (b.kept === "original") keptOriginal++;
      return b;
    });
  };

  const suggested = out.skill_groups.flatMap((g) => g.items);
  const allReal = realSkills([...suggested, ...p.skills.map((s) => s.name)], raw);
  const removed_skills = [...new Set(suggested.filter((s) => !realSkills([s], raw).length))];
  // Use the model's grouping where it holds real skills; anything left over gets a category in code.
  const placed = new Set<string>();
  const groups = out.skill_groups
    .map((g) => ({ category: g.category.trim() || "Skills", items: realSkills(g.items, raw).filter((s) => !placed.has(s) && placed.add(s)) }))
    .filter((g) => g.items.length);
  for (const s of allReal.filter((x) => !placed.has(x))) {
    const cat = skillGroup(s) === "Other" ? "Other" : skillGroup(s);
    const g = groups.find((x) => x.category === cat) ?? (groups.push({ category: cat, items: [] }), groups[groups.length - 1]);
    g.items.push(s);
  }

  const summary = out.summary && safeRewrite(out.summary, raw, vocabulary) ? out.summary : (p.summary ?? "");
  const doc: AtsDoc = {
    name: p.name ?? "Your Name",
    contact: contactLine(p),
    summary,
    skills: groups,
    experience: exp.map((e) => ({ title: e.title, company: e.company, dates: dateRange(p.experience[e.index].start, p.experience[e.index].end), bullets: mapBullets(e.sentences, out.experience.find((x) => x.index === e.index)?.bullets ?? []) })),
    projects: proj.map((x) => ({ name: x.name, bullets: mapBullets(x.sentences, out.projects.find((y) => y.index === x.index)?.bullets ?? []) })),
    education: p.education.map((e) => ({ line: [[e.degree, e.field].filter(Boolean).join(", "), e.institution].filter(Boolean).join(" · "), dates: dateRange(e.start, e.end) })),
  };

  const res: AtsResponse = {
    doc, before: checksForParsed(p, raw, jobSkills), after: checksForDoc(doc, jobSkills),
    kept_original: keptOriginal, removed_skills, job: job ? { id: job.id, title: job.title } : null,
  };
  return NextResponse.json(res);
}
