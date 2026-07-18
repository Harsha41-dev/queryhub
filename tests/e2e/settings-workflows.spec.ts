import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { login } from "./helpers";

const prisma = new PrismaClient();
const marker = `settings${Date.now()}`;
const originalEmail = `${marker}@example.com`;
const changedEmail = `${marker}.changed@example.com`;

test.setTimeout(120_000);

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("persists profile, privacy, notification, theme, account, and deletion settings", async ({
  page,
}) => {
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Settings Audit");
  await page.getByLabel("Username").fill(marker);
  await page.getByLabel("Email address").fill(originalEmail);
  await page.getByLabel("Password", { exact: true }).fill("Workflow123");
  await page.getByLabel("Confirm password").fill("Workflow123");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/home/);

  await page.goto("/settings/profile");
  await page
    .locator('input[name="name"]')
    .first()
    .fill("Settings Audit Updated");
  await page
    .locator('input[name="occupation"]')
    .first()
    .fill("Reliability engineer");
  await page.locator('input[name="location"]').first().fill("Bengaluru");
  await page
    .locator('input[name="website"]')
    .first()
    .fill("https://example.com/audit");
  await page.locator('input[type="file"]').setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(page.getByText("Avatar uploaded")).toBeVisible();
  await page
    .locator('textarea[name="bio"]')
    .first()
    .fill("Auditing settings persistence and safe profile rendering.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Profile updated")).toBeVisible();
  await page.goto(`/profile/${marker}`);
  await expect(
    page
      .getByRole("heading", { name: "Settings Audit Updated", exact: true })
      .first(),
  ).toBeVisible();
  await expect(page.getByText("Reliability engineer").first()).toBeVisible();

  await page.goto("/settings/privacy");
  await page.getByRole("switch", { name: "Show activity" }).click();
  await page.getByRole("switch", { name: "Allow direct messages" }).click();
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByText("Privacy preferences saved")).toBeVisible();
  await page.getByRole("button", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);

  await page.goto("/settings/notifications");
  await page
    .getByRole("switch", { name: "Answers to followed questions" })
    .click();
  await page.getByRole("switch", { name: "Push notifications" }).click();
  await page.getByRole("switch", { name: "Weekly digest" }).click();
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByText("Notification preferences saved")).toBeVisible();

  const userBeforeAccountChange = await prisma.user.findUniqueOrThrow({
    where: { username: marker },
    include: { preference: true },
  });
  expect(userBeforeAccountChange.name).toBe("Settings Audit Updated");
  expect(userBeforeAccountChange.preference?.theme).toBe("dark");
  expect(userBeforeAccountChange.preference?.showActivity).toBe(false);
  expect(userBeforeAccountChange.preference?.emailAnswers).toBe(false);
  expect(userBeforeAccountChange.preference?.pushNotifications).toBe(false);
  expect(userBeforeAccountChange.preference?.emailDigest).toBe(false);
  expect(userBeforeAccountChange.image).toContain("/api/uploads/avatars/");

  await page.goto("/settings/account");
  await page.getByLabel("Email address").fill(changedEmail);
  await page.getByLabel("Current password").fill("Workflow123");
  await page.getByLabel("New password").fill("Workflow456");
  await page.getByRole("button", { name: "Update account" }).click();
  await expect(page.getByText("Account updated")).toBeVisible();
  await page.getByRole("button", { name: "Log out" }).last().click();
  await expect(page).toHaveURL(/\/$/);

  const pendingChange = await prisma.emailChangeToken.findFirst({
    where: { userId: userBeforeAccountChange.id, usedAt: null },
  });
  expect(pendingChange?.newEmail).toBe(changedEmail);
  expect(pendingChange?.tokenHash).toHaveLength(64);
  const unchangedEmail = await prisma.user.findUniqueOrThrow({
    where: { id: userBeforeAccountChange.id },
    select: { email: true },
  });
  expect(unchangedEmail.email).toBe(originalEmail);

  await login(page, originalEmail, "Workflow456");
  await page.goto("/settings/account");
  await page.getByRole("button", { name: "Delete account" }).click();
  await page.getByPlaceholder("DELETE").fill("DELETE");
  await page
    .getByLabel("Current password for account deletion")
    .fill("Workflow456");
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete account" })
    .click();
  await expect(page).toHaveURL(/\/$/);

  const deleted = await prisma.user.findUniqueOrThrow({
    where: { username: marker },
    select: { deletedAt: true },
  });
  expect(deleted.deletedAt).not.toBeNull();
});
