"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LayoutGroup, motion } from "motion/react";
import { ArrowLeft, Columns3, Pencil, RotateCcw, SlidersHorizontal } from "lucide-react";
import { getJob, getJobApplicants } from "@/lib/api";
import { DEFAULT_WEIGHTS, DIMENSIONS, computeStability, rankOf, rebalance, weightedTotal, type Rankable, type Weights } from "@/lib/ranking";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { StatusBadge, statusLabel } from "@/components/app/badges";
import { Avatar, Hero, ScoreRing, Skeleton } from "@/components/app/kit";
import { ProfileLinks } from "@/components/app/links";
import { Empty, ErrorState, Loading, useAsync } from "@/components/app/states";
import { cn } from "@/lib/utils";

const MINI = ["bg-primary", "bg-matched", "bg-missing", "bg-fuchsia-400"];
const storeKey = (jobId: string) => `rc3-weights-${jobId}`;

export default function JobApplicants() {
  const { id } = useParams<{ id: string }>();
  const job = useAsync(() => getJob(id), [id]);
  const apps = useAsync(() => getJobApplicants(id, { sort: "score" }), [id]);
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [minScore, setMinScore] = useState(0);
  const [status, setStatus] = useState<ApplicationStatus | "">("");
  const [skill, setSkill] = useState("");
  const [sort, setSort] = useState<"score" | "name" | "newest">("score");
  const [picked, setPicked] = useState<string[]>([]);

  // Recruiter's priorities are a per-viewer preference, remembered per job in this browser.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storeKey(id)) ?? "null");
      if (Array.isArray(saved) && saved.length === 4 && saved.reduce((a: number, b: number) => a + b, 0) === 100) setWeights(saved as Weights);
    } catch { /* storage unavailable */ }
  }, [id]);
  const changeWeights = (w: Weights) => {
    setWeights(w);
    try { localStorage.setItem(storeKey(id), JSON.stringify(w)); } catch { /* ignore */ }
  };

  const scored = useMemo(() => (apps.data ?? []).filter((a) => a.score_breakdown), [apps.data]);
  const items: Rankable[] = useMemo(() => scored.map((a) => ({ id: a.id, breakdown: a.score_breakdown! })), [scored]);
  const rank = useMemo(() => rankOf(items, weights), [items, weights]);
  const baseRank = useMemo(() => rankOf(items, DEFAULT_WEIGHTS), [items]);
  const stability = useMemo(() => computeStability(items, weights), [items, weights]);
  const custom = weights.some((w, i) => w !== DEFAULT_WEIGHTS[i]);

  const rows = useMemo(() => {
    const list = (apps.data ?? []).map((a) => ({ a, total: a.score_breakdown ? weightedTotal(a.score_breakdown, weights) : null }));
    return list
      .filter(({ a, total }) => (total ?? 0) >= minScore && (!status || a.status === status) && (!skill || a.ai_explanation?.matched.some((m) => m.skill.toLowerCase() === skill.toLowerCase())))
      .sort((x, y) =>
        sort === "name" ? (x.a.candidate_name ?? "").localeCompare(y.a.candidate_name ?? "")
          : sort === "newest" ? y.a.created_at.localeCompare(x.a.created_at)
            : (rank[x.a.id] ?? 999) - (rank[y.a.id] ?? 999));
  }, [apps.data, weights, minScore, status, skill, sort, rank]);

  if (job.loading) return <Loading />;
  if (job.error || !job.data) return <ErrorState message={job.error ?? "Job not found"} onRetry={job.reload} />;
  const skills = [...job.data.required_skills, ...job.data.preferred_skills].map((s) => s.name);
  const name = (appId: string | null) => (apps.data ?? []).find((a) => a.id === appId)?.candidate_name ?? "Candidate";
  const toggle = (x: string) => setPicked((p) => (p.includes(x) ? p.filter((y) => y !== x) : p.length >= 4 ? p : [...p, x]));

  return (
    <>
      <Link href="/recruiter/jobs" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Jobs</Link>
      <Hero eyebrow="Ranked applicants" title={job.data.title} art="compare"
        description="Ranked by job-related evidence. Tune the weights to your priorities and watch the ranking respond. The AI never changes a status — you do."
        actions={
          <>
            <Button disabled={picked.length < 2} asChild={picked.length >= 2} title={picked.length < 2 ? "Tick 2 to 4 applicants" : undefined}>
              {picked.length >= 2 ? <Link href={`/recruiter/compare?ids=${picked.join(",")}`}><Columns3 className="h-4 w-4" /> Compare {picked.length}</Link> : <span><Columns3 className="h-4 w-4" /> Compare {picked.length}</span>}
            </Button>
            <Button asChild variant="outline"><Link href={`/recruiter/jobs/${id}/edit`}><Pencil className="h-4 w-4" /> Edit job</Link></Button>
          </>
        } />

      {/* Stability meter + weight sliders */}
      <section className="dash-card mb-5 grid gap-6 rounded-[18px] border border-border bg-surface px-6 py-5 lg:grid-cols-[1.1fr_1.4fr]" style={{ animationDelay: "80ms" }}>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Stability meter</p>
          <p className="mt-2 font-heading text-[19px] font-semibold leading-snug" aria-live="polite">
            {!stability.applicable
              ? items.length ? "Stability needs at least two scored applicants." : "No scored applicants yet."
              : stability.holdPct >= 0.8
                ? `${name(stability.topId)} stays #1 under ${stability.holdPct === 1 ? "all" : "most"} reasonable weightings.`
                : `${name(stability.topId)} and ${name(stability.rivalId)} swap the top spot if ${stability.driver} matters more.`}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2.5">
            <span className={cn("rounded-full border px-3 py-0.5 text-xs font-bold",
              !stability.applicable ? "border-border text-muted-foreground"
                : stability.badge === "Stable" ? "border-matched bg-matched/10 text-matched"
                  : stability.badge === "Sensitive" ? "border-absent bg-absent/10 text-absent" : "border-missing bg-missing/10 text-missing")}>
              {stability.applicable ? stability.badge : "Not applicable"}
            </span>
            {stability.applicable && <span className="text-xs text-muted-foreground">#1 holds in {Math.round(stability.holdPct * 100)}% of {stability.tested} tested weightings (±15 points)</span>}
          </div>
          <p className="mt-3 border-l-[3px] border-primary pl-2.5 text-xs text-muted-foreground">
            Scores come from job-related evidence only. Changing weights re-ranks this view; it doesn&apos;t change any stored score or make a hiring decision.
          </p>
        </div>
        <div className="grid content-start gap-x-6 gap-y-3 sm:grid-cols-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground sm:col-span-2">
            <span className="flex items-center gap-1.5"><SlidersHorizontal className="h-3.5 w-3.5" /> Your priorities for this role · total <b className="text-foreground">{weights.reduce((a, b) => a + b, 0)}</b>%</span>
            <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" disabled={!custom} onClick={() => changeWeights(DEFAULT_WEIGHTS)}><RotateCcw className="h-3.5 w-3.5" /> Reset to default</Button>
          </div>
          {DIMENSIONS.map((d, i) => (
            <label key={d.key} className="block">
              <span className="mb-0.5 flex justify-between text-sm font-medium">
                {d.label}
                <output className="font-heading font-bold">{weights[i]}%</output>
              </span>
              <input type="range" min={0} max={100} value={weights[i]} aria-valuetext={`${weights[i]} percent`}
                onChange={(e) => changeWeights(rebalance(weights, i, Number(e.target.value)))}
                className="h-5 w-full cursor-pointer accent-[hsl(var(--primary))]" />
            </label>
          ))}
        </div>
      </section>

      <div className="mb-3.5 flex flex-wrap gap-2.5">
        <Select className="w-36" aria-label="Minimum score" value={minScore} onChange={(e) => setMinScore(Number(e.target.value))}>
          <option value={0}>Min score</option><option value={50}>50+</option><option value={70}>70+</option><option value={90}>90+</option>
        </Select>
        <Select className="w-44" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as ApplicationStatus | "")}>
          <option value="">All statuses</option>
          {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </Select>
        <Select className="w-44" aria-label="Matched skill" value={skill} onChange={(e) => setSkill(e.target.value)}>
          <option value="">Any matched skill</option>
          {skills.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select className="w-40" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="score">Highest score</option><option value="name">Name A–Z</option><option value="newest">Newest</option>
        </Select>
      </div>

      {apps.loading && !apps.data && <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>}
      {apps.error && <ErrorState message={apps.error} onRetry={apps.reload} />}
      {apps.data?.length === 0 && <Empty art="inbox" title="No applicants scored yet">Scored applicants will appear here.</Empty>}
      {!!apps.data?.length && rows.length === 0 && <Empty art="search" title="No applicants match these filters">Try lowering the minimum score or clearing a filter.</Empty>}

      <LayoutGroup>
        <ol className="grid gap-3" aria-label="Applicants ranked by weighted score">
          {rows.map(({ a, total }, k) => {
            const nm = a.candidate_name ?? a.candidate_email ?? "Candidate";
            const r = rank[a.id];
            const moved = r && baseRank[a.id] ? baseRank[a.id] - r : 0;
            const range = stability.applicable ? stability.ranges[a.id] : null;
            const x = a.ai_explanation;
            const on = picked.includes(a.id);
            return (
              <motion.li key={a.id} layout="position" transition={{ type: "spring", stiffness: 420, damping: 36 }}
                className={cn("dash-card grid items-center gap-x-3.5 gap-y-1.5 rounded-2xl border bg-surface px-4 py-3",
                  "grid-cols-[20px_28px_56px_minmax(0,1fr)_auto] md:grid-cols-[20px_28px_56px_40px_minmax(0,1fr)_150px_auto]",
                  on ? "border-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]" : "border-border")}
                style={{ animationDelay: `${Math.min(k * 60, 600)}ms` }}>
                <input type="checkbox" aria-label={`Select ${nm} to compare`} checked={on} onChange={() => toggle(a.id)} className="h-[18px] w-[18px] cursor-pointer accent-[hsl(var(--primary))]" />
                <span className={cn("font-heading text-[13px]", r === 1 ? "text-matched" : "text-muted-foreground")}>{r ? `#${r}` : "—"}</span>
                <ScoreRing value={total} size={56} stroke={5} />
                <span className="hidden md:block"><Avatar name={nm} size={40} /></span>
                <Link href={`/recruiter/applications/${a.id}`} className="min-w-0">
                  <p className="truncate text-[15px] font-medium hover:text-primary">{nm}</p>
                  {x ? (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {x.matched.slice(0, 4).map((m) => <span key={m.skill} className={cn("rounded-full border px-2.5 py-px text-[11px]", m.strength === "full" ? "border-matched/40 bg-matched/10 text-matched" : "border-missing/40 bg-missing/10 text-missing")}>{m.skill}</span>)}
                      {x.gaps.filter((g) => g.required && !x.matched.some((m) => m.skill === g.skill)).slice(0, 3).map((g) => <span key={g.skill} className="rounded-full border border-border px-2.5 py-px text-[11px] text-muted-foreground">{g.skill}</span>)}
                    </div>
                  ) : <p className="text-xs text-muted-foreground">{a.match_error ?? "Awaiting AI assessment"}</p>}
                </Link>
                <div className="col-span-full grid gap-[3px] md:col-span-1" aria-label="Sub-scores">
                  {DIMENSIONS.map((d, i) => (
                    <div key={d.key} title={d.label} className="grid grid-cols-[14px_1fr_22px] items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span>{d.short}</span>
                      <i className="h-1 overflow-hidden rounded bg-secondary"><u className={cn("block h-full rounded transition-[width] duration-500", MINI[i])} style={{ width: `${a.score_breakdown?.[d.key] ?? 0}%` }} /></i>
                      <b className="text-right font-medium text-foreground">{a.score_breakdown ? Math.round(a.score_breakdown[d.key]) : "—"}</b>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={a.status} />
                  {r && <span className={cn("whitespace-nowrap text-[11px] font-semibold", moved > 0 ? "text-matched" : moved < 0 ? "text-absent" : "text-muted-foreground")}>
                    {moved > 0 ? `▲ Up ${moved}` : moved < 0 ? `▼ Down ${-moved}` : "— No change"}
                  </span>}
                  {range && <span className="whitespace-nowrap rounded-full border border-border px-2 text-[11px] text-muted-foreground">{range.best === range.worst ? `Rank ${range.best} only` : `Rank ${range.best} to ${range.worst}`}</span>}
                  {a.override_score != null && <span className="text-[10px] text-missing" title={a.override_reason ?? ""}>override {Math.round(a.override_score)} (default weights)</span>}
                  <ProfileLinks links={a.links} compact />
                </div>
              </motion.li>
            );
          })}
        </ol>
      </LayoutGroup>
    </>
  );
}
