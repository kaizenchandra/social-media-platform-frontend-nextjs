import { test, expect, type Page } from "@playwright/test";
import { previewHints } from "../../features/auth/contracts";
async function account(page: Page) {
  const tag = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
  await page.goto("/register");
  await page
    .getByLabel("Display name", { exact: true })
    .fill("Publication preview");
  await page.getByLabel("Email address").fill(`media_${tag}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill(previewHints.password);
  await page.getByLabel("Confirm password").fill(previewHints.password);
  await page.getByLabel("I am using synthetic preview details.").check();
  await page.getByRole("button", { name: "Create preview account" }).click();
  await expect(page).toHaveURL(/\/verify-email$/);
  await page
    .getByLabel("Verification code")
    .fill(previewHints.verificationCode);
  await page.getByRole("button", { name: "Confirm code" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Username", { exact: true }).fill(`m_${tag}`);
  await page.getByRole("button", { name: "Finish preview onboarding" }).click();
  await expect(page).toHaveURL(/\/account$/);
}
test("community membership, private search, creation and navigation", async ({
  page,
}) => {
  test.setTimeout(90000);
  await account(page);
  await page.goto("/communities/studio");
  await expect(
    page.getByRole("heading", { name: "Members only" }),
  ).toBeVisible();
  expect(await page.content()).not.toContain("Private studio planning notes");
  await page.getByRole("button", { name: "Request to join" }).click();
  await expect(
    page.getByRole("button", { name: "Cancel request" }),
  ).toBeVisible();
  await page.goto("/search?q=Private+studio+planning");
  await expect(page.getByRole("heading", { name: "No results" })).toBeVisible();
  await page.goto("/communities");
  const communityName = `Synthetic browser ${crypto.randomUUID().slice(0, 8)}`;
  await page.getByLabel("Community name").fill(communityName);
  await page
    .getByLabel("Description", { exact: true })
    .fill("Synthetic browser description");
  await page.getByLabel("Membership", { exact: true }).selectOption("private");
  await page
    .getByRole("button", { name: "Create community", exact: true })
    .click();
  await page.getByRole("link", { name: communityName, exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Member administration" }),
  ).toBeVisible();
  await page.getByLabel("Post text").fill("Synthetic member post");
  await page.getByRole("button", { name: "Publish synthetic text" }).click();
  await expect(
    page.getByText("Synthetic member post", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("privacy settings, simulated reporting and denied moderation", async ({
  page,
}) => {
  test.setTimeout(90000);
  await account(page);
  await page.goto("/privacy");
  await page.getByLabel("Profile audience").selectOption("private");
  await page.getByLabel("Appear in people search").uncheck();
  await page.getByRole("button", { name: "Save privacy settings" }).click();
  await expect(page.getByRole("status")).toContainText("saved");
  await page.reload();
  await expect(page.getByLabel("Profile audience")).toHaveValue("private");
  await expect(page.getByLabel("Appear in people search")).not.toBeChecked();
  await page.goto("/reports?kind=message&target=synthetic-message");
  await page.getByLabel("Report category").selectOption("intimate-image-abuse");
  await page.getByRole("button", { name: "Submit simulated report" }).click();
  await expect(
    page.getByRole("heading", { name: "intimate-image-abuse", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Restricted evidence: unavailable.", { exact: false }),
  ).toBeVisible();
  await page.goto("/moderation");
  await expect(
    page.getByRole("heading", { name: "Moderator access required" }),
  ).toBeVisible();
  expect(await page.content()).not.toContain("synthetic-message");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("private mutation forms fail closed before hydration and never default to GET", async ({
  page,
  browser,
}) => {
  test.setTimeout(90000);
  await account(page);
  const context = await browser.newContext({
    javaScriptEnabled: false,
    storageState: await page.context().storageState(),
  });
  try {
    const unhydrated = await context.newPage();
    for (const route of [
      "/privacy",
      "/reports",
      "/wellbeing",
      "/marketplace",
    ]) {
      await unhydrated.goto(route);
      const forms = unhydrated.locator('form.discovery-form[method="post"]');
      expect(await forms.count()).toBeGreaterThan(0);
      for (const form of await forms.all()) {
        for (const button of await form.locator('button[type="submit"]').all())
          await expect(button).toBeDisabled();
      }
      await expect(
        unhydrated
          .getByText(
            "JavaScript is required to submit this private preview form.",
          )
          .first(),
      ).toBeVisible();
    }
  } finally {
    await context.close();
  }
});
