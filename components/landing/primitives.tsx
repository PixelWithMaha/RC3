"use client";

import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  type MotionValue,
} from "motion/react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------- reduced motion
const QUERY = "(prefers-reduced-motion: reduce)";
function subscribe(cb: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
/** Hydration-safe prefers-reduced-motion (server + first client render = false). */
export function useReduced(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

// ---------------------------------------------------------------- scroll scene
/**
 * A tall section whose content is pinned while you scroll through it.
 * Children receive scroll progress (0→1). With reduced motion the section is
 * normal height and progress is fixed at 1, so every scene shows its final state.
 */
export function Scene({
  id,
  length = 260,
  children,
}: {
  id?: string;
  length?: number;
  children: (progress: MotionValue<number>) => ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReduced();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const done = useMotionValue(1);

  return (
    <section
      id={id}
      ref={ref}
      className="relative"
      style={{ height: reduced ? undefined : `${length}vh` }}
    >
      <div
        className={
          reduced
            ? "py-16 sm:py-24"
            : "sticky top-0 flex h-[100svh] items-start overflow-hidden lg:items-center"
        }
      >
        <div className="mx-auto grid w-full max-w-6xl items-center gap-5 px-4 pt-[72px] sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 lg:pt-14">
          {children(reduced ? done : scrollYProgress)}
        </div>
      </div>
    </section>
  );
}

/** Index of the last threshold passed (0 = none). Drives discrete, time-animated steps. */
export function useStep(progress: MotionValue<number>, thresholds: number[]): number {
  const count = (v: number) => thresholds.filter((t) => v >= t).length;
  const [step, setStep] = useState(() => count(progress.get()));
  useMotionValueEvent(progress, "change", (v) => {
    const next = count(v);
    setStep((s) => (s === next ? s : next));
  });
  return step;
}

export function SceneCopy({
  step,
  eyebrow,
  title,
  children,
}: {
  step: string;
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="max-w-xl">
      <p className="mb-3 flex items-center gap-3 font-mono text-xs uppercase tracking-[0.2em] text-primary">
        <span className="rounded-md border border-primary/40 px-1.5 py-0.5">{step}</span>
        {eyebrow}
      </p>
      <h2 className="text-3xl font-bold leading-[1.05] sm:text-4xl lg:text-5xl">{title}</h2>
      {children && (
        // On short phones the pinned scene can't fit copy + visual, so the body text gives way.
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground max-lg:[@media(max-height:740px)]:hidden sm:mt-4 sm:text-base">
          {children}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- chips & surfaces
export type Tone = "primary" | "matched" | "missing" | "absent" | "neutral";

const TONES: Record<Tone, string> = {
  primary: "border-primary/50 bg-primary/15 text-primary",
  matched: "border-matched/50 bg-matched/15 text-matched",
  missing: "border-missing/50 bg-missing/15 text-missing",
  absent: "border-absent/50 bg-absent/15 text-absent",
  neutral: "border-border bg-secondary text-foreground",
};

export function Chip({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium sm:text-sm",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "relative rounded-2xl border border-border bg-surface/90 p-4 shadow-[0_20px_80px_-20px_rgba(124,92,255,0.35)] backdrop-blur sm:p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Glow({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}>
      <div className="absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
      <div className="absolute bottom-0 right-0 h-[320px] w-[420px] rounded-full bg-matched/10 blur-[120px]" />
    </div>
  );
}
