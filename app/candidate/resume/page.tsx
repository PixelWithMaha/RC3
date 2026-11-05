"use client";

import { useMemo, useRef, useState } from "react";
import { Check, FileText, Plus, Trash2, Upload, X } from "lucide-react";
import { getMyResume, parseResume, saveParsedResume, uploadResume } from "@/lib/api";
import { GROUP_ORDER, assessSkill, findSkillSpans, mentions, resumeSources, skillGroup, type SkillEvidence, type Tier } from "@/lib/ai/evidence";
import { normalizeSkill, sameSkill } from "@/lib/ai/normalize";
import type { ParsedResume, Resume } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorState, Loading, useAsync } from "@/components/app/states";
import { cn } from "@/lib/utils";

const delay = (i: number) => ({ animationDelay: `${Math.min(i * 45, 1300)}ms` });
const STEPS = ["Resume uploaded", "Text extracted", "Skills normalised", "Evidence linked"];
const TIER: Record<Tier, { label: string; hint: string; pill: string; meter: string }> = {
  proven: { label: "Proven in work", hint: "Backed by your experience or projects", pill: "border-matched text-matched bg-matched/10", meter: "bg-matched" },
  listed: { label: "Listed only", hint: "Only appears in your skills list", pill: "border-missing text-missing bg-missing/10", meter: "bg-missing" },
  none: { label: "No evidence", hint: "Not found in your resume text", pill: "border-absent text-absent bg-absent/10", meter: "bg-absent" },
};
const COMMON = ["Python", "Django", "Django REST Framework", "Flask", "FastAPI", "JavaScript", "TypeScript", "React", "Next.js", "Node.js", "PostgreSQL", "MySQL", "MongoDB", "Redis", "SQL", "Docker", "Docker Compose", "Kubernetes", "AWS", "CI/CD", "GitHub Actions", "Git", "REST API", "GraphQL", "Celery", "Linux"];

type Toast = { msg: string; error?: boolean; undo?: () => void } | null;

export default function ResumePage() {
  const { data: resume, error, loading, reload, setData } = useAsync(getMyResume);
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<"idle" | "busy" | "error">("idle");
  const [step, setStep] = useState(STEPS.length);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setPhase("busy");
    setUploadErr(null);
    setStep(0);
    // Steps advance while the real request runs; they all complete only when the server says so.
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 2500);
    try {
      await fn();
      const r = await getMyResume();
      setData(r);
      if (r && r.parse_status !== "success") throw new Error(r.parse_error ?? "Parsing failed. Please retry.");
      setStep(STEPS.length);
      setPhase("idle");
    } catch (e) {
      setUploadErr((e as Error).message);
      setPhase("error");
    } finally {
      clearInterval(timer);
    }
  };

  const onFile = (file?: File) => {
    if (!file) return;
    if (!/\.(pdf|docx)$/i.test(file.name)) {
      setUploadErr(`“${file.name}” is not a PDF or DOCX. Convert it and try again.`);
      setPhase("error");
      return;
    }
    run(() => uploadResume(file));
  };

  if (loading && !resume) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div className="pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[32px] font-bold">Your resume</h1>
          <p className="text-muted-foreground">We extract skills with the exact lines that prove them. Review and correct anything we got wrong.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {resume && (
            <span className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-[13px]">
              <FileText className="h-4 w-4 text-primary" /> <b>{resume.file_name}</b>
            </span>
          )}
          <input ref={fileRef} type="file" accept="application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
          <Button disabled={phase === "busy"} onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> {resume ? "Upload new resume" : "Upload PDF or DOCX"}
          </Button>
        </div>
      </div>

      {(resume || phase !== "idle") && <Steps step={step} failed={phase === "error"} />}
      {phase === "busy" && <p className="mb-4 text-sm text-muted-foreground">Extracting text and parsing with AI. This takes about 15–30 seconds.</p>}
      {uploadErr && (
        <div className="mb-4">
          <ErrorState message={uploadErr} onRetry={resume && phase === "error" ? () => run(() => parseResume(resume.id)) : undefined} />
        </div>
      )}

      {!resume && phase === "idle" && (
        <div className="mt-6 rounded-[18px] border border-dashed border-border bg-surface px-6 py-14 text-center">
          <FileText className="mx-auto mb-3 h-8 w-8 text-primary" />
          <p className="font-heading text-lg font-semibold">Upload your resume to get started</p>
          <p className="mt-1 text-sm text-muted-foreground">A text-based PDF or a Word (.docx) file, up to 5 MB. Scanned images can&apos;t be read.</p>
        </div>
      )}

      {resume?.parsed && resume.parse_status === "success" && phase !== "busy" && (
        <Editor key={resume.updated_at} resume={resume} onSaved={setData} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- pipeline steps
function Steps({ step, failed }: { step: number; failed: boolean }) {
  return (
    <div className="my-4 flex flex-wrap gap-2">
      {STEPS.map((s, i) => {
        const done = i < step;
        const running = i === step && !failed;
        const bad = i === step && failed;
        return (
          <div key={s} style={delay(i)} className={cn("dash-card flex min-w-[150px] flex-1 items-center gap-2.5 rounded-xl border bg-surface px-3 py-2.5 text-sm",
            running ? "border-primary text-foreground" : bad ? "border-absent text-absent" : done ? "border-border text-foreground" : "border-border text-muted-foreground")}>
            <span className={cn("grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-2 text-xs",
              done ? "rs-pop border-matched bg-matched text-background" : running ? "rs-spin border-primary border-r-transparent" : bad ? "border-absent" : "border-border")}>
              {done ? <Check className="h-3 w-3" /> : bad ? <X className="h-3 w-3" /> : null}
            </span>
            {s}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- editor
function Editor({ resume, onSaved }: { resume: Resume; onSaved: (r: Resume) => void }) {
  const original = resume.parsed!;
  const [parsed, setParsed] = useState<ParsedResume>(original);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [tab, setTab] = useState<Tier | "all">("all");
  const [q, setQ] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);
  const [newSkill, setNewSkill] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const sources = useMemo(() => resumeSources(parsed, resume.raw_text), [parsed, resume.raw_text]);
  const evidence = useMemo(() => parsed.skills.map((s) => assessSkill(s.name, s.excerpt, sources)), [parsed.skills, sources]);
  const count = { all: evidence.length, proven: 0, listed: 0, none: 0 } as Record<Tier | "all", number>;
  evidence.forEach((e) => count[e.tier]++);

  const show = (t: Toast) => {
    setToast(t);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), t?.undo ? 5000 : 2400);
  };
  const update = (p: ParsedResume) => { setParsed(p); setDirty(true); setSaved(false); };

  const completeness = useMemo(() => {
    const items = [!!parsed.name, !!parsed.contact.email, !!(parsed.contact.phone || parsed.contact.location), count.proven + count.listed >= 3, parsed.experience.length > 0, parsed.education.length > 0, parsed.projects.length > 0];
    return Math.round((items.filter(Boolean).length / items.length) * 100);
  }, [parsed, count.proven, count.listed]);

  const save = async () => {
    setSaving(true);
    try {
      onSaved(await saveParsedResume(resume.id, parsed));
      setDirty(false);
      setSaved(true);
      show({ msg: "Corrections saved" });
      setTimeout(() => setSaved(false), 2400);
    } catch (e) {
      show({ msg: (e as Error).message, error: true });
    } finally {
      setSaving(false);
    }
  };

  const remove = (name: string) => {
    setLeaving(name);
    setTimeout(() => {
      const i = parsed.skills.findIndex((s) => s.name === name);
      const removed = parsed.skills[i];
      const next = parsed.skills.filter((_, j) => j !== i);
      update({ ...parsed, skills: next });
      setLeaving(null);
      show({
        msg: `${name} removed`,
        undo: () => {
          setParsed((p) => ({ ...p, skills: [...p.skills.slice(0, i), removed, ...p.skills.slice(i)] }));
          setFresh(name);
          show({ msg: `${name} restored` });
        },
      });
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 280);
  };

  const add = () => {
    const raw = newSkill.trim();
    if (!raw) return;
    const name = normalizeSkill(raw);
    if (parsed.skills.some((s) => sameSkill(s.name, name))) return show({ msg: `${name} is already listed`, error: true });
    // Candidate-added skill: excerpt only if the resume text actually contains it (never invented).
    const line = sources.find((s) => mentions(s.text, name));
    update({ ...parsed, skills: [...parsed.skills, { name, excerpt: line?.text ?? "", verified: !!line }] });
    setNewSkill("");
    setTab("all");
    setQ("");
    setFresh(name);
    show({ msg: line ? `${name} added with proof` : `${name} added. No proof in your resume, so the recruiter will verify it.` });
  };

  const rename = (oldName: string, value: string) => {
    const name = normalizeSkill(value);
    if (!name || name === oldName) return;
    if (parsed.skills.some((s) => s.name !== oldName && sameSkill(s.name, name))) return show({ msg: `${name} is already listed`, error: true });
    update({ ...parsed, skills: parsed.skills.map((s) => (s.name === oldName ? { ...s, name } : s)) });
    setFresh(name);
  };

  const visible = evidence.filter((e) => (tab === "all" || e.tier === tab) && e.name.toLowerCase().includes(q.trim().toLowerCase()));
  const initials = (parsed.name ?? "?").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const circ = 2 * Math.PI * 30;
  let k = 0;

  return (
    <>
      {/* Profile */}
      <section style={delay(k++)} className="dash-card mb-4 grid items-center gap-5 rounded-[18px] border border-border bg-surface px-[22px] py-5 lg:grid-cols-[1.5fr_1.4fr_auto]">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-matched font-heading text-xl font-bold text-white">{initials}</div>
          <div className="min-w-0">
            <input aria-label="Your name" value={parsed.name ?? ""} placeholder="Your name"
              onChange={(e) => update({ ...parsed, name: e.target.value })}
              className="w-full rounded-lg bg-transparent font-heading text-xl font-bold outline-none transition-colors hover:bg-secondary focus:bg-secondary focus:ring-2 focus:ring-primary" />
            <p className="truncate text-sm text-muted-foreground">
              {[parsed.contact.email, parsed.contact.phone, parsed.contact.location, parsed.total_experience_years != null && `${parsed.total_experience_years} years experience`].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          <Tile value={count.all} label="Skills" />
          <Tile value={count.proven} label="Proven in work" className="text-matched" />
          <Tile value={count.listed + count.none} label="Need proof" className="text-missing" />
        </div>
        <div className="flex items-center gap-4">
          <div className="relative h-[78px] w-[78px]" title="Profile completeness">
            <svg width="78" height="78" viewBox="0 0 78 78" className="-rotate-90" aria-hidden>
              <circle cx="39" cy="39" r="30" fill="none" strokeWidth="8" className="stroke-secondary" />
              <circle cx="39" cy="39" r="30" fill="none" strokeWidth="8" strokeLinecap="round" className="dash-ring stroke-matched" strokeDasharray={`${(circ * completeness) / 100} ${circ}`} />
            </svg>
            <b className="absolute inset-0 grid place-items-center font-heading text-lg">{completeness}%</b>
          </div>
          <Button onClick={save} disabled={saving} className={cn(saved && "bg-matched text-background hover:bg-matched")}>
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save corrections"}
          </Button>
        </div>
      </section>

      {/* Skills */}
      <section style={delay(k++)} className="dash-card mb-4 rounded-[18px] border border-border bg-surface px-[22px] py-5">
        <h2 className="font-heading text-xl font-bold">Skills ({count.all})</h2>
        <p className="text-[13px] text-muted-foreground">Names are normalized (e.g. JS → JavaScript). Click a name to rename it.</p>
        <div className="mb-1 mt-3.5 flex flex-wrap items-center gap-2.5">
          <Input className="min-w-[180px] flex-1" placeholder="Search skills" aria-label="Search skills" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="flex gap-1 rounded-[11px] bg-secondary p-1" role="tablist">
            {([["all", "All"], ["proven", "Proven"], ["listed", "Listed only"], ["none", "No evidence"]] as const).map(([t, l]) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                className={cn("rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors", tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                {l} {count[t]}
              </button>
            ))}
          </div>
        </div>
        {GROUP_ORDER.map((g) => {
          const list = visible.filter((e) => skillGroup(e.name) === g);
          if (!list.length) return null;
          return (
            <div key={g}>
              <div className="mb-2 mt-[18px] flex items-center gap-2 text-xs uppercase tracking-[0.08em] text-muted-foreground after:h-px after:flex-1 after:bg-border">{g} · {list.length}</div>
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
                {list.map((e) => (
                  <SkillCard key={e.name} ev={e} i={k++} fresh={fresh === e.name} leaving={leaving === e.name} onRemove={() => remove(e.name)} onRename={(v) => rename(e.name, v)} />
                ))}
              </div>
            </div>
          );
        })}
        {!visible.length && <p className="mt-3.5 text-[13px] text-muted-foreground">No skills match.</p>}
        <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <Input className="flex-1" placeholder="Add a missing skill" aria-label="Add a missing skill" list="rs-skills" value={newSkill} onChange={(e) => setNewSkill(e.target.value)} />
          <datalist id="rs-skills">{COMMON.map((c) => <option key={c} value={c} />)}</datalist>
          <Button type="submit" variant="outline"><Plus className="h-4 w-4" /> Add</Button>
        </form>
      </section>

      {/* Experience / Education / Projects */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <section style={delay(k++)} className="dash-card rounded-[18px] border border-border bg-surface px-[22px] py-5">
            <h2 className="font-heading text-xl font-bold">Experience ({parsed.experience.length})</h2>
            <div className="relative before:absolute before:bottom-2.5 before:left-[5px] before:top-5 before:w-0.5 before:bg-border">
              {parsed.experience.map((e, i) => (
                <Entry key={i} i={k++} timeline title={`${e.title}${e.company ? ` · ${e.company}` : ""}`} meta={[e.start, e.end].filter(Boolean).join(" – ")} verified={e.verified}
                  body={e.description} skills={parsed.skills.map((s) => s.name).filter((n) => mentions(e.description, n))} />
              ))}
              {!parsed.experience.length && <p className="mt-3 text-[13px] text-muted-foreground">No experience found.</p>}
            </div>
          </section>
          <section style={delay(k++)} className="dash-card rounded-[18px] border border-border bg-surface px-[22px] py-5">
            <h2 className="font-heading text-xl font-bold">Education ({parsed.education.length})</h2>
            {parsed.education.map((e, i) => (
              <Entry key={i} i={k++} title={[e.degree, e.field].filter(Boolean).join(", ") || e.institution} meta={`${e.institution} ${[e.start, e.end].filter(Boolean).join(" – ")}`} verified={e.verified} />
            ))}
            {!parsed.education.length && <p className="mt-3 text-[13px] text-muted-foreground">No education found.</p>}
          </section>
        </div>
        <section style={delay(k++)} className="dash-card h-fit rounded-[18px] border border-border bg-surface px-[22px] py-5">
          <h2 className="font-heading text-xl font-bold">Projects ({parsed.projects.length})</h2>
          {parsed.projects.map((p, i) => (
            <Entry key={i} i={k++} title={p.name} verified={p.verified} body={p.description}
              skills={[...new Set([...p.technologies, ...parsed.skills.map((s) => s.name).filter((n) => mentions(p.description, n))])]} />
          ))}
          {!parsed.projects.length && <p className="mt-3 text-[13px] text-muted-foreground">No projects found.</p>}
        </section>
      </div>

      {/* Unsaved bar */}
      <div className={cn("fixed inset-x-0 bottom-0 z-30 flex items-center justify-between border-t border-border bg-background/90 px-[4vw] py-3 backdrop-blur transition-transform duration-500",
        dirty ? "translate-y-0" : "translate-y-[110%]")} aria-hidden={!dirty}>
        <b className="flex items-center gap-2"><span className="dash-ping h-2 w-2 rounded-full bg-missing" /> Unsaved corrections</b>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { setParsed(original); setDirty(false); show({ msg: "Changes discarded" }); }}>Discard</Button>
          <Button size="sm" onClick={save} disabled={saving}>Save corrections</Button>
        </div>
      </div>

      {toast && (
        <div role="status" className={cn("fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-white shadow-xl", toast.error ? "bg-absent" : "bg-primary", dirty && "bottom-20")}>
          {toast.msg}
          {toast.undo && <button onClick={() => { toast.undo!(); setDirty(true); }} className="rounded-lg bg-white/20 px-2.5 py-0.5 font-semibold">Undo</button>}
        </div>
      )}
    </>
  );
}

function Tile({ value, label, className }: { value: number; label: string; className?: string }) {
  return (
    <div className="rounded-xl bg-secondary px-3 py-2.5">
      <b className={cn("block font-heading text-[26px] leading-tight", className)}>{value}</b>
      <span className="text-[13px] text-muted-foreground">{label}</span>
    </div>
  );
}

function Highlight({ text, skill }: { text: string; skill: string }) {
  const spans = findSkillSpans(text, skill);
  if (!spans.length) return <>{text}</>;
  const out: React.ReactNode[] = [];
  let at = 0;
  spans.forEach(([s, e], i) => {
    out.push(text.slice(at, s), <mark key={i} className="rounded bg-matched/30 px-0.5 text-inherit">{text.slice(s, e)}</mark>);
    at = e;
  });
  out.push(text.slice(at));
  return <>{out}</>;
}

function SkillCard({ ev, i, fresh, leaving, onRemove, onRename }: { ev: SkillEvidence; i: number; fresh: boolean; leaving: boolean; onRemove: () => void; onRename: (v: string) => void }) {
  const t = TIER[ev.tier];
  const rest = ev.mentions.filter((m) => m !== ev.best);
  return (
    <div style={delay(i)} className={cn("dash-card rs-lift rounded-[14px] border border-border bg-secondary/50 px-3.5 py-3", fresh && "rs-pop", leaving && "rs-out")}>
      <div className="flex items-center gap-2">
        <input defaultValue={ev.name} aria-label="Skill name" onBlur={(e) => onRename(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="-ml-1.5 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-[15px] font-semibold outline-none hover:border-border focus:border-primary" />
        <span title={t.hint} className={cn("whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold", t.pill)}>{t.label}</span>
        <button onClick={onRemove} aria-label={`Remove ${ev.name}`} className="rounded-lg p-1 text-muted-foreground opacity-60 transition hover:bg-absent/15 hover:text-absent hover:opacity-100">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="my-2 text-[13px] text-muted-foreground">
        {ev.best ? (
          <>
            <span className="mb-0.5 block text-[11px] uppercase tracking-[0.06em] text-primary">{ev.best.label}</span>
            <span className="font-mono text-[12.5px] text-foreground/90"><Highlight text={ev.best.text} skill={ev.name} /></span>
          </>
        ) : "We couldn't find this in your resume text. The recruiter will verify it."}
      </div>
      <div className="h-[5px] overflow-hidden rounded-full bg-border">
        <i className={cn("dash-bar block h-full rounded-full", t.meter)} style={{ width: `${Math.min(ev.mentions.length, 4) * 25 || 8}%` }} />
      </div>
      {rest.length ? (
        <details className="mt-1.5 text-[12.5px] text-muted-foreground">
          <summary className="cursor-pointer text-primary">{ev.mentions.length} mentions · show all</summary>
          {rest.map((m, j) => (
            <div key={j} className="mt-1.5 border-l-2 border-border pl-2">
              <span className="block text-[11px] uppercase tracking-[0.06em] text-primary">{m.label}</span>
              <Highlight text={m.text} skill={ev.name} />
            </div>
          ))}
        </details>
      ) : (
        <p className="mt-1.5 text-[13px] text-muted-foreground">{ev.mentions.length} mention{ev.mentions.length === 1 ? "" : "s"}</p>
      )}
    </div>
  );
}

function Entry({ i, title, meta, verified, body, skills, timeline }: { i: number; title: string; meta?: string; verified: boolean; body?: string; skills?: string[]; timeline?: boolean }) {
  return (
    <div style={delay(i)} className={cn("dash-card rs-nudge relative mt-3 rounded-[14px] border border-border bg-secondary/50 px-[15px] py-[13px]",
      timeline && "ml-[18px] before:absolute before:-left-[23px] before:top-5 before:h-[11px] before:w-[11px] before:rounded-full before:bg-primary before:shadow-[0_0_0_4px_hsl(var(--primary)/0.25)]")}>
      <div className="flex items-start justify-between gap-2">
        <b>{title}</b>
        <span className={cn("whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold", verified ? "border-matched bg-matched/10 text-matched" : "border-missing bg-missing/10 text-missing")}>
          {verified ? "✓ Verified" : "⚠ Unverified"}
        </span>
      </div>
      {meta && <p className="text-[13px] text-muted-foreground">{meta}</p>}
      {body && <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>}
      {!!skills?.length && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {skills.map((s) => <span key={s} className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs text-primary">{s}</span>)}
        </div>
      )}
    </div>
  );
}
