import { describe, expect, it } from "vitest";
import { findConflicts, overlaps } from "@/lib/interviews";

const at = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 10, h, m)).toISOString();

describe("overlaps", () => {
  it("detects overlap and treats touching slots as free", () => {
    expect(overlaps(new Date(at(10)), 60, new Date(at(10, 30)), 60)).toBe(true);
    expect(overlaps(new Date(at(10)), 60, new Date(at(11)), 60)).toBe(false);
  });
});

describe("findConflicts", () => {
  const existing = [
    { id: "i1", start: at(10), durationMin: 60, interviewerId: "rec1", candidateId: "c1" },
    { id: "i2", start: at(14), durationMin: 30, interviewerName: "Sara Ali", candidateId: "c2" },
    { id: "i3", start: at(16), durationMin: 60, interviewerId: "rec9", candidateId: "c3", status: "cancelled" },
  ];
  it("flags same interviewer overlap", () => {
    const c = findConflicts({ start: at(10, 30), durationMin: 45, interviewerId: "rec1", candidateId: "c9" }, existing);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ interview_id: "i1", reason: "interviewer" });
  });
  it("flags same candidate overlap with a different interviewer", () => {
    const c = findConflicts({ start: at(14, 15), durationMin: 30, interviewerId: "rec5", candidateId: "c2" }, existing);
    expect(c[0]).toMatchObject({ interview_id: "i2", reason: "candidate" });
  });
  it("matches interviewer by name case-insensitively when ids are missing", () => {
    const c = findConflicts({ start: at(14), durationMin: 15, interviewerName: "sara ali ", candidateId: "c7" }, existing);
    expect(c[0]?.reason).toBe("interviewer");
  });
  it("ignores cancelled interviews, non-overlapping slots and unrelated people", () => {
    expect(findConflicts({ start: at(16), durationMin: 60, interviewerId: "rec9", candidateId: "c3" }, existing)).toEqual([]);
    expect(findConflicts({ start: at(11), durationMin: 60, interviewerId: "rec1", candidateId: "c1" }, existing)).toEqual([]);
    expect(findConflicts({ start: at(10), durationMin: 60, interviewerId: "rec2", candidateId: "c8" }, existing)).toEqual([]);
  });
});
