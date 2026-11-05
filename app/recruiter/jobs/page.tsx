"use client";

import Link from "next/link";
import { MapPin, Plus, Users } from "lucide-react";
import { getRecruiterJobs, setJobStatus } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Hero, JobMark, Skeleton, stagger } from "@/components/app/kit";
import { Empty, ErrorState, useAction, useAsync } from "@/components/app/states";
import { cn } from "@/lib/utils";

export default function RecruiterJobs() {
  const { data: jobs, error, loading, reload } = useAsync(getRecruiterJobs);
  const action = useAction();
  const newBtn = <Button asChild><Link href="/recruiter/jobs/new"><Plus className="h-4 w-4" /> New job</Link></Button>;
  const open = jobs?.filter((j) => j.status === "open").length ?? 0;

  return (
    <>
      <Hero eyebrow="Vacancies" title="Jobs" art="jobs" actions={newBtn}
        description={jobs ? `${open} open · ${jobs.length - open} closed · ${jobs.reduce((t, j) => t + j.applicant_count, 0)} applicants in total` : "Your vacancies and applicant counts."} />
      {loading && !jobs && <div className="grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-44" />)}</div>}
      {error && <ErrorState message={error} onRetry={reload} />}
      {action.error && <ErrorState message={action.error} />}
      {jobs?.length === 0 && <Empty art="jobs" title="No jobs yet" action={newBtn}>Create your first vacancy to start receiving applications.</Empty>}
      <div className="grid gap-4 md:grid-cols-2">
        {jobs?.map((j, i) => {
          const rate = j.applicant_count ? Math.round((j.shortlisted_count / j.applicant_count) * 100) : 0;
          return (
            <div key={j.id} style={stagger(i)} className={cn("dash-card rounded-2xl border border-border bg-surface p-5", j.status === "closed" && "opacity-70")}>
              <div className="flex items-start gap-4">
                <JobMark title={j.title} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/recruiter/jobs/${j.id}`} className="font-heading text-lg font-semibold hover:text-primary">{j.title}</Link>
                    <span className={cn("rounded-full border px-2 py-0.5 text-xs", j.status === "open" ? "border-matched/50 text-matched" : "border-border text-muted-foreground")}>{j.status}</span>
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{[j.location, j.type, j.department].filter(Boolean).join(" · ")}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {j.required_skills.slice(0, 5).map((s) => <span key={s.name} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{s.name}</span>)}
                {!j.required_skills.length && <span className="text-xs text-muted-foreground">No skills set</span>}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <Stat value={j.applicant_count} label="Applicants" />
                <Stat value={j.shortlisted_count} label="Shortlisted" tone="text-matched" />
                <Stat value={`${rate}%`} label="Shortlist rate" />
              </div>
              <div className="mt-4 flex gap-2">
                <Button asChild size="sm" className="flex-1"><Link href={`/recruiter/jobs/${j.id}`}><Users className="h-4 w-4" /> Applicants</Link></Button>
                <Button size="sm" variant="outline" disabled={!!action.busy}
                  onClick={() => action.run(j.id, async () => { await setJobStatus(j.id, j.status === "open" ? "closed" : "open"); await reload(); })}>
                  {j.status === "open" ? "Close" : "Reopen"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Stat({ value, label, tone }: { value: number | string; label: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-secondary/60 py-2">
      <p className={cn("font-heading text-xl font-bold", tone)}>{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
