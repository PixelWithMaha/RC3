// INT-3: scheduling conflict detection (same interviewer or same candidate, overlapping time).

export interface Slot {
  id?: string;
  start: string | Date;
  durationMin: number;
  interviewerId?: string | null;
  interviewerName?: string | null;
  candidateId?: string | null;
  status?: string;
}

export interface Conflict {
  interview_id: string;
  scheduled_at: string;
  duration_min: number;
  reason: "interviewer" | "candidate";
}

export function overlaps(aStart: Date, aMin: number, bStart: Date, bMin: number): boolean {
  const aEnd = aStart.getTime() + aMin * 60_000;
  const bEnd = bStart.getTime() + bMin * 60_000;
  return aStart.getTime() < bEnd && bStart.getTime() < aEnd;
}

function sameInterviewer(a: Slot, b: Slot): boolean {
  if (a.interviewerId && b.interviewerId) return a.interviewerId === b.interviewerId;
  const an = a.interviewerName?.trim().toLowerCase();
  const bn = b.interviewerName?.trim().toLowerCase();
  return !!an && an === bn;
}

export function findConflicts(proposed: Slot, existing: Slot[]): Conflict[] {
  const start = new Date(proposed.start);
  const out: Conflict[] = [];
  for (const e of existing) {
    if (e.status === "cancelled" || (proposed.id && e.id === proposed.id)) continue;
    const eStart = new Date(e.start);
    if (!overlaps(start, proposed.durationMin, eStart, e.durationMin)) continue;
    const reason = sameInterviewer(proposed, e)
      ? "interviewer"
      : proposed.candidateId && proposed.candidateId === e.candidateId
        ? "candidate"
        : null;
    if (reason) {
      out.push({ interview_id: e.id ?? "", scheduled_at: eStart.toISOString(), duration_min: e.durationMin, reason });
    }
  }
  return out;
}
