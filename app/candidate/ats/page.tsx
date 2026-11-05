"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { CheckCircle2, Copy, Download, FileText, Printer, ShieldCheck, Upload, Wand2, XCircle } from "lucide-react";
import { getMyResume, getOpenJobs, makeAtsResume, uploadResume, type AtsResponse } from "@/lib/api";
import { docToText, type AtsCheck } from "@/lib/ai/ats";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Hero, ScoreRing, Skeleton, stagger } from "@/components/app/kit";
import { Empty, ErrorState, Loading, useAction, useAsync } from "@/components/app/states";
import { cn } from "@/lib/utils";

export default function AtsResume() {
  const resume = useAsync(getMyResume);
  const jobs = useAsync(getOpenJobs);
  const [jobId, setJobId] = useState("");
  const [res, setRes] = useState<AtsResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const action = useAction();
  const ready = resume.data?.parse_status === "success";

  const generate = () => action.run("gen", async () => { setRes(null); setRes(await makeAtsResume(jobId || undefined)); });
  const upload = (f?: File) => f && action.run("upload", async () => {
    setRes(null);
    const r = await uploadResume(f);
    if (r.parse_status !== "success") throw new Error(r.error ?? "Could not read that resume.");
    await resume.reload();
  });
  const downloadTxt = () => {
    if (!res) return;
    const url = URL.createObjectURL(new Blob([docToText(res.doc)], { type: "text/plain" }));
    Object.assign(document.createElement("a"), { href: url, download: `${res.doc.name.replace(/\W+/g, "-").toLowerCase()}-ats-resume.txt` }).click();
    URL.revokeObjectURL(url);
  };

  if (resume.loading && !resume.data) return <Loading />;

  return (
    <>
      <Hero eyebrow="ATS resume" title="Make your resume ATS-friendly"
        description="Upload any resume and get a clean, single-column version with standard headings and action-verb bullets that applicant tracking systems read reliably. Same facts, never invented."
        art="resume" />

      <div className="dash-card mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-4">
        <FileText className="h-5 w-5 text-primary" />
        <span className="text-sm">
          {resume.data ? <><b>{resume.data.file_name}</b> <span className={ready ? "text-matched" : "text-missing"}>· {resume.data.parse_status}</span></> : <span className="text-muted-foreground">No resume yet</span>}
        </span>
        <input ref={fileRef} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden
          onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
        <Button size="sm" variant="outline" disabled={!!action.busy} onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" /> {action.busy === "upload" ? "Uploading & reading…" : resume.data ? "Upload a different resume" : "Upload PDF or DOCX"}
        </Button>
        <div className="ml-auto flex flex-wrap gap-2">
          <Select className="w-60" value={jobId} onChange={(e) => setJobId(e.target.value)} aria-label="Optional target job">
            <option value="">No target job (general)</option>
            {jobs.data?.map((j) => <option key={j.id} value={j.id}>Align to: {j.title}</option>)}
          </Select>
          <Button disabled={!ready || !!action.busy} onClick={generate}><Wand2 className="h-4 w-4" /> {action.busy === "gen" ? "Formatting…" : res ? "Regenerate" : "Make ATS-friendly"}</Button>
        </div>
      </div>

      {action.error && <div className="mb-4"><ErrorState message={action.error} onRetry={action.busy ? undefined : generate} /></div>}
      {action.busy === "gen" && <div className="grid gap-4 lg:grid-cols-[1fr_340px]"><Skeleton className="h-[600px]" /><Skeleton className="h-[400px]" /></div>}
      {!res && !action.busy && (
        <Empty art="resume" title={ready ? "Ready when you are" : "Upload your resume first"}>
          {ready ? "Click “Make ATS-friendly”. Optionally pick a job to align the wording to its keywords." : "Any PDF or Word resume works, as long as it has selectable text."}
        </Empty>
      )}

      {res && !action.busy && (
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => window.print()}><Printer className="h-4 w-4" /> Download PDF</Button>
              <Button size="sm" variant="outline" onClick={downloadTxt}><Download className="h-4 w-4" /> Download .txt</Button>
              <Button size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(docToText(res.doc)).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}>
                <Copy className="h-4 w-4" /> {copied ? "Copied" : "Copy text"}
              </Button>
            </div>
            <Paper res={res} />
            <p className="mt-2 text-xs text-muted-foreground">“Download PDF” opens your browser&apos;s print dialog. Choose <b>Save as PDF</b>; the result is text-based, which ATS software reads.</p>
          </div>
          <aside className="space-y-4">
            <section style={stagger(1)} className="dash-card rounded-2xl border border-border bg-surface p-5">
              <h2 className="mb-3 font-heading text-lg font-semibold">ATS check</h2>
              <div className="flex items-center justify-around">
                <div className="text-center"><ScoreRing value={res.before.score} size={86} /><p className="mt-1 text-xs text-muted-foreground">Original</p></div>
                <span className="text-2xl text-muted-foreground">→</span>
                <div className="text-center"><ScoreRing value={res.after.score} size={86} /><p className="mt-1 text-xs text-matched">ATS version</p></div>
              </div>
              <ul className="mt-4 space-y-2">{res.after.checks.map((c) => <CheckRow key={c.id} c={c} before={res.before.checks.find((b) => b.id === c.id)} />)}</ul>
            </section>
            <section style={stagger(2)} className="dash-card rounded-2xl border border-border bg-surface p-5 text-sm">
              <h2 className="mb-2 flex items-center gap-2 font-heading text-lg font-semibold"><ShieldCheck className="h-5 w-5 text-matched" /> Kept truthful</h2>
              <p className="text-muted-foreground">Every skill and number was checked against your resume text.</p>
              <ul className="mt-2 space-y-1 text-xs">
                <li>{res.kept_original === 0 ? "✓ All bullets rewritten faithfully" : `↺ ${res.kept_original} bullet(s) kept in your own words (the rewrite added something new)`}</li>
                <li>{res.removed_skills.length ? `✕ Not included (not in your resume): ${res.removed_skills.join(", ")}` : "✓ No skills were invented"}</li>
                <li>✓ Contact details filled in from your resume, never sent to the AI</li>
              </ul>
              {res.job && <p className="mt-3 text-xs text-muted-foreground">Wording aligned to <Link className="text-primary hover:underline" href={`/candidate/jobs/${res.job.id}`}>{res.job.title}</Link>. Want deeper tailoring? Try the <Link href={`/candidate/coach?job=${res.job.id}`} className="text-primary hover:underline">resume coach</Link>.</p>}
            </section>
          </aside>
        </div>
      )}
    </>
  );
}

function CheckRow({ c, before }: { c: AtsCheck; before?: AtsCheck }) {
  const fixed = c.pass && before && !before.pass;
  return (
    <li className="flex items-start gap-2 text-sm">
      {c.pass ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-matched" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-missing" />}
      <span className="min-w-0">
        {c.label}
        <span className="block text-xs text-muted-foreground">{c.detail}{fixed && <span className="ml-1 text-matched">· fixed</span>}</span>
      </span>
    </li>
  );
}

/** The ATS document itself: plain, single column, standard headings, black on white (also what gets printed). */
function Paper({ res }: { res: AtsResponse }) {
  const d = res.doc;
  const H = ({ children }: { children: React.ReactNode }) => <h3 className="mb-1.5 mt-5 border-b border-neutral-300 pb-1 text-[13px] font-bold uppercase tracking-wide text-neutral-900">{children}</h3>;
  return (
    <article id="ats-doc" style={stagger(0)} className="dash-card rounded-xl border border-border bg-white px-8 py-8 font-sans text-[13.5px] leading-relaxed text-neutral-800 shadow-2xl sm:px-12">
      <h2 className="text-2xl font-bold text-neutral-900" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>{d.name}</h2>
      <p className="text-neutral-600">{d.contact.join(" | ")}</p>
      {d.summary && (<><H>Summary</H><p>{d.summary}</p></>)}
      {d.skills.length > 0 && (<><H>Skills</H>{d.skills.map((g) => <p key={g.category}><b className="text-neutral-900">{g.category}:</b> {g.items.join(", ")}</p>)}</>)}
      {d.experience.length > 0 && (<><H>Experience</H>{d.experience.map((e, i) => (
        <div key={i} className="mb-3">
          <p className="flex flex-wrap justify-between gap-2"><b className="text-neutral-900">{e.title}{e.company ? `, ${e.company}` : ""}</b><span className="text-neutral-600">{e.dates}</span></p>
          <ul className="ml-5 list-disc">{e.bullets.map((b, k) => <li key={k} className={cn(b.kept === "original" && "print:bg-transparent")} title={b.kept === "original" ? "Kept in your own words" : `Original: ${b.original}`}>{b.text}</li>)}</ul>
        </div>
      ))}</>)}
      {d.projects.length > 0 && (<><H>Projects</H>{d.projects.map((p, i) => (
        <div key={i} className="mb-2"><b className="text-neutral-900">{p.name}</b><ul className="ml-5 list-disc">{p.bullets.map((b, k) => <li key={k}>{b.text}</li>)}</ul></div>
      ))}</>)}
      {d.education.length > 0 && (<><H>Education</H>{d.education.map((e, i) => <p key={i} className="flex flex-wrap justify-between gap-2"><span>{e.line}</span><span className="text-neutral-600">{e.dates}</span></p>)}</>)}
    </article>
  );
}
