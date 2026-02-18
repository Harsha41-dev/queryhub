import { describe, expect, it } from "vitest";
import { extractMentionedUsernames } from "@/lib/mentions";

describe("mentions", () => {
  it("extracts unique bounded usernames without matching email domains", () => {
    expect(
      extractMentionedUsernames(
        "Thanks @Maya_Dev and @maya_dev. Ignore a@host.example and @ab.",
      ),
    ).toEqual(["maya_dev"]);
  });
});
