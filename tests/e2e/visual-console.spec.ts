import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("production pages have security headers and no console, hydration, or server errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) =>
    errors.push(`page ${page.url()}: ${error.message}`),
  );
  page.on("response", (response) => {
    if (response.status() >= 500)
      errors.push(`HTTP ${response.status()}: ${response.url()}`);
  });

  const response = await page.request.get("/");
  expect(response.headers()["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["strict-transport-security"]).toContain(
    "max-age=63072000",
  );

  for (const path of [
    "/",
    "/login",
    "/search?q=software&sort=newest",
    "/question/why-do-database-migrations-fail-in-production-even-when-they-passed-in-staging",
  ]) {
    await page.goto(path);
    await expect(page.locator("body")).toBeVisible();
  }

  await login(page);
  for (const path of [
    "/home",
    "/following",
    "/answer",
    "/bookmarks",
    "/notifications",
    "/settings/profile",
    "/settings/privacy",
    "/topic/software-engineering",
    "/profile/mayachen",
  ]) {
    await page.goto(path);
    await expect(page.locator("body")).toBeVisible();
  }

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/home");
  await page.screenshot({
    path: "test-results/visual-home-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.screenshot({
    path: "test-results/visual-home-mobile.png",
    fullPage: true,
  });

  expect(errors).toEqual([]);
});

test("administration renders without runtime errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page, "admin@queryhub.dev", "DemoPass123!");
  await page.goto("/admin");
  await page.screenshot({
    path: "test-results/visual-admin-desktop.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
