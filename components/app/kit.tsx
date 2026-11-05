// Shared design kit: avatars, score rings, illustrations, hero, pipeline stepper, fit meter.
import type { ReactNode } from "react";
import type { ApplicationStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const stagger = (i: number, step = 60) => ({ animationDelay: `${Math.min(i * step, 1200)}ms` });

const hue = (s: string) => ([...s].reduce((a, c) => a + c.charCodeAt(0), 0) * 37) % 360;
export function Avatar({ name, size = 36, className }: { name: string | null | undefined; size?: number; className?: string }) {
  const n = (name || "?").trim();
  const initials = n.split(/[\s@.]+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const h = hue(n);
  return (
    <span
      aria-hidden
      className={cn("inline-grid shrink-0 place-items-center rounded-full font-semibold text-white", className)}
      style={{ width: size, height: size, fontSize: size * 0.36, background: `linear-gradient(135deg, hsl(${h} 60% 52%), hsl(${(h + 40) % 360} 55% 40%))` }}
    >
      {initials}
    </span>
  );
}

/** Company-style tile for a job, derived from its title. */
export function JobMark({ title, size = 44 }: { title: string; size?: number }) {
  const h = hue(title);
  return (
    <span aria-hidden className="inline-grid shrink-0 place-items-center rounded-xl font-heading font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.4, background: `linear-gradient(135deg, hsl(${h} 70% 60% / .9), hsl(${(h + 60) % 360} 70% 45% / .9))` }}>
      {title.trim()[0]?.toUpperCase()}
    </span>
  );
}

export function ScoreRing({ value, size = 64, stroke = 7, label }: { value: number | null | undefined; size?: number; stroke?: number; label?: string }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, v = value ?? 0;
  const color = value == null ? "#272C3F" : v >= 75 ? "#2DD4BF" : v >= 50 ? "#F5B544" : "#F87171";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={value == null ? "Not scored" : `${Math.round(v)} out of 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} stroke="#1C2033" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" stroke={color}
          className="dash-ring" strokeDasharray={`${(c * v) / 100} ${c}`} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center leading-none">
        <span className="font-heading font-bold" style={{ fontSize: size * 0.3 }}>{value == null ? "—" : Math.round(v)}</span>
        {label && <span className="absolute bottom-[18%] text-[9px] text-muted-foreground">{label}</span>}
      </div>
    </div>
  );
}

export function FitMeter({ pct, className }: { pct: number; className?: string }) {
  const color = pct >= 75 ? "bg-matched" : pct >= 40 ? "bg-missing" : "bg-absent";
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-secondary", className)}>
      <i className={cn("dash-bar block h-full rounded-full", color)} style={{ width: `${Math.max(4, pct)}%` }} />
    </div>
  );
}

/** Page hero: soft glow panel with eyebrow, title, copy, actions and an optional illustration. */
export function Hero({ eyebrow, title, description, actions, art }: { eyebrow?: string; title: ReactNode; description?: ReactNode; actions?: ReactNode; art?: Illus }) {
  return (
    <section className="dash-card relative mb-6 overflow-hidden rounded-[20px] border border-border bg-surface px-6 py-6 sm:px-8">
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-matched/10 blur-3xl" />
      <div className="relative flex flex-wrap items-center justify-between gap-6">
        <div className="min-w-0 max-w-2xl">
          {eyebrow && <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-primary">{eyebrow}</p>}
          <h1 className="text-2xl font-bold sm:text-[32px]">{title}</h1>
          {description && <p className="mt-1.5 text-sm text-muted-foreground sm:text-base">{description}</p>}
          {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
        </div>
        {art && <div className="kit-float hidden shrink-0 md:block"><Illustration kind={art} size={150} /></div>}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- inline SVG illustrations (palette-matched)
export type Illus = "jobs" | "inbox" | "search" | "calendar" | "resume" | "compare" | "shield" | "profile";
export function Illustration({ kind, size = 120 }: { kind: Illus; size?: number }) {
  const P = "#7C5CFF", M = "#2DD4BF", A = "#F5B544", S = "#1C2033", L = "#272C3F", T = "#E6E8F2";
  const doc = (x: number, y: number, w = 56, h = 70) => (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={8} fill={S} stroke={L} strokeWidth={2} />
      {[14, 24, 34, 44].map((dy, i) => <rect key={i} x={x + 9} y={y + dy} width={w - (i % 2 ? 26 : 18)} height={4} rx={2} fill={i === 1 ? M : L} />)}
    </g>
  );
  const art: Record<Illus, ReactNode> = {
    jobs: (<>
      <rect x={22} y={44} width={76} height={54} rx={10} fill={S} stroke={L} strokeWidth={2} />
      <path d="M46 44v-8a6 6 0 0 1 6-6h16a6 6 0 0 1 6 6v8" fill="none" stroke={P} strokeWidth={3} />
      <rect x={22} y={62} width={76} height={6} fill={P} opacity={0.5} />
      <circle cx={92} cy={36} r={12} fill={M} /><path d="M86 36l4 4 8-8" stroke="#0B0D17" strokeWidth={3} fill="none" strokeLinecap="round" />
    </>),
    inbox: (<>
      <path d="M20 66l14-30h52l14 30v26a6 6 0 0 1-6 6H26a6 6 0 0 1-6-6z" fill={S} stroke={L} strokeWidth={2} />
      <path d="M20 66h24l6 10h20l6-10h24" fill="none" stroke={P} strokeWidth={3} />
      <circle cx={60} cy={34} r={6} fill={M} opacity={0.8} /><circle cx={78} cy={26} r={4} fill={A} />
    </>),
    search: (<>
      {doc(16, 26)}{doc(46, 20)}
      <circle cx={84} cy={70} r={20} fill="none" stroke={P} strokeWidth={5} /><path d="M98 84l12 12" stroke={P} strokeWidth={6} strokeLinecap="round" />
      <circle cx={84} cy={70} r={8} fill={M} opacity={0.5} />
    </>),
    calendar: (<>
      <rect x={20} y={28} width={80} height={70} rx={10} fill={S} stroke={L} strokeWidth={2} />
      <rect x={20} y={28} width={80} height={16} rx={8} fill={P} />
      {[0, 1, 2, 3].map((c) => [0, 1, 2].map((r) => <rect key={`${c}${r}`} x={30 + c * 17} y={52 + r * 14} width={10} height={8} rx={2} fill={c === 2 && r === 1 ? M : L} />))}
    </>),
    resume: (<>
      {doc(30, 18, 60, 82)}
      <rect x={24} y={42} width={72} height={10} fill={P} opacity={0.25} className="kit-scan" />
      <circle cx={92} cy={86} r={13} fill={M} /><path d="M86 86l4 4 8-8" stroke="#0B0D17" strokeWidth={3} fill="none" strokeLinecap="round" />
    </>),
    compare: (<>
      {doc(14, 26, 44, 62)}{doc(62, 26, 44, 62)}
      <path d="M58 46h4M58 58h4M58 70h4" stroke={M} strokeWidth={3} strokeLinecap="round" />
      <circle cx={36} cy={98} r={5} fill={M} /><circle cx={84} cy={98} r={5} fill={A} />
    </>),
    shield: (<>
      <path d="M60 18l34 12v26c0 22-15 36-34 44-19-8-34-22-34-44V30z" fill={S} stroke={P} strokeWidth={3} />
      <path d="M46 58l10 10 20-22" stroke={M} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>),
    profile: (<>
      <circle cx={60} cy={46} r={18} fill={P} opacity={0.8} /><path d="M28 98c4-18 18-26 32-26s28 8 32 26" fill={S} stroke={L} strokeWidth={2} />
      <circle cx={88} cy={30} r={6} fill={M} /><circle cx={30} cy={36} r={4} fill={A} /><circle cx={96} cy={72} r={3} fill={T} opacity={0.5} />
    </>),
  };
  return <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden>{art[kind]}</svg>;
}

// ---------------------------------------------------------------- pipeline stepper
const STEPS: { key: ApplicationStatus; label: string }[] = [
  { key: "submitted", label: "Submitted" }, { key: "ai_assessed", label: "AI assessed" }, { key: "recruiter_review", label: "In review" },
  { key: "shortlisted", label: "Shortlisted" }, { key: "interview", label: "Interview" }, { key: "selected", label: "Decision" },
];
const ORDER: ApplicationStatus[] = ["submitted", "parsed", "ai_assessed", "recruiter_review", "shortlisted", "interview", "selected"];

export function PipelineStepper({ status, reached, vertical }: { status: ApplicationStatus; reached?: ApplicationStatus[]; vertical?: boolean }) {
  const rejected = status === "rejected";
  const furthest = Math.max(...(reached ?? [status]).map((s) => ORDER.indexOf(s)), rejected ? 0 : ORDER.indexOf(status));
  if (vertical) {
    // Narrow containers (e.g. a side panel): one step per row so labels never overflow.
    return (
      <ol className="relative space-y-2.5" aria-label="Application progress">
        {STEPS.map((s, i) => {
          const idx = ORDER.indexOf(s.key);
          const done = idx <= furthest;
          const current = !rejected && (idx === furthest || (s.key === "ai_assessed" && status === "parsed"));
          const isDecision = s.key === "selected";
          const bad = isDecision && rejected;
          const label = isDecision ? (rejected ? "Not selected" : status === "selected" ? "Selected" : "Decision") : s.label;
          return (
            <li key={s.key} className="relative flex items-center gap-3">
              {i < STEPS.length - 1 && <span aria-hidden className={cn("absolute left-[11px] top-6 h-[calc(100%-4px)] w-0.5 rounded-full", idx < furthest ? "bg-matched" : "bg-border")} />}
              <span className={cn("relative grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-[10px] font-bold",
                bad ? "border-absent bg-absent/20 text-absent" : done ? "border-matched bg-matched text-background" : "border-border bg-surface text-muted-foreground",
                current && "ring-4 ring-matched/20")}>
                {bad ? "✕" : done ? "✓" : i + 1}
              </span>
              <span className={cn("text-sm", current ? "font-medium text-foreground" : done || bad ? "text-foreground" : "text-muted-foreground")}>{label}</span>
              {current && <span className="ml-auto rounded-full bg-matched/15 px-2 py-0.5 text-[11px] text-matched">Current</span>}
            </li>
          );
        })}
      </ol>
    );
  }
  return (
    <ol className="flex w-full min-w-0 items-center" aria-label="Application progress">
      {STEPS.map((s, i) => {
        const idx = ORDER.indexOf(s.key);
        const done = idx <= furthest;
        const current = !rejected && (idx === furthest || (s.key === "ai_assessed" && status === "parsed"));
        const last = i === STEPS.length - 1;
        const isDecision = s.key === "selected";
        return (
          <li key={s.key} className={cn("flex items-center", !last && "flex-1")}>
            <div className="flex flex-col items-center gap-1">
              <span className={cn("grid h-6 w-6 place-items-center rounded-full border-2 text-[10px] font-bold transition-colors",
                isDecision && rejected ? "border-absent bg-absent/20 text-absent"
                  : done ? "border-matched bg-matched text-background" : "border-border text-muted-foreground",
                current && "ring-4 ring-matched/20")}>
                {isDecision && rejected ? "✕" : done ? "✓" : i + 1}
              </span>
              <span className={cn("whitespace-nowrap text-[10px] sm:text-[11px]", !current && "max-sm:hidden", done || (isDecision && rejected) ? "text-foreground" : "text-muted-foreground")}>
                {isDecision ? (rejected ? "Not selected" : status === "selected" ? "Selected" : "Decision") : s.label}
              </span>
            </div>
            {!last && <span className={cn("mx-1 mb-4 h-0.5 flex-1 rounded-full", idx < furthest ? "bg-matched" : "bg-border")} />}
          </li>
        );
      })}
    </ol>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("kit-skeleton rounded-xl", className)} />;
}
