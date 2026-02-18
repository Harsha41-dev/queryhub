import { describe, expect, it } from "vitest";
import { passwordResetEmail } from "@/lib/email/templates";
import { safeRedirectPath, tokenHash } from "@/lib/email/tokens";

describe("email security utilities", () => {
  it("hashes tokens deterministically without retaining the raw value", () => {
    const raw = "single-use-token-that-is-not-stored";
    const hashed = tokenHash(raw);
    expect(hashed).toHaveLength(64);
    expect(hashed).not.toContain(raw);
    expect(tokenHash(raw)).toBe(hashed);
  });

  it("rejects cross-origin and protocol-relative redirects", () => {
    expect(safeRedirectPath("/settings/account")).toBe("/settings/account");
    expect(safeRedirectPath("//evil.example/path")).toBe("/login");
    expect(safeRedirectPath("https://evil.example/path")).toBe("/login");
  });

  it("produces plain-text and escaped HTML templates", () => {
    const message = passwordResetEmail({
      to: "member@example.com",
      name: "<Member>",
      url: "https://queryhub.example/reset?token=a&next=b",
    });
    expect(message.text).toContain("https://queryhub.example/reset");
    expect(message.html).toContain("&lt;Member&gt;");
    expect(message.html).toContain("&amp;next=b");
    expect(message.html).not.toContain("<Member>");
  });
});
