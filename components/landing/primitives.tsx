"use client";

import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  motion,
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
 * A tall section whose content is pinned while you scroll through it (scrubbed animation).
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
    <section id={id} ref={ref} className="relative" style={{ height: reduced ? undefined : `${length}vh` }}>
      <div className={reduced ? "py-20" : "sticky top-0 flex h-[100svh] items-center overflow-hidden"}>
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 pt-16 text-center sm:px-6">
          {children(reduced ? done : scrollYProgress)}
        </div>
      </div>
    </section>
  );
}

/**
 * Word-by-word heading reveal: each word rises out of its own mask.
 * The in-view trigger sits on the (visible) heading; words follow via variants —
 * a word hidden inside its mask would never register as in view itself.
 */
export function Reveal({ text, as = "h2", className, delay = 0 }: { text: string; as?: "h1" | "h2"; className?: string; delay?: number }) {
  const Tag = as === "h1" ? motion.h1 : motion.h2;
  const words = text.split(" ");
  return (
    <Tag
      aria-label={text}
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.3 }}
      transition={{ staggerChildren: 0.07, delayChildren: delay }}
    >
      {words.map((w, i) => (
        <span key={i} aria-hidden className="inline-block overflow-hidden pb-[0.08em] align-top">
          <motion.span
            className="inline-block"
            variants={{ hidden: { y: "115%" }, show: { y: "0%" } }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            {w}
          </motion.span>
          {i < words.length - 1 && "\u00a0"}
        </span>
      ))}
    </Tag>
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

export function SceneCopy({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-8 max-w-3xl">
      <Reveal text={title} className="text-3xl font-bold leading-[1.08] sm:text-4xl lg:text-5xl" />
      {children && <p className="mx-auto mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg">{children}</p>}
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
