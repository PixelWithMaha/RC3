"use client";

import Link from "next/link";
import { MapPin } from "lucide-react";
import { getOpenJobs } from "@/lib/api";
import { Empty, ErrorState, Loading, PageHeader, useAsync } from "@/components/app/states";

export default function CandidateJobs() {
  const { data: jobs, error, loading, reload } = useAsync(getOpenJobs);
  return (
    <>
      <PageHeader title="Open jobs" description="Apply with your parsed resume. You'll get an AI relevance assessment; a recruiter makes every decision." />
      {loading && <Loading />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {jobs?.length === 0 && <Empty title="No open jobs right now">Check back soon.</Empty>}
      <div className="grid gap-4 md:grid-cols-2">
        {jobs?.map((j) => (
          <Link key={j.id} href={`/candidate/jobs/${j.id}`} className="rounded-xl border border-border bg-surface p-5 transition-colors hover:border-primary/60">
            <p className="font-heading text-lg font-semibold">{j.title}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" /> {[j.location, j.type, j.department].filter(Boolean).join(" · ")}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {j.required_skills.map((s) => (
                <span key={s.name} className="rounded-full border border-border px-2 py-0.5 text-xs">{s.name}</span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
