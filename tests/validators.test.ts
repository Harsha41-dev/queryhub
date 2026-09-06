import { describe, expect, it } from "vitest";
import {
  acceptedAnswerSchema,
  answerRequestSchema,
  bookmarkCollectionSchema,
  credentialSchema,
  feedFeedbackSchema,
  mediaUploadSchema,
  notificationMuteSchema,
  onboardingSchema,
  profileSchema,
  questionMergeSchema,
  pushSubscriptionSchema,
  questionSchema,
  registerSchema,
  reportSchema,
  spaceMemberSchema,
  spaceSchema,
  spaceInviteSchema,
  spaceUpdateSchema,
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

  it("validates the Quora-style workflow payloads", () => {
    const id = "clh1234567890abcdefghijkl";
    expect(
      answerRequestSchema.safeParse({
        questionId: id,
        userId: id,
        message: "Could you answer this from your experience?",
      }).success,
    ).toBe(true);
    expect(
      credentialSchema.safeParse({
        label: "Software Engineer at X",
        organization: "X",
        url: "https://example.com",
        isDefault: true,
      }).success,
    ).toBe(true);
    expect(
      feedFeedbackSchema.safeParse({ type: "MUTE_USER", topicId: id }).success,
    ).toBe(false);
    expect(
      bookmarkCollectionSchema.safeParse({ name: "Interview Prep" }).success,
    ).toBe(true);
    expect(
      notificationMuteSchema.safeParse({ targetUserId: id, muted: true })
        .success,
    ).toBe(true);
    expect(
      notificationMuteSchema.safeParse({
        targetUserId: id,
        topicId: id,
        muted: true,
      }).success,
    ).toBe(false);
    expect(acceptedAnswerSchema.safeParse({ answerId: id }).success).toBe(true);
    expect(
      questionMergeSchema.safeParse({ targetQuestionId: id }).success,
    ).toBe(true);
    expect(acceptedAnswerSchema.safeParse({ answerId: null }).success).toBe(
      true,
    );
    expect(
      onboardingSchema.safeParse({ topicIds: Array(11).fill(id) }).success,
    ).toBe(false);
    expect(
      spaceSchema.safeParse({
        name: "AI Builders",
        description: "A practical space for builders to discuss AI products.",
        color: "#0891b2",
        rules: "Share specific questions and cite sources when possible.",
        allowMemberSubmissions: true,
        requireApproval: true,
      }).success,
    ).toBe(true);
    expect(
      spaceUpdateSchema.safeParse({
        action: "UPDATE_SETTINGS",
        name: "AI Builders",
        description: "A practical space for builders to discuss AI products.",
        color: "#0891b2",
        allowMemberSubmissions: false,
        requireApproval: true,
      }).success,
    ).toBe(true);
    expect(
      spaceMemberSchema.safeParse({
        action: "UPDATE_MEMBER",
        userId: id,
        role: "MODERATOR",
      }).success,
    ).toBe(true);
    expect(
      spaceInviteSchema.safeParse({
        action: "INVITE",
        username: "topic_expert",
        role: "CONTRIBUTOR",
        message: "Would love your answers here.",
      }).success,
    ).toBe(true);
    expect(
      spaceInviteSchema.safeParse({
        action: "RESPOND",
        inviteId: id,
        response: "ACCEPT",
      }).success,
    ).toBe(true);
  });

  it("validates browser push subscriptions", () => {
    expect(
      pushSubscriptionSchema.safeParse({
        endpoint: "https://push.example.test/subscription/abc",
        keys: {
          p256dh: "abcdefghijklmnopqrstuvwxyz1234567890",
          auth: "auth-token-12345",
        },
      }).success,
    ).toBe(true);
    expect(
      pushSubscriptionSchema.safeParse({
        endpoint: "not-a-url",
        keys: { p256dh: "short", auth: "short" },
      }).success,
    ).toBe(false);
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
