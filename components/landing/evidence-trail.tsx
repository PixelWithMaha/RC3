"use client";

import Link from "next/link";
import { MotionConfig, motion, useScroll, useSpring } from "motion/react";
import { ReactLenis } from "lenis/react";
import "lenis/dist/lenis.css";
import { Button } from "@/components/ui/button";
import { useReduced } from "./primitives";
import {
  AnalyticsSection,
  FairnessScene,
  FinalCta,
  Hero,
  KanbanScene,
  MatchScene,
  ParseScene,
  ScoreScene,
  SearchScene,
  Spotlight,
  StageRail,
} from "./scenes";

export function EvidenceTrail() {
  const reduced = useReduced();
  const page = (
    <MotionConfig reducedMotion="user">
      <ProgressRail />
      {!reduced && <Spotlight />}
      <Nav />
      <StageRail />
      <main className="relative z-[2] overflow-x-clip">
        <Hero />
        <ParseScene />
        <MatchScene />
        <ScoreScene />
        <KanbanScene />
        <FairnessScene />
        <SearchScene />
        <AnalyticsSection />
        <FinalCta />
      </main>
      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        TalentBridge · Next.js, Supabase, pgvector and Gemini · AI recommends. You decide.
      </footer>
    </MotionConfig>
  );
  // Smooth scrolling only when the user hasn't asked for reduced motion.
  return reduced ? page : <ReactLenis root options={{ lerp: 0.12 }}>{page}</ReactLenis>;
}

function ProgressRail() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 40, restDelta: 0.001 });
  return (
    <motion.div
      aria-hidden
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-gradient-to-r from-primary to-matched"
    />
  );
}

function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-heading font-bold">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-sm text-primary-foreground">
            T
          </span>
          TalentBridge
          <span className="hidden font-normal text-muted-foreground sm:inline">· Evidence Trail</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/auth/login">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/auth/sign-up">Get started</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
