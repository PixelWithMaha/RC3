"use client";

import Link from "next/link";
import { useState } from "react";
import { getMyApplicationTimeline, getMyApplications, getMyInterviews } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { StatusBadge, statusLabel } from "@/components/app/badges";
import { Empty, ErrorState, Loading, PageHeader, useAsync } from "@/components/app/states";

export default function MyApplications() {
  const { data, error, loading, reload } = useAsync(async () => {
    const [apps, interviews] = await Promise.all([getMyApplications(), getMyInterviews()]);
    return { apps, interviews };
  });

  if (loading) return <Loading />;
  if (error || !data) return <ErrorState message={error ?? "Could not load"} onRetry={reload} />;

  return (
    <>
      <PageHeader title="My applications" description="Every status change is made by a recruiter — the AI only assesses relevance." />
      {data.apps.length === 0 ? (
        <Empty title="No applications yet" action={<Button asChild><Link href="/candidate/jobs">Browse jobs</Link></Button>} />
      ) : (
        <div className="space-y-3">
          {data.apps.map((a) => (
            <AppRow key={a.id} id={a.id} title={a.job_title} status={a.status} createdAt={a.created_at}
              interviews={data.interviews.filter((i) => i.application_id === a.id)} />
          ))}
        </div>
      )}
    </>
  );
}

function AppRow({ id, title, status, createdAt, interviews }: {
  id: string; title: string; status: Parameters<typeof StatusBadge>[0]["status"]; createdAt: string;
  interviews: Awaited<ReturnType<typeof getMyInterviews>>;
}) {
  const [open, setOpen] = useState(false);
  const [timeline, setTimeline] = useState<Awaited<ReturnType<typeof getMyApplicationTimeline>> | null>(null);
  return (
    <div className="rounded-xl border border-border bg-surface p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">Applied {new Date(createdAt).toLocaleDateString()}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          <Button size="sm" variant="ghost" onClick={() => {
            setOpen((o) => !o);
            if (!timeline) getMyApplicationTimeline(id).then(setTimeline).catch(() => setTimeline([]));
          }}>
            {open ? "Hide" : "History"}
          </Button>
        </div>
      </div>
      {interviews.map((i) => (
        <p key={i.id} className="mt-2 text-xs text-matched">
          {i.type} interview · {new Date(i.scheduled_at).toLocaleString()} · {i.duration_min} min · {i.status}
        </p>
      ))}
      {open && (
        <ol className="mt-3 space-y-1 border-l border-border pl-4 text-xs">
          {!timeline && <li className="text-muted-foreground">Loading…</li>}
          {timeline?.map((t, i) => (
            <li key={i}><span className="text-foreground">{statusLabel(t.to_status)}</span> <span className="text-muted-foreground">· {new Date(t.created_at).toLocaleString()}</span></li>
          ))}
        </ol>
      )}
    </div>
  );
}
