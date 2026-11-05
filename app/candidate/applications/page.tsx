"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarClock, ChevronDown } from "lucide-react";
import { getMyApplicationTimeline, getMyApplications, getMyInterviews } from "@/lib/api";
import type { ApplicationStatus, CandidateInterview, RankedApplication } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { StatusBadge, statusLabel } from "@/components/app/badges";
import { Hero, JobMark, PipelineStepper, Skeleton, stagger } from "@/components/app/kit";
import { Empty, ErrorState, useAsync } from "@/components/app/states";
import { cn } from "@/lib/utils";

export default function MyApplications() {
  const { data, error, loading, reload } = useAsync(async () => {
    const [apps, interviews] = await Promise.all([getMyApplications(), getMyInterviews()]);
    return { apps, interviews };
  });

  return (
    <>
      <Hero eyebrow="Your pipeline" title="My applications" description="Every status change is made by a recruiter. The AI only assesses relevance." art="inbox" />
      {loading && !data && <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-36" />)}</div>}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data?.apps.length === 0 && <Empty art="jobs" title="No applications yet" action={<Button asChild><Link href="/candidate/jobs">Browse jobs</Link></Button>}>Find a role that fits your evidence.</Empty>}
      <div className="space-y-3">
        {data?.apps.map((a, i) => <AppRow key={a.id} i={i} app={a} interviews={data.interviews.filter((x) => x.application_id === a.id)} />)}
      </div>
    </>
  );
}

function AppRow({ i, app, interviews }: { i: number; app: RankedApplication; interviews: CandidateInterview[] }) {
  const [open, setOpen] = useState(false);
  const [timeline, setTimeline] = useState<{ to_status: ApplicationStatus; created_at: string }[] | null>(null);
  return (
    <div style={stagger(i)} className="dash-card rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <JobMark title={app.job_title} size={40} />
          <div>
            <Link href={`/candidate/jobs/${app.job_id}`} className="font-heading font-semibold hover:text-primary">{app.job_title}</Link>
            <p className="text-xs text-muted-foreground">Applied {new Date(app.created_at).toLocaleDateString()}</p>
          </div>
        </div>
        <StatusBadge status={app.status} />
      </div>
      <div className="mt-5"><PipelineStepper status={app.status} reached={timeline?.map((t) => t.to_status)} /></div>
      {interviews.map((iv) => {
        const up = iv.status === "scheduled" && new Date(iv.scheduled_at) > new Date();
        return (
          <div key={iv.id} className={cn("mt-4 flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm", up ? "border-matched/40 bg-matched/5" : "border-border")}>
            <CalendarClock className={cn("h-4 w-4", up ? "text-matched" : "text-muted-foreground")} />
            <span className="capitalize">{iv.type} interview</span>
            <span className="text-muted-foreground">{new Date(iv.scheduled_at).toLocaleString()} · {iv.duration_min} min</span>
            <span className={cn("ml-auto rounded-full px-2 py-0.5 text-xs", up ? "bg-matched/15 text-matched" : "bg-secondary text-muted-foreground")}>
              {up ? "Upcoming" : iv.status === "done" ? "Completed" : iv.status}
            </span>
          </div>
        );
      })}
      <button
        className="mt-4 inline-flex items-center gap-1 text-sm text-primary"
        onClick={() => { setOpen((o) => !o); if (!timeline) getMyApplicationTimeline(app.id).then(setTimeline).catch(() => setTimeline([])); }}
      >
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} /> {open ? "Hide history" : "Show history"}
      </button>
      {open && (
        <ol className="mt-3 space-y-2 border-l border-border pl-4 text-xs">
          {!timeline && <li className="text-muted-foreground">Loading…</li>}
          {timeline?.map((t, k) => (
            <li key={k} className="dash-slide relative" style={stagger(k, 80)}>
              <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
              <span className="text-foreground">{statusLabel(t.to_status)}</span> <span className="text-muted-foreground">· {new Date(t.created_at).toLocaleString()}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
