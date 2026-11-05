"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { applyToJob, getJob, getMyApplications, getMyResume } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/app/badges";
import { ErrorState, Loading, PageHeader, useAction, useAsync } from "@/components/app/states";

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

  return (
    <>
      <PageHeader title={job.title} description={[job.department, job.location, job.type].filter(Boolean).join(" · ")} />
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardContent className="space-y-5 pt-6 text-sm">
            <p className="whitespace-pre-line leading-relaxed text-muted-foreground">{job.description || "No description."}</p>
            <Reqs label="Required skills" skills={job.required_skills} />
            {job.preferred_skills.length > 0 && <Reqs label="Nice to have" skills={job.preferred_skills} />}
            <p><span className="text-muted-foreground">Minimum experience:</span> {job.min_experience_years} years</p>
            {job.qualifications.length > 0 && <p><span className="text-muted-foreground">Qualifications:</span> {job.qualifications.join("; ")}</p>}
          </CardContent>
        </Card>
        <Card className="h-fit">
          <CardHeader><CardTitle className="text-base">Apply</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {app ? (
              <>
                <p className="flex items-center gap-2 text-matched"><CheckCircle2 className="h-4 w-4" /> Applied</p>
                <p>Status: <StatusBadge status={app.status} /></p>
                <Button asChild variant="outline" size="sm"><Link href="/candidate/applications">Track application</Link></Button>
              </>
            ) : !canApply ? (
              <>
                <p className="text-muted-foreground">Upload and parse your resume first.</p>
                <Button asChild size="sm"><Link href="/candidate/resume">Go to resume</Link></Button>
              </>
            ) : (
              <>
                <p className="text-muted-foreground">We&apos;ll send your resume evidence (without name, contact or personal details) for an AI relevance check.</p>
                <Button
                  className="w-full"
                  disabled={!!action.busy}
                  onClick={() => action.run("apply", async () => {
                    const r = await applyToJob(job.id);
                    setNote(r.matchError ? "Applied. AI assessment will be retried by the recruiter." : "Applied and assessed.");
                    await reload();
                  })}
                >
                  {action.busy ? "Submitting & assessing…" : "Apply now"}
                </Button>
              </>
            )}
            {note && <p className="text-xs text-muted-foreground">{note}</p>}
            {action.error && <ErrorState message={action.error} />}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Reqs({ label, skills }: { label: string; skills: { name: string; importance: number }[] }) {
  return (
    <div>
      <p className="mb-2 text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {skills.map((s) => (
          <span key={s.name} className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs text-primary">{s.name}</span>
        ))}
      </div>
    </div>
  );
}
