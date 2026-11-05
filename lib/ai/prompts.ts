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
