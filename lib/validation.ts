// Shared zod schemas (AUTH-8). Safe to import on client (form validation) and server (route handlers).
import { z } from "zod";
import { JOB_TYPES } from "@/lib/types";

export const SkillRequirementZ = z.object({
  name: z.string().trim().min(1).max(80),
  importance: z.number().int().min(1).max(5),
});

const JobBaseZ = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  department: z.string().trim().max(120).nullable().optional(),
  location: z.string().trim().max(120).nullable().optional(),
  type: z.enum(JOB_TYPES),
  salary_min: z.number().nonnegative().nullable().optional(),
  salary_max: z.number().nonnegative().nullable().optional(),
  description: z.string().trim().max(20_000).default(""),
  required_skills: z.array(SkillRequirementZ).max(50).default([]),
  preferred_skills: z.array(SkillRequirementZ).max(50).default([]),
  min_experience_years: z.number().min(0).max(50).default(0),
  qualifications: z.array(z.string().trim().min(1).max(200)).max(30).default([]),
  status: z.enum(["open", "closed"]).default("open"),
});

const salaryOk = (j: { salary_min?: number | null; salary_max?: number | null }) =>
  j.salary_min == null || j.salary_max == null || j.salary_min <= j.salary_max;

export const JobCreateZ = JobBaseZ.refine(salaryOk, { message: "Minimum salary must be ≤ maximum", path: ["salary_max"] });
export const JobUpdateZ = JobBaseZ.partial().refine(salaryOk, {
  message: "Minimum salary must be ≤ maximum",
  path: ["salary_max"],
});
export type JobCreateInput = z.input<typeof JobCreateZ>;
export type JobUpdateInput = z.input<typeof JobUpdateZ>;

export const JobExtractRequestZ = z.object({
  description: z.string().trim().min(30, "Description is too short to extract requirements").max(20_000),
});
