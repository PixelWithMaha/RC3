"use client";

import Link from "next/link";
import {
  AnimatePresence,
  motion,
  useMotionTemplate,
  useTransform,
  type MotionValue,
} from "motion/react";
import {
  ArrowDown,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  FileText,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Chip, Glow, Panel, Scene, SceneCopy, useReduced, useStep } from "./primitives";

const spring = { type: "spring", stiffness: 260, damping: 26 } as const;

// =============================================================== Hero
export function Hero() {
  const reduced = useReduced();
  return (
    <section className="relative flex min-h-[100svh] items-center overflow-hidden pb-12 pt-24">
      <Glow />
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
        <div>
          <p className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-primary">
            Recruitment &amp; talent intelligence
          </p>
          <h1 className="text-5xl font-bold leading-[0.95] sm:text-6xl lg:text-7xl">
            The Evidence <span className="text-primary">Trail</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Every AI score in RC3 points back to a real line in the resume. Recruiters see the proof and
            the gaps, and then make the call themselves.
          </p>
          <div className="mt-8">
            <CtaButtons />
          </div>
          <p className="mt-10 flex items-center gap-2 text-sm text-muted-foreground">
            <ArrowDown className="h-4 w-4 animate-bounce motion-reduce:animate-none" />
            Scroll to follow one resume through RC3
          </p>
        </div>
        <ScanningResume reduced={reduced} />
      </div>
    </section>
  );
}

const SCAN_LINES: { text: string; hits: string[] }[] = [
  { text: "Backend developer · 4 years building web services", hits: ["4 years"] },
  { text: "Built REST services in Django backed by Postgres.", hits: ["Django", "Postgres"] },
  { text: "Shipped dashboards in JS and ReactJS.", hits: ["JS"] },
  { text: "Automated reports with Python scripts.", hits: ["Python"] },
  { text: "BSc Computer Science · FAST NUCES", hits: ["BSc Computer Science"] },
];
const SCAN_SECONDS = 3.2;
const SCAN_PAUSE = 0.8;

function ScanningResume({ reduced }: { reduced: boolean }) {
  const cycle = SCAN_SECONDS + SCAN_PAUSE;
  return (
    <Panel className="mx-auto w-full max-w-md overflow-hidden">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/20 font-heading font-bold text-primary">
          SA
        </div>
        <div>
          <p className="font-heading font-semibold">sara-ahmed-resume.pdf</p>
          <p className="text-xs text-muted-foreground">Scanning for evidence…</p>
        </div>
      </div>
      <div className="relative space-y-3 font-mono text-[12px] leading-relaxed text-foreground/80 sm:text-[13px]">
        {SCAN_LINES.map((line, i) => {
          const at = ((i + 0.6) / SCAN_LINES.length) * (SCAN_SECONDS / cycle);
          return (
            <p key={i}>
              {splitHits(line.text, line.hits).map((part, j) =>
                part.hit ? (
                  <motion.span
                    key={j}
                    className="rounded px-0.5"
                    initial={false}
                    animate={
                      reduced
                        ? { backgroundColor: "rgba(45,212,191,0.22)", color: "#2DD4BF" }
                        : {
                            backgroundColor: ["rgba(45,212,191,0)", "rgba(45,212,191,0)", "rgba(45,212,191,0.22)", "rgba(45,212,191,0.22)"],
                            color: ["#E6E8F2", "#E6E8F2", "#2DD4BF", "#2DD4BF"],
                          }
                    }
                    transition={
                      reduced ? { duration: 0 } : { duration: cycle, times: [0, at, at + 0.04, 1], repeat: Infinity, ease: "linear" }
                    }
                  >
                    {part.text}
                  </motion.span>
                ) : (
                  <span key={j}>{part.text}</span>
                ),
              )}
            </p>
          );
        })}
        {!reduced && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-x-[-24px] h-12 border-b-2 border-primary bg-gradient-to-b from-transparent to-primary/25"
            initial={{ top: "-15%" }}
            animate={{ top: ["-15%", "95%"] }}
            transition={{ duration: SCAN_SECONDS, repeat: Infinity, repeatDelay: SCAN_PAUSE, ease: "linear" }}
          />
        )}
      </div>
      <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-4">
        <Chip tone="matched"><Check className="h-3.5 w-3.5" /> 6 excerpts verified</Chip>
        <Chip tone="neutral">0 hallucinations</Chip>
      </div>
    </Panel>
  );
}

function splitHits(text: string, hits: string[]) {
  const parts: { text: string; hit: boolean }[] = [];
  let rest = text;
  while (rest) {
    const next = hits
      .map((h) => ({ h, i: rest.search(new RegExp(`\\b${h}\\b`)) }))
      .filter((x) => x.i >= 0)
      .sort((a, b) => a.i - b.i)[0];
    if (!next) {
      parts.push({ text: rest, hit: false });
      break;
    }
    if (next.i > 0) parts.push({ text: rest.slice(0, next.i), hit: false });
    parts.push({ text: next.h, hit: true });
    rest = rest.slice(next.i + next.h.length);
  }
  return parts;
}

// =============================================================== 01 Upload
export function UploadScene() {
  return (
    <Scene id="upload" length={220}>
      {(p) => (
        <>
          <SceneCopy step="01" eyebrow="Upload" title="Drop a PDF. Get structured evidence.">
            Text is extracted on the server and parsed into skills, experience and projects. Every item
            keeps the exact line it came from.
          </SceneCopy>
          <UploadVisual p={p} />
        </>
      )}
    </Scene>
  );
}

const UPLOAD_STEPS = ["Text extracted from PDF", "Structured by Gemini", "Excerpts matched to raw text"];

function UploadVisual({ p }: { p: MotionValue<number> }) {
  const docY = useTransform(p, [0, 0.35], [-150, 0]);
  const docRotate = useTransform(p, [0, 0.35], [-10, 0]);
  const docOpacity = useTransform(p, [0, 0.12], [0, 1]);
  const zoneBorder = useTransform(p, [0.28, 0.38], ["rgba(124,92,255,0.25)", "rgba(124,92,255,0.9)"]);
  const bar = useTransform(p, [0.4, 0.85], ["0%", "100%"]);
  const label = useTransform(p, (v): string =>
    v < 0.38
      ? "Waiting for a PDF…"
      : v < 0.55
        ? "Extracting text…"
        : v < 0.7
          ? "Parsing with Gemini…"
          : v < 0.85
            ? "Verifying excerpts…"
            : "Done · 9 skills · 2 roles · 1 project",
  );
  const step = useStep(p, [0.55, 0.7, 0.85]);

  return (
    <Panel className="mx-auto w-full max-w-lg">
      <motion.div
        style={{ borderColor: zoneBorder }}
        className="relative flex h-40 items-end justify-center rounded-xl border-2 border-dashed bg-background/40 pb-4 sm:h-52"
      >
        <motion.div
          style={{ y: docY, rotate: docRotate, opacity: docOpacity }}
          className="absolute top-4 flex h-24 w-20 flex-col gap-1.5 rounded-lg border border-border bg-foreground/95 p-2.5 shadow-xl sm:top-6 sm:h-32 sm:w-24"
        >
          <span className="self-start rounded bg-absent px-1 font-mono text-[9px] font-bold text-background">PDF</span>
          {[80, 60, 90, 50, 70].map((w, i) => (
            <span key={i} className="h-1 rounded bg-background/30" style={{ width: `${w}%` }} />
          ))}
        </motion.div>
        <p className="font-mono text-xs text-muted-foreground">resume.pdf · 84 KB</p>
      </motion.div>

      <div className="mt-5">
        <div className="mb-2 flex justify-between font-mono text-xs">
          <motion.span className="text-foreground">{label}</motion.span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-secondary">
          <motion.div style={{ width: bar }} className="h-full rounded-full bg-gradient-to-r from-primary to-matched" />
        </div>
      </div>

      <ul className="mt-5 space-y-2 text-sm">
        {UPLOAD_STEPS.map((s, i) => (
          <motion.li
            key={s}
            initial={false}
            animate={{ opacity: step > i ? 1 : 0.35, x: step > i ? 0 : -6 }}
            transition={spring}
            className="flex items-center gap-2"
          >
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full border transition-colors",
                step > i ? "border-matched bg-matched/20 text-matched" : "border-border text-transparent",
              )}
            >
              <Check className="h-3 w-3" />
            </span>
            {s}
          </motion.li>
        ))}
      </ul>
    </Panel>
  );
}

// =============================================================== 02 Extract
type Token = { raw: string; canonical: string };
const EXTRACT_LINES: (string | Token)[][] = [
  ["Built REST services in ", { raw: "Django", canonical: "Django" }, " backed by ", { raw: "Postgres", canonical: "PostgreSQL" }, "."],
  ["Shipped dashboards in ", { raw: "JS", canonical: "JavaScript" }, " and ", { raw: "ReactJS", canonical: "React" }, "."],
  ["Automated reports with ", { raw: "Python", canonical: "Python" }, " scripts."],
];
const TOKENS = EXTRACT_LINES.flat().filter((x): x is Token => typeof x !== "string");

export function ExtractScene() {
  return (
    <Scene id="extract" length={260}>
      {(p) => (
        <>
          <SceneCopy step="02" eyebrow="Extract" title="Words become skills.">
            Equivalent terms are normalized, so <span className="font-mono text-foreground">JS</span> becomes{" "}
            <span className="font-mono text-foreground">JavaScript</span> and{" "}
            <span className="font-mono text-foreground">Postgres</span> becomes{" "}
            <span className="font-mono text-foreground">PostgreSQL</span>. Nothing gets missed because of
            wording.
          </SceneCopy>
          <ExtractVisual p={p} />
        </>
      )}
    </Scene>
  );
}

function ExtractVisual({ p }: { p: MotionValue<number> }) {
  const thresholds = TOKENS.map((_, i) => 0.08 + i * 0.09);
  const lifted = useStep(p, thresholds);
  const morphed = useStep(p, [0.68]) > 0;
  let tokenIndex = -1;

  return (
    <Panel className="mx-auto w-full max-w-lg">
      <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Resume text</p>
      <div className="space-y-2 font-mono text-[12px] leading-relaxed sm:text-sm">
        {EXTRACT_LINES.map((line, li) => (
          <p key={li} className="text-foreground/75">
            {line.map((part, pi) => {
              if (typeof part === "string") return <span key={pi}>{part}</span>;
              tokenIndex++;
              const on = lifted > tokenIndex;
              return (
                <span
                  key={pi}
                  className={cn(
                    "rounded px-0.5 transition-colors duration-300",
                    on ? "bg-primary/25 text-foreground" : "",
                  )}
                >
                  {part.raw}
                </span>
              );
            })}
          </p>
        ))}
      </div>

      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        normalized skills
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="flex min-h-[76px] flex-wrap content-start gap-2">
        <AnimatePresence>
          {TOKENS.slice(0, lifted).map((t) => {
            const changes = t.raw !== t.canonical;
            const text = morphed ? t.canonical : t.raw;
            return (
              <motion.span
                key={t.raw}
                layout
                initial={{ opacity: 0, y: -48, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -24 }}
                transition={spring}
              >
                <Chip tone={morphed && changes ? "matched" : "primary"}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={text}
                      initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
                      transition={{ duration: 0.3 }}
                    >
                      {text}
                    </motion.span>
                  </AnimatePresence>
                </Chip>
              </motion.span>
            );
          })}
        </AnimatePresence>
      </div>
      <motion.p
        initial={false}
        animate={{ opacity: morphed ? 1 : 0 }}
        className="mt-3 font-mono text-[11px] text-matched"
      >
        3 aliases normalized · JS → JavaScript · Postgres → PostgreSQL · ReactJS → React
      </motion.p>
    </Panel>
  );
}

// =============================================================== 03 Match
const SLOTS = [
  { name: "Python", importance: 5, excerpt: "Automated reports with Python scripts." },
  { name: "Django", importance: 5, excerpt: "Built REST services in Django…" },
  { name: "PostgreSQL", importance: 4, excerpt: "…backed by Postgres." },
  { name: "Docker", importance: 4, excerpt: null },
];
const TRAY = ["Python", "Django", "PostgreSQL", "JavaScript", "React"];

export function MatchScene() {
  return (
    <Scene id="match" length={280}>
      {(p) => (
        <>
          <SceneCopy step="03" eyebrow="Match" title="Skills land in the job's slots, with proof.">
            Each requirement is filled only when there&apos;s an excerpt to back it up. When nothing is
            found, RC3 says <span className="text-missing">missing evidence</span>. That&apos;s different
            from a <span className="text-absent">confirmed absence</span>, and RC3 keeps the two apart.
          </SceneCopy>
          <MatchVisual p={p} />
        </>
      )}
    </Scene>
  );
}

function MatchVisual({ p }: { p: MotionValue<number> }) {
  const step = useStep(p, [0.12, 0.26, 0.4, 0.58, 0.72]);
  const flown = Math.min(step, 3);

  return (
    <div className="mx-auto w-full max-w-lg space-y-4">
      <div className="flex min-h-[34px] flex-wrap justify-center gap-2">
        {TRAY.map((s, i) => (
          <motion.span
            key={s}
            initial={false}
            animate={i < flown ? { opacity: 0, y: 40, scale: 0.7 } : { opacity: 1, y: 0, scale: 1 }}
            transition={spring}
          >
            <Chip tone="primary">{s}</Chip>
          </motion.span>
        ))}
      </div>

      <Panel>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BriefcaseBusiness className="h-4 w-4 text-primary" />
            <p className="font-heading font-semibold">Backend Developer</p>
          </div>
          <span className="font-mono text-[11px] text-muted-foreground">required skills</span>
        </div>
        <ul className="space-y-2.5">
          {SLOTS.map((slot, i) => {
            const filled = i < 3 && flown > i;
            const missing = i === 3 && step >= 4;
            return (
              <li
                key={slot.name}
                className={cn(
                  "rounded-xl border p-3 transition-colors duration-500",
                  filled ? "border-matched/60 bg-matched/5" : missing ? "border-missing/60 bg-missing/5" : "border-dashed border-border",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{slot.name}</span>
                    <span className="flex gap-0.5" aria-label={`importance ${slot.importance} of 5`}>
                      {Array.from({ length: 5 }, (_, d) => (
                        <span key={d} className={cn("h-1.5 w-1.5 rounded-full", d < slot.importance ? "bg-primary" : "bg-secondary")} />
                      ))}
                    </span>
                  </div>
                  <AnimatePresence mode="wait" initial={false}>
                    {filled ? (
                      <motion.span key="m" initial={{ opacity: 0, y: -60, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={spring}>
                        <Chip tone="matched"><Check className="h-3.5 w-3.5" /> Matched</Chip>
                      </motion.span>
                    ) : missing ? (
                      <motion.span key="x" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={spring}>
                        <Chip tone="missing">Missing evidence</Chip>
                      </motion.span>
                    ) : (
                      <motion.span key="e" exit={{ opacity: 0 }} className="font-mono text-[11px] text-muted-foreground">
                        awaiting evidence
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                <AnimatePresence initial={false}>
                  {(filled || missing) && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className={cn("overflow-hidden font-mono text-[11px] sm:text-xs", filled ? "text-matched/90" : "text-missing/90")}
                    >
                      <span className="block pt-2">
                        {filled ? `“${slot.excerpt}”` : "Not mentioned in the resume · Learn: containerize a Django service"}
                      </span>
                    </motion.p>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      </Panel>

      <motion.div
        initial={false}
        animate={{ opacity: step >= 5 ? 1 : 0.45 }}
        className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground"
      >
        <Legend color="bg-matched" label="Matched · excerpt found" />
        <Legend color="bg-missing" label="Missing · not mentioned" />
        <Legend color="bg-absent" label="Absent · explicitly lacking" />
      </motion.div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-full", color)} />
      {label}
    </span>
  );
}

// =============================================================== 04 Score
const BARS = [
  { label: "Skills", weight: 0.5, value: 80 },
  { label: "Experience", weight: 0.25, value: 92 },
  { label: "Projects", weight: 0.15, value: 88 },
  { label: "Qualifications", weight: 0.1, value: 78 },
];
const TOTAL = BARS.reduce((s, b) => s + b.weight * b.value, 0); // 84

export function ScoreScene() {
  return (
    <Scene id="score" length={240}>
      {(p) => (
        <>
          <SceneCopy step="04" eyebrow="Score" title="A score you can audit.">
            The model rates each dimension, but the weighted total is calculated in code, not by the LLM.
            The same evidence always gives the same number.
          </SceneCopy>
          <ScoreVisual p={p} />
        </>
      )}
    </Scene>
  );
}

function ScoreVisual({ p }: { p: MotionValue<number> }) {
  const ring = useTransform(p, [0.08, 0.6], [0, TOTAL / 100]);
  const score = useTransform(p, [0.08, 0.6], [0, TOTAL]);
  const scoreText = useTransform(score, (v) => Math.round(v).toString());
  const formulaOpacity = useTransform(p, [0.62, 0.75], [0, 1]);

  return (
    <Panel className="mx-auto w-full max-w-lg">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
        <div className="relative h-36 w-36 shrink-0 sm:h-44 sm:w-44">
          <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
            <defs>
              <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#7C5CFF" />
                <stop offset="100%" stopColor="#2DD4BF" />
              </linearGradient>
            </defs>
            <circle cx="100" cy="100" r="84" fill="none" stroke="#1F2438" strokeWidth="14" />
            <motion.circle
              cx="100"
              cy="100"
              r="84"
              fill="none"
              stroke="url(#ring)"
              strokeWidth="14"
              strokeLinecap="round"
              style={{ pathLength: ring }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span className="font-heading text-4xl font-bold sm:text-5xl">{scoreText}</motion.span>
            <span className="text-xs text-muted-foreground">job relevance</span>
          </div>
        </div>
        <div className="w-full space-y-3">
          {BARS.map((b, i) => (
            <ScoreBar key={b.label} p={p} index={i} {...b} />
          ))}
        </div>
      </div>
      <motion.p
        style={{ opacity: formulaOpacity }}
        className="mt-6 rounded-lg bg-background/60 p-3 text-center font-mono text-[11px] text-muted-foreground sm:text-xs"
      >
        0.50×80 + 0.25×92 + 0.15×88 + 0.10×78 = <span className="text-foreground">{TOTAL.toFixed(0)}</span>
      </motion.p>
    </Panel>
  );
}

function ScoreBar({ p, index, label, weight, value }: { p: MotionValue<number>; index: number; label: string; weight: number; value: number }) {
  const start = 0.12 + index * 0.07;
  const v = useTransform(p, [start, start + 0.35], [0, value]);
  const width = useTransform(v, (x) => `${x}%`);
  const text = useTransform(v, (x) => Math.round(x).toString());
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span>
          {label} <span className="font-mono text-muted-foreground">×{weight.toFixed(2)}</span>
        </span>
        <motion.span className="font-mono">{text}</motion.span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <motion.div style={{ width }} className="h-full rounded-full bg-primary" />
      </div>
    </div>
  );
}

// =============================================================== 05 Fairness
const IDENTITY = [
  { label: "Name", value: "Sara Ahmed" },
  { label: "Email", value: "sara.ahmed@example.com" },
  { label: "Address", value: "Gulberg, Lahore" },
  { label: "Date of birth", value: "12 Mar 1997" },
  { label: "Gender", value: "Female" },
];

export function FairnessScene() {
  return (
    <Scene id="fairness" length={220}>
      {(p) => (
        <>
          <SceneCopy step="05" eyebrow="Fairness" title={<>Scored on skills, <span className="text-matched">not identity.</span></>}>
            Name, contact details, address, gender, age, religion, marital status and nationality are removed
            before any scoring call. Change them and the score stays the same.
          </SceneCopy>
          <FairnessVisual p={p} />
        </>
      )}
    </Scene>
  );
}

function FairnessVisual({ p }: { p: MotionValue<number> }) {
  const blur = useTransform(p, [0.12, 0.45], [0, 9]);
  const filter = useMotionTemplate`blur(${blur}px)`;
  const redactOpacity = useTransform(p, [0.4, 0.52], [0, 1]);
  const sentOpacity = useTransform(p, [0.5, 0.62], [0, 1]);
  const testOpacity = useTransform(p, [0.66, 0.8], [0, 1]);

  return (
    <Panel className="mx-auto w-full max-w-lg">
      <div className="mb-4 flex items-center gap-3">
        <motion.div style={{ filter }} className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary/60 to-matched/60">
          <UserRound className="h-6 w-6 text-background" />
        </motion.div>
        <div className="text-sm">
          <p className="font-heading font-semibold">Candidate profile</p>
          <p className="text-xs text-muted-foreground">What the scoring model receives</p>
        </div>
      </div>
      <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-sm">
        {IDENTITY.map((f) => (
          <div key={f.label} className="contents">
            <dt className="text-muted-foreground">{f.label}</dt>
            <dd className="relative">
              <motion.span style={{ filter }} className="inline-block">{f.value}</motion.span>
              <motion.span style={{ opacity: redactOpacity }} className="absolute inset-y-0 left-0 flex items-center font-mono text-[11px] text-absent">
                [redacted]
              </motion.span>
            </dd>
          </div>
        ))}
      </dl>

      <div className="relative mt-5 rounded-xl border border-border p-3">
        <motion.div style={{ opacity: sentOpacity }} className="pointer-events-none absolute inset-0 rounded-xl border-2 border-matched shadow-[0_0_30px_-6px_rgba(45,212,191,0.6)]" />
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Skills &amp; evidence</span>
          <motion.span style={{ opacity: sentOpacity }} className="flex items-center gap-1 text-matched">
            <ShieldCheck className="h-3.5 w-3.5" /> sent to scoring
          </motion.span>
        </div>
        <div className="flex flex-wrap gap-2">
          {["Python", "Django", "PostgreSQL", "REST API", "4 yrs backend"].map((s) => (
            <Chip key={s} tone="neutral">{s}</Chip>
          ))}
        </div>
      </div>
      <motion.p style={{ opacity: testOpacity }} className="mt-4 font-mono text-[11px] text-muted-foreground sm:text-xs">
        Counterfactual test: name + gender swapped → score <span className="text-foreground">84</span> →{" "}
        <span className="text-matched">84</span>
      </motion.p>
    </Panel>
  );
}

// =============================================================== 06 Decide
const RANKED = [
  { name: "Sara A.", score: 84, note: "4/4 skills · 3 verified excerpts", tone: "matched" as const },
  { name: "Bilal K.", score: 63, note: "Docker: missing evidence", tone: "missing" as const },
  { name: "Hina R.", score: 31, note: "Backend: explicitly lacking", tone: "absent" as const },
];

const TONE_TEXT = { matched: "text-matched", missing: "text-missing", absent: "text-absent" } as const;

export function DecideScene() {
  return (
    <Scene id="decide" length={260}>
      {(p) => (
        <>
          <SceneCopy step="06" eyebrow="Decide" title={<>AI recommends. <span className="text-primary">You decide.</span></>}>
            RC3 never shortlists or rejects anyone on its own. Every status change is a recruiter action,
            written to an audit trail with who made it, when, and why.
          </SceneCopy>
          <DecideVisual p={p} />
        </>
      )}
    </Scene>
  );
}

function DecideVisual({ p }: { p: MotionValue<number> }) {
  const left = useTransform(p, [0.05, 0.45], ["calc(88% + 0px)", "calc(100% + -78px)"]);
  const top = useTransform(p, [0.05, 0.45], ["calc(100% + 10px)", "calc(0% + 40px)"]);
  const step = useStep(p, [0.5, 0.58, 0.7]);
  const clicked = step >= 1;
  const shortlisted = step >= 2;

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="relative space-y-3">
        {RANKED.map((c, i) => {
          const isTop = i === 0;
          return (
            <motion.div
              key={c.name}
              initial={false}
              animate={isTop && shortlisted ? { scale: 1.02 } : { scale: 1 }}
              transition={spring}
              className={cn(
                "flex h-[84px] items-center justify-between gap-3 rounded-2xl border bg-surface px-4 transition-colors duration-500",
                isTop && shortlisted ? "border-matched shadow-[0_0_40px_-10px_rgba(45,212,191,0.6)]" : "border-border",
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="w-10 font-heading text-2xl font-bold">{c.score}</span>
                <div className="min-w-0">
                  <p className="font-medium">{c.name}</p>
                  <p className={cn("truncate text-xs", TONE_TEXT[c.tone])}>{c.note}</p>
                </div>
              </div>
              {isTop ? (
                <motion.span
                  initial={false}
                  animate={clicked && !shortlisted ? { scale: 0.92 } : { scale: 1 }}
                  className={cn(
                    "inline-flex h-9 w-[104px] shrink-0 items-center justify-center gap-1 rounded-lg text-sm font-medium transition-colors",
                    shortlisted ? "bg-matched/20 text-matched" : "bg-primary text-primary-foreground",
                  )}
                >
                  {shortlisted ? (<><Check className="h-4 w-4" /> Shortlisted</>) : "Shortlist"}
                </motion.span>
              ) : (
                <span className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground">Review</span>
              )}
            </motion.div>
          );
        })}

        <motion.svg
          aria-hidden
          style={{ left, top }}
          animate={clicked && !shortlisted ? { scale: 0.85 } : { scale: 1 }}
          viewBox="0 0 24 24"
          className="pointer-events-none absolute z-10 h-7 w-7 drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]"
        >
          <path d="M3 2l7.5 19 2.6-7.9L21 10.5z" fill="#E6E8F2" stroke="#0B0D17" strokeWidth="1.4" strokeLinejoin="round" />
        </motion.svg>
      </div>

      <motion.div
        initial={false}
        animate={{ opacity: step >= 3 ? 1 : 0, y: step >= 3 ? 0 : 8 }}
        className="mt-5 rounded-xl border border-border bg-background/60 p-3 font-mono text-[11px] sm:text-xs"
      >
        <p className="text-muted-foreground">audit trail</p>
        <p className="mt-1">
          <span className="text-muted-foreground">ai_assessed</span> → <span className="text-matched">shortlisted</span>{" "}
          · by recruiter · just now
        </p>
        <p className="mt-1 text-muted-foreground">statuses changed by AI: 0</p>
      </motion.div>
    </div>
  );
}

// =============================================================== 07 Search
const SEARCH_QUERY = "Python developers with REST API experience";
const RESULTS = [
  { name: "Sara A.", sim: 0.89, parts: ["Built ", "REST services", " in ", "Django", " backed by PostgreSQL."], note: null },
  { name: "Bilal K.", sim: 0.81, parts: ["Designed ", "Flask endpoints", " consumed by the mobile app."], note: "different wording, same skill" },
  { name: "Usman T.", sim: 0.74, parts: ["", "Python", " automation for ", "API", " integration tests."], note: null },
];

export function SearchScene() {
  return (
    <Scene id="search" length={240}>
      {(p) => (
        <>
          <SceneCopy step="07" eyebrow="Search" title="Ask for talent in plain language.">
            Resume passages are stored as embeddings in pgvector, so a search for &ldquo;REST API&rdquo; also
            finds &ldquo;Flask endpoints&rdquo;, and each result comes with its evidence.
          </SceneCopy>
          <SearchVisual p={p} />
        </>
      )}
    </Scene>
  );
}

function SearchVisual({ p }: { p: MotionValue<number> }) {
  const chars = useTransform(p, [0.05, 0.4], [0, SEARCH_QUERY.length]);
  const typed = useTransform(chars, (v) => SEARCH_QUERY.slice(0, Math.round(v)));
  const shown = useStep(p, [0.48, 0.58, 0.68]);
  const searching = useStep(p, [0.41]) > 0 && shown === 0;

  return (
    <div className="mx-auto w-full max-w-lg space-y-3">
      <Panel className="flex items-center gap-3 !p-4">
        <Search className="h-5 w-5 shrink-0 text-primary" />
        <p className="min-h-[1.5em] flex-1 text-sm sm:text-base">
          <motion.span>{typed}</motion.span>
          <span className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[3px] animate-pulse bg-primary motion-reduce:animate-none" />
        </p>
        <span className="hidden font-mono text-[10px] text-muted-foreground sm:block">{searching ? "embedding…" : "⏎"}</span>
      </Panel>
      <div className="min-h-[260px] space-y-3">
        <AnimatePresence>
          {RESULTS.slice(0, shown).map((r) => (
            <motion.div
              key={r.name}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={spring}
              className="rounded-2xl border border-border bg-surface p-4"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="font-medium">{r.name}</p>
                <span className="font-mono text-xs text-matched">{Math.round(r.sim * 100)}% match</span>
              </div>
              <p className="font-mono text-[11px] leading-relaxed text-foreground/80 sm:text-xs">
                “
                {r.parts.map((t, i) =>
                  i % 2 === 1 ? (
                    <mark key={i} className="rounded bg-matched/20 px-0.5 text-matched">{t}</mark>
                  ) : (
                    <span key={i}>{t}</span>
                  ),
                )}
                ”
              </p>
              {r.note && <Chip tone="primary" className="mt-2 !text-[11px]">{r.note}</Chip>}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

// =============================================================== CTA
export function CtaButtons({ size = "lg" }: { size?: "lg" | "default" }) {
  return (
    <div className="flex flex-wrap gap-3">
      <Button asChild size={size}>
        <Link href="/auth/sign-up?role=recruiter">
          <BriefcaseBusiness className="h-4 w-4" /> I&apos;m hiring
        </Link>
      </Button>
      <Button asChild size={size} variant="outline">
        <Link href="/auth/sign-up?role=candidate">
          <FileText className="h-4 w-4" /> I&apos;m a candidate
        </Link>
      </Button>
    </div>
  );
}

export function FinalCta() {
  return (
    <section className="relative overflow-hidden py-24 sm:py-32">
      <Glow />
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="text-center text-4xl font-bold sm:text-6xl">Follow the evidence.</h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-muted-foreground">
          Hiring with AI is safer when the evidence is visible and the decision stays with a person.
        </p>
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <RoleCard
            href="/auth/sign-up?role=recruiter"
            icon={<BriefcaseBusiness className="h-5 w-5" />}
            title="I'm hiring"
            body="Paste a job description and let AI pull out the requirements. Then review a ranked list of candidates, each with excerpts, gaps and a score breakdown."
            cta="Start as a recruiter"
            primary
          />
          <RoleCard
            href="/auth/sign-up?role=candidate"
            icon={<FileText className="h-5 w-5" />}
            title="I'm a candidate"
            body="Upload a PDF, fix anything the AI got wrong, and track every application from submitted to decision."
            cta="Start as a candidate"
          />
        </div>
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </section>
  );
}

function RoleCard({ href, icon, title, body, cta, primary }: { href: string; icon: React.ReactNode; title: string; body: string; cta: string; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "group rounded-2xl border bg-surface p-6 transition-colors sm:p-8",
        primary ? "border-primary/50 hover:border-primary" : "border-border hover:border-foreground/40",
      )}
    >
      <span className={cn("mb-5 inline-flex h-10 w-10 items-center justify-center rounded-xl", primary ? "bg-primary text-primary-foreground" : "bg-secondary")}>
        {icon}
      </span>
      <h3 className="text-2xl font-bold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
      <span className={cn("mt-6 inline-flex items-center gap-1.5 text-sm font-medium", primary ? "text-primary" : "text-foreground")}>
        {cta} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </span>
    </Link>
  );
}
