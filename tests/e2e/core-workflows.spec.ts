import { test, expect } from "@playwright/test";

test.describe.serial("core member workflows", () => {
  test.setTimeout(90_000);
  test("login with demo credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/home/);
    await expect(
      page.getByText("What do you want to know?").first(),
    ).toBeVisible();
  });

  test("register, ask, answer, vote, bookmark, and report", async ({
    page,
  }) => {
    const unique = Date.now();
    await page.goto("/register");
    await page.getByLabel("Full name").fill("Workflow Tester");
    await page.getByLabel("Username").fill(`workflow_${unique}`);
    await page
      .getByLabel("Email address")
      .fill(`workflow_${unique}@example.com`);
    await page.getByLabel(/^Password/).fill("Workflow123");
    await page.getByLabel("Confirm password").fill("Workflow123");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/home/);

    await page.getByRole("button", { name: "Ask a question" }).click();
    const title = `How can a team verify an important workflow ${unique}?`;
    await page
      .getByPlaceholder("What would you like to understand better?")
      .fill(title);
    await page
      .getByPlaceholder(/Share what you already know/)
      .fill(
        "We want a repeatable approach that catches failures before people depend on the workflow.",
      );
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: /Product Design/ }).click();
    await page.getByRole("button", { name: "Publish question" }).click();
    await expect(page).toHaveURL(/\/question\//);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();

    await page.getByRole("button", { name: "Answer" }).first().click();
    await page
      .getByPlaceholder(/Write from experience/)
      .fill(
        "Begin with a clearly defined success condition, then test the smallest complete path with realistic data. Record every failure, assign ownership, and repeat the check after each material change.",
      );
    await page.getByRole("button", { name: "Publish answer" }).click();
    await expect(page.getByText("Your answer was published")).toBeVisible();

    await page.getByRole("button", { name: "Upvote question" }).click();
    await page.getByRole("button", { name: "Save question" }).click();
    await expect(page.getByText("Question saved")).toBeVisible();
    await page.getByRole("button", { name: "Report question" }).click();
    await page.getByLabel("Reason").selectOption("OTHER");
    await page.getByRole("button", { name: "Submit report" }).click();
    await expect(page.getByText("Report submitted for review")).toBeVisible();
  });
});
