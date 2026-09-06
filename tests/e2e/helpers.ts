import { expect, type Page } from "@playwright/test";

export async function login(
  page: Page,
  email = "maya@queryhub.dev",
  password = "DemoPass123!",
) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await finishOnboardingIfNeeded(page);
  await expect(page).toHaveURL(/\/home/);
}

export async function finishOnboardingIfNeeded(page: Page) {
  await expect(page).toHaveURL(/\/(home|onboarding)/);
  if (!page.url().includes("/onboarding")) return;

  await page.getByRole("button", { name: "Skip" }).click();
  await expect(page).toHaveURL(/\/home/);
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/$/);
}
