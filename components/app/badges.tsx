import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { ApplicationStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS: Record<ApplicationStatus, { label: string; cls: string }> = {
  submitted: { label: "Submitted", cls: "border-border text-muted-foreground" },
  parsed: { label: "Parsed", cls: "border-border text-muted-foreground" },
  ai_assessed: { label: "AI assessed", cls: "border-primary/50 text-primary" },
  recruiter_review: { label: "In review", cls: "border-primary/50 text-primary" },
  shortlisted: { label: "Shortlisted", cls: "border-matched/50 bg-matched/10 text-matched" },
  interview: { label: "Interview", cls: "border-matched/50 bg-matched/10 text-matched" },
  selected: { label: "Selected", cls: "border-matched bg-matched/20 text-matched" },
  rejected: { label: "Rejected", cls: "border-absent/50 bg-absent/10 text-absent" },
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const s = STATUS[status];
  return <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium", s.cls)}>{s.label}</span>;
}

export const statusLabel = (s: ApplicationStatus) => STATUS[s].label;

/** TI-8: every excerpt shows whether it was found in the raw resume text. */
export function VerifiedBadge({ verified }: { verified: boolean }) {
  return verified ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-matched/40 px-2 py-0.5 text-[11px] text-matched">
      <CheckCircle2 className="h-3 w-3" /> Verified
    </span>
  ) : (
    <span
      title="This excerpt was not found in the resume text. Review manually."
      className="inline-flex items-center gap-1 rounded-full border border-missing/50 bg-missing/10 px-2 py-0.5 text-[11px] text-missing"
    >
      <AlertTriangle className="h-3 w-3" /> Unverified — review manually
    </span>
  );
}

export function ScorePill({ score, override }: { score: number | null; override?: number | null }) {
  const v = override ?? score;
  const tone = v == null ? "text-muted-foreground border-border" : v >= 75 ? "text-matched border-matched/50" : v >= 50 ? "text-missing border-missing/50" : "text-absent border-absent/50";
  return (
    <span className={cn("inline-flex min-w-[3.25rem] items-center justify-center rounded-lg border px-2 py-1 font-heading text-lg font-bold", tone)}>
      {v == null ? "—" : Math.round(v)}
      {override != null && <span className="ml-1 text-[10px] font-normal">(override)</span>}
    </span>
  );
}

export function Excerpt({ children }: { children: React.ReactNode }) {
  return <q className="font-mono text-xs leading-relaxed text-foreground/80">{children}</q>;
}
