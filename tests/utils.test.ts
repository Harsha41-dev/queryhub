import { describe, expect, it } from "vitest";
import { compactNumber, safeRedirectPath, slugify } from "@/lib/utils";

describe("core utilities", () => {
  it("creates stable URL-safe slugs", () => {
    expect(slugify("  What makes café teams thrive?  ")).toBe(
      "what-makes-cafe-teams-thrive",
    );
    expect(slugify("one---two")).toBe("one-two");
  });

  it("rejects unsafe redirects", () => {
    expect(safeRedirectPath("//malicious.example")).toBe("/home");
    expect(safeRedirectPath("https://malicious.example")).toBe("/home");
    expect(safeRedirectPath("/question/a")).toBe("/question/a");
  });

  it("formats engagement counts compactly", () => {
    expect(compactNumber(999)).toBe("999");
    expect(compactNumber(12_400)).toMatch(/12(\.4)?K/i);
  });
});
