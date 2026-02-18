import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("has no viewport overflow or serious accessibility violations on public, auth, and content views", async ({
  page,
}) => {
  for (const path of [
    "/",
    "/login",
    "/search?q=software",
    "/question/why-do-database-migrations-fail-in-production-even-when-they-passed-in-staging",
  ]) {
    await page.goto(path);
    await expect(page.locator("body")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(
      overflow,
      `${path} has horizontal page overflow`,
    ).toBeLessThanOrEqual(1);
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((item) =>
        ["serious", "critical"].includes(item.impact ?? ""),
      ),
      `${path} has serious accessibility violations`,
    ).toEqual([]);
  }
});
