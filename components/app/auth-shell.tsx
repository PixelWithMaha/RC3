// Split auth layout: form on the left, animated evidence card on the right (desktop).
import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1fr_1.05fr]">
      <div className="relative flex flex-col px-6 py-8 sm:px-10">
        <Link href="/" className="flex items-center gap-2 font-heading text-lg font-bold">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-[15px] text-primary-foreground">R</span> RC3
        </Link>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="dash-card w-full max-w-sm">{children}</div>
        </div>
        <p className="text-center text-xs text-muted-foreground">AI recommends. You decide.</p>
      </div>
      <aside className="relative hidden overflow-hidden border-l border-border bg-surface lg:flex lg:items-center lg:justify-center">
        <div aria-hidden className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-primary/25 blur-3xl" />
        <div aria-hidden className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-matched/15 blur-3xl" />
        <div className="relative w-full max-w-md px-8">
          <EvidenceCard />
          <h2 className="mt-8 text-3xl font-bold leading-tight">Every score points back to <span className="text-primary">real evidence.</span></h2>
          <p className="mt-3 text-muted-foreground">Resumes become transparent skill evidence, explainable scores and fair, human decisions.</p>
          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            {[["Verified", "excerpts"], ["0", "auto-decisions"], ["50/25/15/10", "weighted score"]].map(([a, b]) => (
              <div key={b} className="rounded-xl border border-border bg-background/40 p-3">
                <p className="font-heading text-lg font-bold text-matched">{a}</p>
                <p className="text-[11px] text-muted-foreground">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function EvidenceCard() {
  const lines = [
    { t: "Built REST services in ", h: "Django", r: " and Postgres." },
    { t: "Containerized every service with ", h: "Docker", r: "." },
    { t: "Automated reports with ", h: "Python", r: " scripts." },
  ];
  return (
    <div className="kit-float relative overflow-hidden rounded-2xl border border-border bg-background/80 p-5 shadow-[0_30px_80px_-20px_rgba(124,92,255,0.45)]">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-primary to-matched font-heading font-bold text-white">AK</span>
        <div className="flex-1">
          <p className="font-heading font-semibold">Ayesha Khan</p>
          <p className="text-xs text-muted-foreground">Backend Developer · 5 yrs</p>
        </div>
        <span className="rounded-lg border border-matched/50 px-2 py-0.5 font-heading text-xl font-bold text-matched">94</span>
      </div>
      <div className="relative space-y-2 font-mono text-[12px] text-foreground/80">
        {lines.map((l, i) => (
          <p key={i}>{l.t}<mark className="rounded bg-matched/25 px-0.5 text-matched">{l.h}</mark>{l.r}</p>
        ))}
        <div aria-hidden className="kit-scan pointer-events-none absolute inset-x-0 top-0 h-8 border-b-2 border-primary bg-gradient-to-b from-transparent to-primary/20" />
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5 text-[11px]">
        <span className="rounded-full border border-matched/50 bg-matched/10 px-2 py-0.5 text-matched">✓ Python</span>
        <span className="rounded-full border border-matched/50 bg-matched/10 px-2 py-0.5 text-matched">✓ Django</span>
        <span className="rounded-full border border-matched/50 bg-matched/10 px-2 py-0.5 text-matched">✓ Docker</span>
        <span className="rounded-full border border-missing/50 bg-missing/10 px-2 py-0.5 text-missing">AWS · no evidence</span>
      </div>
    </div>
  );
}
