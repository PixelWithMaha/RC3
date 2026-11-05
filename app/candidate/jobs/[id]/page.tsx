"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, MapPin, Wallet, Wand2 } from "lucide-react";
import { applyToJob, getJob, getMyApplications, getMyResume } from "@/lib/api";
import { computeFit } from "@/lib/ai/fit";
import type { Job, Resume } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/app/badges";
import { Hero, JobMark, PipelineStepper, ScoreRing, stagger } from "@/components/app/kit";
import { ErrorState, Loading, useAction, useAsync } from "@/components/app/states";
import { cn } from "@/lib/utils";

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading, reload } = useAsync(async () => {
    const [job, apps, resume] = await Promise.all([getJob(id), getMyApplications(), getMyResume()]);
    return { job, app: apps.find((a) => a.job_id === id) ?? null, resume };
  }, [id]);
  const action = useAction();
  const [note, setNote] = useState<string | null>(null);

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorState message={error ?? "Could not load"} onRetry={reload} />;
  const { job, app, resume } = data;
  if (!job) return <ErrorState message="This job is not available." />;
  const canApply = resume?.parse_status === "success";
  const salary = job.salary_min || job.salary_max ? `${(job.salary_min ?? 0).toLocaleString()} – ${(job.salary_max ?? 0).toLocaleString()}` : null;

  return (
    <>
      <Link href="/candidate/jobs" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> All jobs</Link>
      <Hero
        eyebrow={job.department ?? "Open role"}
        title={<span className="flex items-center gap-3"><JobMark title={job.title} size={40} />{job.title}</span>}
        description={
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{[job.location, job.type].filter(Boolean).join(" · ")}</span>
            {salary && <span className="inline-flex items-center gap-1"><Wallet className="h-3.5 w-3.5" />{salary}</span>}
            <span>{job.min_experience_years}+ years</span>
          </span>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {resume?.parsed && <FitComparison job={job} resume={resume} />}
          <section style={stagger(2)} className="dash-card rounded-2xl border border-border bg-surface p-6 text-sm">
            <h2 className="mb-2 font-heading text-lg font-semibold">About the role</h2>
            <p className="whitespace-pre-line leading-relaxed text-muted-foreground">{job.description || "No description."}</p>
            {job.qualifications.length > 0 && (
              <><h3 className="mb-1 mt-4 font-semibold">Qualifications</h3><ul className="list-disc pl-5 text-muted-foreground">{job.qualifications.map((q) => <li key={q}>{q}</li>)}</ul></>
            )}
          </section>
        </div>
        <aside style={stagger(1)} className="dash-card h-fit space-y-4 rounded-2xl border border-border bg-surface p-5 text-sm lg:sticky lg:top-24">
          <h2 className="font-heading text-lg font-semibold">Apply</h2>
          {app ? (
            <>
              <p className="flex items-center gap-2 text-matched"><CheckCircle2 className="h-4 w-4" /> You applied {new Date(app.created_at).toLocaleDateString()}</p>
              <p className="flex items-center gap-2">Status: <StatusBadge status={app.status} /></p>
              <PipelineStepper status={app.status} vertical />
              <Button asChild variant="outline" size="sm" className="w-full"><Link href="/candidate/applications">Track application</Link></Button>
            </>
          ) : !canApply ? (
            <>
              <p className="text-muted-foreground">Upload and parse your resume first.</p>
              <Button asChild size="sm" className="w-full"><Link href="/candidate/resume">Go to resume</Link></Button>
            </>
          ) : (
            <>
              <p className="text-muted-foreground">We send only your resume evidence — never your name, contact or personal details — for an AI relevance check. A recruiter decides.</p>
              <Button className="w-full" disabled={!!action.busy}
                onClick={() => action.run("apply", async () => {
                  const r = await applyToJob(job.id);
                  setNote(r.matchError ? "Applied. The AI assessment will be retried by the recruiter." : "Applied and assessed.");
                  await reload();
                })}>
                {action.busy ? "Submitting & assessing…" : "Apply now"}
              </Button>
            </>
          )}
          {canApply && (
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href={`/candidate/coach?job=${job.id}`}><Wand2 className="h-4 w-4" /> Tailor my resume for this job</Link>
            </Button>
          )}
          {note && <p className="text-xs text-muted-foreground">{note}</p>}
          {action.error && <ErrorState message={action.error} />}
        </aside>
      </div>
    </>
  );
}

/** Side by side: what the job requires ↔ what your resume shows (computed from real resume evidence). */
function FitComparison({ job, resume }: { job: Job; resume: Resume }) {
  const { fit, rows } = computeFit(job, resume.parsed!, resume.raw_text);

  return (
    <section style={stagger(0)} className="dash-card rounded-2xl border border-border bg-surface p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-lg font-semibold">Your fit, side by side</h2>
          <p className="text-sm text-muted-foreground">What the job asks for, next to the exact lines in your resume.</p>
        </div>
        <ScoreRing value={fit} size={68} label="fit" />
      </div>
      <div className="hidden grid-cols-2 gap-3 pb-2 text-[11px] uppercase tracking-wider text-muted-foreground sm:grid">
        <span>Job requires</span><span>Your resume shows</span>
      </div>
      <div className="space-y-2">
        {rows.map(({ req, ev, related }, i) => (
          <div key={req.name} style={stagger(i + 2, 50)} className="dash-slide grid gap-2 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background/40 px-3 py-2.5">
              <span className="font-medium">{req.name}{!req.required && <span className="ml-1.5 text-[11px] text-muted-foreground">nice to have</span>}</span>
              <span className="flex gap-0.5" aria-label={`importance ${req.importance} of 5`}>
                {Array.from({ length: 5 }, (_, d) => <i key={d} className={cn("h-1.5 w-1.5 rounded-full", d < req.importance ? "bg-primary" : "bg-secondary")} />)}
              </span>
            </div>
            <div className={cn("rounded-xl border px-3 py-2.5 text-sm",
              ev.tier === "proven" ? "border-matched/40 bg-matched/5" : ev.tier === "listed" || related ? "border-missing/40 bg-missing/5" : "border-dashed border-absent/40 bg-absent/5")}>
              {!ev.best && related?.ev.best ? (
                <>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-missing">≈ Related: {related.skill} · partial credit · {related.ev.best.label}</span>
                  <p className="mt-0.5 line-clamp-2 font-mono text-xs text-foreground/80">{related.ev.best.text}</p>
                </>
              ) : ev.best ? (
                <>
                  <span className={cn("text-[11px] font-semibold uppercase tracking-wider", ev.tier === "proven" ? "text-matched" : "text-missing")}>
                    {ev.tier === "proven" ? "✓ Proven" : "Listed only"} · {ev.best.label}
                  </span>
                  <p className="mt-0.5 line-clamp-2 font-mono text-xs text-foreground/80">{ev.best.text}</p>
                </>
              ) : (
                <span className="text-xs text-absent">Not found in your resume — add proof if you have it</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
