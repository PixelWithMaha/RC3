"use client";

import { useRef, useState } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import { getMyResume, parseResume, saveParsedResume, uploadResume } from "@/lib/api";
import type { ParsedResume, Resume } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Excerpt, VerifiedBadge } from "@/components/app/badges";
import { ErrorState, Loading, PageHeader, useAction, useAsync } from "@/components/app/states";

export default function ResumePage() {
  const { data: resume, error, loading, reload, setData } = useAsync(getMyResume);
  const fileRef = useRef<HTMLInputElement>(null);
  const action = useAction();

  const onFile = (file: File | undefined) => {
    if (!file) return;
    action.run("upload", async () => {
      await uploadResume(file);
      await reload();
    });
  };

  if (loading && !resume) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <>
      <PageHeader
        title="Your resume"
        description="We extract skills with the exact lines that prove them. Review and correct anything we got wrong."
        actions={
          <>
            <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <Button disabled={!!action.busy} onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> {resume ? "Upload new PDF" : "Upload PDF"}
            </Button>
          </>
        }
      />
      {action.busy && <Loading label="Uploading, extracting text and parsing with AI — about 15–30 seconds…" />}
      {action.error && <ErrorState message={action.error} />}

      {!resume && !action.busy && (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Upload a text-based PDF (max 5 MB) to get started.</CardContent></Card>
      )}

      {resume && resume.parse_status !== "success" && !action.busy && (
        <ErrorState
          message={resume.parse_error ?? "Parsing has not finished."}
          onRetry={() => action.run("retry", async () => { await parseResume(resume.id); await reload(); })}
        />
      )}

      {resume?.parsed && resume.parse_status === "success" && (
        <ResumeEditor key={resume.updated_at} resume={resume} onSaved={setData} />
      )}
    </>
  );
}

function ResumeEditor({ resume, onSaved }: { resume: Resume; onSaved: (r: Resume) => void }) {
  const [parsed, setParsed] = useState<ParsedResume>(resume.parsed!);
  const [newSkill, setNewSkill] = useState("");
  const [saved, setSaved] = useState(false);
  const action = useAction();
  const unverified = parsed.skills.filter((s) => !s.verified).length;

  const update = (p: ParsedResume) => {
    setParsed(p);
    setSaved(false);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>{parsed.name ?? "Unnamed"}</CardTitle>
            <CardDescription>
              {[parsed.contact.email, parsed.contact.phone, parsed.contact.location].filter(Boolean).join(" · ")}
              {parsed.total_experience_years != null && ` · ${parsed.total_experience_years} years experience`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            {resume.is_verified && <span className="text-xs text-matched">Reviewed by you</span>}
            <Button
              disabled={!!action.busy}
              onClick={() => action.run("save", async () => { onSaved(await saveParsedResume(resume.id, parsed)); setSaved(true); })}
            >
              {action.busy ? "Saving…" : saved ? "Saved ✓" : "Save corrections"}
            </Button>
          </div>
        </CardHeader>
        {action.error && <CardContent><ErrorState message={action.error} /></CardContent>}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Skills ({parsed.skills.length})</CardTitle>
          <CardDescription>
            Names are normalized (e.g. JS → JavaScript).{" "}
            {unverified > 0 && <span className="text-missing">{unverified} skill(s) have no matching line in your resume.</span>}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {parsed.skills.map((s, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2">
              <Input
                className="h-8 w-44"
                value={s.name}
                aria-label="Skill name"
                onChange={(e) => update({ ...parsed, skills: parsed.skills.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })}
              />
              <VerifiedBadge verified={s.verified} />
              <span className="min-w-0 flex-1 truncate">{s.excerpt ? <Excerpt>{s.excerpt}</Excerpt> : <span className="text-xs text-muted-foreground">Added by you</span>}</span>
              <Button size="sm" variant="ghost" aria-label={`Remove ${s.name}`} onClick={() => update({ ...parsed, skills: parsed.skills.filter((_, j) => j !== i) })}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <form
            className="flex gap-2 pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newSkill.trim()) return;
              update({ ...parsed, skills: [...parsed.skills, { name: newSkill.trim(), excerpt: "", verified: false }] });
              setNewSkill("");
            }}
          >
            <Input className="h-9 max-w-xs" placeholder="Add a missing skill" value={newSkill} onChange={(e) => setNewSkill(e.target.value)} />
            <Button type="submit" size="sm" variant="outline"><Plus className="h-4 w-4" /> Add</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={`Experience (${parsed.experience.length})`}>
          {parsed.experience.map((e, i) => (
            <Item key={i} title={`${e.title}${e.company ? ` · ${e.company}` : ""}`} meta={[e.start, e.end].filter(Boolean).join(" – ")} verified={e.verified}>
              {e.description}
            </Item>
          ))}
        </Section>
        <Section title={`Projects (${parsed.projects.length})`}>
          {parsed.projects.map((p, i) => (
            <Item key={i} title={p.name} meta={p.technologies.join(", ")} verified={p.verified}>{p.description}</Item>
          ))}
        </Section>
        <Section title={`Education (${parsed.education.length})`}>
          {parsed.education.map((e, i) => (
            <Item key={i} title={[e.degree, e.field].filter(Boolean).join(", ") || e.institution} meta={`${e.institution} ${[e.start, e.end].filter(Boolean).join(" – ")}`} verified={e.verified} />
          ))}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function Item({ title, meta, verified, children }: { title: string; meta?: string; verified: boolean; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{title}</span>
        <VerifiedBadge verified={verified} />
      </div>
      {meta && <p className="text-xs text-muted-foreground">{meta}</p>}
      {children && <p className="mt-1 text-muted-foreground">{children}</p>}
    </div>
  );
}
