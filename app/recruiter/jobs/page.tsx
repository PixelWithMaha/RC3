"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { getRecruiterJobs, setJobStatus } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Empty, ErrorState, Loading, PageHeader, useAction, useAsync } from "@/components/app/states";
import { cn } from "@/lib/utils";

export default function RecruiterJobs() {
  const { data: jobs, error, loading, reload } = useAsync(getRecruiterJobs);
  const action = useAction();
  const newBtn = <Button asChild><Link href="/recruiter/jobs/new"><Plus className="h-4 w-4" /> New job</Link></Button>;
  return (
    <>
      <PageHeader title="Jobs" description="Your vacancies and applicant counts." actions={newBtn} />
      {loading && !jobs && <Loading />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {action.error && <ErrorState message={action.error} />}
      {jobs?.length === 0 && <Empty title="No jobs yet" action={newBtn}>Create your first vacancy to start receiving applications.</Empty>}
      {!!jobs?.length && (
        <div className="divide-y divide-border rounded-xl border border-border bg-surface">
          {jobs.map((j) => (
            <div key={j.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <Link href={`/recruiter/jobs/${j.id}`} className="min-w-0 flex-1">
                <p className="font-medium hover:text-primary">{j.title}</p>
                <p className="truncate text-xs text-muted-foreground">{j.required_skills.map((s) => s.name).join(", ") || "No skills set"}</p>
              </Link>
              <div className="flex items-center gap-4 text-sm">
                <span><b>{j.applicant_count}</b> <span className="text-muted-foreground">applicants</span></span>
                <span><b>{j.shortlisted_count}</b> <span className="text-muted-foreground">shortlisted</span></span>
                <span className={cn("rounded-full border px-2 py-0.5 text-xs", j.status === "open" ? "border-matched/50 text-matched" : "border-border text-muted-foreground")}>{j.status}</span>
                <Button size="sm" variant="outline" disabled={!!action.busy}
                  onClick={() => action.run(j.id, async () => { await setJobStatus(j.id, j.status === "open" ? "closed" : "open"); await reload(); })}>
                  {j.status === "open" ? "Close" : "Reopen"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
