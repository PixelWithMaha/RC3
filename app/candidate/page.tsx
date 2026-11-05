"use client";

import Link from "next/link";
import { ArrowRight, CalendarClock, FileText } from "lucide-react";
import { getMyApplications, getMyInterviews, getMyResume } from "@/lib/api";
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
  const upcoming = interviews.filter((i) => i.status === "scheduled" && new Date(i.scheduled_at) > new Date());

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
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="h-4 w-4 text-primary" /> Upcoming interviews</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {upcoming.length === 0 && <p className="text-muted-foreground">None scheduled.</p>}
            {upcoming.map((i) => (
              <p key={i.id}>{i.job_title} · {new Date(i.scheduled_at).toLocaleString()}</p>
            ))}
          </CardContent>
        </Card>
      </div>

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
