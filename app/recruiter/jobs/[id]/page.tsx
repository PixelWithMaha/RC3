"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Columns3, Pencil } from "lucide-react";
import { getJob, getJobApplicants, type ApplicantFilters } from "@/lib/api";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusBadge, statusLabel } from "@/components/app/badges";
import { Avatar, Hero, ScoreRing, Skeleton, stagger } from "@/components/app/kit";
import { Empty, ErrorState, Loading, useAsync } from "@/components/app/states";
import { cn } from "@/lib/utils";

export default function JobApplicants() {
  const { id } = useParams<{ id: string }>();
  const [filters, setFilters] = useState<ApplicantFilters>({ sort: "score" });
  const [picked, setPicked] = useState<string[]>([]);
  const togglePick = (x: string) => setPicked((p) => (p.includes(x) ? p.filter((y) => y !== x) : p.length >= 4 ? p : [...p, x]));
  const job = useAsync(() => getJob(id), [id]);
  const apps = useAsync(() => getJobApplicants(id, filters), [id, JSON.stringify(filters)]);

  if (job.loading) return <Loading />;
  if (job.error || !job.data) return <ErrorState message={job.error ?? "Job not found"} onRetry={job.reload} />;
  const skills = [...job.data.required_skills, ...job.data.preferred_skills].map((s) => s.name);

  return (
    <>
      <Link href="/recruiter/jobs" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Jobs</Link>
      <Hero
        eyebrow="Ranked applicants"
        title={job.data.title}
        description="Ranked by AI relevance (or your override). Tick 2–4 to compare side by side. The AI never changes a status — you do."
        art="compare"
        actions={
          <>
            {picked.length >= 2 && <Button asChild><Link href={`/recruiter/compare?ids=${picked.join(",")}`}><Columns3 className="h-4 w-4" /> Compare {picked.length}</Link></Button>}
            <Button asChild variant="outline"><Link href={`/recruiter/jobs/${id}/edit`}><Pencil className="h-4 w-4" /> Edit job</Link></Button>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input type="number" min={0} max={100} placeholder="Min score" className="w-32" aria-label="Minimum score"
          onChange={(e) => setFilters({ ...filters, minScore: e.target.value ? Number(e.target.value) : undefined })} />
        <Select className="w-44" aria-label="Status" value={filters.status ?? ""} onChange={(e) => setFilters({ ...filters, status: (e.target.value || undefined) as ApplicationStatus | undefined })}>
          <option value="">All statuses</option>
          {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </Select>
        <Select className="w-44" aria-label="Matched skill" value={filters.skill ?? ""} onChange={(e) => setFilters({ ...filters, skill: e.target.value || undefined })}>
          <option value="">Any matched skill</option>
          {skills.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select className="w-40" aria-label="Sort" value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value as "score" | "newest" })}>
          <option value="score">Highest score</option>
          <option value="newest">Newest</option>
        </Select>
      </div>

      {apps.loading && !apps.data && <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>}
      {apps.error && <ErrorState message={apps.error} onRetry={apps.reload} />}
      {apps.data?.length === 0 && <Empty art="inbox" title="No matching applicants">Applicants appear here as soon as candidates apply.</Empty>}
      <div className="space-y-2.5">
        {apps.data?.map((a, rank) => {
          const name = a.candidate_name ?? a.candidate_email ?? "Candidate";
          const x = a.ai_explanation;
          return (
            <div key={a.id} style={stagger(rank)}
              className={cn("dash-card flex flex-wrap items-center gap-4 rounded-2xl border bg-surface p-4", picked.includes(a.id) ? "border-primary" : "border-border")}>
              <input type="checkbox" aria-label={`Select ${name} to compare`} checked={picked.includes(a.id)} onChange={() => togglePick(a.id)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
              <span className={cn("w-7 font-heading text-sm", rank === 0 ? "text-matched" : "text-muted-foreground")}>#{rank + 1}</span>
              <ScoreRing value={a.effective_score} size={56} stroke={6} />
              <Link href={`/recruiter/applications/${a.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar name={name} size={40} />
                <div className="min-w-0">
                  <p className="font-medium hover:text-primary">{name}{a.override_score != null && <span className="ml-2 text-[11px] text-missing">override</span>}</p>
                  {x ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {x.matched.slice(0, 4).map((m) => <span key={m.skill} className={cn("rounded-full px-2 py-0.5 text-[11px]", m.strength === "full" ? "bg-matched/15 text-matched" : "bg-missing/15 text-missing")}>{m.skill}</span>)}
                      {x.gaps.filter((g) => g.required && !x.matched.some((m) => m.skill === g.skill)).slice(0, 3).map((g) => (
                        <span key={g.skill} className={cn("rounded-full border px-2 py-0.5 text-[11px]", g.type === "explicitly_lacking" ? "border-absent/50 text-absent" : "border-missing/50 text-missing")}>{g.skill}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">{a.match_error ?? "Awaiting AI assessment"}</p>
                  )}
                </div>
              </Link>
              <StatusBadge status={a.status} />
            </div>
          );
        })}
      </div>
    </>
  );
}
