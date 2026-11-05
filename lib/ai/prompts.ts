// Prompts + JSON schemas (Gemini structured output) + zod validators.
import { z } from "zod";

// ---------------------------------------------------------------- Resume parsing (RES-3/4/8)
export const RESUME_PARSE_SYSTEM = `You are a precise resume parser for a recruitment platform.
Return ONLY data that is present in the resume text. Never invent or infer facts.

Rules:
- Normalize skill names to their canonical form (e.g. "JS" -> "JavaScript", "ReactJS" -> "React",
  "Postgres" -> "PostgreSQL", "k8s" -> "Kubernetes", "RESTful APIs" -> "REST API", "Node" -> "Node.js").
- List each distinct skill once. Include tools, frameworks, languages, databases, cloud and practices
  that the resume mentions, including those only mentioned inside experience or project descriptions.
- For EVERY skill, education entry, experience entry and project, "excerpt" MUST be a short
  VERBATIM substring copied exactly from the resume text (5-25 words) that proves it. Do not paraphrase,
  fix typos, or join text from different places.
- total_experience_years: sum of professional experience in years (decimals allowed), or null if unknown.
- Use null for unknown scalar fields and [] for empty lists.`;

export function resumeParsePrompt(rawText: string): string {
  return `Parse this resume into the required JSON.\n\n<resume>\n${rawText}\n</resume>`;
}

const str = { type: "string" };
const nstr = { type: ["string", "null"] };

export const RESUME_PARSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    name: nstr,
    contact: {
      type: "object",
      properties: { email: nstr, phone: nstr, location: nstr, links: { type: "array", items: str } },
      required: ["email", "phone", "location", "links"],
    },
    summary: nstr,
    total_experience_years: { type: ["number", "null"] },
    skills: {
      type: "array",
      items: { type: "object", properties: { name: str, excerpt: str }, required: ["name", "excerpt"] },
    },
    education: {
      type: "array",
      items: {
        type: "object",
        properties: { institution: str, degree: nstr, field: nstr, start: nstr, end: nstr, excerpt: str },
        required: ["institution", "degree", "field", "start", "end", "excerpt"],
      },
    },
    experience: {
      type: "array",
      items: {
        type: "object",
        properties: { title: str, company: nstr, start: nstr, end: nstr, description: str, excerpt: str },
        required: ["title", "company", "start", "end", "description", "excerpt"],
      },
    },
    projects: {
      type: "array",
      items: {
        type: "object",
        properties: { name: str, description: str, technologies: { type: "array", items: str }, excerpt: str },
        required: ["name", "description", "technologies", "excerpt"],
      },
    },
  },
  required: ["name", "contact", "summary", "total_experience_years", "skills", "education", "experience", "projects"],
} as const;

const zs = z.string().catch("");
const zns = z.string().nullable().catch(null);

export const ResumeParseZ = z.object({
  name: zns,
  contact: z
    .object({ email: zns, phone: zns, location: zns, links: z.array(z.string()).catch([]) })
    .catch({ email: null, phone: null, location: null, links: [] }),
  summary: zns,
  total_experience_years: z.number().nullable().catch(null),
  skills: z.array(z.object({ name: z.string().min(1), excerpt: zs })),
  education: z
    .array(z.object({ institution: zs, degree: zns, field: zns, start: zns, end: zns, excerpt: zs }))
    .catch([]),
  experience: z
    .array(z.object({ title: zs, company: zns, start: zns, end: zns, description: zs, excerpt: zs }))
    .catch([]),
  projects: z
    .array(z.object({ name: zs, description: zs, technologies: z.array(z.string()).catch([]), excerpt: zs }))
    .catch([]),
});
export type ResumeParseOutput = z.infer<typeof ResumeParseZ>;

// ---------------------------------------------------------------- Job requirement extraction (JOB-7)
export const JOB_EXTRACT_SYSTEM = `You extract structured hiring requirements from a free-text job description.
Return ONLY requirements stated or clearly implied by the text. Never invent requirements.

Rules:
- required_skills: skills described as required / must-have / essential, or core to the role.
- preferred_skills: skills described as nice-to-have / preferred / a plus / bonus.
- A skill appears in only one list. Use canonical names ("Postgres" -> "PostgreSQL", "JS" -> "JavaScript",
  "RESTful APIs" -> "REST API"). Keep each skill short (1-4 words); no soft skills unless explicitly required.
- importance (integer 1-5): 5 = critical/explicitly required, 4 = clearly required, 3 = important,
  2 = useful, 1 = minor. Base it on emphasis and wording in the text.
- min_experience_years: minimum years of experience stated (number), or 0 if not stated.
- qualifications: degrees, certifications or other formal qualifications stated (short phrases), [] if none.`;

export function jobExtractPrompt(description: string): string {
  return `Extract the requirements from this job description.\n\n<job_description>\n${description}\n</job_description>`;
}

const skillReq = {
  type: "object",
  properties: { name: { type: "string" }, importance: { type: "integer", minimum: 1, maximum: 5 } },
  required: ["name", "importance"],
};

export const JOB_EXTRACT_JSON_SCHEMA = {
  type: "object",
  properties: {
    required_skills: { type: "array", items: skillReq },
    preferred_skills: { type: "array", items: skillReq },
    min_experience_years: { type: "number", minimum: 0 },
    qualifications: { type: "array", items: { type: "string" } },
  },
  required: ["required_skills", "preferred_skills", "min_experience_years", "qualifications"],
} as const;

const zSkillReq = z.object({ name: z.string().min(1), importance: z.coerce.number() });
export const JobExtractZ = z.object({
  required_skills: z.array(zSkillReq).catch([]),
  preferred_skills: z.array(zSkillReq).catch([]),
  min_experience_years: z.coerce.number().catch(0),
  qualifications: z.array(z.string()).catch([]),
});
export type JobExtractOutput = z.infer<typeof JobExtractZ>;

// ---------------------------------------------------------------- Matching (MATCH-1..3, GAP-1..4)
export const MATCH_SYSTEM = `You assess how well an anonymized candidate matches a job, using ONLY the resume evidence given.
You do not decide hiring outcomes; you produce evidence for a human recruiter.

For EVERY listed job skill (required and preferred) return one assessment:
- status "full": clear evidence of the skill or a direct equivalent (semantic match, e.g. "built REST endpoints in Flask"
  satisfies "REST API"; "Postgres" satisfies "PostgreSQL").
- status "partial": related/adjacent evidence only (e.g. MySQL for PostgreSQL, Flask for Django).
- status "not_mentioned": no evidence either way (missing evidence).
- status "explicitly_lacking": the resume explicitly states the candidate lacks it (e.g. "no backend experience").
- resume_skill: the candidate skill that matched (or null).
- excerpt: a short VERBATIM quote (5-25 words) copied exactly from the resume that supports the status; "" if not_mentioned.
- learning_suggestion: one concrete learning area for partial/not_mentioned/explicitly_lacking; "" for full.

Also score 0-100: experience_score (relevance + years vs minimum), project_score (relevance of projects),
qualification_score (stated qualifications vs required). Give one-sentence notes for each, and a 2-3 sentence
plain-language summary. Never mention or infer name, gender, age, nationality, religion or other personal attributes.`;

export function matchPrompt(job: unknown, resume: unknown): string {
  return `<job>\n${JSON.stringify(job)}\n</job>\n\n<anonymized_resume>\n${JSON.stringify(resume)}\n</anonymized_resume>`;
}

export const MATCH_JSON_SCHEMA = {
  type: "object",
  properties: {
    requirements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          skill: { type: "string" },
          status: { type: "string", enum: ["full", "partial", "not_mentioned", "explicitly_lacking"] },
          resume_skill: { type: ["string", "null"] },
          excerpt: { type: "string" },
          learning_suggestion: { type: "string" },
        },
        required: ["skill", "status", "resume_skill", "excerpt", "learning_suggestion"],
      },
    },
    experience_score: { type: "number" },
    project_score: { type: "number" },
    qualification_score: { type: "number" },
    experience_note: { type: "string" },
    project_note: { type: "string" },
    qualification_note: { type: "string" },
    summary: { type: "string" },
  },
  required: ["requirements", "experience_score", "project_score", "qualification_score",
    "experience_note", "project_note", "qualification_note", "summary"],
} as const;

const zNum = z.coerce.number().catch(0);
export const MatchZ = z.object({
  requirements: z.array(z.object({
    skill: z.string(),
    status: z.enum(["full", "partial", "not_mentioned", "explicitly_lacking"]).catch("not_mentioned"),
    resume_skill: z.string().nullable().catch(null),
    excerpt: z.string().catch(""),
    learning_suggestion: z.string().catch(""),
  })),
  experience_score: zNum, project_score: zNum, qualification_score: zNum,
  experience_note: z.string().catch(""), project_note: z.string().catch(""),
  qualification_note: z.string().catch(""), summary: z.string().catch(""),
});
export type MatchOutput = z.infer<typeof MatchZ>;

// ---------------------------------------------------------------- Interview questions (QUES-1..3)
export const QUESTIONS_SYSTEM = `You write interview questions for a recruiter. Use the job requirements and the candidate's
anonymized resume. Produce two categories:
- "role": questions on the job's required skills, especially gaps or partial matches that need probing.
- "project": questions about the candidate's OWN listed projects and experience (reference them specifically).
For each question give an answer_guideline: what a strong answer covers (2-4 short points in one string).
Difficulty: beginner = fundamentals, intermediate = applied/design trade-offs, advanced = depth, scale, failure modes.
Never ask about personal attributes (age, gender, family, religion, nationality, health).`;

export function questionsPrompt(job: unknown, resume: unknown, gaps: unknown, difficulties: string[]): string {
  return `Generate 2 "role" and 1 "project" question for EACH difficulty in: ${difficulties.join(", ")}.
<job>${JSON.stringify(job)}</job>
<anonymized_resume>${JSON.stringify(resume)}</anonymized_resume>
<known_gaps>${JSON.stringify(gaps)}</known_gaps>`;
}

export const QUESTIONS_JSON_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
          category: { type: "string", enum: ["role", "project"] },
          question: { type: "string" },
          answer_guideline: { type: "string" },
        },
        required: ["difficulty", "category", "question", "answer_guideline"],
      },
    },
  },
  required: ["questions"],
} as const;

export const QuestionsZ = z.object({
  questions: z.array(z.object({
    difficulty: z.enum(["beginner", "intermediate", "advanced"]),
    category: z.enum(["role", "project"]).catch("role"),
    question: z.string().min(5),
    answer_guideline: z.string().catch(""),
  })).min(1),
});

// ---------------------------------------------------------------- Resume coach (tailor to a job)
export const COACH_SYSTEM = `You are an honest resume coach. A candidate wants to tailor their resume to one job.
You may ONLY rephrase what their resume already says, so it reads clearly in the job's vocabulary.

Hard rules:
- "original" MUST be copied VERBATIM from the resume lines provided (one bullet/sentence).
- The rewrite must keep the same facts. NEVER add a tool, technology, skill, employer, title, number,
  percentage, metric or achievement that the original line does not state. Do not inflate seniority.
- You MAY: use the job's term for the same thing (e.g. "REST endpoints" -> "REST APIs", "Postgres" -> "PostgreSQL"),
  lead with a strong verb, make the impact clearer, move the most job-relevant fact first.
- target_skills: the job skills this rewrite makes clearer (only ones the original line genuinely shows).
- Suggest at most 6 rewrites, most impactful first. Skip lines that are already strong.
- summary_rewrite: a 2-sentence professional summary built ONLY from facts in the resume, aimed at this job.
- honest_gaps: job skills the resume shows NO evidence for. For each, practical advice to genuinely gain or
  demonstrate it (a small project, a course, a certification). Never suggest claiming it.`;

export function coachPrompt(job: unknown, lines: unknown, skills: string[]): string {
  return `<job>${JSON.stringify(job)}</job>
<resume_lines>${JSON.stringify(lines)}</resume_lines>
<resume_skills>${JSON.stringify(skills)}</resume_skills>`;
}

export const COACH_JSON_SCHEMA = {
  type: "object",
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          section: { type: "string", enum: ["experience", "project", "summary", "skills"] },
          original: { type: "string" },
          rewrite: { type: "string" },
          target_skills: { type: "array", items: { type: "string" } },
          why: { type: "string" },
        },
        required: ["section", "original", "rewrite", "target_skills", "why"],
      },
    },
    summary_rewrite: { type: "string" },
    honest_gaps: {
      type: "array",
      items: { type: "object", properties: { skill: { type: "string" }, advice: { type: "string" } }, required: ["skill", "advice"] },
    },
  },
  required: ["suggestions", "summary_rewrite", "honest_gaps"],
} as const;

export const CoachZ = z.object({
  suggestions: z.array(z.object({
    section: z.enum(["experience", "project", "summary", "skills"]).catch("experience"),
    original: z.string(),
    rewrite: z.string().min(3),
    target_skills: z.array(z.string()).catch([]),
    why: z.string().catch(""),
  })).catch([]),
  summary_rewrite: z.string().catch(""),
  honest_gaps: z.array(z.object({ skill: z.string(), advice: z.string().catch("") })).catch([]),
});

// ---------------------------------------------------------------- ATS-friendly rewrite
export const ATS_SYSTEM = `You convert a resume into an ATS-friendly version. You may ONLY rephrase what it already says.

Rules:
- Each bullet must rewrite exactly one numbered source sentence; return its source index.
- Start every bullet with a strong past-tense action verb (Built, Designed, Led, Automated, ...). Keep it under 25 words.
- Keep the same facts. NEVER add a tool, technology, skill, number, metric, employer or achievement that the
  source sentence does not state. If a target job is given, prefer its wording ONLY when it means the same thing
  (e.g. "REST endpoints" -> "REST APIs").
- summary: 2 sentences built only from facts in the resume.
- skill_groups: group ONLY the resume's listed skills into 2-5 plain categories (e.g. Languages, Frameworks,
  Databases, Tools & Cloud). Do not add skills.
- Plain text only: no emojis, tables, columns or special symbols.`;

export function atsPrompt(input: unknown, job: unknown): string {
  return `<resume>${JSON.stringify(input)}</resume>${job ? `\n<target_job>${JSON.stringify(job)}</target_job>` : ""}`;
}

const atsBullets = { type: "array", items: { type: "object", properties: { source: { type: "integer" }, text: { type: "string" } }, required: ["source", "text"] } };
export const ATS_JSON_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    skill_groups: { type: "array", items: { type: "object", properties: { category: { type: "string" }, items: { type: "array", items: { type: "string" } } }, required: ["category", "items"] } },
    experience: { type: "array", items: { type: "object", properties: { index: { type: "integer" }, bullets: atsBullets }, required: ["index", "bullets"] } },
    projects: { type: "array", items: { type: "object", properties: { index: { type: "integer" }, bullets: atsBullets }, required: ["index", "bullets"] } },
  },
  required: ["summary", "skill_groups", "experience", "projects"],
} as const;

const zBullets = z.array(z.object({ source: z.coerce.number(), text: z.string() })).catch([]);
export const AtsZ = z.object({
  summary: z.string().catch(""),
  skill_groups: z.array(z.object({ category: z.string(), items: z.array(z.string()).catch([]) })).catch([]),
  experience: z.array(z.object({ index: z.coerce.number(), bullets: zBullets })).catch([]),
  projects: z.array(z.object({ index: z.coerce.number(), bullets: zBullets })).catch([]),
});
