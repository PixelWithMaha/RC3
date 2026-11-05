"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Columns3, Pencil } from "lucide-react";
import { getJob, getJobApplicants, type ApplicantFilters } from "@/lib/api";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ScorePill, StatusBadge, statusLabel } from "@/components/app/badges";
import { Empty, ErrorState, Loading, PageHeader, useAsync } from "@/components/app/states";

export default function JobApplicants() {
  const { id } = useParams<{ id: string }>();
  const [filters, setFilters] = useState<ApplicantFilters>({ sort: "score" });
  const [picked, setPicked] = useState<string[]>([]);
  const togglePick = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 4 ? p : [...p, id]));
  const job = useAsync(() => getJob(id), [id]);
  const apps = useAsync(() => getJobApplicants(id, filters), [id, JSON.stringify(filters)]);

  if (job.loading) return <Loading />;
  if (job.error || !job.data) return <ErrorState message={job.error ?? "Job not found"} onRetry={job.reload} />;
  const skills = [...job.data.required_skills, ...job.data.preferred_skills].map((s) => s.name);

  return (
    <>
      <PageHeader
        title={job.data.title}
        description="Applicants ranked by AI relevance (or your override). Tick 2–4 to compare side by side. The AI never changes a status — you do."
        actions={
          <>
            {picked.length >= 2 && (
              <Button asChild><Link href={`/recruiter/compare?ids=${picked.join(",")}`}><Columns3 className="h-4 w-4" /> Compare {picked.length}</Link></Button>
            )}
            <Button asChild variant="outline"><Link href={`/recruiter/jobs/${id}/edit`}><Pencil className="h-4 w-4" /> Edit job</Link></Button>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <Input type="number" min={0} max={100} placeholder="Min score" className="w-32"
          onChange={(e) => setFilters({ ...filters, minScore: e.target.value ? Number(e.target.value) : undefined })} />
        <Select className="w-44" value={filters.status ?? ""} onChange={(e) => setFilters({ ...filters, status: (e.target.value || undefined) as ApplicationStatus | undefined })}>
          <option value="">All statuses</option>
          {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </Select>
        <Select className="w-44" value={filters.skill ?? ""} onChange={(e) => setFilters({ ...filters, skill: e.target.value || undefined })}>
          <option value="">Any matched skill</option>
          {skills.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select className="w-40" value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value as "score" | "newest" })}>
          <option value="score">Highest score</option>
          <option value="newest">Newest</option>
        </Select>
      </div>

      {apps.loading && !apps.data && <Loading />}
      {apps.error && <ErrorState message={apps.error} onRetry={apps.reload} />}
      {apps.data?.length === 0 && <Empty title="No matching applicants">Applicants appear here as soon as candidates apply.</Empty>}
      <div className="space-y-2">
        {apps.data?.map((a, rank) => (
          <Link key={a.id} href={`/recruiter/applications/${a.id}`}
            onClick={(e) => { if ((e.target as HTMLElement).tagName === "INPUT") e.preventDefault(); }}
            className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary/60">
            <input
              type="checkbox"
              aria-label={`Select ${a.candidate_name ?? "candidate"} to compare`}
              checked={picked.includes(a.id)}
              onClick={(e) => e.stopPropagation()}
              onChange={() => togglePick(a.id)}
              className="h-4 w-4 accent-[hsl(var(--primary))]"
            />
            <span className="w-6 text-sm text-muted-foreground">#{rank + 1}</span>
            <ScorePill score={a.ai_score} override={a.override_score} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{a.candidate_name ?? a.candidate_email ?? "Candidate"}</p>
              <p className="truncate text-xs text-muted-foreground">
                {a.ai_explanation
                  ? `Matched: ${a.ai_explanation.matched.map((m) => m.skill).join(", ") || "none"} · Gaps: ${a.ai_explanation.gaps.map((g) => g.skill).join(", ") || "none"}`
                  : a.match_error ?? "Awaiting AI assessment"}
              </p>
            </div>
            <StatusBadge status={a.status} />
          </Link>
        ))}
      </div>
    </>
  );
}
