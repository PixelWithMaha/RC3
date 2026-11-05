import { describe, expect, it } from "vitest";
import { normalizeLink, profileLinks } from "@/lib/links";

describe("links", () => {
  it("adds https and strips trailing punctuation", () => {
    expect(normalizeLink("linkedin.com/in/ayesha-khan,")).toBe("https://linkedin.com/in/ayesha-khan");
    expect(normalizeLink("http://github.com/ayesha")).toBe("http://github.com/ayesha");
  });
  it("rejects unsafe or non-URL values", () => {
    expect(normalizeLink("javascript:alert(1)")).toBeNull();
    expect(normalizeLink("data:text/html,hi")).toBeNull();
    expect(normalizeLink("mailto:a@b.com")).toBeNull();
    expect(normalizeLink("not a link")).toBeNull();
    expect(normalizeLink("localhost")).toBeNull();
  });
  it("classifies, labels, dedupes and orders", () => {
    const l = profileLinks(["ayesha.dev", "https://www.linkedin.com/in/ayesha-khan/", "github.com/ayeshak", "github.com/ayeshak", "javascript:x"]);
    expect(l.map((x) => [x.kind, x.label])).toEqual([["linkedin", "ayesha-khan"], ["github", "ayeshak"], ["portfolio", "ayesha.dev"]]);
  });
});
