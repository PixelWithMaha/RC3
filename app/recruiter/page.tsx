"use client";

import Link from "next/link";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Plus } from "lucide-react";
import { getRecruiterAnalytics } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { statusLabel } from "@/components/app/badges";
import { Empty, ErrorState, Loading, PageHeader, useAsync } from "@/components/app/states";

const axis = { stroke: "#8A90A8", fontSize: 12 };
const tooltip = { contentStyle: { background: "#141827", border: "1px solid #272C3F", borderRadius: 8, color: "#E6E8F2" }, cursor: { fill: "rgba(124,92,255,0.08)" } };

export default function RecruiterDashboard() {
  const { data: a, error, loading, reload } = useAsync(getRecruiterAnalytics);
  if (loading && !a) return <Loading />;
  if (error || !a) return <ErrorState message={error ?? "Could not load analytics"} onRetry={reload} />;

  const kpis = [
    { label: "Active jobs", value: a.kpis.activeJobs },
    { label: "Applications", value: a.kpis.totalApplications },
    { label: "Shortlisted", value: a.kpis.shortlisted },
    { label: "Pending review", value: a.kpis.pendingReviews },
    { label: "Upcoming interviews", value: a.kpis.upcomingInterviews },
  ];

  return (
    <>
      <PageHeader title="Recruitment dashboard" actions={<Button asChild><Link href="/recruiter/jobs/new"><Plus className="h-4 w-4" /> New job</Link></Button>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {kpis.map((k) => (
          <Card key={k.label}><CardContent className="pt-5"><p className="text-xs text-muted-foreground">{k.label}</p><p className="font-heading text-3xl font-bold">{k.value}</p></CardContent></Card>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Application → shortlist rate</p><p className="font-heading text-2xl font-bold text-matched">{a.shortlistRate}%</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Avg. processing time (to decision)</p><p className="font-heading text-2xl font-bold">{a.avgProcessingDays == null ? "—" : `${a.avgProcessingDays} days`}</p></CardContent></Card>
      </div>

      {a.kpis.totalApplications === 0 ? (
        <div className="mt-6"><Empty title="No applications yet">Charts appear once candidates apply to your jobs.</Empty></div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Applications by job</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer>
                <BarChart data={a.byJob}>
                  <CartesianGrid stroke="#1F2438" vertical={false} />
                  <XAxis dataKey="title" {...axis} tickLine={false} />
                  <YAxis allowDecimals={false} {...axis} tickLine={false} width={28} />
                  <Tooltip {...tooltip} />
                  <Bar dataKey="applications" name="Applications" fill="#7C5CFF" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="shortlisted" name="Shortlisted" fill="#2DD4BF" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Pipeline by stage</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer>
                <BarChart data={a.byStage.map((s) => ({ ...s, label: statusLabel(s.status) }))} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid stroke="#1F2438" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} {...axis} tickLine={false} />
                  <YAxis type="category" dataKey="label" {...axis} tickLine={false} width={90} />
                  <Tooltip {...tooltip} />
                  <Bar dataKey="count" name="Applications" fill="#7C5CFF" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Common skill gaps</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {a.commonGaps.length === 0 && <p className="text-sm text-muted-foreground">No gaps recorded.</p>}
              {a.commonGaps.map((g) => (
                <div key={g.skill} className="flex items-center gap-3 text-sm">
                  <span className="w-32 truncate">{g.skill}</span>
                  <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div className="bg-missing" style={{ width: `${(g.notMentioned / a.kpis.totalApplications) * 100}%` }} title="Missing evidence" />
                    <div className="bg-absent" style={{ width: `${(g.explicitlyLacking / a.kpis.totalApplications) * 100}%` }} title="Confirmed absence" />
                  </div>
                  <span className="w-32 text-right text-xs text-muted-foreground">{g.notMentioned} missing · {g.explicitlyLacking} absent</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
