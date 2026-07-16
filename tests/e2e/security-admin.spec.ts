import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { login, logout } from "./helpers";

const prisma = new PrismaClient();
const marker = `security${Date.now()}`;
const email = `${marker}@example.com`;
let testUserId = "";

test.describe
  .serial("authentication, authorization, notifications, and moderation", () => {
  test.setTimeout(120_000);

  test.beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        name: "Security Audit",
        username: marker,
        email,
        passwordHash: await hash("Workflow123", 12),
        preference: { create: {} },
      },
    });
    testUserId = user.id;
  });

  test.afterAll(async () => {
    if (testUserId)
      await prisma.user
        .delete({ where: { id: testUserId } })
        .catch(() => undefined);
    await prisma.$disconnect();
  });

  test("persists sessions, rejects IDOR and normal-user administration, and protects routes after logout", async ({
    page,
  }) => {
    await login(page);
    await page.reload();
    await expect(page).toHaveURL(/\/home/);

    const otherQuestion = await prisma.question.findFirstOrThrow({
      where: {
        author: { email: { not: "maya@queryhub.dev" } },
        deletedAt: null,
      },
    });
    expect(
      (
        await page.request.patch(`/api/questions/${otherQuestion.id}`, {
          data: { title: "How could an unauthorized edit ever be accepted?" },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await page.request.delete(`/api/questions/${otherQuestion.id}`)
      ).status(),
    ).toBe(403);
    expect(
      (
        await page.request.patch("/api/admin/content", {
          data: {
            target: "question",
            id: otherQuestion.id,
            action: "HIDE_CONTENT",
          },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await page.request.post("/api/votes", {
          headers: { "content-type": "application/json" },
          data: "{",
        })
      ).status(),
    ).toBe(400);

    await page.goto("/admin");
    await expect(page).not.toHaveURL(/\/admin$/);
    await page.goto("/home");
    await logout(page);
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login/);
  });

  test("enforces privacy, notification read state, role boundaries, suspension, audit records, and topic restoration", async ({
    browser,
  }) => {
    const userContext = await browser.newContext();
    const userPage = await userContext.newPage();
    await login(userPage, email, "Workflow123");
    expect(
      (
        await userPage.request.patch("/api/settings/preferences", {
          data: { profilePublic: false, showActivity: false },
        })
      ).status(),
    ).toBe(200);
    const privateSearch = await userPage.request.get(`/api/search?q=${marker}`);
    const privateSearchBody = (await privateSearch.json()) as {
      data: { counts: { people: number } };
    };
    expect(privateSearchBody.data.counts.people).toBe(0);

    const anonymousContext = await browser.newContext();
    const anonymousPage = await anonymousContext.newPage();
    await anonymousPage.goto(`/profile/${marker}`);
    await expect(anonymousPage.getByText("This trail ends here")).toBeVisible();

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await login(adminPage, "admin@queryhub.dev");
    await adminPage.goto("/admin/topics");
    await expect(
      adminPage.getByRole("heading", { name: "Knowledge topics" }),
    ).toBeVisible();
    const topic = await prisma.topic.findUniqueOrThrow({
      where: { slug: "economics" },
    });
    expect(
      (
        await adminPage.request.patch("/api/admin/content", {
          data: {
            target: "topic",
            id: topic.id,
            action: "HIDE_CONTENT",
            note: marker,
          },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await adminPage.request.patch("/api/admin/content", {
          data: {
            target: "topic",
            id: topic.id,
            action: "RESTORE_CONTENT",
            note: marker,
          },
        })
      ).status(),
    ).toBe(200);

    const moderatorContext = await browser.newContext();
    const moderatorPage = await moderatorContext.newPage();
    await login(moderatorPage, "moderator@queryhub.dev");
    await moderatorPage.goto("/admin/users");
    await expect(
      moderatorPage.getByRole("heading", { name: "Community members" }),
    ).toBeVisible();
    await moderatorPage.goto("/admin/topics");
    await expect(moderatorPage).toHaveURL(/\/admin\/reports/);
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: "admin@queryhub.dev" },
    });
    expect(
      (
        await moderatorPage.request.patch(`/api/admin/users/${admin.id}`, {
          data: { action: "SUSPEND_USER" },
        })
      ).status(),
    ).toBe(403);

    expect(
      (
        await adminPage.request.patch(`/api/admin/users/${testUserId}`, {
          data: { action: "SUSPEND_USER", note: marker },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await userPage.request.patch("/api/settings/preferences", {
          data: { theme: "dark" },
        })
      ).status(),
    ).toBe(401);
    await userPage.goto("/home");
    await expect(userPage).toHaveURL(/\/login/);
    expect(
      (
        await adminPage.request.patch(`/api/admin/users/${testUserId}`, {
          data: { action: "UNSUSPEND_USER", note: marker },
        })
      ).status(),
    ).toBe(200);
    expect(
      await prisma.moderationAction.count({ where: { note: marker } }),
    ).toBeGreaterThanOrEqual(4);

    await adminContext.close();
    await moderatorContext.close();
    await anonymousContext.close();
    await userContext.close();
  });

  test("shows and persists notification unread state", async ({ page }) => {
    await login(page);
    await page.goto("/notifications");
    const unread = page.getByText(/\d+ unread/).first();
    await expect(unread).toBeVisible();
    const markAll = page.getByRole("button", { name: "Mark all read" });
    if (await markAll.isEnabled()) await markAll.click();
    await expect(page.getByText("0 unread").first()).toBeVisible();
    await page.reload();
    await expect(page.getByText("0 unread").first()).toBeVisible();
  });
});
