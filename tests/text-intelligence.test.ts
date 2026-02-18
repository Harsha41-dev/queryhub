import { describe, expect, it } from "vitest";
import {
  buildSearchExcerpt,
  questionQualityWarnings,
  similarityRatio,
  textRelevance,
  tokenizeSearch,
} from "@/lib/text-intelligence";

describe("text intelligence helpers", () => {
  it("tokenizes meaningful search terms", () => {
    expect(tokenizeSearch("How do I learn AI systems in 2026?")).toEqual([
      "how",
      "learn",
      "systems",
      "2026",
    ]);
  });

  it("scores exact title matches higher than body matches", () => {
    const titleScore = textRelevance("distributed systems", [
      { text: "Distributed systems interview prep", weight: 3 },
      { text: "Some notes" },
    ]);
    const bodyScore = textRelevance("distributed systems", [
      { text: "Interview prep", weight: 3 },
      { text: "Distributed systems notes" },
    ]);
    expect(titleScore.score).toBeGreaterThan(bodyScore.score);
  });

  it("detects near duplicate question text", () => {
    expect(
      similarityRatio(
        "How can I prepare for system design interviews?",
        "How do I prepare for system design interview rounds?",
      ),
    ).toBeGreaterThan(0.7);
  });

  it("builds focused excerpts and quality warnings", () => {
    expect(
      buildSearchExcerpt(
        "This answer explains ranking, freshness, and reputation signals.",
        "freshness",
      ),
    ).toContain("freshness");
    expect(
      questionQualityWarnings({
        title: "How?",
        duplicateScore: 0.95,
        topicCount: 0,
      }),
    ).toEqual(
      expect.arrayContaining([
        "Make the question more specific.",
        "Add context so answers can match your situation.",
        "A very similar question already exists.",
        "Choose at least one topic.",
      ]),
    );
  });
});
