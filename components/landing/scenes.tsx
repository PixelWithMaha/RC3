"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { BriefcaseBusiness, FileText, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Chip, Reveal, Scene, SceneCopy, useReduced } from "./primitives";

const MATCHED = "#2DD4BF";
const PRIMARY = "#7C5CFF";
const LINE = "#272C3F";

// =============================================================== shared bits
/** Button that drifts toward the cursor (magnetic hover). */
export function Magnetic({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const x = useSpring(0, { stiffness: 250, damping: 18 });
  const y = useSpring(0, { stiffness: 250, damping: 18 });
  return (
    <motion.span
      ref={ref}
      style={{ x, y }}
      className={cn("inline-block", className)}
      onMouseMove={(e) => {
        const r = ref.current!.getBoundingClientRect();
        x.set((e.clientX - r.left - r.width / 2) * 0.3);
        y.set((e.clientY - r.top - r.height / 2) * 0.3);
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.span>
  );
}

function Btn({ href, children, outline }: { href: string; children: ReactNode; outline?: boolean }) {
  return (
    <Magnetic>
      <Link
        href={href}
        className={cn(
          "inline-flex items-center gap-2 rounded-xl px-6 py-3 text-[15px] font-semibold transition-colors",
          outline ? "border border-border text-foreground hover:border-foreground/40" : "bg-primary text-primary-foreground hover:bg-primary/90",
        )}
      >
        {children}
      </Link>
    </Magnetic>
  );
}

export function CtaButtons() {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      <Btn href="/auth/sign-up?role=recruiter"><BriefcaseBusiness className="h-4 w-4" /> I&apos;m hiring</Btn>
      <Btn href="/auth/sign-up?role=candidate" outline><FileText className="h-4 w-4" /> I&apos;m a candidate</Btn>
    </div>
  );
}

function Bar({ value, className }: { value: MotionValue<string> | string; className?: string }) {
  return (
    <div className={cn("h-2 overflow-hidden rounded-full bg-secondary", className)}>
      <motion.i className="block h-full rounded-full bg-gradient-to-r from-primary to-matched" style={{ width: value }} />
    </div>
  );
}

// =============================================================== 1 Hero: the pile sorts itself
const PILE = [
  { n: "Alex Rivers", s: 68 }, { n: "Maria Khan", s: 74 }, { n: "Bilal K.", s: 63 }, { n: "Dev Patel", s: 71 },
  { n: "Lena Brandt", s: 59 }, { n: "Hina R.", s: 31 }, { n: "Chen Wei", s: 77 }, { n: "Ayesha Noor", s: 66 },
  { n: "Usman T.", s: 70 }, { n: "Sara Ahmed", s: 84 },
];
// Deterministic scatter (no hydration mismatch): vw, vh, deg
const SCATTER = [
  [-38, -30, -18], [34, -26, 14], [-30, 24, 9], [40, 18, -12], [-12, -36, 22],
  [16, 34, -20], [-42, 2, 6], [28, -4, -24], [-4, 30, 16], [8, -18, -8],
];

export function Hero() {
  return (
    <Scene id="hero" length={230}>
      {(p) => <HeroInner p={p} />}
    </Scene>
  );
}

function HeroInner({ p }: { p: MotionValue<number> }) {
  const copyY = useTransform(p, [0, 0.8], [0, -60]);
  const copyOpacity = useTransform(p, [0, 0.8], [1, 0.4]);
  return (
    <>
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {PILE.map((c, i) => <PileCard key={c.n} i={i} p={p} {...c} />)}
      </div>
      <motion.div style={{ y: copyY, opacity: copyOpacity }} className="relative z-10 -mt-24">
        <p className="mb-5 font-mono text-xs uppercase tracking-[0.2em] text-primary">RC3 · Recruitment &amp; talent intelligence</p>
        <Reveal as="h1" text="The Evidence Trail" className="text-5xl font-bold leading-[1.02] sm:text-7xl lg:text-[92px]" delay={0.2} />
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground"
        >
          Resumes become transparent score breakdowns, verified skills and fair decisions that always stay with you.
        </motion.p>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} className="mt-8">
          <CtaButtons />
          <p className="mt-6 text-sm text-muted-foreground">Scroll. The pile of resumes sorts itself.</p>
        </motion.div>
      </motion.div>
    </>
  );
}

function PileCard({ i, p, n, s }: { i: number; p: MotionValue<number>; n: string; s: number }) {
  const [sx, sy, sr] = SCATTER[i];
  const range = [i * 0.03, 0.6 + i * 0.03];
  const x = useTransform(p, range, [`${sx}vw`, "0vw"]);
  const y = useTransform(p, range, [`${sy}vh`, `${30 - i * 0.7}vh`]);
  const rotate = useTransform(p, range, [sr, (i - 5) * 2]);
  return (
    <motion.div
      style={{ x, y, rotate }}
      className="absolute left-1/2 top-1/2 -ml-[95px] -mt-[45px] w-[190px] rounded-2xl border border-border bg-surface/95 p-3.5 text-left opacity-90 shadow-xl"
    >
      <b className="text-sm">{n}</b>
      <Bar value={`${s}%`} className="my-2.5" />
      <small className="text-xs text-muted-foreground">{s}% match</small>
    </motion.div>
  );
}

// =============================================================== 2 Parse: skills glow, become chips
const DOC: (string | { raw: string; chip: string })[] = [
  "Backend developer. Built REST services in ", { raw: "Python", chip: "Python" }, " and ", { raw: "Django", chip: "Django" },
  ", stored data in ", { raw: "Postgres", chip: "PostgreSQL" }, ", documented ", { raw: "REST API", chip: "REST API" },
  " design and shipped dashboards in ", { raw: "JS", chip: "JavaScript" }, ".",
];
const SKILLS = DOC.filter((d): d is { raw: string; chip: string } => typeof d !== "string");
const skillAt = (i: number) => 0.2 + i * 0.12;

export function ParseScene() {
  return (
    <Scene id="parse" length={300}>
      {(p) => (
        <>
          <SceneCopy title="One resume, read like a recruiter would">
            Skills are found, normalized and listed with proof. <span className="font-mono text-foreground">Postgres</span> becomes{" "}
            <span className="font-mono text-foreground">PostgreSQL</span>, <span className="font-mono text-foreground">JS</span> becomes{" "}
            <span className="font-mono text-foreground">JavaScript</span>.
          </SceneCopy>
          <ParseVisual p={p} />
        </>
      )}
    </Scene>
  );
}

function ParseVisual({ p }: { p: MotionValue<number> }) {
  const docY = useTransform(p, [0, 0.15], [70, 0]);
  const docO = useTransform(p, [0, 0.15], [0, 1]);
  const docR = useTransform(p, [0, 0.15], [-4, 0]);
  const count = useTransform(p, (v) => `${SKILLS.filter((_, i) => v >= skillAt(i) + 0.06).length} skills extracted`);
  let k = -1;
  return (
    <div className="grid w-full max-w-5xl items-center gap-10 text-left md:grid-cols-2">
      <motion.div style={{ y: docY, opacity: docO, rotate: docR }} className="rounded-xl bg-foreground p-7 text-[17px] leading-[1.9] text-background shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
        <h4 className="mb-1.5 font-heading text-xl font-bold">Sara Ahmed</h4>
        {DOC.map((d, i) => (typeof d === "string" ? <span key={i}>{d}</span> : <Glow key={i} p={p} at={skillAt(++k)}>{d.raw}</Glow>))}
      </motion.div>
      <div>
        <motion.div className="font-heading text-2xl font-bold text-matched">{count}</motion.div>
        <div className="mt-4 flex flex-wrap gap-2.5">
          {SKILLS.map((s, i) => <FlyChip key={s.chip} p={p} at={skillAt(i)}>{s.chip}</FlyChip>)}
        </div>
        <p className="mt-6 font-mono text-xs text-muted-foreground">each chip keeps its source line → hallucination check</p>
      </div>
    </div>
  );
}

function Glow({ p, at, children }: { p: MotionValue<number>; at: number; children: ReactNode }) {
  const bg = useTransform(p, [at, at + 0.05], ["rgba(124,92,255,0.15)", MATCHED]);
  return <motion.span style={{ backgroundColor: bg }} className="rounded-md px-1.5 py-0.5 font-semibold">{children}</motion.span>;
}

function FlyChip({ p, at, children }: { p: MotionValue<number>; at: number; children: ReactNode }) {
  const r = [at + 0.03, at + 0.11];
  const opacity = useTransform(p, r, [0, 1]);
  const x = useTransform(p, r, [-120, 0]);
  const scale = useTransform(p, r, [0.6, 1]);
  return (
    <motion.span style={{ opacity, x, scale }}>
      <Chip tone="matched" className="px-4 py-2 !text-base">{children}</Chip>
    </motion.span>
  );
}

// =============================================================== 3 Match: lines follow meaning
const LEFT = ["Python", "Django", "PostgreSQL", "Docker"];
const RIGHT = ["“stored data in Postgres”", "“python3 report scripts”", "“REST services in Django”"];
const PATHS = [
  { d: "M0 35C228 35 228 105 456 105", label: "python3 ≈ Python", top: "25%", left: "50%" },
  { d: "M0 105C228 105 228 175 456 175", label: "Django ✓ excerpt verified", top: "50%", left: "50%" },
  { d: "M0 175C228 175 228 35 456 35", label: "Postgres ≈ PostgreSQL", top: "37.5%", left: "30%" },
];
const pathAt = (i: number) => 0.3 + i * 0.17;

export function MatchScene() {
  return (
    <Scene id="match" length={280}>
      {(p) => (
        <>
          <SceneCopy title="Meaning, not just keywords">
            Job requirements on the left, resume evidence on the right. A match needs proof — when there is none, RC3 says so.
          </SceneCopy>
          <MatchVisual p={p} />
        </>
      )}
    </Scene>
  );
}

function MatchVisual({ p }: { p: MotionValue<number> }) {
  const nodScale = useTransform(p, [0.82, 0.92], [1, 1.08]);
  const nodGlow = useTransform(p, [0.82, 0.92], ["0 0 0px rgba(245,181,68,0)", "0 0 28px rgba(245,181,68,0.45)"]);
  return (
    <div className="relative grid w-full max-w-4xl grid-cols-[140px_1fr_140px] grid-rows-[repeat(4,70px)] text-sm sm:grid-cols-[220px_1fr_220px] sm:text-base">
      {LEFT.map((l, i) => <MatchBox key={l} p={p} i={i} col={1}>{l}</MatchBox>)}
      <svg viewBox="0 0 456 280" preserveAspectRatio="none" aria-hidden className="col-start-2 row-span-4 row-start-1 h-full w-full overflow-visible">
        {PATHS.map((path, i) => <MatchPath key={i} p={p} i={i} d={path.d} />)}
      </svg>
      {RIGHT.map((r, i) => <MatchBox key={r} p={p} i={i + 4} col={3} mono>{r}</MatchBox>)}
      <motion.div
        style={{ scale: nodScale, boxShadow: nodGlow, gridColumn: 3, gridRow: 4 }}
        className="self-center rounded-xl border border-missing/60 bg-missing/15 px-3 py-3 text-center font-semibold text-missing"
      >
        No evidence found
      </motion.div>
      {PATHS.map((path, i) => <MatchLabel key={i} p={p} i={i} {...path} />)}
    </div>
  );
}

function MatchBox({ p, i, col, mono, children }: { p: MotionValue<number>; i: number; col: number; mono?: boolean; children: ReactNode }) {
  const r = [i * 0.03, 0.12 + i * 0.03];
  const opacity = useTransform(p, r, [0, 1]);
  const y = useTransform(p, r, [30, 0]);
  return (
    <motion.div
      style={{ opacity, y, gridColumn: col, gridRow: (i % 4) + 1 }}
      className={cn("self-center rounded-xl border border-border bg-surface px-3 py-3 text-center font-semibold", mono && "font-mono text-xs font-normal sm:text-sm")}
    >
      {children}
    </motion.div>
  );
}

function MatchPath({ p, i, d }: { p: MotionValue<number>; i: number; d: string }) {
  const len = useTransform(p, [pathAt(i), pathAt(i) + 0.12], [0, 1]);
  return <motion.path d={d} fill="none" stroke={MATCHED} strokeWidth={2.5} strokeLinecap="round" style={{ pathLength: len }} />;
}

function MatchLabel({ p, i, label, top, left }: { p: MotionValue<number>; i: number; label: string; top: string; left: string }) {
  const r = [pathAt(i) + 0.12, pathAt(i) + 0.16];
  const opacity = useTransform(p, r, [0, 1]);
  const scale = useTransform(p, r, [0.6, 1]);
  return (
    <motion.span style={{ opacity, scale, top, left }} className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap">
      <Chip tone="matched" className="!text-xs">{label}</Chip>
    </motion.span>
  );
}

// =============================================================== 4 Score: ring + bars + reasons
const BARS = [
  { label: "Skills", w: 0.5, v: 80 },
  { label: "Experience", w: 0.25, v: 92 },
  { label: "Projects", w: 0.15, v: 88 },
  { label: "Qualifications", w: 0.1, v: 78 },
];
const TOTAL = BARS.reduce((s, b) => s + b.w * b.v, 0); // 84

export function ScoreScene() {
  return (
    <Scene id="score" length={260}>
      {(p) => (
        <>
          <SceneCopy title="Every score comes with its reasons">
            The weighted total is computed in code, not by the LLM, and every claim links to the exact line in the resume.
          </SceneCopy>
          <ScoreVisual p={p} />
        </>
      )}
    </Scene>
  );
}

function ScoreVisual({ p }: { p: MotionValue<number> }) {
  const ring = useTransform(p, [0, 0.55], [0, TOTAL / 100]);
  const num = useTransform(p, [0, 0.55], [0, TOTAL]);
  const numText = useTransform(num, (v) => `${Math.round(v)}`);
  const qO = useTransform(p, [0.4, 0.55], [0, 1]);
  const qY = useTransform(p, [0.4, 0.55], [40, 0]);
  const bO = useTransform(p, [0.55, 0.7], [0, 1]);
  const bY = useTransform(p, [0.55, 0.7], [40, 0]);
  return (
    <div className="grid w-full max-w-5xl items-center gap-10 text-left md:grid-cols-[auto_1fr_1fr]">
      <div className="relative mx-auto h-[190px] w-[190px]">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <defs>
            <linearGradient id="ring2" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={PRIMARY} />
              <stop offset="100%" stopColor={MATCHED} />
            </linearGradient>
          </defs>
          <circle cx="60" cy="60" r="54" fill="none" stroke={LINE} strokeWidth="12" />
          <motion.circle cx="60" cy="60" r="54" fill="none" stroke="url(#ring2)" strokeWidth="12" strokeLinecap="round" style={{ pathLength: ring }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span className="font-heading text-5xl font-bold">{numText}</motion.span>
          <span className="text-xs text-muted-foreground">job relevance</span>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        {BARS.map((b, i) => <ScoreBar key={b.label} p={p} i={i} {...b} />)}
      </div>
      <div className="flex flex-col gap-3">
        <motion.div style={{ opacity: qO, y: qY }} className="rounded-xl bg-primary/10 p-4 text-[15px] italic leading-relaxed">
          “Built REST services in <mark className="rounded bg-matched/30 px-1 not-italic text-foreground">Django</mark> backed by Postgres.”
        </motion.div>
        <motion.div style={{ opacity: bO, y: bY }} className="flex flex-wrap gap-2">
          <Chip tone="missing">Docker: no evidence found</Chip>
          <Chip tone="absent">Kubernetes: confirmed absent</Chip>
        </motion.div>
        <motion.p style={{ opacity: bO }} className="font-mono text-[11px] text-muted-foreground">0.50×80 + 0.25×92 + 0.15×88 + 0.10×78 = 84</motion.p>
      </div>
    </div>
  );
}

function ScoreBar({ p, i, label, w, v }: { p: MotionValue<number>; i: number; label: string; w: number; v: number }) {
  const width = useTransform(p, [i * 0.1, 0.45 + i * 0.1], ["0%", `${v}%`]);
  return (
    <div className="text-[15px]">
      <div className="mb-1.5 flex justify-between"><span>{label} <span className="text-muted-foreground">{w * 100}%</span></span><span className="font-mono">{v}</span></div>
      <Bar value={width} />
    </div>
  );
}

// =============================================================== 5 Kanban: AI suggests, you decide
const COLS = ["Review", "Shortlisted", "Interview", "Selected"];
const CARDS = [{ n: "Sara Ahmed", s: 84 }, { n: "Bilal K.", s: 63 }, { n: "Hina R.", s: 31 }];

export function KanbanScene() {
  return (
    <Scene id="kanban" length={260}>
      {(p) => (
        <>
          <SceneCopy title="AI suggests. You decide.">Nothing moves forward until a recruiter says so — and every move is written to the audit trail.</SceneCopy>
          <KanbanVisual p={p} />
        </>
      )}
    </Scene>
  );
}

function KanbanVisual({ p }: { p: MotionValue<number> }) {
  const c1 = useRef<HTMLDivElement>(null);
  const c2 = useRef<HTMLDivElement>(null);
  const step = useRef(0);
  useEffect(() => {
    const measure = () => { if (c1.current && c2.current) step.current = c2.current.offsetLeft - c1.current.offsetLeft; };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  const x = useTransform(p, (v) => {
    const a = Math.min(1, Math.max(0, (v - 0.35) / 0.2));
    const b = Math.min(1, Math.max(0, (v - 0.65) / 0.2));
    return step.current * (a + b);
  });
  const y = useTransform(p, [0.35, 0.45, 0.85], [0, -14, -14]);
  const btnO = useTransform(p, [0.2, 0.28, 0.5, 0.55], [0, 1, 1, 0]);
  const btnS = useTransform(p, [0.2, 0.28], [0.6, 1]);
  const auditO = useTransform(p, [0.55, 0.62], [0, 1]);
  const auditText = useTransform(p, (v): string => (v < 0.75 ? "ai_assessed → shortlisted · by recruiter" : "shortlisted → interview · by recruiter"));

  return (
    <div className="w-full max-w-5xl">
      <div className="grid grid-cols-2 gap-4 text-left md:grid-cols-4">
        {COLS.map((c, i) => (
          <KanbanCol key={c} p={p} i={i} title={c} innerRef={i === 0 ? c1 : i === 1 ? c2 : undefined}>
            {i === 0 &&
              CARDS.map((card, j) => (
                <motion.div
                  key={card.n}
                  style={j === 0 ? { x, y } : undefined}
                  className={cn(
                    "relative mb-2.5 rounded-xl border bg-background/70 p-3 text-sm",
                    j === 0 ? "z-10 border-matched shadow-[0_0_30px_-8px_rgba(45,212,191,0.6)]" : "border-border",
                  )}
                >
                  <b>{card.n}</b>
                  <br />
                  <span className="text-muted-foreground">{card.s}% match · AI suggestion</span>
                </motion.div>
              ))}
          </KanbanCol>
        ))}
      </div>
      <motion.div style={{ opacity: btnO, scale: btnS }} className="mt-6">
        <span className="inline-flex animate-[pulse-ring_1.4s_infinite] rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground">
          Shortlist Sara
        </span>
      </motion.div>
      <motion.p style={{ opacity: auditO }} className="mt-4 font-mono text-xs text-muted-foreground">
        audit trail: <motion.span className="text-matched">{auditText}</motion.span> · AI status changes: 0
      </motion.p>
    </div>
  );
}

function KanbanCol({ p, i, title, innerRef, children }: { p: MotionValue<number>; i: number; title: string; innerRef?: React.Ref<HTMLDivElement>; children?: ReactNode }) {
  const opacity = useTransform(p, [i * 0.04, 0.14 + i * 0.04], [0, 1]);
  const y = useTransform(p, [i * 0.04, 0.14 + i * 0.04], [40, 0]);
  return (
    <motion.div ref={innerRef} style={{ opacity, y, zIndex: i === 0 ? 20 : 1 }} className="relative min-h-[220px] rounded-2xl border border-border bg-surface p-3.5">
      <h5 className="mb-3 text-sm text-muted-foreground">{title}</h5>
      {children}
    </motion.div>
  );
}

// =============================================================== 6 Fairness: hide identity, score stays
const PII = [["Name", "Sara Ahmed"], ["Gender", "Female"], ["Age", "27"], ["Address", "Gulberg, Lahore"]];

export function FairnessScene() {
  return (
    <Scene id="fair" length={230}>
      {(p) => (
        <>
          <SceneCopy title="The score ignores who you are">Name, gender, age and address are stripped before any scoring call. The result stays the same.</SceneCopy>
          <FairVisual p={p} />
        </>
      )}
    </Scene>
  );
}

function FairVisual({ p }: { p: MotionValue<number> }) {
  const tgBg = useTransform(p, [0.1, 0.25], [LINE, MATCHED]);
  const knob = useTransform(p, [0.1, 0.25], [0, 28]);
  const okS = useTransform(p, [0.65, 0.78], [0, 1]);
  return (
    <div className="grid w-full max-w-4xl items-center gap-10 text-left md:grid-cols-2">
      <div className="rounded-2xl border border-border bg-surface p-6">
        {PII.map(([k, v], i) => <PiiRow key={k} p={p} i={i} k={k} v={v} />)}
        <div className="flex justify-between pt-3 text-[15px]"><span className="text-muted-foreground">Skills &amp; projects</span><span className="text-matched">Used for scoring</span></div>
      </div>
      <div className="flex flex-col items-start gap-5">
        <div className="flex items-center gap-3.5">
          <motion.span style={{ backgroundColor: tgBg }} className="inline-block h-[34px] w-[62px] rounded-full p-1">
            <motion.i style={{ x: knob }} className="block h-[26px] w-[26px] rounded-full bg-foreground" />
          </motion.span>
          <b>Hide personal details</b>
        </div>
        <div className="font-heading text-6xl font-bold">84</div>
        <motion.span style={{ scale: okS, opacity: okS }} className="origin-left">
          <Chip tone="matched">Score unchanged · counterfactual test passed</Chip>
        </motion.span>
      </div>
    </div>
  );
}

function PiiRow({ p, i, k, v }: { p: MotionValue<number>; i: number; k: string; v: string }) {
  const r = [0.3 + i * 0.07, 0.42 + i * 0.07];
  const blur = useTransform(p, r, [0, 9]);
  const filter = useMotionTemplate`blur(${blur}px)`;
  const opacity = useTransform(p, r, [1, 0.45]);
  return (
    <div className="flex justify-between border-b border-border py-2.5 text-[15px]">
      <span className="text-muted-foreground">{k}</span>
      <motion.span style={{ filter, opacity }}>{v}</motion.span>
    </div>
  );
}

// =============================================================== 7 Search
const QUERY = "Python developers with REST API experience";
const RESULTS = [
  { n: "Sara Ahmed", sim: 89, parts: ["Built ", "REST services", " in ", "Django", " backed by Postgres."] },
  { n: "Bilal K.", sim: 81, parts: ["Designed ", "Flask endpoints", " for the mobile app."] },
  { n: "Usman T.", sim: 74, parts: ["", "Python", " automation for ", "API", " integration tests."] },
];

export function SearchScene() {
  return (
    <Scene id="search" length={230}>
      {(p) => (
        <>
          <SceneCopy title="Ask for talent in plain language">Semantic search over resume passages finds “Flask endpoints” when you ask for “REST API”.</SceneCopy>
          <SearchVisual p={p} />
        </>
      )}
    </Scene>
  );
}

function SearchVisual({ p }: { p: MotionValue<number> }) {
  const typed = useTransform(p, (v) => QUERY.slice(0, Math.round(Math.min(1, Math.max(0, v / 0.4)) * QUERY.length)));
  return (
    <div className="w-full max-w-2xl space-y-3 text-left">
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
        <Search className="h-5 w-5 text-primary" />
        <motion.span className="flex-1">{typed}</motion.span>
        <span className="h-5 w-0.5 animate-pulse bg-primary" />
      </div>
      {RESULTS.map((r, i) => <SearchResult key={r.n} p={p} i={i} {...r} />)}
    </div>
  );
}

function SearchResult({ p, i, n, sim, parts }: { p: MotionValue<number>; i: number; n: string; sim: number; parts: string[] }) {
  const rg = [0.45 + i * 0.1, 0.55 + i * 0.1];
  const opacity = useTransform(p, rg, [0, 1]);
  const y = useTransform(p, rg, [20, 0]);
  return (
    <motion.div style={{ opacity, y }} className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-1.5 flex justify-between"><b>{n}</b><span className="font-mono text-xs text-matched">{sim}% match</span></div>
      <p className="font-mono text-xs text-foreground/80">
        “{parts.map((t, j) => (j % 2 ? <mark key={j} className="rounded bg-matched/25 px-0.5 text-matched">{t}</mark> : <span key={j}>{t}</span>))}”
      </p>
    </motion.div>
  );
}

// =============================================================== 8 Analytics: counters + charts draw
const STATS = [{ n: 3, l: "Active jobs" }, { n: 48, l: "Applications" }, { n: 9, l: "Shortlisted" }, { n: 2.4, l: "Days to decision", d: 1 }];
const JOB_BARS = [100, 72, 55, 38, 26];

export function AnalyticsSection() {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReduced();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const one = useMotionValue(1);
  const q = reduced ? one : scrollYProgress;
  const line = useTransform(q, [0.3, 1], [0, 1]);
  return (
    <section ref={ref} id="ana" className="flex min-h-screen flex-col items-center justify-center px-4 py-24 text-center sm:px-6">
      <SceneCopy title="See the whole pipeline at a glance" />
      <div className="grid w-full max-w-5xl grid-cols-2 gap-4 md:grid-cols-4">
        {STATS.map((s) => <Stat key={s.l} q={q} {...s} />)}
      </div>
      <div className="mt-4 grid w-full max-w-5xl gap-4 text-left md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <b>Applications by job</b>
          <div className="mt-4 flex h-[150px] items-end gap-3.5 px-3.5">
            {JOB_BARS.map((h, i) => <JobBar key={i} q={q} i={i} h={h} />)}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5">
          <b>Shortlist rate over time</b>
          <svg viewBox="0 0 200 100" preserveAspectRatio="none" className="mt-3 h-[150px] w-full">
            <motion.polyline points="0,85 30,70 60,76 90,50 120,56 150,30 200,18" fill="none" stroke={MATCHED} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ pathLength: line }} />
          </svg>
        </div>
      </div>
    </section>
  );
}

function Stat({ q, n, l, d = 0 }: { q: MotionValue<number>; n: number; l: string; d?: number }) {
  const v = useTransform(q, [0, 0.6], [0, n]);
  const text = useTransform(v, (x) => x.toFixed(d));
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 text-left">
      <motion.b className="block font-heading text-4xl">{text}</motion.b>
      <span className="text-sm text-muted-foreground">{l}</span>
    </div>
  );
}

function JobBar({ q, i, h }: { q: MotionValue<number>; i: number; h: number }) {
  const scaleY = useTransform(q, [0.2 + i * 0.08, 0.6 + i * 0.08], [0, 1]);
  return <motion.i style={{ scaleY, height: `${h}%` }} className="block flex-1 origin-bottom rounded-t-md bg-gradient-to-t from-primary to-matched" />;
}

// =============================================================== 9 CTA: drifting gradient
export function FinalCta() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end end"] });
  const pos = useTransform(scrollYProgress, [0, 1], ["0% 0%", "100% 100%"]);
  return (
    <motion.section
      ref={ref}
      id="cta"
      style={{
        backgroundPosition: pos,
        backgroundSize: "300% 300%",
        backgroundImage: "linear-gradient(120deg,#0B0D17,#2a1f66,#0B0D17,#0f3a3a)",
      }}
      className="flex min-h-[80vh] flex-col items-center justify-center px-4 text-center"
    >
      <SceneCopy title="Ready to hire with proof?">Pick your side. Both start in under a minute.</SceneCopy>
      <CtaButtons />
      <p className="mt-8 text-sm text-muted-foreground">
        Already have an account? <Link href="/auth/login" className="text-primary hover:underline">Sign in</Link>
      </p>
    </motion.section>
  );
}

// =============================================================== global effects
/** Soft spotlight that follows the cursor. */
export function Spotlight() {
  const x = useSpring(-500, { stiffness: 120, damping: 20 });
  const y = useSpring(-500, { stiffness: 120, damping: 20 });
  useEffect(() => {
    const move = (e: MouseEvent) => { x.set(e.clientX); y.set(e.clientY); };
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, [x, y]);
  return (
    <motion.div
      aria-hidden
      style={{ x, y }}
      className="pointer-events-none fixed left-0 top-0 z-[1] -ml-[210px] -mt-[210px] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(124,92,255,0.14),transparent_65%)]"
    />
  );
}

const RAIL = [
  { id: "hero", label: "Submitted" }, { id: "parse", label: "Parsed" }, { id: "match", label: "AI assessment" },
  { id: "score", label: "Recruiter review" }, { id: "kanban", label: "Shortlisted" }, { id: "fair", label: "Interview" },
  { id: "ana", label: "Selected" },
];

/** Pipeline-stage rail: highlights the stage matching the section in view. */
export function StageRail() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const mid = window.innerHeight * 0.55;
      let idx = 0;
      RAIL.forEach((r, i) => {
        const el = document.getElementById(r.id);
        if (el && el.getBoundingClientRect().top <= mid) idx = i;
      });
      setActive(idx);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <ul aria-hidden className="fixed right-6 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-3.5 text-xs text-muted-foreground lg:flex">
      {RAIL.map((r, i) => (
        <li key={r.id} className={cn("flex items-center justify-end gap-2 transition-colors duration-300", i === active && "text-matched")}>
          <span>{r.label}</span>
          <i className={cn("block h-2.5 w-2.5 rounded-full transition-all duration-300", i === active ? "bg-matched shadow-[0_0_12px_#2DD4BF]" : i < active ? "bg-primary/60" : "bg-border")} />
        </li>
      ))}
    </ul>
  );
}
