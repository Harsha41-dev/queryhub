import { describe, expect, it } from "vitest";
import {
  mediaUploadSchema,
  profileSchema,
  questionSchema,
  registerSchema,
  reportSchema,
  voteSchema,
} from "@/lib/validators";
import { sanitizeAnswerHtml } from "@/lib/sanitize";

describe("input validation", () => {
  it("accepts a specific question and rejects a statement", () => {
    expect(
      questionSchema.safeParse({
        title: "How can teams make reviews more useful?",
        topics: ["Leadership"],
      }).success,
    ).toBe(true);
    expect(
      questionSchema.safeParse({
        title: "This is not a question",
        topics: ["Leadership"],
      }).success,
    ).toBe(false);
  });

  it("requires strong matching passwords", () => {
    const base = {
      name: "Test User",
      username: "test_user",
      email: "test@example.com",
      terms: true as const,
    };
    expect(
      registerSchema.safeParse({
        ...base,
        password: "Secure123",
        confirmPassword: "Secure123",
      }).success,
    ).toBe(true);
    expect(
      registerSchema.safeParse({
        ...base,
        password: "weak",
        confirmPassword: "weak",
      }).success,
    ).toBe(false);
  });

  it("only allows one polymorphic target", () => {
    const id = "clh1234567890abcdefghijkl";
    expect(voteSchema.safeParse({ questionId: id, value: 1 }).success).toBe(
      true,
    );
    expect(
      voteSchema.safeParse({ questionId: id, answerId: id, value: 1 }).success,
    ).toBe(false);
    expect(
      reportSchema.safeParse({ profileId: id, reason: "SPAM" }).success,
    ).toBe(true);
  });

  it("bounds uploads and removes unsafe rich content", () => {
    expect(
      mediaUploadSchema.safeParse({
        name: "photo.webp",
        type: "image/webp",
        size: 1024,
      }).success,
    ).toBe(true);
    expect(
      mediaUploadSchema.safeParse({
        name: "payload.svg",
        type: "image/svg+xml",
        size: 1024,
      }).success,
    ).toBe(false);
    expect(
      sanitizeAnswerHtml(
        '<p>Safe</p><script>alert(1)</script><a href="javascript:bad()">link</a>',
      ),
    ).toBe('<p>Safe</p><a rel="nofollow noreferrer" target="_blank">link</a>');
  });

  it("allows only web URLs on public profiles", () => {
    const profile = {
      name: "Safe User",
      username: "safe_user",
      bio: "",
      location: "",
      occupation: "",
      website: "https://example.com",
      image: "https://example.com/avatar.png",
    };
    expect(profileSchema.safeParse(profile).success).toBe(true);
    expect(
      profileSchema.safeParse({ ...profile, website: "javascript:alert(1)" })
        .success,
    ).toBe(false);
    expect(
      profileSchema.safeParse({ ...profile, image: "data:text/html,bad" })
        .success,
    ).toBe(false);
  });
});
