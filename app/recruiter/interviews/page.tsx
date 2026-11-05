"use client";

import Link from "next/link";
import { getInterviews } from "@/lib/api";
import { Avatar, Hero, Skeleton, stagger } from "@/components/app/kit";
import { Empty, ErrorState, useAsync } from "@/components/app/states";
import { cn } from "@/lib/utils";

export default function RecruiterInterviews() {
  const { data, error, loading, reload } = useAsync(() => getInterviews());
  const now = Date.now();
  const active = (data ?? []).filter((i) => i.status !== "cancelled");
  const upcoming = active.filter((i) => i.status === "scheduled" && new Date(i.scheduled_at).getTime() >= now);
  const past = active.filter((i) => !upcoming.includes(i)).reverse();
  const groups = (list: typeof active) => {
    const m = new Map<string, typeof active>();
    for (const i of list) {
      const k = new Date(i.scheduled_at).toDateString();
      m.set(k, [...(m.get(k) ?? []), i]);
    }
    return [...m.entries()];
  };
  let k = 0;

  return (
    <>
      <Hero eyebrow="Schedule" title="Interviews" art="calendar"
        description={data ? `${upcoming.length} upcoming · ${past.length} completed or past` : "All interviews across your jobs."} />
      {loading && !data && <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && active.length === 0 && <Empty art="calendar" title="No interviews scheduled">Shortlist a candidate, then schedule from their application page.</Empty>}
      {[["Upcoming", upcoming], ["Past", past]].map(([label, list]) => (list as typeof active).length > 0 && (
        <section key={label as string} className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">{label as string}</h2>
          {groups(list as typeof active).map(([day, items]) => {
            const d = new Date(day);
            return (
              <div key={day} className="mb-4 flex gap-4">
                <div style={stagger(k++)} className="dash-card h-fit min-w-16 rounded-xl border border-border bg-surface py-2 text-center">
                  <p className="text-[11px] uppercase text-muted-foreground">{d.toLocaleDateString("en", { weekday: "short" })}</p>
                  <p className="font-heading text-2xl font-bold">{d.getDate()}</p>
                  <p className="text-[11px] text-muted-foreground">{d.toLocaleDateString("en", { month: "short" })}</p>
                </div>
                <div className="flex-1 space-y-2">
                  {items.map((i) => (
                    <Link key={i.id} href={`/recruiter/applications/${i.application_id}`} style={stagger(k++)}
                      className={cn("dash-card flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-4 hover:border-primary/60", label === "Past" && "opacity-75")}>
                      <Avatar name={i.candidate_name} size={40} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{i.candidate_name ?? "Candidate"} <span className="text-muted-foreground">· {i.job_title}</span></p>
                        <p className="text-xs capitalize text-muted-foreground">{i.type} · with {i.interviewer_name} · {i.duration_min} min</p>
                      </div>
                      <span className="font-mono text-sm">{new Date(i.scheduled_at).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-xs", i.feedback ? "bg-matched/15 text-matched" : i.status === "scheduled" ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground")}>
                        {i.feedback ? "Feedback recorded" : i.status === "scheduled" ? "Scheduled" : i.status}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      ))}
    </>
  );
}
