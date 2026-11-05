import { describe, expect, it } from "vitest";
import { buildParsedResume, chunkText, cleanText, isPdf } from "@/lib/ai/resume";

const raw = "Skills: Python, Postgres, ReactJS\nBuilt a Django REST API deployed with Docker.";

describe("buildParsedResume", () => {
  it("normalizes skills and computes verified from the raw text", () => {
    const p = buildParsedResume(
      {
        name: "X", contact: { email: null, phone: null, location: null, links: [] }, summary: null,
        total_experience_years: 2,
        skills: [
          { name: "Postgres", excerpt: "Python, Postgres" },
          { name: "ReactJS", excerpt: "Python, Postgres, ReactJS" },
          { name: "Kubernetes", excerpt: "orchestrated Kubernetes clusters" },
        ],
        education: [], experience: [],
        projects: [{ name: "API", description: "d", technologies: ["django", "Docker"], excerpt: "Built a Django REST API" }],
      },
      raw,
    );
    expect(p.skills.map((s) => [s.name, s.verified])).toEqual([
      ["PostgreSQL", true],
      ["React", true],
      ["Kubernetes", false],
    ]);
    expect(p.projects[0].verified).toBe(true);
    expect(p.projects[0].technologies).toEqual(["Django", "Docker"]);
  });
});

describe("text helpers", () => {
  it("chunks long text under the size limit", () => {
    const text = Array.from({ length: 50 }, (_, i) => `Line ${i} about Python and Django services.`).join("\n");
    const chunks = chunkText(text, 300, 50);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 360)).toBe(true);
  });
  it("cleans whitespace and null bytes", () => {
    expect(cleanText("a\u0000  b\n\n\n\nc")).toBe("a b\n\nc");
  });
  it("detects PDF magic bytes", () => {
    expect(isPdf(new TextEncoder().encode("%PDF-1.7"))).toBe(true);
    expect(isPdf(new TextEncoder().encode("PK\u0003\u0004"))).toBe(false);
  });
});

import { isDocx } from "@/lib/ai/resume";
describe("isDocx", () => {
  it("detects the ZIP signature used by .docx", () => {
    expect(isDocx(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14]))).toBe(true);
    expect(isDocx(new TextEncoder().encode("%PDF-1.7"))).toBe(false);
  });
});
