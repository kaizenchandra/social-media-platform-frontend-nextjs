import { test, expect } from "@playwright/test";
test("production composer, drafts, content and appeal routes reject forged preview sessions", async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: "common.preview.session",
      value: "forged-preview",
      url: "http://127.0.0.1:3100",
    },
  ]);
  for (const path of [
    "/create",
    "/drafts",
    "/content/ce093acb-08bb-4d65-a37f-76d44d75b657",
    "/content/ce093acb-08bb-4d65-a37f-76d44d75b657/appeal",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login\?/);
    expect(await page.content()).not.toContain("Start simulated upload");
  }
});
test("production authentication remains unavailable and forged preview sessions grant no account access", async ({
  page,
  context,
}) => {
  await page.goto("/login");
  await expect(
    page.getByText("Authentication is not connected", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeDisabled();
  await context.addCookies([
    {
      name: "common.preview.session",
      value: "forged-preview-token",
      url: "http://127.0.0.1:3100",
    },
  ]);
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login\?/);
  await expect(page.getByRole("heading", { name: /Your space/ })).toHaveCount(
    0,
  );
});

test("production feed routes reject forged sessions and expose no preview posts", async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: "common.preview.session",
      value: "forged-preview",
      url: "http://127.0.0.1:3100",
    },
  ]);
  for (const route of ["/", "/saved", "/posts/demo-ava-public"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login\?/);
    expect(await page.content()).not.toContain("Synthetic preview post from");
  }
});

test("production exposes no profile fixtures and protects own profile/connections", async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: "common.preview.session",
      value: "forged-preview",
      url: "http://127.0.0.1:3100",
    },
  ]);
  await page.goto("/profile/ava");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Profile unavailable",
  );
  expect(await page.content()).not.toContain("Small moments, shared");
  for (const route of ["/profile", "/connections"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login\?/);
  }
});

test("production rich-media routes reject forged preview sessions", async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: "common.preview.session",
      value: "forged-media",
      url: "http://127.0.0.1:3100",
    },
  ]);
  for (const path of [
    "/stories",
    "/stories/create",
    "/reels",
    "/reels/create",
    "/videos",
    "/videos/create",
    "/videos/video-studio",
    "/live",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login\?/);
    expect(await page.content()).not.toContain("synthetic-motion.webm");
  }
});

test("production community and trust routes fail closed", async ({ page }) => {
  for (const route of [
    "/communities",
    "/communities/studio",
    "/search",
    "/pages",
    "/privacy",
    "/reports",
    "/moderation",
  ]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login\?/);
    expect(await page.content()).not.toContain("Private studio planning notes");
  }
});

test("production advanced platform routes reject forged sessions", async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: "common.preview.session",
      value: "forged-advanced",
      url: "http://127.0.0.1:3100",
    },
  ]);
  for (const route of [
    "/creator",
    "/marketplace",
    "/marketplace/studio-kit",
    "/marketplace/sellers/demo-noah",
    "/assistant",
    "/wellbeing",
    "/messages?listing=studio-kit",
  ]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login\?/);
    expect(await page.content()).not.toContain("Synthetic sketch kit");
  }
});
