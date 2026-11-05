"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { changeApplicationStatus, getRecruiterDashboard } from "@/lib/api";
import { FUNNEL_STAGES, dailySeries, funnelReach, weekDelta } from "@/lib/analytics";
import type { ApplicationStatus, RankedApplication } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { statusLabel } from "@/components/app/badges";
import { ErrorState, Loading, useAsync } from "@/components/app/states";
import { cn } from "@/lib/utils";

const C = { primary: "#7C5CFF", matched: "#2DD4BF", missing: "#F5B544", absent: "#F87171", line: "#272C3F", soft: "#1C2033" };
const PENDING: ApplicationStatus[] = ["submitted", "parsed", "ai_assessed", "recruiter_review"];
const TARGET_DAYS = 5;
const delay = (i: number) => ({ animationDelay: `${i * 70}ms` });

type Data = Awaited<ReturnType<typeof getRecruiterDashboard>>;

export default function RecruiterDashboard() {
  const { data, error, loading, reload } = useAsync(getRecruiterDashboard);
  const [period, setPeriod] = useState(30);

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorState message={error ?? "Could not load the dashboard"} onRetry={reload} />;
  const openJobs = data.jobs.filter((j) => j.status === "open").length;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Recruitment dashboard</h1>
          <p className="text-sm text-muted-foreground">{data.apps.length} applicants across {openJobs} open job{openJobs === 1 ? "" : "s"}</p>
        </div>
        <div className="flex items-center gap-2.5">
          <Select aria-label="Period" className="w-36" value={period} onChange={(e) => setPeriod(Number(e.target.value))}>
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </Select>
          <Button asChild><Link href="/recruiter/jobs/new"><Plus className="h-4 w-4" /> New job</Link></Button>
        </div>
      </div>
      <Dashboard data={data} period={period} onChanged={reload} />
      <p className="mt-6 text-center text-xs text-muted-foreground">AI suggests, recruiters decide: every status change on this page is a manual action, written to the audit trail.</p>
    </>
  );
}

function Dashboard({ data, period, onChanged }: { data: Data; period: number; onChanged: () => void }) {
  const { apps, events, interviews, analytics: a } = data;
  const shortlistDates = useMemo(() => events.filter((e) => e.to_status === "shortlisted").map((e) => e.created_at), [events]);
  const appDates = apps.map((x) => x.created_at);
  const pendingDates = apps.filter((x) => PENDING.includes(x.status)).map((x) => x.created_at);
  const upcoming = interviews.filter((i) => i.status === "scheduled" && new Date(i.scheduled_at) >= new Date());

  const kpis = [
    { label: "Active jobs", value: a.kpis.activeJobs, dates: data.jobs.map((j) => j.created_at), color: C.primary },
    { label: "Applications", value: a.kpis.totalApplications, dates: appDates, color: C.primary },
    { label: "Shortlisted", value: a.kpis.shortlisted, dates: shortlistDates, color: C.matched },
    { label: "Pending review", value: a.kpis.pendingReviews, dates: pendingDates, color: C.missing },
    { label: "Upcoming interviews", value: a.kpis.upcomingInterviews, dates: upcoming.map((i) => i.created_at), color: C.primary },
  ];

  const decided = apps.filter((x) => x.status === "selected" || x.status === "rejected").length;
  const reachedShortlist = Math.round((a.shortlistRate / 100) * apps.length);

  return (
    <>
      <section className="grid grid-cols-2 gap-3.5 lg:grid-cols-5" aria-label="Key numbers">
        {kpis.map((k, i) => <KpiCard key={k.label} i={i} {...k} />)}
      </section>

      <section className="mt-3.5 grid gap-3.5 md:grid-cols-2">
        <Card i={5}>
          <p className="text-[13px] text-muted-foreground">Application → shortlist rate</p>
          <div className="flex items-center justify-between">
            <div>
              <CountUp value={a.shortlistRate} suffix="%" className="font-heading text-[34px] font-bold text-matched" />
              <p className="text-[13px] text-muted-foreground">{reachedShortlist} of {apps.length} applicants reached shortlist</p>
            </div>
            <Ring pct={a.shortlistRate} />
          </div>
        </Card>
        <Card i={6}>
          <p className="text-[13px] text-muted-foreground">Avg. processing time (to decision)</p>
          <div className="flex items-center justify-between">
            <div>
              {a.avgProcessingDays == null ? <span className="font-heading text-[34px] font-bold">—</span> : (
                <span className="font-heading text-[34px] font-bold">{a.avgProcessingDays}<span className="text-[13px] font-normal text-muted-foreground"> days</span></span>
              )}
              <p className="text-[13px] text-muted-foreground">{decided} decision{decided === 1 ? "" : "s"} · target {TARGET_DAYS} days</p>
            </div>
            {a.avgProcessingDays != null && (
              <Delta tone={a.avgProcessingDays <= TARGET_DAYS ? "up" : "down"}>{a.avgProcessingDays <= TARGET_DAYS ? "On target" : "Over target"}</Delta>
            )}
          </div>
          <Bar pct={Math.min(((a.avgProcessingDays ?? 0) / (TARGET_DAYS * 2)) * 100, 100)} color={(a.avgProcessingDays ?? 0) <= TARGET_DAYS ? C.matched : C.missing} className="mt-3" />
        </Card>
      </section>

      <section className="mt-3.5 grid gap-3.5 lg:grid-cols-[1.8fr_1fr]">
        <Card i={7}>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[15px] font-semibold">Applications over time</h3>
            <div className="flex gap-3.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><b className="h-2.5 w-2.5 rounded-[3px] bg-primary" />Applications</span>
              <span className="flex items-center gap-1.5"><b className="h-2.5 w-2.5 rounded-[3px] bg-matched" />Shortlisted</span>
            </div>
          </div>
          <TrendChart key={period} days={period} total={dailySeries(appDates, period)} shortlisted={dailySeries(shortlistDates, period)} />
        </Card>
        <Card i={8}>
          <h3 className="mb-3 text-[15px] font-semibold">Hiring funnel</h3>
          <Funnel apps={apps} events={events} />
        </Card>
      </section>

      <section className="mt-3.5 grid gap-3.5 lg:grid-cols-3">
        <Card i={9}>
          <h3 className="mb-3 text-[15px] font-semibold">Applications by job</h3>
          <ByJob apps={apps} jobs={a.byJob} />
        </Card>
        <Card i={10}>
          <h3 className="mb-3 text-[15px] font-semibold">Common skill gaps</h3>
          {a.commonGaps.length === 0 && <p className="text-[13px] text-muted-foreground">No gaps recorded yet.</p>}
          {a.commonGaps.slice(0, 6).map((g) => (
            <Item key={g.skill} label={g.skill} meta={<>{g.count} applicant{g.count === 1 ? "" : "s"} · {Math.round((g.count / Math.max(apps.length, 1)) * 100)}%</>}>
              <div className="flex h-2 overflow-hidden rounded-full bg-secondary">
                <i className="dash-bar block bg-missing" style={{ width: `${(g.notMentioned / a.commonGaps[0].count) * 100}%` }} title="Missing evidence" />
                <i className="dash-bar block bg-absent" style={{ width: `${(g.explicitlyLacking / a.commonGaps[0].count) * 100}%` }} title="Confirmed absence" />
              </div>
            </Item>
          ))}
          <p className="mt-2 text-[13px] text-muted-foreground"><span className="text-missing">Amber</span> = no evidence found · <span className="text-absent">red</span> = confirmed absence.</p>
        </Card>
        <Card i={11}>
          <h3 className="mb-1 text-[15px] font-semibold">Upcoming interviews</h3>
          {upcoming.length === 0 && <p className="pt-2 text-[13px] text-muted-foreground">No interviews scheduled.</p>}
          {upcoming.slice(0, 5).map((iv, k) => {
            const d = new Date(iv.scheduled_at);
            return (
              <Link key={iv.id} href={`/recruiter/applications/${iv.application_id}`} style={{ animationDelay: `${0.9 + k * 0.1}s` }}
                className="dash-slide flex items-center gap-3 border-t border-border py-2.5 first:border-0 hover:text-primary">
                <div className="min-w-12 rounded-[10px] bg-secondary px-1 py-1 text-center">
                  <b className="block font-heading text-lg">{d.getDate()}</b>
                  <span className="text-[11px] text-muted-foreground">{d.toLocaleDateString("en", { month: "short" })}</span>
                </div>
                <div className="min-w-0">
                  <b className="block truncate">{iv.candidate_name ?? "Candidate"}</b>
                  <span className="text-[13px] text-muted-foreground">{iv.job_title} · {d.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })} · {iv.interviewer_name}</span>
                </div>
              </Link>
            );
          })}
        </Card>
      </section>

      <ApplicantsTable apps={apps} onChanged={onChanged} />
    </>
  );
}

// ---------------------------------------------------------------- building blocks
function Card({ i, className, children }: { i: number; className?: string; children: React.ReactNode }) {
  return <div style={delay(i)} className={cn("dash-card rounded-2xl border border-border bg-surface px-5 py-[18px]", className)}>{children}</div>;
}

function Delta({ tone, children }: { tone: "up" | "down" | "flat"; children: React.ReactNode }) {
  const cls = tone === "up" ? "bg-matched/15 text-matched" : tone === "down" ? "bg-absent/15 text-absent" : "bg-secondary text-muted-foreground";
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", cls)}>{children}</span>;
}

function KpiCard({ i, label, value, dates, color }: { i: number; label: string; value: number; dates: string[]; color: string }) {
  const d = weekDelta(dates);
  return (
    <Card i={i}>
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <div className="flex items-center justify-between gap-2">
        <CountUp value={value} className="font-heading text-[34px] font-bold leading-tight" />
        {d == null ? <Delta tone="flat">— wk</Delta> : <Delta tone={d > 0 ? "up" : d < 0 ? "down" : "flat"}>{d > 0 ? `▲ +${d}` : d < 0 ? `▼ ${d}` : "0"}% wk</Delta>}
      </div>
      <Sparkline values={dailySeries(dates, 14)} color={color} />
    </Card>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1);
  const d = values.map((y, i) => `${i ? "L" : "M"}${((i / (values.length - 1)) * 100).toFixed(1)} ${(28 - (y / max) * 24).toFixed(1)}`).join("");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="dash-spark mt-2 block h-[30px] w-full" aria-hidden>
      <path d={`${d}L100 30L0 30Z`} fill={color} opacity={0.15} />
      <path d={d} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Bar({ pct, color, className }: { pct: number; color: string; className?: string }) {
  return (
    <div className={cn("h-2 overflow-hidden rounded-full bg-secondary", className)}>
      <i className="dash-bar block h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
    </div>
  );
}

function Item({ label, meta, children }: { label: React.ReactNode; meta: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
        <span className="truncate">{label}</span>
        <span className="shrink-0 text-[13px] text-muted-foreground">{meta}</span>
      </div>
      {children}
    </div>
  );
}

function Ring({ pct }: { pct: number }) {
  const circ = 2 * Math.PI * 36;
  return (
    <svg width="92" height="92" viewBox="0 0 92 92" role="img" aria-label={`${pct} percent`}>
      <circle cx="46" cy="46" r="36" fill="none" strokeWidth="10" stroke={C.soft} />
      <circle cx="46" cy="46" r="36" fill="none" strokeWidth="10" strokeLinecap="round" stroke={C.matched}
        className="dash-ring" strokeDasharray={`${(circ * pct) / 100} ${circ}`} transform="rotate(-90 46 46)" />
    </svg>
  );
}

function CountUp({ value, suffix = "", className }: { value: number; suffix?: string; className?: string }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(value); from.current = value; return; }
    const start = from.current, t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min((t - t0) / 700, 1);
      setShown(start + (value - start) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  const decimals = Number.isInteger(value) ? 0 : 1;
  return <span className={className}>{shown.toFixed(decimals)}{suffix}</span>;
}

function TrendChart({ days, total, shortlisted }: { days: number; total: number[]; shortlisted: number[] }) {
  const W = 640, H = 230, P = { l: 32, r: 10, t: 10, b: 24 };
  const max = Math.max(2, Math.ceil(Math.max(...total, ...shortlisted) / 2) * 2);
  const X = (i: number) => P.l + (i / (days - 1)) * (W - P.l - P.r);
  const Y = (v: number) => H - P.b - (v / max) * (H - P.t - P.b);
  const path = (s: number[]) => s.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join("");
  const label = (i: number) => { const d = new Date(); d.setDate(d.getDate() - (days - 1 - i)); return d.toLocaleDateString("en", { month: "short", day: "numeric" }); };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Applications per day">
      <defs>
        <linearGradient id="dash-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.primary} stopOpacity=".35" />
          <stop offset="1" stopColor={C.primary} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={P.l} x2={W - P.r} y1={Y(max * f)} y2={Y(max * f)} stroke={C.line} />
          <text x={P.l - 6} y={Y(max * f) + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">{+(max * f).toFixed(1)}</text>
        </g>
      ))}
      {[0, Math.floor((days - 1) / 2), days - 1].map((i) => (
        <text key={i} x={X(i)} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[11px]">{label(i)}</text>
      ))}
      <path d={`${path(total)}L${X(days - 1)} ${Y(0)}L${X(0)} ${Y(0)}Z`} fill="url(#dash-g)" className="dash-area" />
      <path pathLength={1} d={path(total)} fill="none" stroke={C.primary} strokeWidth={2.5} strokeLinejoin="round" className="dash-line" />
      <path pathLength={1} d={path(shortlisted)} fill="none" stroke={C.matched} strokeWidth={2.5} strokeLinejoin="round" className="dash-line" />
      {total.map((v, i) => (
        <circle key={i} cx={X(i)} cy={Y(v)} r={days > 14 ? 2.5 : 4} fill={C.primary} className="dash-dot" style={{ animationDelay: `${(0.7 + i * 0.03).toFixed(2)}s` }}>
          <title>{label(i)}: {v} application{v === 1 ? "" : "s"}</title>
        </circle>
      ))}
    </svg>
  );
}

function Funnel({ apps, events }: { apps: RankedApplication[]; events: Data["events"] }) {
  const f = funnelReach(apps, events);
  const top = f[0].count || 1;
  return (
    <>
      {f.map((s, i) => (
        <Item key={s.status} label={statusLabel(s.status)}
          meta={<><b className="text-foreground">{s.count}</b>{i > 0 && ` · ${Math.round((s.count / (f[i - 1].count || 1)) * 100)}%`}</>}>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <i className="dash-bar block h-full rounded-full bg-primary" style={{ width: `${(s.count / top) * 100}%`, opacity: 1 - i * 0.1 }} />
          </div>
        </Item>
      ))}
    </>
  );
}

function ByJob({ apps, jobs }: { apps: RankedApplication[]; jobs: Data["analytics"]["byJob"] }) {
  const max = Math.max(...jobs.map((j) => j.applications), 1);
  if (!jobs.length) return <p className="text-[13px] text-muted-foreground">No jobs yet.</p>;
  return (
    <>
      {jobs.map((j) => {
        const scored = apps.filter((x) => x.job_id === j.jobId && x.effective_score != null);
        const avg = scored.length ? Math.round(scored.reduce((s, x) => s + (x.effective_score ?? 0), 0) / scored.length) : null;
        return (
          <Item key={j.jobId} label={<Link href={`/recruiter/jobs/${j.jobId}`} className="hover:text-primary">{j.title}</Link>}
            meta={<><b className="text-foreground">{j.applications}</b>{avg != null && ` · avg match ${avg}`}</>}>
            <Bar pct={(j.applications / max) * 100} color={C.primary} />
          </Item>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------- applicants table
const hue = (s: string) => ([...s].reduce((a, c) => a + c.charCodeAt(0), 0) * 37) % 360;
const initials = (s: string) => s.split(/\s+/).map((x) => x[0]).join("").slice(0, 2).toUpperCase();

function ApplicantsTable({ apps, onChanged }: { apps: RankedApplication[]; onChanged: () => void }) {
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<ApplicationStatus | "">("");
  const [sort, setSort] = useState<{ key: "score" | "date"; dir: 1 | -1 }>({ key: "date", dir: -1 });
  const [limit, setLimit] = useState(8);
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = apps.filter((x) => (!stage || x.status === stage) && `${x.candidate_name ?? ""} ${x.candidate_email ?? ""} ${x.job_title}`.toLowerCase().includes(term));
    return list.sort((a, b) =>
      sort.key === "score"
        ? ((a.effective_score ?? -1) - (b.effective_score ?? -1)) * sort.dir
        : (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * sort.dir,
    );
  }, [apps, q, stage, sort]);
  const shown = rows.slice(0, limit);

  const toggle = (key: "score" | "date") => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : -1 }));
  const act = async (a: RankedApplication, to: ApplicationStatus) => {
    setBusy(a.id);
    setErr(null);
    try {
      await changeApplicationStatus(a.id, to);
      setFlash(a.id);
      setToast(`${a.candidate_name ?? "Candidate"} moved to ${statusLabel(to)}`);
      setTimeout(() => setToast(null), 2200);
      setTimeout(() => setFlash(null), 1500);
      onChanged();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section style={delay(12)} className="dash-card mt-3.5 rounded-2xl border border-border bg-surface px-5 py-[18px]">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[15px] font-semibold">Applicants</h3>
        <div className="flex flex-wrap gap-2">
          <Input className="h-9 w-52" placeholder="Search name or job" aria-label="Search applicants" value={q} onChange={(e) => { setQ(e.target.value); setLimit(8); }} />
          <Select className="w-40" aria-label="Filter by stage" value={stage} onChange={(e) => { setStage(e.target.value as ApplicationStatus | ""); setLimit(8); }}>
            <option value="">All stages</option>
            {[...FUNNEL_STAGES, "rejected" as const].map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </Select>
        </div>
      </div>
      {err && <ErrorState message={err} />}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-[0.06em] text-muted-foreground">
              <th className="p-2 font-semibold">Candidate</th>
              <th className="p-2 font-semibold">Job</th>
              <th className="p-2 font-semibold"><button onClick={() => toggle("score")} title="Sort by match">Match ↕</button></th>
              <th className="p-2 font-semibold">Stage</th>
              <th className="p-2 font-semibold"><button onClick={() => toggle("date")} title="Sort by date">Applied ↕</button></th>
              <th className="p-2 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr><td colSpan={6} className="border-t border-border p-3 text-[13px] text-muted-foreground">{apps.length ? "No applicants match." : "No applicants yet — they appear here as soon as candidates apply."}</td></tr>
            )}
            {shown.map((a, i) => {
              const name = a.candidate_name ?? a.candidate_email ?? "Candidate";
              const score = a.effective_score;
              const color = score == null ? C.line : score >= 80 ? C.matched : score >= 65 ? C.primary : C.missing;
              return (
                <tr key={a.id} style={{ animationDelay: `${1 + i * 0.06}s` }} className={cn("dash-slide [&>td]:border-t [&>td]:border-border [&>td]:px-2 [&>td]:py-[11px] hover:[&>td]:bg-secondary/60", flash === a.id && "dash-flash")}>
                  <td>
                    <Link href={`/recruiter/applications/${a.id}`} className="flex items-center gap-2.5 hover:text-primary">
                      <span className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold text-white" style={{ background: `hsl(${hue(name)} 55% 45%)` }}>{initials(name)}</span>
                      {name}
                    </Link>
                  </td>
                  <td>{a.job_title}</td>
                  <td>
                    <div className="flex min-w-[110px] items-center gap-2">
                      <b className="w-6 font-heading">{score == null ? "—" : Math.round(score)}</b>
                      <Bar pct={score ?? 0} color={color} className="flex-1" />
                    </div>
                  </td>
                  <td><StageChip status={a.status} /></td>
                  <td className="text-muted-foreground">{new Date(a.created_at).toLocaleDateString("en", { month: "short", day: "numeric" })}</td>
                  <td className="whitespace-nowrap">
                    {PENDING.includes(a.status) ? (
                      <span className="flex gap-1.5">
                        <Button size="sm" className="h-7 px-2.5 text-xs" disabled={busy === a.id} onClick={() => act(a, "shortlisted")}>Shortlist</Button>
                        <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" disabled={busy === a.id} aria-label={`Reject ${name}`} onClick={() => act(a, "rejected")}>Reject</Button>
                      </span>
                    ) : a.status === "shortlisted" ? (
                      <Button asChild size="sm" className="h-7 px-2.5 text-xs"><Link href={`/recruiter/applications/${a.id}`}>Schedule</Link></Button>
                    ) : (
                      <span className="text-[13px] text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[13px] text-muted-foreground">Showing {shown.length} of {rows.length}</span>
        {shown.length < rows.length && <Button size="sm" variant="outline" onClick={() => setLimit((n) => n + 8)}>Show more</Button>}
      </div>
      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-xl">{toast}</div>
      )}
    </section>
  );
}

function StageChip({ status }: { status: ApplicationStatus }) {
  const cls =
    status === "shortlisted" || status === "selected" ? "bg-matched/15 text-matched"
      : status === "rejected" ? "bg-absent/15 text-absent"
        : status === "interview" ? "bg-primary/15 text-primary"
          : status === "ai_assessed" || status === "recruiter_review" ? "bg-missing/15 text-missing"
            : "bg-secondary text-muted-foreground";
  return <span className={cn("whitespace-nowrap rounded-full px-2.5 py-[3px] text-xs font-semibold", cls)}>{statusLabel(status)}</span>;
}
