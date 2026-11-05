"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { getApplication, getResumeFileUrl, rescoreApplication } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/app/badges";
import { ErrorState, Loading, useAction, useAsync } from "@/components/app/states";
import { AuditCard, EvidenceCard, InterviewsCard, NotesCard, QuestionsCard, ScoreCard, StatusActions } from "@/components/app/application-panels";

export default function ApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: app, error, loading, reload } = useAsync(() => getApplication(id), [id]);
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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{app.candidate_name ?? app.candidate_email ?? "Candidate"}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            Applied {new Date(app.created_at).toLocaleDateString()} · <StatusBadge status={app.status} />
          </p>
        </div>
        {app.resume && (
          <Button variant="outline" size="sm" onClick={async () => window.open(await getResumeFileUrl(app.resume!.file_path), "_blank")}>
            View resume PDF
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-4">
          {rescore.error && <ErrorState message={rescore.error} />}
          <ScoreCard app={app} rescoring={!!rescore.busy} onChanged={changed}
            onRescore={() => rescore.run("rescore", async () => { await rescoreApplication(app.id); changed(); })} />
          <EvidenceCard app={app} />
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
