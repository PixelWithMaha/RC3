"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getApplication } from "@/lib/api";
import { WEIGHTS } from "@/lib/ai/scoring";
import type { RankedApplication } from "@/lib/types";
import { Excerpt, StatusBadge, VerifiedBadge } from "@/components/app/badges";
import { Avatar, Hero, ScoreRing } from "@/components/app/kit";
import { ProfileLinks } from "@/components/app/links";
import { Empty, ErrorState, Loading, useAsync } from "@/components/app/states";
import { cn } from "@/lib/utils";

type App = NonNullable<Awaited<ReturnType<typeof getApplication>>>;

/** TI-6: side-by-side evidence, gaps, missing information and score explanations. */
export default function Compare() {
  const ids = (useSearchParams().get("ids") ?? "").split(",").filter(Boolean).slice(0, 4);
  const { data, error, loading, reload } = useAsync(async () => (await Promise.all(ids.map(getApplication))).filter(Boolean) as App[], [ids.join(",")]);

  if (ids.length < 2) return <Empty art="compare" title="Pick at least two applicants">Tick candidates on a job&apos;s applicant list, then press Compare.</Empty>;
  if (loading) return <Loading />;
  if (error || !data) return <ErrorState message={error ?? "Could not load"} onRetry={reload} />;
  const jobId = data[0]?.job_id;
  const skills = [...new Set(data.flatMap((a) => [...(a.ai_explanation?.matched.map((m) => m.skill) ?? []), ...(a.ai_explanation?.gaps.map((g) => g.skill) ?? [])]))];
  const best = Math.max(...data.map((a) => a.effective_score ?? -1));

  return (
    <>
      {jobId && (
        <Link href={`/recruiter/jobs/${jobId}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {data[0].job_title}
        </Link>
      )}
      <Hero eyebrow="Side by side" title="Compare candidates" description="Same job, same evidence rules. Decisions stay with you." art="compare" />
      <div className="overflow-x-auto">
        <div className="grid min-w-[720px] gap-3" style={{ gridTemplateColumns: `160px repeat(${data.length}, minmax(0, 1fr))` }}>
          <div />
          {data.map((a) => (
            <div key={a.id} className={cn("dash-card flex flex-col items-center rounded-2xl border bg-surface p-4 text-center", a.effective_score === best ? "border-matched/60 shadow-[0_0_40px_-12px_rgba(45,212,191,0.55)]" : "border-border")}>
              <Avatar name={a.candidate_name ?? a.candidate_email} size={48} />
              <Link href={`/recruiter/applications/${a.id}`} className="mt-2 font-heading text-lg font-semibold hover:text-primary">{a.candidate_name ?? a.candidate_email ?? "Candidate"}</Link>
              <div className="mt-2"><ScoreRing value={a.effective_score} size={70} /></div>
              <div className="mt-2"><StatusBadge status={a.status} /></div>
              <ProfileLinks className="mt-2 justify-center" links={a.resume?.parsed?.contact.links} compact />
              {a.effective_score === best && <p className="mt-2 rounded-full bg-matched/15 px-2 py-0.5 text-xs text-matched">Highest score</p>}
            </div>
          ))}

          <Label>Score breakdown</Label>
          {data.map((a) => (
            <Cell key={a.id}>
              {(Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).map((k) => (
                <div key={k} className="mb-2">
                  <div className="mb-1 flex justify-between text-xs"><span className="capitalize">{k}</span><span className="font-mono">{a.score_breakdown ? Math.round(a.score_breakdown[k]) : "—"}</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${a.score_breakdown?.[k] ?? 0}%` }} /></div>
                </div>
              ))}
            </Cell>
          ))}

          <Label>Summary</Label>
          {data.map((a) => <Cell key={a.id}><p className="text-sm text-muted-foreground">{a.ai_explanation?.summary ?? a.match_error ?? "Not assessed"}</p></Cell>)}

          {skills.map((skill) => (
            <SkillRow key={skill} skill={skill} apps={data} />
          ))}

          <Label>Experience</Label>
          {data.map((a) => <Cell key={a.id}><p className="text-xs text-muted-foreground">{a.ai_explanation?.experience_note ?? "—"}</p></Cell>)}
          <Label>Projects</Label>
          {data.map((a) => <Cell key={a.id}><p className="text-xs text-muted-foreground">{a.ai_explanation?.project_note ?? "—"}</p></Cell>)}
          <Label>Missing information</Label>
          {data.map((a) => (
            <Cell key={a.id}>
              <MissingInfo app={a} />
            </Cell>
          ))}
        </div>
      </div>
    </>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="pt-3 text-xs uppercase tracking-wider text-muted-foreground">{children}</div>;
}
function Cell({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-border bg-surface/60 p-3">{children}</div>;
}

function SkillRow({ skill, apps }: { skill: string; apps: RankedApplication[] }) {
  return (
    <>
      <Label>{skill}</Label>
      {apps.map((a) => {
        const m = a.ai_explanation?.matched.find((x) => x.skill === skill);
        const g = a.ai_explanation?.gaps.find((x) => x.skill === skill);
        return (
          <Cell key={a.id}>
            {m ? (
              <>
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <span className={cn("rounded-full px-2 text-[11px] font-semibold", m.strength === "full" ? "bg-matched/15 text-matched" : "bg-missing/15 text-missing")}>{m.strength === "full" ? "Matched" : "Partial"}</span>
                  <VerifiedBadge verified={m.verified} />
                </div>
                {m.excerpt && <Excerpt>{m.excerpt}</Excerpt>}
              </>
            ) : g ? (
              <span className={cn("rounded-full px-2 text-[11px] font-semibold", g.type === "explicitly_lacking" ? "bg-absent/15 text-absent" : "bg-missing/15 text-missing")}>
                {g.type === "explicitly_lacking" ? "Confirmed absence" : "Missing evidence"}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </Cell>
        );
      })}
    </>
  );
}

function MissingInfo({ app }: { app: App }) {
  const p = app.resume?.parsed;
  const items = [
    !p?.education.length && "No education listed",
    !p?.projects.length && "No projects listed",
    p?.total_experience_years == null && "Years of experience unclear",
    (app.ai_explanation?.unsupported_claims.length ?? 0) > 0 && `${app.ai_explanation!.unsupported_claims.length} unverified AI claim(s)`,
    app.ai_explanation?.gaps.filter((g) => g.type === "not_mentioned" && g.required).length && `${app.ai_explanation!.gaps.filter((g) => g.type === "not_mentioned" && g.required).length} required skill(s) without evidence`,
  ].filter(Boolean) as string[];
  return items.length ? (
    <ul className="list-disc space-y-0.5 pl-4 text-xs text-missing">{items.map((i) => <li key={i}>{i}</li>)}</ul>
  ) : (
    <p className="text-xs text-matched">Nothing missing</p>
  );
}
