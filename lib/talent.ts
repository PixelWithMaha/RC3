// Pure talent-intelligence helpers (TI-3, TI-4, TI-7). No I/O; unit-tested.
import type { Job, ParsedResume } from "@/lib/types";
import { computeFit } from "@/lib/ai/fit";

// ---------------------------------------------------------------- vectors
/** pgvector comes back from PostgREST as "[0.1,0.2,…]". */
export function parseVector(v: unknown): number[] | null {
  if (Array.isArray(v)) return v as number[];
  if (typeof v !== "string" || !v.startsWith("[")) return null;
  try { return JSON.parse(v) as number[]; } catch { return null; }
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

// ---------------------------------------------------------------- TI-7 counterfactual
export interface Counterfactual { altered: ParsedResume; attributes_changed: string[] }

/** Same professional content, different protected attributes (name, gender, age, contact, nationality, religion). */
export function buildCounterfactual(p: ParsedResume): Counterfactual {
  const altered: ParsedResume = structuredClone(p);
  altered.name = "Jordan Ellis";
  altered.contact = { email: "jordan.ellis@example.org", phone: "+1 415 555 0199", location: "Toronto, Canada", links: [] };
  const swapPronouns = (t: string) =>
    t.replace(/\b(she|he)\b/gi, (m) => (m.toLowerCase() === "she" ? "he" : "she"))
      .replace(/\b(her|his)\b/gi, (m) => (m.toLowerCase() === "her" ? "his" : "her"));
  const firstName = p.name?.split(/\s+/)[0];
  const swapName = (t: string) => (firstName ? t.replace(new RegExp(`\\b${firstName}\\b`, "g"), "Jordan") : t);
  altered.summary = `${swapPronouns(swapName(p.summary ?? ""))} Gender: Non-binary. Age: 52. Nationality: Canadian. Religion: none stated. Marital status: married.`.trim();
  altered.experience = altered.experience.map((e) => ({ ...e, description: swapPronouns(swapName(e.description)) }));
  return {
    altered,
    attributes_changed: ["name", "email", "phone", "location", "gender", "age", "nationality", "religion", "marital status", "pronouns"],
  };
}

// ---------------------------------------------------------------- TI-4 recommendations
export type FitTier = "strong" | "good" | "stretch";
export interface Recommendation {
  job: Job; score: number; fit: number; tier: FitTier; eligible: boolean;
  reason: string; matched: string[]; missing: string[];
}

/** Gemini embeddings of any tech resume vs any tech job sit around 0.55–0.75, so rescale before use. */
export const scaleSimilarity = (cos: number) => Math.min(1, Math.max(0, (cos - 0.55) / 0.3));

/**
 * score = 80% evidence-based fit (same as the job page) + 15% rescaled resume↔job meaning + 5% interests.
 * Only jobs with real evidence (fit ≥ 30 and at least one required skill shown) are eligible to recommend.
 */
export function recommendJobs(
  jobs: (Job & { embedding?: unknown })[],
  resume: { parsed: ParsedResume; raw_text?: string | null; embedding?: unknown },
  interests: string[] = [],
  appliedJobIds: Set<string> = new Set(),
): Recommendation[] {
  const rv = parseVector(resume.embedding);
  return jobs
    .filter((j) => j.status === "open" && !appliedJobIds.has(j.id))
    .map((job) => {
      const f = computeFit(job, resume.parsed, resume.raw_text ?? null);
      const jv = parseVector(job.embedding);
      const sim = rv && jv ? scaleSimilarity(cosine(rv, jv)) : 0;
      const text = `${job.title} ${job.department ?? ""} ${job.description}`.toLowerCase();
      const interest = interests.some((i) => i.trim() && text.includes(i.trim().toLowerCase())) ? 1 : 0;
      const score = Math.min(100, Math.round(0.8 * f.fit + 15 * sim + 5 * interest));
      const shownRequired = job.required_skills.some((r) => !f.requiredMissing.includes(r.name)); // proven, listed or related
      const eligible = f.fit >= 30 && (shownRequired || !job.required_skills.length);
      const matched = [...f.proven, ...f.listed];
      const parts = [
        f.proven.length && `Proven: ${f.proven.slice(0, 4).join(", ")}`,
        f.listed.length && `Listed: ${f.listed.slice(0, 3).join(", ")}`,
        f.related.length && `Related: ${f.related.slice(0, 2).join(", ")}`,
        f.requiredMissing.length && `Not in your resume: ${f.requiredMissing.slice(0, 3).join(", ")}${f.requiredMissing.length > 3 ? ` +${f.requiredMissing.length - 3}` : ""}`,
      ].filter(Boolean) as string[];
      const reason = (parts.length ? parts.join(" · ") : "No listed skill appears in your resume yet.") + (interest ? " · Matches your interests." : "");
      return { job, score, fit: f.fit, tier: (f.fit >= 70 ? "strong" : f.fit >= 45 ? "good" : "stretch") as FitTier, eligible, reason, matched, missing: f.requiredMissing };
    })
    .sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------- TI-3 duplicates
export interface DupCandidate {
  application_id: string; candidate_id: string; job_id: string; created_at: string;
  email: string | null; phone: string | null; embedding?: unknown;
  raw_text?: string | null; name?: string | null;
}
export interface DupPair {
  a: DupCandidate; b: DupCandidate;
  similarity: number | null;   // document (text) similarity 0-1
  meaning: number | null;      // embedding cosine — context only, never sufficient alone
  reasons: string[];           // strong signals that triggered the flag
  context: string[];           // supporting information shown to the recruiter
  sameJob: boolean;
}

export const normEmail = (e: string | null | undefined) => (e ? e.trim().toLowerCase().replace(/\+[^@]*@/, "@") : null);
export const normPhone = (p: string | null | undefined) => { const d = (p ?? "").replace(/\D/g, ""); return d.length >= 9 ? d.slice(-10) : null; };
const normName = (n: string | null | undefined) => (n ?? "").toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean).sort().join(" ") || null;

/** Lexical near-duplicate check: Jaccard overlap of word 3-grams. Same document ≈ 1, different people ≈ low. */
export function documentSimilarity(a: string | null | undefined, b: string | null | undefined): number | null {
  const grams = (t: string) => {
    const w = t.toLowerCase().replace(/[^a-z0-9+#]+/g, " ").trim().split(" ").filter(Boolean);
    const g = new Set<string>();
    for (let i = 0; i + 2 < w.length; i++) g.add(`${w[i]} ${w[i + 1]} ${w[i + 2]}`);
    return g;
  };
  if (!a || !b) return null;
  const ga = grams(a), gb = grams(b);
  if (!ga.size || !gb.size) return null;
  let inter = 0;
  for (const g of ga) if (gb.has(g)) inter++;
  return inter / (ga.size + gb.size - inter);
}

export const DOC_THRESHOLD = 0.6;

/**
 * Likely duplicate CANDIDATE records (different accounts, same person).
 * Strong signals only: same normalized email, same normalized phone, or a near-identical resume document.
 * Embedding similarity and matching names are shown as context but never flag on their own
 * (two backend developers' resumes are semantically ~0.98 similar without being the same person).
 * One pair per pair of accounts; a same-job application pair is preferred as the representative.
 */
export function findDuplicatePairs(rows: DupCandidate[]): DupPair[] {
  const best = new Map<string, DupPair>();
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i], b = rows[j];
      if (a.candidate_id === b.candidate_id) continue;
      const reasons: string[] = [];
      if (normEmail(a.email) && normEmail(a.email) === normEmail(b.email)) reasons.push("Same email in resume");
      if (normPhone(a.phone) && normPhone(a.phone) === normPhone(b.phone)) reasons.push("Same phone in resume");
      const doc = documentSimilarity(a.raw_text, b.raw_text);
      if (doc != null && doc >= DOC_THRESHOLD) reasons.push(`Resume text ${Math.round(doc * 100)}% identical`);
      if (!reasons.length) continue;
      const va = parseVector(a.embedding), vb = parseVector(b.embedding);
      const meaning = va && vb ? cosine(va, vb) : null;
      const context: string[] = [];
      if (doc != null && doc < DOC_THRESHOLD) context.push(`Resume text ${Math.round(doc * 100)}% identical`);
      if (meaning != null) context.push(`Meaning ${Math.round(meaning * 100)}% similar`);
      const na = normName(a.name), nb = normName(b.name);
      if (na && nb) context.push(na === nb ? "Same account name" : `Different account names: “${a.name}” vs “${b.name}”`);
      const [first, second] = a.created_at <= b.created_at ? [a, b] : [b, a];
      const pair: DupPair = { a: first, b: second, similarity: doc, meaning, reasons, context, sameJob: a.job_id === b.job_id };
      const key = [a.candidate_id, b.candidate_id].sort().join("|");
      const prev = best.get(key);
      if (!prev || (pair.sameJob && !prev.sameJob) || (pair.sameJob === prev.sameJob && pair.b.created_at < prev.b.created_at)) best.set(key, pair);
    }
  }
  return [...best.values()];
}
