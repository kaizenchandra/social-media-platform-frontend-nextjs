import { test, expect } from "@playwright/test";
import { previewHints } from "../../features/auth/contracts";
test("dummy sign-in opens protected preview pages including moderation", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/login?returnTo=/creator");
  await page
    .getByLabel("Email address or username")
    .fill(previewHints.username);
  await page
    .getByLabel("Password", { exact: true })
    .fill(previewHints.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/creator$/);
  await expect(
    page.getByRole("heading", { name: "Creator studio", exact: true }),
  ).toBeVisible();
  for (const route of [
    "/",
    "/account",
    "/profile",
    "/connections",
    "/saved",
    "/messages",
    "/groups",
    "/communities",
    "/pages",
    "/search",
    "/privacy",
    "/reports",
    "/moderation",
    "/create",
    "/drafts",
    "/stories",
    "/reels",
    "/videos",
    "/live",
    "/marketplace",
    "/assistant",
    "/wellbeing",
  ]) {
    await page.goto(route);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Moderator access required" }),
    ).toHaveCount(0);
  }
});
