"use client";

import Link from "next/link";
import { getInterviews } from "@/lib/api";
import { Empty, ErrorState, Loading, PageHeader, useAsync } from "@/components/app/states";
import { cn } from "@/lib/utils";

export default function RecruiterInterviews() {
  const { data, error, loading, reload } = useAsync(() => getInterviews());
  const now = new Date();
  return (
    <>
      <PageHeader title="Interviews" description="All scheduled interviews across your jobs." />
      {loading && <Loading />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data?.length === 0 && <Empty title="No interviews scheduled">Shortlist a candidate, then schedule from their application page.</Empty>}
      {!!data?.length && (
        <div className="divide-y divide-border rounded-xl border border-border bg-surface">
          {data.map((i) => (
            <Link key={i.id} href={`/recruiter/applications/${i.application_id}`} className={cn("flex flex-wrap items-center justify-between gap-3 p-4 text-sm hover:bg-secondary/40", new Date(i.scheduled_at) < now && "opacity-70")}>
              <div>
                <p className="font-medium">{i.candidate_name ?? "Candidate"} · {i.job_title}</p>
                <p className="text-xs text-muted-foreground">{i.type} · {i.interviewer_name} · {i.duration_min} min</p>
              </div>
              <div className="text-right">
                <p>{new Date(i.scheduled_at).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{i.status}{i.feedback ? " · feedback recorded" : ""}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
