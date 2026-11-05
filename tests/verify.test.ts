import { describe, expect, it } from "vitest";
import { verifyAll, verifyExcerpt } from "@/lib/ai/verify";

const raw = `Jane Doe
• Built REST endpoints in Django and deployed with Docker Compose on AWS.
Designed a Post-
greSQL schema for 2M “orders” records.`;

describe("verifyExcerpt", () => {
  it("accepts verbatim excerpts regardless of case and whitespace", () => {
    expect(verifyExcerpt("built REST endpoints in   django", raw)).toBe(true);
  });
  it("tolerates smart quotes and PDF line-break hyphenation", () => {
    expect(verifyExcerpt('schema for 2M "orders" records', raw)).toBe(true);
    expect(verifyExcerpt("Designed a PostgreSQL schema", raw)).toBe(true);
  });
  it("rejects hallucinated excerpts", () => {
    expect(verifyExcerpt("Led a team of 10 Kubernetes engineers", raw)).toBe(false);
    expect(verifyExcerpt("deployed with Kubernetes on AWS", raw)).toBe(false);
  });
  it("rejects empty or trivially short excerpts", () => {
    expect(verifyExcerpt("", raw)).toBe(false);
    expect(verifyExcerpt("a", raw)).toBe(false);
    expect(verifyExcerpt(undefined, raw)).toBe(false);
  });
  it("verifyAll overrides any model-provided verified flag", () => {
    const out = verifyAll([{ excerpt: "made up claim entirely", verified: true }], raw);
    expect(out[0].verified).toBe(false);
  });
});
