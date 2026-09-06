import { describe, expect, it } from "vitest";
import {
  assessContentRisk,
  assessUserText,
  recentDuplicateWindow,
} from "@/lib/abuse";

describe("abuse heuristics", () => {
  it("allows normal useful writing", () => {
    expect(
      assessUserText(
        "A useful answer usually explains the trade-off, gives context, and names when the advice might not apply.",
      ),
    ).toEqual({ ok: true });
  });

  it("blocks obvious link spam and repetitive text", () => {
    expect(
      assessUserText(
        "https://a.test https://b.test https://c.test https://d.test https://e.test",
        { maxLinks: 4 },
      ),
    ).toMatchObject({ ok: false, code: "LINK_SPAM" });
    expect(assessUserText("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toMatchObject({
      ok: false,
      code: "REPETITIVE_TEXT",
    });
  });

  it("builds a recent duplicate cutoff", () => {
    const cutoff = recentDuplicateWindow(2);
    expect(Date.now() - cutoff.getTime()).toBeGreaterThanOrEqual(
      2 * 60 * 60 * 1000 - 1000,
    );
  });

  it("surfaces automated moderation signals", () => {
    const risk = assessContentRisk(
      "BUY NOW guaranteed income contact me at test@example.com https://a.test https://b.test https://c.test https://d.test https://e.test",
    );
    expect(risk.score).toBeGreaterThanOrEqual(4);
    expect(risk.labels).toContain("high link density");
    expect(risk.summary).toContain("risk points");
  });
});
