// TI-8: hallucination check, in code. An excerpt is verified only if it appears in the raw text.

/** Lowercase, unify quotes/dashes/bullets, collapse whitespace. */
export function normalizeForMatch(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/[•●▪◦‣⁃·]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Alphanumerics only: tolerates PDF line-break hyphenation and spacing artifacts. */
function squash(s: string): string {
  return normalizeForMatch(s).replace(/[^a-z0-9+#]/g, "");
}

const MIN_SQUASHED_LEN = 8;

export function verifyExcerpt(excerpt: string | null | undefined, rawText: string): boolean {
  if (!excerpt || !rawText) return false;
  const e = normalizeForMatch(excerpt).replace(/^\.{3}|\.{3}$/g, "").trim();
  if (e.length < 3) return false;
  if (normalizeForMatch(rawText).includes(e)) return true;
  const sq = squash(e);
  return sq.length >= MIN_SQUASHED_LEN && squash(rawText).includes(sq);
}

/** Sets `verified` on every item from its excerpt. Never trusts a model-provided `verified`. */
export function verifyAll<T extends { excerpt: string }>(items: T[], rawText: string): (T & { verified: boolean })[] {
  return items.map((it) => ({ ...it, verified: verifyExcerpt(it.excerpt, rawText) }));
}
