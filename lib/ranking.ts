// Live "what-if" ranking for recruiters. Re-weights the STORED AI sub-scores in code; it never
// re-runs the AI and never changes a stored score or status (human in control).
import type { ScoreBreakdown } from "@/lib/types";

export const DIMENSIONS = [
  { key: "skills", label: "Skills", short: "S" },
  { key: "experience", label: "Experience", short: "E" },
  { key: "projects", label: "Project relevance", short: "P" },
  { key: "qualifications", label: "Qualifications", short: "Q" },
] as const satisfies readonly { key: keyof ScoreBreakdown; label: string; short: string }[];

/** Weights in whole percent, same order as DIMENSIONS, always summing to 100. Default = MATCH-3. */
export type Weights = [number, number, number, number];
export const DEFAULT_WEIGHTS: Weights = [50, 25, 15, 10];

export interface Rankable { id: string; breakdown: ScoreBreakdown }

export function weightedTotal(b: ScoreBreakdown, w: Weights): number {
  return DIMENSIONS.reduce((s, d, i) => s + b[d.key] * w[i], 0) / 100;
}

/** Rank (1 = best) per id. Ties broken by id so the order is deterministic. */
export function rankOf(items: Rankable[], w: Weights): Record<string, number> {
  const order = [...items].sort((a, b) => weightedTotal(b.breakdown, w) - weightedTotal(a.breakdown, w) || a.id.localeCompare(b.id));
  return Object.fromEntries(order.map((x, i) => [x.id, i + 1]));
}

/** Set one weight and redistribute the rest proportionally so the total stays exactly 100. */
export function rebalance(w: Weights, index: number, value: number): Weights {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const rest = 100 - v;
  const others = [0, 1, 2, 3].filter((j) => j !== index);
  const sum = others.reduce((a, j) => a + w[j], 0);
  const raw = others.map((j) => (sum ? (w[j] / sum) * rest : rest / 3));
  const floors = raw.map(Math.floor);
  let leftover = rest - floors.reduce((a, b) => a + b, 0);
  raw.map((r, k) => [r - floors[k], k] as const).sort((a, b) => b[0] - a[0]).forEach(([, k]) => { if (leftover-- > 0) floors[k]++; });
  const out = [...w] as Weights;
  out[index] = v;
  others.forEach((j, k) => (out[j] = floors[k]));
  return out;
}

export interface Stability {
  applicable: boolean;
  tested: number;
  holdPct: number;                 // share of nearby weightings where the current #1 stays #1
  badge: "Stable" | "Somewhat sensitive" | "Sensitive";
  topId: string | null;
  rivalId: string | null;          // who most often takes #1 instead
  driver: string | null;           // which dimension, when weighted up, favours the rival
  ranges: Record<string, { best: number; worst: number }>;
}

/** Re-rank under every weighting within ±delta points (total kept at 100) and see how much the order moves. */
export function computeStability(items: Rankable[], w: Weights, delta = 15): Stability {
  const empty: Stability = { applicable: false, tested: 0, holdPct: 1, badge: "Stable", topId: null, rivalId: null, driver: null, ranges: {} };
  if (items.length < 2) return empty;
  const ranges: Stability["ranges"] = Object.fromEntries(items.map((x) => [x.id, { best: Infinity, worst: 0 }]));
  const wins: Record<string, number> = {};
  const shift: Record<string, number[]> = {};
  const cur = rankOf(items, w);
  const topId = Object.keys(cur).find((id) => cur[id] === 1)!;
  const steps = [-delta, 0, delta];
  let tested = 0;
  for (const a of steps) for (const b of steps) for (const c of steps) for (const d of steps) {
    if (a + b + c + d !== 0) continue;
    const t = [w[0] + a, w[1] + b, w[2] + c, w[3] + d] as Weights;
    if (t.some((x) => x < 0)) continue;
    tested++;
    const r = rankOf(items, t);
    for (const id in r) { ranges[id].best = Math.min(ranges[id].best, r[id]); ranges[id].worst = Math.max(ranges[id].worst, r[id]); }
    const win = Object.keys(r).find((id) => r[id] === 1)!;
    wins[win] = (wins[win] ?? 0) + 1;
    const s = (shift[win] ??= [0, 0, 0, 0]);
    [a, b, c, d].forEach((v, i) => (s[i] += v));
  }
  const holdPct = (wins[topId] ?? 0) / tested;
  const rivalId = Object.keys(wins).filter((id) => id !== topId).sort((x, y) => wins[y] - wins[x])[0] ?? null;
  const driver = rivalId ? DIMENSIONS[shift[rivalId].indexOf(Math.max(...shift[rivalId]))].label : null;
  return {
    applicable: true, tested, holdPct, topId, rivalId, driver, ranges,
    badge: holdPct >= 0.8 ? "Stable" : holdPct < 0.5 ? "Sensitive" : "Somewhat sensitive",
  };
}
