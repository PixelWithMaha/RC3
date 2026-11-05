// Candidate profile links (LinkedIn, GitHub, portfolio). Only http(s) is ever rendered as a link.
export type LinkKind = "linkedin" | "github" | "portfolio";
export interface ProfileLink { kind: LinkKind; url: string; label: string }

/** Adds https:// when missing; returns null for anything that isn't a plain http(s) URL. */
export function normalizeLink(raw: string): string | null {
  const t = raw.trim().replace(/[),.;]+$/, "");
  if (!t || /\s/.test(t)) return null;
  const withProto = /^https?:\/\//i.test(t) ? t : /^[a-z][a-z0-9+.-]*:/i.test(t) ? null : `https://${t.replace(/^\/+/, "")}`;
  if (!withProto) return null; // javascript:, data:, mailto: … are never links here
  try {
    const u = new URL(withProto);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!u.hostname.includes(".")) return null;
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function classifyLink(url: string): LinkKind {
  const host = new URL(url).hostname.replace(/^www\./, "");
  if (host === "linkedin.com" || host.endsWith(".linkedin.com")) return "linkedin";
  if (host === "github.com") return "github";
  return "portfolio";
}

/** Normalized, de-duplicated, safe links, LinkedIn first, then GitHub, then the rest. */
export function profileLinks(raw: string[] | null | undefined): ProfileLink[] {
  const seen = new Set<string>();
  const out: ProfileLink[] = [];
  for (const r of raw ?? []) {
    const url = normalizeLink(r);
    if (!url || seen.has(url.toLowerCase())) continue;
    seen.add(url.toLowerCase());
    const kind = classifyLink(url);
    const u = new URL(url);
    const label = kind === "portfolio" ? u.hostname.replace(/^www\./, "") : u.pathname.replace(/^\/(in\/)?/, "").split("/")[0] || u.hostname;
    out.push({ kind, url, label });
  }
  const order: Record<LinkKind, number> = { linkedin: 0, github: 1, portfolio: 2 };
  return out.sort((a, b) => order[a.kind] - order[b.kind]);
}
