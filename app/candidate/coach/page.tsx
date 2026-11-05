"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, ArrowRight, Check, Copy, Download, GraduationCap, ShieldCheck, Sparkles, Wand2 } from "lucide-react";
import { getOpenJobs, getResumeCoaching, type CoachResponse } from "@/lib/api";
import type { CheckedSuggestion } from "@/lib/ai/coach";
import { findSkillSpans } from "@/lib/ai/evidence";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Hero, Skeleton, stagger } from "@/components/app/kit";
import { Empty, ErrorState, useAction, useAsync } from "@/components/app/states";
import { cn } from "@/lib/utils";

const STATUS = {
  safe: { label: "Safe to use", icon: ShieldCheck, cls: "border-matched/50 bg-matched/10 text-matched" },
  confirm: { label: "Confirm it's true", icon: AlertTriangle, cls: "border-missing/50 bg-missing/10 text-missing" },
  check: { label: "Adds something new", icon: AlertTriangle, cls: "border-absent/50 bg-absent/10 text-absent" },
} as const;

export default function ResumeCoach() {
  const params = useSearchParams();
  const router = useRouter();
  const jobs = useAsync(getOpenJobs);
  const [jobId, setJobId] = useState(params.get("job") ?? "");
  const [res, setRes] = useState<CoachResponse | null>(null);
  const action = useAction();
  const run = (id = jobId) => id && action.run("coach", async () => { setRes(null); setRes(await getResumeCoaching(id)); });

  return (
    <>
      <Hero eyebrow="Resume coach" title="Tailor your resume to a job"
        description="AI rephrases lines you already wrote so they speak the job's language. It can't add skills or numbers: anything new is flagged, and nothing changes until you edit your own resume."
        art="resume" />
      <div className="mb-6 flex flex-wrap gap-2">
        <Select className="h-11 min-w-[240px] flex-1" value={jobId} aria-label="Job to tailor for"
          onChange={(e) => { setJobId(e.target.value); setRes(null); router.replace(`/candidate/coach?job=${e.target.value}`); }}>
          <option value="">Choose a job…</option>
          {jobs.data?.map((j) => <option key={j.id} value={j.id}>{j.title}{j.location ? ` · ${j.location}` : ""}</option>)}
        </Select>
        <Button className="h-11" disabled={!jobId || !!action.busy} onClick={() => run()}>
          <Wand2 className="h-4 w-4" /> {action.busy ? "Coaching…" : res ? "Try again" : "Tailor my resume"}
        </Button>
      </div>

      {action.error && <ErrorState message={action.error} onRetry={() => run()} />}
      {action.busy && <div className="space-y-3"><Skeleton className="h-24" />{[0, 1, 2].map((i) => <Skeleton key={i} className="h-36" />)}</div>}
      {!res && !action.busy && !action.error && <Empty art="resume" title="Pick a job to get started">You&apos;ll see your own lines rewritten for that role, side by side.</Empty>}
      {res && !action.busy && <Results res={res} />}
    </>
  );
}

function Results({ res }: { res: CoachResponse }) {
  const gained = res.coverage.after.filter((k) => !res.coverage.before.includes(k));
  const download = () => {
    const txt = [
      `Resume suggestions for: ${res.job.title}`, "",
      ...(res.summary ? ["SUMMARY", res.summary.text, ""] : []),
      ...res.suggestions.flatMap((s, i) => [`${i + 1}. [${STATUS[s.status].label}]`, `Before: ${s.original}`, `After:  ${s.rewrite}`, `Why:    ${s.why}`, ""]),
      ...(res.honest_gaps.length ? ["GAPS TO BUILD (don't claim these)", ...res.honest_gaps.map((g) => `- ${g.skill}: ${g.advice}`)] : []),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([txt], { type: "text/plain" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `resume-suggestions-${res.job.title.replace(/\W+/g, "-").toLowerCase()}.txt` });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Coverage: before → after */}
      <section className="dash-card rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-semibold">Job skills proven in your experience</h2>
            <p className="text-sm text-muted-foreground">Rewording can move skills you already have into your work lines. It never adds new ones.</p>
          </div>
          <div className="flex items-center gap-3 font-heading text-3xl font-bold">
            <span className="text-muted-foreground">{res.coverage.before.length}</span>
            <ArrowRight className="h-6 w-6 text-primary" />
            <span className="text-matched">{res.coverage.after.length}</span>
            <span className="text-base font-normal text-muted-foreground">/ {res.coverage.total}</span>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {res.coverage.before.map((k) => <span key={k} className="rounded-full border border-matched/50 bg-matched/10 px-2.5 py-0.5 text-xs text-matched">✓ {k}</span>)}
          {gained.map((k) => <span key={k} className="rs-pop rounded-full border border-primary bg-primary/15 px-2.5 py-0.5 text-xs text-primary">↑ {k} now shown in work</span>)}
          {res.coverage.absent.map((k) => <span key={k} className="rounded-full border border-dashed border-absent/50 px-2.5 py-0.5 text-xs text-absent">{k} · not in your resume</span>)}
        </div>
        <div className="mt-4 flex justify-end"><Button size="sm" variant="outline" onClick={download}><Download className="h-4 w-4" /> Download suggestions</Button></div>
      </section>

      {res.summary && (
        <section className="dash-card rounded-2xl border border-border bg-surface p-5" style={stagger(1)}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 font-heading font-semibold"><Sparkles className="h-4 w-4 text-primary" /> Tailored summary</h3>
            <CopyBtn text={res.summary.text} />
          </div>
          <p className="text-sm leading-relaxed">{res.summary.text}</p>
          {(res.summary.new_skills.length > 0 || res.summary.new_numbers.length > 0) && (
            <p className="mt-2 text-xs text-absent">Mentions {[...res.summary.new_skills, ...res.summary.new_numbers].join(", ")}, which isn&apos;t in your resume. Remove it unless it&apos;s true.</p>
          )}
        </section>
      )}

      <h2 className="pt-2 font-heading text-lg font-semibold">Line-by-line rewrites</h2>
      {res.suggestions.length === 0 && <Empty art="resume" title="Your lines already fit this job well">No rewrites needed.</Empty>}
      {res.suggestions.map((s, i) => <SuggestionCard key={i} s={s} i={i} />)}
      {res.dropped > 0 && <p className="text-xs text-muted-foreground">{res.dropped} suggestion(s) were discarded because they didn&apos;t quote your resume exactly.</p>}

      {res.honest_gaps.length > 0 && (
        <section className="dash-card rounded-2xl border border-dashed border-border bg-surface/60 p-5">
          <h2 className="mb-1 flex items-center gap-2 font-heading text-lg font-semibold"><GraduationCap className="h-5 w-5 text-missing" /> Gaps no rewording can fix</h2>
          <p className="mb-3 text-sm text-muted-foreground">Your resume shows no evidence of these. Don&apos;t claim them; build them instead:</p>
          <div className="grid gap-2 md:grid-cols-2">
            {res.honest_gaps.map((g) => (
              <div key={g.skill} className="rounded-xl border border-border bg-background/40 p-3 text-sm">
                <p className="font-medium text-missing">{g.skill}</p>
                <p className="mt-0.5 text-muted-foreground">{g.advice}</p>
              </div>
            ))}
          </div>
        </section>
      )}
      <p className="text-center text-xs text-muted-foreground">
        Update your resume file, then <Link href="/candidate/resume" className="text-primary hover:underline">upload it again</Link> so recruiters see the new version.
      </p>
    </div>
  );
}

function SuggestionCard({ s, i }: { s: CheckedSuggestion; i: number }) {
  const st = STATUS[s.status];
  const Icon = st.icon;
  const flagged = [...s.new_skills, ...s.new_numbers];
  return (
    <div style={stagger(i + 2)} className="dash-card rounded-2xl border border-border bg-surface p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.section}</span>
        <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold", st.cls)}><Icon className="h-3.5 w-3.5" /> {st.label}</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-background/40 p-3">
          <p className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">Your line</p>
          <p className="font-mono text-[13px] text-foreground/75">{s.original}</p>
        </div>
        <div className={cn("rounded-xl border p-3", s.status === "safe" ? "border-matched/40 bg-matched/5" : s.status === "confirm" ? "border-missing/40 bg-missing/5" : "border-absent/40 bg-absent/5")}>
          <div className="mb-1 flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-wider text-primary">Suggested</p>
            <CopyBtn text={s.rewrite} />
          </div>
          <p className="text-[13px] leading-relaxed"><Highlighted text={s.rewrite} good={s.emphasized} bad={[...s.new_skills, ...s.borrowed_skills]} numbers={s.new_numbers} /></p>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{s.why}</p>
      {s.emphasized.length > 0 && <p className="mt-1 text-xs text-matched">Shows the job&apos;s: {s.emphasized.join(", ")}</p>}
      {s.borrowed_skills.length > 0 && <p className="mt-1 text-xs text-missing">Adds {s.borrowed_skills.join(", ")} from elsewhere in your resume. Only keep it if you used it in this role.</p>}
      {flagged.length > 0 && <p className="mt-1 text-xs text-absent">Mentions {flagged.join(", ")}, which your resume never states. Remove it unless it&apos;s true.</p>}
    </div>
  );
}

function Highlighted({ text, good, bad, numbers }: { text: string; good: string[]; bad: string[]; numbers: string[] }) {
  const marks: { s: number; e: number; kind: "good" | "bad" }[] = [];
  for (const k of good) for (const [s, e] of findSkillSpans(text, k)) marks.push({ s, e, kind: "good" });
  for (const k of bad) for (const [s, e] of findSkillSpans(text, k)) marks.push({ s, e, kind: "bad" });
  for (const n of numbers) { const at = text.toLowerCase().indexOf(n); if (at >= 0) marks.push({ s: at, e: at + n.length, kind: "bad" }); }
  marks.sort((a, b) => a.s - b.s);
  const out: React.ReactNode[] = [];
  let at = 0;
  marks.forEach((m, i) => {
    if (m.s < at) return;
    out.push(text.slice(at, m.s), <mark key={i} className={cn("rounded px-0.5", m.kind === "good" ? "bg-matched/25 text-matched" : "bg-absent/25 text-absent")}>{text.slice(m.s, m.e)}</mark>);
    at = m.e;
  });
  out.push(text.slice(at));
  return <>{out}</>;
}

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" aria-label="Copy" onClick={() => { navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }); }}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground">
      {done ? <Check className="h-3.5 w-3.5 text-matched" /> : <Copy className="h-3.5 w-3.5" />} {done ? "Copied" : "Copy"}
    </button>
  );
}
