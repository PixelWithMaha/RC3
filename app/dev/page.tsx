"use client";

// Backend test console — a quick way to exercise lib/api.ts + app/api/* end to end.
// Not part of the product UI (that lives in app/candidate and app/recruiter).
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  createJob,
  extractJobRequirements,
  getMyResume,
  getRecruiterJobs,
  parseResume,
  setJobStatus,
  uploadResume,
} from "@/lib/api";
import type { JobExtraction, JobWithCounts, ParseResumeResponse, ParsedResume, Profile } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogoutButton } from "@/components/logout-button";

const DEMO_JD = `We're hiring a Backend Developer to build and scale our APIs. You must have strong Python and Django experience and solid PostgreSQL skills (schema design, query tuning). Experience containerizing services with Docker is required. 3+ years of professional backend experience. Bachelor's degree in Computer Science or related field.
Nice to have: AWS, Redis, CI/CD pipelines, Celery.`;

export default function DevConsole() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not signed in");
        const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        if (error) throw new Error("No profile row: " + error.message);
        setProfile(data as Profile);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-8 space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Backend test console</h1>
          <p className="text-sm text-muted-foreground">Exercises the real API routes and Gemini calls.</p>
        </div>
        <LogoutButton />
      </header>

      {loading && <p className="text-sm text-muted-foreground">Loading profile…</p>}
      {error && <ErrorBox message={error} />}
      {profile && (
        <Card>
          <CardContent className="pt-6 flex flex-wrap items-center gap-3 text-sm">
            <span>{profile.email}</span>
            <Badge>{profile.role}</Badge>
            <span className="text-muted-foreground">
              {profile.role === "candidate"
                ? "Candidate tools below. Sign in as a recruiter to test jobs."
                : "Recruiter tools below. Sign in as a candidate to test resumes."}
            </span>
          </CardContent>
        </Card>
      )}

      {profile?.role === "candidate" && <ResumeSection />}
      {profile?.role === "recruiter" && <JobsSection />}
    </main>
  );
}

// ---------------------------------------------------------------- Candidate: resume
function ResumeSection() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [result, setResult] = useState<ParseResumeResponse | null>(null);

  useEffect(() => {
    getMyResume()
      .then((r) => {
        if (!r) return;
        setResumeId(r.id);
        setResult({ parsed: r.parsed, parse_status: r.parse_status, error: r.parse_error ?? undefined });
      })
      .catch((e) => setError(e.message));
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resume upload &amp; parse</CardTitle>
        <CardDescription>RES-1..8 · uploads to the private bucket, then calls /api/resume/parse</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <Input type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <Button
            disabled={!file || busy}
            onClick={() =>
              run(async () => {
                const r = await uploadResume(file!);
                setResumeId(r.resumeId);
                setResult(r);
              })
            }
          >
            {busy ? "Working…" : "Upload & parse"}
          </Button>
          {resumeId && result?.parse_status !== "success" && (
            <Button variant="outline" disabled={busy} onClick={() => run(async () => setResult(await parseResume(resumeId)))}>
              Retry parse
            </Button>
          )}
        </div>
        {busy && <p className="text-sm text-muted-foreground">Extracting text and calling Gemini — this takes ~10–30 s.</p>}
        {error && <ErrorBox message={error} />}
        {result && (
          <div className="space-y-2">
            <div className="text-sm">
              Status: <Badge variant={result.parse_status === "success" ? "default" : "destructive"}>{result.parse_status}</Badge>
            </div>
            {result.error && <ErrorBox message={result.error} />}
            {result.parsed && <ParsedView parsed={result.parsed} />}
          </div>
        )}
        {!result && !busy && <p className="text-sm text-muted-foreground">No resume uploaded yet.</p>}
      </CardContent>
    </Card>
  );
}

function ParsedView({ parsed }: { parsed: ParsedResume }) {
  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="font-semibold">{parsed.name ?? "(no name)"}</p>
        <p className="text-muted-foreground">
          {[parsed.contact.email, parsed.contact.phone, parsed.contact.location].filter(Boolean).join(" · ")}
        </p>
        {parsed.total_experience_years != null && <p>Experience: {parsed.total_experience_years} years</p>}
      </div>

      <Section title={`Skills (${parsed.skills.length})`}>
        <ul className="space-y-1">
          {parsed.skills.map((s) => (
            <li key={s.name} className="flex flex-wrap items-start gap-2">
              <Badge variant="secondary">{s.name}</Badge>
              <VerifiedBadge verified={s.verified} />
              <span className="text-muted-foreground italic">“{s.excerpt}”</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={`Experience (${parsed.experience.length})`}>
        {parsed.experience.map((e, i) => (
          <div key={i} className="mb-2">
            <div className="font-medium">
              {e.title}
              {e.company && ` · ${e.company}`} <span className="text-muted-foreground">{[e.start, e.end].filter(Boolean).join(" – ")}</span>{" "}
              <VerifiedBadge verified={e.verified} />
            </div>
            <p className="text-muted-foreground">{e.description}</p>
          </div>
        ))}
      </Section>

      <Section title={`Projects (${parsed.projects.length})`}>
        {parsed.projects.map((p, i) => (
          <div key={i} className="mb-2">
            <div className="font-medium">
              {p.name} <VerifiedBadge verified={p.verified} />
            </div>
            <p className="text-muted-foreground">{p.description}</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {p.technologies.map((t) => (
                <Badge key={t} variant="outline">{t}</Badge>
              ))}
            </div>
          </div>
        ))}
      </Section>

      <Section title={`Education (${parsed.education.length})`}>
        {parsed.education.map((e, i) => (
          <div key={i}>
            {[e.degree, e.field].filter(Boolean).join(", ")} — {e.institution} <VerifiedBadge verified={e.verified} />
          </div>
        ))}
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------- Recruiter: jobs
function JobsSection() {
  const [title, setTitle] = useState("Backend Developer");
  const [description, setDescription] = useState(DEMO_JD);
  const [extracted, setExtracted] = useState<JobExtraction | null>(null);
  const [jobs, setJobs] = useState<JobWithCounts[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    getRecruiterJobs().then(setJobs).catch((e) => setError(e.message));
  }, []);
  useEffect(refresh, [refresh]);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Create job with AI extraction</CardTitle>
          <CardDescription>JOB-7 · /api/job/extract, then JOB-1/8 · POST /api/jobs (embeds server-side)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">Description</Label>
            <textarea
              id="desc"
              rows={7}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={!!busy}
              onClick={() => run("extract", async () => setExtracted(await extractJobRequirements(description)))}
            >
              {busy === "extract" ? "Extracting…" : "Extract with AI"}
            </Button>
            <Button
              variant="secondary"
              disabled={!!busy || !extracted || !title.trim()}
              onClick={() =>
                run("create", async () => {
                  await createJob({ title, description, type: "full-time", ...extracted! });
                  setExtracted(null);
                  refresh();
                })
              }
            >
              {busy === "create" ? "Publishing…" : "Publish job"}
            </Button>
          </div>
          {error && <ErrorBox message={error} />}

          {extracted && (
            <div className="rounded-md border p-4 space-y-3 text-sm">
              <p className="font-semibold">Extracted requirements (review before publishing)</p>
              <SkillList label="Required" skills={extracted.required_skills} />
              <SkillList label="Preferred" skills={extracted.preferred_skills} />
              <p>Min experience: {extracted.min_experience_years} years</p>
              <p>Qualifications: {extracted.qualifications.join("; ") || "—"}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My jobs</CardTitle>
          <CardDescription>JOB-3/6 · applicant counts from the jobs_with_counts view</CardDescription>
        </CardHeader>
        <CardContent>
          {jobs === null && !error && <p className="text-sm text-muted-foreground">Loading…</p>}
          {jobs?.length === 0 && <p className="text-sm text-muted-foreground">No jobs yet — create one above.</p>}
          <ul className="divide-y">
            {jobs?.map((j) => (
              <li key={j.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                <div className="space-y-1">
                  <div className="font-medium">
                    {j.title} <Badge variant={j.status === "open" ? "default" : "outline"}>{j.status}</Badge>
                  </div>
                  <p className="text-muted-foreground">
                    {j.applicant_count} applicants · {j.shortlisted_count} shortlisted ·{" "}
                    {j.required_skills.map((s) => `${s.name} (${s.importance})`).join(", ")}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!!busy}
                  onClick={() =>
                    run("status", async () => {
                      await setJobStatus(j.id, j.status === "open" ? "closed" : "open");
                      refresh();
                    })
                  }
                >
                  {j.status === "open" ? "Close" : "Reopen"}
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------- bits
function SkillList({ label, skills }: { label: string; skills: { name: string; importance: number }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-20 text-muted-foreground">{label}</span>
      {skills.length === 0 && <span className="text-muted-foreground">—</span>}
      {skills.map((s) => (
        <Badge key={s.name} variant="secondary">
          {s.name} · {s.importance}
        </Badge>
      ))}
    </div>
  );
}

function VerifiedBadge({ verified }: { verified: boolean }) {
  return verified ? (
    <Badge variant="outline" className="inline-flex border-green-600 text-green-700 dark:text-green-400">Verified</Badge>
  ) : (
    <Badge variant="outline" className="border-amber-500 text-amber-600">⚠ Unverified</Badge>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-semibold mb-1">{title}</p>
      {children}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return <p className="rounded-md border border-red-300 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300">{message}</p>;
}
