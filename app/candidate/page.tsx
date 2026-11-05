"use client";

import Link from "next/link";
import { ArrowRight, CalendarClock, FileText, Sparkles } from "lucide-react";
import { getMyApplications, getMyInterviews, getMyResume, getRecommendations } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/app/badges";
import { Empty, ErrorState, Loading, PageHeader, useAsync } from "@/components/app/states";

export default function CandidateDashboard() {
  const { data, error, loading, reload } = useAsync(async () => {
    const [resume, apps, interviews] = await Promise.all([getMyResume(), getMyApplications(), getMyInterviews()]);
    return { resume, apps, interviews };
  });

  if (loading) return <Loading />;
  if (error || !data) return <ErrorState message={error ?? "Could not load"} onRetry={reload} />;
  const { resume, apps, interviews } = data;
  // Upcoming first (soonest), then past/completed (most recent). Cancelled ones are hidden.
  const now = Date.now();
  const shown = interviews
    .filter((i) => i.status !== "cancelled")
    .sort((a, b) => {
      const ta = new Date(a.scheduled_at).getTime(), tb = new Date(b.scheduled_at).getTime();
      const ua = a.status === "scheduled" && ta >= now, ub = b.status === "scheduled" && tb >= now;
      return ua !== ub ? (ua ? -1 : 1) : ua ? ta - tb : tb - ta;
    })
    .slice(0, 3);

  return (
    <>
      <PageHeader title="Your dashboard" description="Track your resume, applications and interviews." />
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4 text-primary" /> Resume</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {!resume ? (
              <p className="text-muted-foreground">No resume uploaded yet.</p>
            ) : (
              <p>
                {resume.file_name} · <span className={resume.parse_status === "success" ? "text-matched" : "text-missing"}>{resume.parse_status}</span>
                {resume.is_verified && <span className="text-matched"> · reviewed by you</span>}
              </p>
            )}
            <Button asChild size="sm" variant={resume ? "outline" : "default"}>
              <Link href="/candidate/resume">{resume ? "Review resume" : "Upload resume"}</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Applications</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <p className="font-heading text-3xl font-bold">{apps.length}</p>
            <p className="text-muted-foreground">{apps.filter((a) => ["shortlisted", "interview", "selected"].includes(a.status)).length} progressed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="h-4 w-4 text-primary" /> Interviews</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {shown.length === 0 && <p className="text-muted-foreground">None scheduled yet.</p>}
            {shown.map((i) => {
              const upcoming = i.status === "scheduled" && new Date(i.scheduled_at).getTime() >= now;
              return (
                <div key={i.id} className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{i.job_title}</p>
                    <p className="text-xs text-muted-foreground">{i.type} · {new Date(i.scheduled_at).toLocaleString()} · {i.duration_min} min</p>
                  </div>
                  <span className={upcoming ? "rounded-full bg-matched/15 px-2 py-0.5 text-xs text-matched" : "rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground"}>
                    {upcoming ? "Upcoming" : i.status === "done" ? "Completed" : "Past"}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Recommended />

      <h2 className="mb-3 mt-8 text-lg font-semibold">Recent applications</h2>
      {apps.length === 0 ? (
        <Empty title="No applications yet" action={<Button asChild><Link href="/candidate/jobs">Browse jobs <ArrowRight className="h-4 w-4" /></Link></Button>}>
          Upload your resume, then apply to an open role.
        </Empty>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border">
          {apps.slice(0, 5).map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 p-4 text-sm">
              <span className="font-medium">{a.job_title}</span>
              <StatusBadge status={a.status} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Recommended() {
  const { data, error, loading, reload } = useAsync(getRecommendations);
  return (
    <section className="mt-8">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold"><Sparkles className="h-4 w-4 text-primary" /> Recommended for you</h2>
      <p className="mb-3 text-sm text-muted-foreground">Ranked by your verified skills, project experience, interests and resume meaning.</p>
      {loading && <Loading className="py-4" />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data?.needsResume && <Empty title="Upload your resume to get recommendations" action={<Button asChild size="sm"><Link href="/candidate/resume">Upload resume</Link></Button>} />}
      {data && !data.needsResume && data.jobs.length === 0 && <Empty title="No new jobs to recommend">You&apos;ve applied to every open role. Check back soon.</Empty>}
      <div className="grid gap-3 md:grid-cols-2">
        {data?.jobs.map((r) => (
          <Link key={r.job.id} href={`/candidate/jobs/${r.job.id}`} className="dash-card rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary/60">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-heading font-semibold">{r.job.title}</p>
                <p className="text-xs text-muted-foreground">{[r.job.location, r.job.type].filter(Boolean).join(" · ")}</p>
              </div>
              <span className="rounded-lg border border-matched/50 px-2 py-0.5 font-heading text-lg font-bold text-matched">{r.score}</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{r.reason}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
