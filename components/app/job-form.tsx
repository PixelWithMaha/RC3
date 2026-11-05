"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { createJob, extractJobRequirements, updateJob } from "@/lib/api";
import { JOB_TYPES, type Job, type JobType, type SkillRequirement } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState, useAction } from "@/components/app/states";

export function JobForm({ job }: { job?: Job }) {
  const router = useRouter();
  const action = useAction();
  const [f, setF] = useState({
    title: job?.title ?? "",
    department: job?.department ?? "",
    location: job?.location ?? "",
    type: (job?.type ?? "full-time") as JobType,
    salary_min: job?.salary_min?.toString() ?? "",
    salary_max: job?.salary_max?.toString() ?? "",
    description: job?.description ?? "",
    min_experience_years: job?.min_experience_years?.toString() ?? "0",
    qualifications: (job?.qualifications ?? []).join("\n"),
  });
  const [required, setRequired] = useState<SkillRequirement[]>(job?.required_skills ?? []);
  const [preferred, setPreferred] = useState<SkillRequirement[]>(job?.preferred_skills ?? []);
  const [extracted, setExtracted] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  const extract = () =>
    action.run("extract", async () => {
      const r = await extractJobRequirements(f.description);
      setRequired(r.required_skills);
      setPreferred(r.preferred_skills);
      setF((x) => ({ ...x, min_experience_years: String(r.min_experience_years), qualifications: r.qualifications.join("\n") }));
      setExtracted(true);
    });

  const save = () =>
    action.run("save", async () => {
      const input = {
        title: f.title,
        department: f.department || null,
        location: f.location || null,
        type: f.type,
        salary_min: num(f.salary_min),
        salary_max: num(f.salary_max),
        description: f.description,
        required_skills: required.filter((s) => s.name.trim()),
        preferred_skills: preferred.filter((s) => s.name.trim()),
        min_experience_years: Number(f.min_experience_years) || 0,
        qualifications: f.qualifications.split("\n").map((q) => q.trim()).filter(Boolean),
      };
      const saved = job ? await updateJob(job.id, input) : await createJob(input);
      router.push(`/recruiter/jobs/${saved.id}`);
      router.refresh();
    });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Job details</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <Field label="Title" id="title"><Input id="title" value={f.title} onChange={set("title")} placeholder="Backend Developer" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Department" id="dep"><Input id="dep" value={f.department} onChange={set("department")} /></Field>
            <Field label="Location" id="loc"><Input id="loc" value={f.location} onChange={set("location")} /></Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Type" id="type">
              <Select id="type" value={f.type} onChange={set("type")}>
                {JOB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="Salary min" id="smin"><Input id="smin" type="number" min={0} value={f.salary_min} onChange={set("salary_min")} /></Field>
            <Field label="Salary max" id="smax"><Input id="smax" type="number" min={0} value={f.salary_max} onChange={set("salary_max")} /></Field>
          </div>
          <Field label="Description" id="desc">
            <Textarea id="desc" rows={10} value={f.description} onChange={set("description")} placeholder="Paste the full job description…" />
          </Field>
          <Button type="button" variant="secondary" disabled={!!action.busy || f.description.trim().length < 30} onClick={extract}>
            <Sparkles className="h-4 w-4" /> {action.busy === "extract" ? "Extracting…" : "Extract requirements with AI"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Requirements</CardTitle>
          <CardDescription>{extracted ? "AI suggestions below — review and edit before saving." : "Add skills with importance 1–5, or extract them from the description."}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <SkillEditor label="Required skills" skills={required} onChange={setRequired} />
          <SkillEditor label="Preferred skills (half weight)" skills={preferred} onChange={setPreferred} />
          <Field label="Minimum experience (years)" id="exp">
            <Input id="exp" type="number" min={0} max={50} value={f.min_experience_years} onChange={set("min_experience_years")} />
          </Field>
          <Field label="Qualifications (one per line)" id="quals">
            <Textarea id="quals" rows={3} value={f.qualifications} onChange={set("qualifications")} />
          </Field>
          {action.error && <ErrorState message={action.error} />}
          <Button disabled={!!action.busy || !f.title.trim()} onClick={save}>
            {action.busy === "save" ? "Saving…" : job ? "Save changes" : "Publish job"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><Label htmlFor={id}>{label}</Label>{children}</div>;
}

function SkillEditor({ label, skills, onChange }: { label: string; skills: SkillRequirement[]; onChange: (s: SkillRequirement[]) => void }) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {skills.length === 0 && <p className="text-xs text-muted-foreground">None yet.</p>}
      {skills.map((s, i) => (
        <div key={i} className="flex gap-2">
          <Input className="h-9" value={s.name} aria-label="Skill" onChange={(e) => onChange(skills.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
          <Select className="w-28" aria-label="Importance" value={s.importance} onChange={(e) => onChange(skills.map((x, j) => (j === i ? { ...x, importance: Number(e.target.value) } : x)))}>
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>Imp. {n}</option>)}
          </Select>
          <Button type="button" variant="ghost" size="icon" aria-label="Remove" onClick={() => onChange(skills.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => onChange([...skills, { name: "", importance: 3 }])}>
        <Plus className="h-4 w-4" /> Add skill
      </Button>
    </div>
  );
}
