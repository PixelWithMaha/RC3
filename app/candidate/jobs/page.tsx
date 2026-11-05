"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, MapPin, Search } from "lucide-react";
import { getMyApplications, getMyResume, getOpenJobs } from "@/lib/api";
import { recommendJobs } from "@/lib/talent";
import { JOB_TYPES } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FitMeter, Hero, JobMark, Skeleton, stagger } from "@/components/app/kit";
import { Empty, ErrorState } from "@/components/app/states";

export default function CandidateJobs() {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [data, setData] = useState<Awaited<ReturnType<typeof load>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { load().then(setData).catch((e) => setError(e.message)); }, []);

  const jobs = (data?.jobs ?? []).filter((j) =>
    (!type || j.type === type) &&
    `${j.title} ${j.department ?? ""} ${j.location ?? ""} ${j.required_skills.map((s) => s.name).join(" ")}`.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <>
      <Hero eyebrow="Open roles" title="Find a job that fits your evidence"
        description="Your fit is estimated from the skills your resume actually proves. A recruiter makes every decision."
        art="jobs" />
      <div className="mb-5 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search title, skill or location" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search jobs" />
        </div>
        <Select className="w-44" value={type} onChange={(e) => setType(e.target.value)} aria-label="Job type">
          <option value="">All types</option>
          {JOB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
      </div>
      {error && <ErrorState message={error} />}
      {!data && !error && <div className="grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}</div>}
      {data && jobs.length === 0 && <Empty art="jobs" title={data.jobs.length ? "No jobs match your search" : "No open jobs right now"}>{data.jobs.length ? "Try a different keyword or type." : "Check back soon."}</Empty>}
      <div className="grid gap-4 md:grid-cols-2">
        {jobs.map((j, i) => {
          const fit = data?.fit.get(j.id);
          const applied = data?.applied.has(j.id);
          return (
            <Link key={j.id} href={`/candidate/jobs/${j.id}`} style={stagger(i)}
              className="dash-card group rounded-2xl border border-border bg-surface p-5 hover:border-primary/60">
              <div className="flex items-start gap-4">
                <JobMark title={j.title} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-heading text-lg font-semibold group-hover:text-primary">{j.title}</p>
                    {applied && <span className="rounded-full bg-matched/15 px-2 py-0.5 text-xs text-matched">Applied</span>}
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {[j.location, j.type, j.department].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {j.required_skills.slice(0, 6).map((s) => {
                  const has = fit?.matched.some((m) => m.toLowerCase() === s.name.toLowerCase());
                  return <span key={s.name} className={has ? "rounded-full border border-matched/50 bg-matched/10 px-2 py-0.5 text-xs text-matched" : "rounded-full border border-border px-2 py-0.5 text-xs"}>{has && "✓ "}{s.name}</span>;
                })}
              </div>
              {fit && (
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs"><span className="text-muted-foreground">Your fit</span><span className="font-mono">{fit.score}%</span></div>
                  <FitMeter pct={fit.score} />
                </div>
              )}
              <span className="mt-4 inline-flex items-center gap-1 text-sm text-primary">View role <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
            </Link>
          );
        })}
      </div>
    </>
  );
}

async function load() {
  const [jobs, resume, apps] = await Promise.all([getOpenJobs(), getMyResume(), getMyApplications()]);
  const fit = new Map<string, { score: number; matched: string[] }>();
  if (resume?.parsed) for (const r of recommendJobs(jobs, { parsed: resume.parsed, raw_text: resume.raw_text })) fit.set(r.job.id, { score: r.fit, matched: r.matched });
  return { jobs, fit, applied: new Set(apps.map((a) => a.job_id)) };
}
