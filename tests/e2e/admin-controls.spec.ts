import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { login } from "./helpers";

test("admin tables filter, sort, paginate, export, and remain responsive", async ({
  page,
}) => {
  await login(page, "admin@queryhub.dev", "DemoPass123!");
  await page.goto("/admin/users");
  await expect(
    page.getByRole("heading", { name: "Community members" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "User", exact: true }).click();
  const statusFilter = page
    .locator('select[aria-label="Filter users by status"]')
    .first();
  await statusFilter.selectOption("Active");
  await expect(page.getByText(/records$/).first()).toBeVisible();
  await statusFilter.selectOption("All");

  const next = page.getByRole("button", { name: "Next page" });
  await expect(next).toBeEnabled();
  await next.click();
  await expect(page.getByText(/Page 2 of/)).toBeVisible();
  await page.getByRole("button", { name: "Previous page" }).click();
  await expect(page.getByText(/Page 1 of/)).toBeVisible();

  await page.getByLabel("Search users").fill("no-user-can-match-this-audit");
  await expect(page.getByText("No records match these filters.")).toBeVisible();
  await page.getByLabel("Search users").fill("");

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const exported = await download;
  expect(exported.suggestedFilename()).toBe("queryhub-users-page-1.csv");

  for (const width of [320, 375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/admin", "/admin/users", "/admin/content"]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, `${path} overflows at ${width}px`).toBeLessThanOrEqual(
        1,
      );
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      expect(
        results.violations.filter((violation) =>
          ["serious", "critical"].includes(violation.impact ?? ""),
        ),
        `${path} has serious accessibility violations at ${width}px`,
      ).toEqual([]);
    }
  }
});
