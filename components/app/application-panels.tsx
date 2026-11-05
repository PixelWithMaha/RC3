"use client";

import { useState } from "react";
import { AlertTriangle, CalendarPlus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import {
  addNote, changeApplicationStatus, deleteQuestion, generateQuestions, getApplicationEvents, getInterviews,
  getNotes, getQuestions, overrideScore, saveInterviewFeedback, scheduleInterview, updateQuestion,
} from "@/lib/api";
import type { ApplicationStatus, ConflictCheckResponse, Difficulty, InterviewFeedback, InterviewType, RankedApplication } from "@/lib/types";
import { WEIGHTS } from "@/lib/ai/scoring";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Excerpt, statusLabel, VerifiedBadge } from "@/components/app/badges";
import { ErrorState, Loading, useAction, useAsync } from "@/components/app/states";
import { cn } from "@/lib/utils";

// Mirrors public.is_valid_transition (human actions only)
const NEXT: Partial<Record<ApplicationStatus, ApplicationStatus[]>> = {
  submitted: ["recruiter_review", "shortlisted", "rejected"],
  parsed: ["recruiter_review", "shortlisted", "rejected"],
  ai_assessed: ["recruiter_review", "shortlisted", "rejected"],
  recruiter_review: ["shortlisted", "rejected"],
  shortlisted: ["interview", "rejected", "recruiter_review"],
  interview: ["selected", "rejected"],
};

// ---------------------------------------------------------------- status actions (PIPE-3, INT-5)
export function StatusActions({ app, onChanged }: { app: RankedApplication; onChanged: () => void }) {
  const [reason, setReason] = useState("");
  const action = useAction();
  const options = NEXT[app.status] ?? [];
  if (!options.length) return <p className="text-sm text-muted-foreground">Final decision recorded.</p>;
  return (
    <div className="space-y-2">
      <Input placeholder="Reason (optional, saved to the audit trail)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        {options.map((s) => (
          <Button key={s} size="sm" variant={s === "rejected" ? "outline" : s === "shortlisted" || s === "selected" ? "default" : "secondary"}
            className={cn(s === "rejected" && "border-absent/50 text-absent hover:bg-absent/10")}
            disabled={!!action.busy}
            onClick={() => action.run(s, async () => { await changeApplicationStatus(app.id, s, reason || undefined); setReason(""); onChanged(); })}>
            {action.busy === s ? "…" : actionLabel(s)}
          </Button>
        ))}
      </div>
      {action.error && <ErrorState message={action.error} />}
    </div>
  );
}
const actionLabel = (s: ApplicationStatus) =>
  ({ recruiter_review: "Move to review", shortlisted: "Shortlist", rejected: "Reject", interview: "Move to interview", selected: "Select (final)" } as Record<string, string>)[s] ?? statusLabel(s);

// ---------------------------------------------------------------- score (MATCH-2/3/6)
export function ScoreCard({ app, onRescore, rescoring, onChanged }: { app: RankedApplication; onRescore: () => void; rescoring: boolean; onChanged: () => void }) {
  const b = app.score_breakdown;
  const [score, setScore] = useState("");
  const [reason, setReason] = useState("");
  const action = useAction();
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Job-relevance score</CardTitle>
          <CardDescription>Weighted in code: 50% skills · 25% experience · 15% projects · 10% qualifications</CardDescription>
        </div>
        <Button size="sm" variant="outline" disabled={rescoring} onClick={onRescore}>
          <RefreshCw className={cn("h-4 w-4", rescoring && "animate-spin")} /> {rescoring ? "Scoring…" : "Re-score"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {!b ? (
          <p className="text-sm text-muted-foreground">{app.match_error ?? "Not assessed yet."}</p>
        ) : (
          <>
            <div className="flex items-end gap-4">
              <span className="font-heading text-5xl font-bold">{Math.round(app.effective_score ?? app.ai_score ?? 0)}</span>
              <div className="pb-1 text-xs text-muted-foreground">
                {app.override_score != null && <p className="text-missing">Override (AI said {Math.round(app.ai_score ?? 0)}): {app.override_reason}</p>}
                {app.semantic_similarity != null && <p>Semantic similarity (embeddings): {(app.semantic_similarity * 100).toFixed(0)}%</p>}
              </div>
            </div>
            {(Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).map((k) => (
              <div key={k}>
                <div className="mb-1 flex justify-between text-xs"><span className="capitalize">{k} <span className="text-muted-foreground">×{WEIGHTS[k]}</span></span><span className="font-mono">{Math.round(b[k])}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${b[k]}%` }} /></div>
              </div>
            ))}
          </>
        )}
        <form className="flex flex-wrap gap-2 border-t border-border pt-4"
          onSubmit={(e) => { e.preventDefault(); action.run("ov", async () => { await overrideScore(app.id, Number(score), reason); setScore(""); setReason(""); onChanged(); }); }}>
          <Input type="number" min={0} max={100} required placeholder="Override" className="w-28" value={score} onChange={(e) => setScore(e.target.value)} />
          <Input required placeholder="Reason for override" className="min-w-0 flex-1" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button size="sm" variant="secondary" disabled={!!action.busy}>Override</Button>
        </form>
        {action.error && <ErrorState message={action.error} />}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------- evidence & gaps (GAP-1..4, TI-8)
export function EvidenceCard({ app }: { app: RankedApplication }) {
  const x = app.ai_explanation;
  if (!x) return null;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Evidence &amp; gaps</CardTitle><CardDescription>{x.summary}</CardDescription></CardHeader>
      <CardContent className="space-y-5 text-sm">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Matched</p>
          {x.matched.length === 0 && <p className="text-muted-foreground">No matched skills.</p>}
          {x.matched.map((m) => (
            <div key={m.skill} className="rounded-lg border border-matched/30 bg-matched/5 p-3">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="font-medium text-matched">{m.skill}</span>
                {m.resume_skill && m.resume_skill !== m.skill && <span className="text-xs text-muted-foreground">via {m.resume_skill}</span>}
                <span className="rounded-full border border-border px-2 text-[11px]">{m.strength}</span>
                <VerifiedBadge verified={m.verified} />
              </div>
              {m.excerpt && <Excerpt>{m.excerpt}</Excerpt>}
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Gaps</p>
          {x.gaps.length === 0 && <p className="text-muted-foreground">No gaps found.</p>}
          {x.gaps.map((g) => (
            <div key={g.skill} className={cn("rounded-lg border p-3", g.type === "explicitly_lacking" ? "border-absent/40 bg-absent/5" : "border-missing/40 bg-missing/5")}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{g.skill}</span>
                <span className={cn("rounded-full px-2 text-[11px]", g.type === "explicitly_lacking" ? "bg-absent/20 text-absent" : "bg-missing/20 text-missing")}>
                  {g.type === "explicitly_lacking" ? "Confirmed absence" : "Missing evidence"}
                </span>
                {!g.required && <span className="text-[11px] text-muted-foreground">preferred</span>}
              </div>
              {g.excerpt && <p className="mt-1"><Excerpt>{g.excerpt}</Excerpt></p>}
              <p className="mt-1 text-xs text-muted-foreground">Learning area: {g.learning_suggestion}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
          <p><b className="text-foreground">Experience:</b> {x.experience_note}</p>
          <p><b className="text-foreground">Projects:</b> {x.project_note}</p>
          <p><b className="text-foreground">Qualifications:</b> {x.qualification_note}</p>
        </div>
        {x.unsupported_claims.length > 0 && (
          <div className="rounded-lg border border-missing/40 bg-missing/10 p-3 text-xs text-missing">
            <p className="mb-1 flex items-center gap-1 font-medium"><AlertTriangle className="h-3.5 w-3.5" /> Unverified AI claims (scored at most partial)</p>
            <ul className="list-disc pl-5">{x.unsupported_claims.map((c) => <li key={c}>{c}</li>)}</ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------- notes (PIPE-4) + audit trail (PIPE-5)
export function NotesCard({ applicationId }: { applicationId: string }) {
  const notes = useAsync(() => getNotes(applicationId), [applicationId]);
  const [text, setText] = useState("");
  const action = useAction();
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Private notes</CardTitle><CardDescription>Never visible to the candidate.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); action.run("note", async () => { await addNote(applicationId, text); setText(""); await notes.reload(); }); }}>
          <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a note…" />
          <Button size="sm" disabled={!text.trim() || !!action.busy}>Add note</Button>
        </form>
        {action.error && <ErrorState message={action.error} />}
        {notes.loading && <Loading className="py-2" />}
        {notes.data?.map((n) => (
          <div key={n.id} className="rounded-lg bg-secondary/60 p-2.5 text-sm">
            {n.note}<p className="text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function AuditCard({ applicationId, version }: { applicationId: string; version: number }) {
  const ev = useAsync(() => getApplicationEvents(applicationId), [applicationId, version]);
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Audit trail</CardTitle></CardHeader>
      <CardContent>
        {ev.loading && <Loading className="py-2" />}
        {ev.error && <ErrorState message={ev.error} onRetry={ev.reload} />}
        <ol className="space-y-3 border-l border-border pl-4 text-sm">
          {ev.data?.map((e) => (
            <li key={e.id}>
              <p>
                {e.event_type === "status_change"
                  ? <>{e.from_status ? statusLabel(e.from_status) : "—"} → <b>{e.to_status ? statusLabel(e.to_status) : ""}</b></>
                  : <b>{e.event_type === "score_override" ? "Score override" : "Re-scored"}</b>}
              </p>
              <p className="text-xs text-muted-foreground">
                {e.changed_by ? "Recruiter" : "System (AI pipeline)"} · {new Date(e.created_at).toLocaleString()}
                {e.reason && <> · {e.reason}</>}
              </p>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------- questions (QUES-1..4)
const DIFFS: Difficulty[] = ["beginner", "intermediate", "advanced"];
export function QuestionsCard({ applicationId }: { applicationId: string }) {
  const qs = useAsync(() => getQuestions(applicationId), [applicationId]);
  const action = useAction();
  const gen = (difficulty?: Difficulty, regenerate = false) =>
    action.run(difficulty ?? "all", async () => { qs.setData(await generateQuestions(applicationId, { difficulty, regenerate })); });

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div><CardTitle className="text-base">Interview questions</CardTitle><CardDescription>Role questions target gaps; project questions use the candidate&apos;s own work.</CardDescription></div>
        <Button size="sm" disabled={!!action.busy} onClick={() => gen(undefined, !!qs.data?.length)}>
          <Sparkles className="h-4 w-4" /> {action.busy === "all" ? "Generating…" : qs.data?.length ? "Regenerate all" : "Generate"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {action.error && <ErrorState message={action.error} />}
        {qs.loading && <Loading className="py-2" />}
        {qs.data?.length === 0 && !action.busy && <p className="text-sm text-muted-foreground">No questions yet.</p>}
        {DIFFS.map((d) => {
          const list = qs.data?.filter((q) => q.difficulty === d) ?? [];
          if (!list.length) return null;
          return (
            <div key={d} className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{d}</p>
                <Button size="sm" variant="ghost" disabled={!!action.busy} onClick={() => gen(d, true)}>
                  <RefreshCw className={cn("h-3.5 w-3.5", action.busy === d && "animate-spin")} /> Regenerate
                </Button>
              </div>
              {list.map((q) => (
                <div key={q.id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 rounded bg-secondary px-1.5 text-[10px] uppercase">{q.category}</span>
                    <textarea
                      defaultValue={q.question}
                      aria-label="Question"
                      className="min-h-[2.5rem] flex-1 resize-none bg-transparent outline-none"
                      onBlur={(e) => e.target.value !== q.question && updateQuestion(q.id, { question: e.target.value })}
                    />
                    <Button size="icon" variant="ghost" aria-label="Remove question"
                      onClick={() => action.run("del", async () => { await deleteQuestion(q.id); qs.setData(qs.data!.filter((x) => x.id !== q.id)); })}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground"><b>Look for:</b> {q.answer_guideline}</p>
                </div>
              ))}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------- interviews (INT-1..4)
const TYPES: InterviewType[] = ["technical", "hr", "culture", "final"];
export function InterviewsCard({ app, onChanged }: { app: RankedApplication; onChanged: () => void }) {
  const list = useAsync(() => getInterviews(app.id), [app.id]);
  const [f, setF] = useState({ when: "", duration: "60", interviewer: "", type: "technical" as InterviewType });
  const [conflict, setConflict] = useState<ConflictCheckResponse | null>(null);
  const action = useAction();
  const canSchedule = ["shortlisted", "interview"].includes(app.status);

  const submit = (force: boolean) =>
    action.run("schedule", async () => {
      const r = await scheduleInterview({
        applicationId: app.id, candidateId: app.candidate_id, scheduledAt: new Date(f.when).toISOString(),
        durationMin: Number(f.duration), interviewerName: f.interviewer.trim(), type: f.type,
      }, force);
      if (!r.interview) { setConflict(r.conflicts); return; }
      setConflict(null);
      await list.reload();
      onChanged();
    });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Interviews</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {!canSchedule && <p className="text-sm text-muted-foreground">Shortlist the candidate to schedule an interview.</p>}
        {canSchedule && (
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); submit(false); }}>
            <div className="grid gap-1.5"><Label htmlFor="when">Date &amp; time</Label><Input id="when" type="datetime-local" required value={f.when} onChange={(e) => { setF({ ...f, when: e.target.value }); setConflict(null); }} /></div>
            <div className="grid gap-1.5"><Label htmlFor="dur">Duration (min)</Label><Input id="dur" type="number" min={5} max={480} value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label htmlFor="who">Interviewer</Label><Input id="who" required value={f.interviewer} onChange={(e) => { setF({ ...f, interviewer: e.target.value }); setConflict(null); }} /></div>
            <div className="grid gap-1.5"><Label htmlFor="typ">Type</Label>
              <Select id="typ" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as InterviewType })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</Select>
            </div>
            <Button className="sm:col-span-2" disabled={!!action.busy}><CalendarPlus className="h-4 w-4" /> {action.busy ? "Checking…" : "Schedule interview"}</Button>
          </form>
        )}
        {conflict?.conflict && (
          <div className="rounded-lg border border-missing/50 bg-missing/10 p-3 text-sm text-missing">
            <p className="flex items-center gap-1 font-medium"><AlertTriangle className="h-4 w-4" /> Scheduling conflict</p>
            {conflict.with?.map((c) => (
              <p key={c.interview_id} className="text-xs">Same {c.reason} already booked {new Date(c.scheduled_at).toLocaleString()} ({c.duration_min} min)</p>
            ))}
            <Button size="sm" variant="outline" className="mt-2" onClick={() => submit(true)}>Schedule anyway</Button>
          </div>
        )}
        {action.error && <ErrorState message={action.error} />}
        {list.data?.map((i) => <InterviewRow key={i.id} interview={i} onSaved={list.reload} />)}
      </CardContent>
    </Card>
  );
}

function InterviewRow({ interview: i, onSaved }: { interview: Awaited<ReturnType<typeof getInterviews>>[number]; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [fb, setFb] = useState<InterviewFeedback>(i.feedback ?? { technical: 3, communication: 3, problem_solving: 3, culture_fit: 3, strengths: "", concerns: "", recommendation: "hire" });
  const action = useAction();
  const rating = (k: "technical" | "communication" | "problem_solving" | "culture_fit") => (
    <div className="grid gap-1"><Label className="text-xs capitalize">{k.replace("_", " ")}</Label>
      <Select value={fb[k]} onChange={(e) => setFb({ ...fb, [k]: Number(e.target.value) })}>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</Select>
    </div>
  );
  return (
    <div className="rounded-lg border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>{new Date(i.scheduled_at).toLocaleString()} · {i.duration_min} min · {i.type} · {i.interviewer_name}</span>
        <span className="flex items-center gap-2"><span className="text-xs text-muted-foreground">{i.status}</span>
          <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)}>{i.feedback ? "View feedback" : "Add feedback"}</Button></span>
      </div>
      {open && (
        <form className="mt-3 grid gap-3" onSubmit={(e) => { e.preventDefault(); action.run("fb", async () => { await saveInterviewFeedback(i.id, fb); setOpen(false); onSaved(); }); }}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{rating("technical")}{rating("communication")}{rating("problem_solving")}{rating("culture_fit")}</div>
          <Textarea rows={2} placeholder="Strengths" value={fb.strengths} onChange={(e) => setFb({ ...fb, strengths: e.target.value })} />
          <Textarea rows={2} placeholder="Concerns" value={fb.concerns} onChange={(e) => setFb({ ...fb, concerns: e.target.value })} />
          <Select value={fb.recommendation} onChange={(e) => setFb({ ...fb, recommendation: e.target.value as InterviewFeedback["recommendation"] })}>
            <option value="strong_hire">Strong hire</option><option value="hire">Hire</option><option value="no_hire">No hire</option><option value="strong_no_hire">Strong no hire</option>
          </Select>
          <Button size="sm" disabled={!!action.busy}>Save feedback</Button>
          {action.error && <ErrorState message={action.error} />}
        </form>
      )}
    </div>
  );
}
