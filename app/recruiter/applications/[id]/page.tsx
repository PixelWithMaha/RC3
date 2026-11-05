"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { getApplication, getJob, getResumeFileUrl, rescoreApplication } from "@/lib/api";
import { Avatar, ScoreRing } from "@/components/app/kit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/app/badges";
import { ErrorState, Loading, useAction, useAsync } from "@/components/app/states";
import { AuditCard, EvidenceCard, FairnessCard, InterviewsCard, NotesCard, QuestionsCard, RequirementsVsEvidence, ScoreCard, StatusActions } from "@/components/app/application-panels";

export default function ApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: app, error, loading, reload } = useAsync(() => getApplication(id), [id]);
  const job = useAsync(async () => (app?.job_id ? getJob(app.job_id) : null), [app?.job_id]);
  const [version, setVersion] = useState(0);
  const rescore = useAction();
  const changed = () => { reload(); setVersion((v) => v + 1); };

  if (loading && !app) return <Loading />;
  if (error || !app) return <ErrorState message={error ?? "Application not found"} onRetry={reload} />;

  return (
    <>
      <Link href={`/recruiter/jobs/${app.job_id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {app.job_title}
      </Link>
      <section className="dash-card relative mb-6 overflow-hidden rounded-[20px] border border-border bg-surface px-6 py-5">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-5">
          <Avatar name={app.candidate_name ?? app.candidate_email} size={60} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold sm:text-3xl">{app.candidate_name ?? app.candidate_email ?? "Candidate"}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {app.job_title} · applied {new Date(app.created_at).toLocaleDateString()} · <StatusBadge status={app.status} />
            </p>
          </div>
          <ScoreRing value={app.effective_score} size={84} label={app.override_score != null ? "override" : "relevance"} />
          {app.resume && (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                // Open the tab synchronously (popup blockers), then point it at the signed URL.
                const tab = window.open("", "_blank");
                try {
                  const url = await getResumeFileUrl(app.resume!.file_path);
                  if (tab) tab.location.href = url;
                  else window.location.href = url;
                } catch (e) {
                  tab?.close();
                  alert("Could not open the resume: " + (e as Error).message);
                }
              }}
            >
              View resume
            </Button>
          )}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-4">
          {rescore.error && <ErrorState message={rescore.error} />}
          <ScoreCard app={app} rescoring={!!rescore.busy} onChanged={changed}
            onRescore={() => rescore.run("rescore", async () => { await rescoreApplication(app.id); changed(); })} />
          {job.data && <RequirementsVsEvidence app={app} job={job.data} />}
          <EvidenceCard app={app} />
          <FairnessCard applicationId={app.id} />
          <QuestionsCard applicationId={app.id} />
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Decision</CardTitle></CardHeader>
            <CardContent><StatusActions app={app} onChanged={changed} /></CardContent>
          </Card>
          <InterviewsCard app={app} onChanged={changed} />
          <NotesCard applicationId={app.id} />
          <AuditCard applicationId={app.id} version={version} />
        </div>
      </div>
    </>
  );
}
