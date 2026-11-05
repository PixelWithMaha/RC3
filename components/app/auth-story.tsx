"use client";

// Auth side panel: a looping 3-step story — candidate shares, AI verifies, recruiter decides.
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

const STEPS = [
  { ms: 4800, title: "Step 1 · A candidate shares a resume", text: "They apply to a job and upload their CV." },
  { ms: 5600, title: "Step 2 · AI reads it and finds job-related evidence", text: "Skills are matched to the job and gaps are flagged, with excerpts." },
  { ms: 5400, title: "Step 3 · The recruiter reviews and makes the decision", text: "Scores are explainable. A human shortlists or rejects." },
];
const TONE = ["#E879F9", "#8B6BFF", "#2DD4BF"];

function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setR(m.matches);
    const f = () => setR(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return r;
}

export function AuthStory() {
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  const [cycle, setCycle] = useState(0); // remounts animations each loop
  useEffect(() => {
    if (reduced) { setStep(2); return; }
    const t = setTimeout(() => {
      setStep((s) => (s + 1) % 3);
      if (step === 2) setCycle((c) => c + 1);
    }, STEPS[step].ms);
    return () => clearTimeout(t);
  }, [step, reduced]);

  return (
    <div className="relative flex w-full flex-col items-center gap-5 px-6">
      <div className="text-center">
        <h2 className="font-heading text-[clamp(24px,2.6vw,32px)] font-bold leading-tight">
          <span className="text-fuchsia-400">Candidates share.</span>{" "}
          <span className="text-[#9B82FF]">AI verifies skills.</span>{" "}
          <span className="text-matched">Recruiters decide.</span>
        </h2>
        <span className="mt-2.5 inline-block rounded-full border border-border bg-surface/70 px-3.5 py-1 text-xs text-muted-foreground">
          Job: <b className="text-foreground">Backend Developer</b> · Python · Django · PostgreSQL · Docker
        </span>
      </div>

      <div key={cycle} className="flex w-full max-w-[720px] items-stretch" aria-hidden>
        <Stage i={0} step={step}>
          <Label i={0} text="Candidate" />
          <div className="flex items-center gap-2.5">
            <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-gradient-to-br from-fuchsia-400 to-primary text-xs font-semibold text-white">AK</span>
            <div><b className="block text-[13px]">Ayesha Khan</b><small className="text-[11px] text-muted-foreground">Applies to Backend Developer</small></div>
          </div>
          <div className="flex items-center gap-2 rounded-[10px] bg-secondary px-2.5 py-2 text-xs"><span className="rounded bg-absent px-1.5 py-0.5 text-[9px] font-bold text-white">PDF</span>Ayesha_CV.pdf</div>
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
            <motion.div className="h-full bg-gradient-to-r from-fuchsia-400 to-[#8B6BFF]" initial={{ width: reduced ? "100%" : "0%" }}
              animate={{ width: step >= 0 ? "100%" : "0%" }} transition={{ duration: reduced ? 0 : 2.6, delay: 0.3, ease: "easeOut" }} />
          </div>
          <Status show={step > 0 || (step === 0 && !reduced)} done={step > 0} delay={2.9} active={step === 0} a="Uploading resume…" b="✓ Resume shared with the recruiter" />
        </Stage>
        <Connector on={step >= 1} />
        <Stage i={1} step={step}>
          <Label i={1} text="TalentBridge AI" />
          <div className="relative grid gap-1.5 overflow-hidden rounded-[9px] bg-white p-2.5">
            <span className="h-1.5 rounded bg-[#D3D7E8]" />
            <Hl on={step >= 1} i={0}>Built REST APIs in Django</Hl>
            <span className="h-1.5 w-2/3 rounded bg-[#D3D7E8]" />
            <Hl on={step >= 1} i={1}>Docker for every service</Hl>
            <span className="h-1.5 rounded bg-[#D3D7E8]" />
            {step === 1 && !reduced && <motion.div className="absolute inset-x-0 h-6 bg-gradient-to-b from-transparent via-primary/70 to-transparent" initial={{ top: "-20%" }} animate={{ top: "110%" }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }} />}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["✓ Python", "✓ Django", "✓ Postgres", "✓ Docker", "AWS · no evidence"].map((c, k) => (
              <motion.span key={c} initial={false} animate={step >= 1 ? { opacity: 1, scale: 1 } : { opacity: 0.15, scale: 1 }}
                transition={{ delay: step === 1 && !reduced ? 0.8 + k * 0.3 : 0, type: "spring", stiffness: 400, damping: 18 }}
                className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", k === 4 ? "border-missing/60 text-missing" : "border-matched/60 text-matched")}>{c}</motion.span>
            ))}
          </div>
          <Status show done={step > 1} delay={3} active={step === 1} a="Reading resume and matching it to the job…" b="✓ Evidence found, gaps flagged" />
        </Stage>
        <Connector on={step >= 2} />
        <Stage i={2} step={step}>
          <Label i={2} text="Recruiter" />
          <div>
            <div className="flex items-baseline gap-1.5"><Count to={step === 2 ? 94 : 0} reduced={reduced} /><small className="text-[11px] text-muted-foreground">/100 match</small></div>
            <small className="text-[11px] text-muted-foreground">Every point links to resume evidence</small>
          </div>
          <div className="grid gap-1.5">
            {[92, 78, 85].map((w, k) => (
              <div key={k} className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <motion.i className="block h-full bg-gradient-to-r from-primary to-matched" initial={false} animate={{ width: step === 2 ? `${w}%` : "0%" }} transition={{ duration: reduced ? 0 : 1, delay: reduced ? 0 : 0.4 + k * 0.2 }} />
              </div>
            ))}
          </div>
          <div className="mt-auto flex gap-1.5 text-xs font-semibold">
            <motion.span initial={false} animate={step === 2 ? { backgroundColor: "#2DD4BF", color: "#04302c", borderColor: "#2DD4BF" } : { backgroundColor: "rgba(0,0,0,0)", color: "#E6E8F2", borderColor: "rgba(45,212,191,0.55)" }}
              transition={{ delay: step === 2 && !reduced ? 2.4 : 0, duration: 0.3 }} className="flex-1 rounded-lg border py-1.5 text-center">Shortlist</motion.span>
            <span className="flex-1 rounded-lg border border-border py-1.5 text-center text-muted-foreground">Reject</span>
          </div>
          <Status show done={false} delay={2.9} active={step === 2} a="Reviewing the evidence…" b="✓ Shortlisted by the recruiter. AI never decides." finalOnly />
        </Stage>
      </div>

      <div className="relative h-[62px] w-full max-w-[720px] text-center" aria-live="polite">
        {STEPS.map((s, k) => (
          <div key={k} className={cn("absolute inset-0 transition-all duration-500", k === step ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0")}>
            <b className="block font-heading text-lg">{s.title}</b>
            <span className="text-muted-foreground">{s.text}</span>
          </div>
        ))}
      </div>
      <div className="flex w-full max-w-[300px] gap-2" aria-hidden>
        {STEPS.map((s, k) => (
          <div key={`${k}-${cycle}-${step}`} className="h-1 flex-1 overflow-hidden rounded-full bg-white/15">
            <motion.i className="block h-full bg-primary" initial={{ width: k < step ? "100%" : "0%" }} animate={{ width: k <= step ? "100%" : "0%" }}
              transition={{ duration: k === step && !reduced ? s.ms / 1000 : 0, ease: "linear" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Stage({ i, step, children }: { i: number; step: number; children: React.ReactNode }) {
  const on = i === step, done = i < step;
  return (
    <div className="flex min-h-[250px] min-w-0 flex-1 flex-col gap-2.5 rounded-2xl border bg-surface/90 p-3.5 transition-all duration-700"
      style={{
        opacity: on ? 1 : done ? 0.8 : 0.38,
        transform: `scale(${on ? 1.03 : done ? 0.97 : 0.95})`,
        borderColor: on ? TONE[i] : "hsl(var(--border))",
        boxShadow: on ? `0 0 0 1px ${TONE[i]}, 0 18px 50px rgba(0,0,0,.5), 0 0 40px ${TONE[i]}4d` : "none",
      }}>
      {children}
    </div>
  );
}

function Label({ i, text }: { i: number; text: string }) {
  return (
    <div className="flex items-center gap-1.5 font-heading text-[11px] font-bold uppercase tracking-[0.09em]" style={{ color: TONE[i] }}>
      <i className="grid h-5 w-5 place-items-center rounded-full text-[11px] not-italic text-[#10132a]" style={{ background: TONE[i] }}>{i + 1}</i>{text}
    </div>
  );
}

function Hl({ on, i, children }: { on: boolean; i: number; children: React.ReactNode }) {
  return (
    <motion.span initial={false} animate={on ? { backgroundColor: "rgba(45,212,191,0.4)", color: "#04504a" } : { backgroundColor: "#E8EAF3", color: "#444444" }}
      transition={{ delay: on ? 0.5 + i * 0.8 : 0, duration: 0.5 }} className="rounded px-1 font-mono text-[9px] leading-relaxed">{children}</motion.span>
  );
}

function Status({ a, b, active, done, delay, finalOnly }: { a: string; b: string; active: boolean; done: boolean; delay: number; show?: boolean; finalOnly?: boolean }) {
  const [flip, setFlip] = useState(false);
  useEffect(() => {
    if (!active) { setFlip(done); return; }
    setFlip(false);
    const t = setTimeout(() => setFlip(true), delay * 1000);
    return () => clearTimeout(t);
  }, [active, done, delay]);
  const showB = flip || (done && !finalOnly);
  return <div className="h-[30px] text-[11px]">{showB ? <span className="text-foreground">{b}</span> : <span className="text-muted-foreground">{a}</span>}</div>;
}

function Connector({ on }: { on: boolean }) {
  return (
    <div className="relative h-0.5 shrink-0 basis-10 self-center bg-[repeating-linear-gradient(90deg,rgba(255,255,255,.27)_0_5px,transparent_5px_10px)]">
      {on && <motion.i className="absolute -top-2.5 h-[22px] w-4 rounded-[3px] bg-white shadow-[0_0_14px_rgba(255,255,255,.5)]" initial={{ left: -4, opacity: 1 }} animate={{ left: 30, opacity: 0 }} transition={{ duration: 0.9, delay: 0.1 }} />}
    </div>
  );
}

function Count({ to, reduced }: { to: number; reduced: boolean }) {
  const [n, setN] = useState(reduced ? to : 0);
  useEffect(() => {
    if (reduced || to === 0) { setN(to); return; }
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => { const p = Math.min(1, (t - t0 - 500) / 1200); setN(Math.max(0, Math.round(to * p))); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, reduced]);
  return <b className="font-heading text-[44px] leading-none text-matched">{n}</b>;
}
