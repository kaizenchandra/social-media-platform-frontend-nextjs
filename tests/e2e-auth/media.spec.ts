import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
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
test("stories navigate, react, highlight and keep new drafts private", async ({
  page,
}) => {
  test.setTimeout(60000);
  await account(page);
  await page.goto("/stories");
  await expect(
    page.getByRole("heading", { name: "Stories", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "View story: A slower morning" })
    .click();
  const viewer = page.getByRole("region", { name: "Story: A slower morning" });
  await expect(viewer).toBeVisible();
  await viewer.getByRole("button", { name: "Play story" }).click();
  await expect(
    viewer.getByRole("button", { name: "Pause story" }),
  ).toBeVisible();
  await viewer.getByRole("button", { name: "Pause story" }).click();
  await viewer.getByRole("button", { name: "Love", exact: true }).click();
  await expect(
    viewer.getByRole("button", { name: "Loved", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await viewer.focus();
  await viewer.press("ArrowRight");
  await expect(
    page.getByRole("region", { name: "Story: Room to grow" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "View story: Your synthetic story" })
    .click();
  await page.getByRole("button", { name: "Add to highlights" }).click();
  await expect(
    page.getByRole("button", { name: "Remove highlight" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByLabel("Media collection").selectOption("highlights");
  await expect(
    page.getByRole("button", { name: "View story: Your synthetic story" }),
  ).toBeVisible();
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/stories-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("link", { name: "Create story draft" }).click();
  await page
    .getByLabel("Story text", { exact: true })
    .fill("Synthetic private story draft");
  await page
    .getByLabel("I am using only benign synthetic text and media.")
    .check();
  // Cold development compilation may refresh a route; verify the final controlled input before submission.
  await page
    .getByLabel("Story text", { exact: true })
    .fill("Synthetic private story draft");
  await expect(page.getByLabel("Story text", { exact: true })).toHaveValue(
    "Synthetic private story draft",
  );
  await page.getByRole("button", { name: "Start simulated upload" }).click();
  await expect(
    page.getByText("Simulated APPROVED", { exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    page.getByRole("button", { name: "Publish (backend unavailable)" }),
  ).toBeDisabled();
  await page.goto("/stories");
  await expect(
    page.getByText("Synthetic private story draft", { exact: true }),
  ).toHaveCount(0);
});
test("reel playback, captions, keyboard navigation, failed loading and restriction", async ({
  page,
}) => {
  test.setTimeout(60000);
  await account(page);
  await page.goto("/reels");
  await page
    .getByRole("button", { name: "Watch Six seconds of quiet" })
    .click();
  const player = page.getByRole("region", {
    name: "Player: Six seconds of quiet",
  });
  const video = player.locator("video");
  await expect
    .poll(() => video.evaluate((v) => (v as HTMLVideoElement).readyState))
    .toBeGreaterThan(0);
  await expect
    .poll(() =>
      video.evaluate((v) => Number.isFinite((v as HTMLVideoElement).duration)),
    )
    .toBe(true);
  await player.scrollIntoViewIfNeeded();
  await player.focus();
  await player.press("Space");
  await expect(
    player.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await player.press("Space");
  await expect(
    player.getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible();
  await player.press("ArrowRight");
  await expect
    .poll(() => video.evaluate((v) => (v as HTMLVideoElement).currentTime))
    .toBeGreaterThan(4);
  await player.press("ArrowLeft");
  await expect
    .poll(() => video.evaluate((v) => (v as HTMLVideoElement).currentTime))
    .toBeLessThan(2);
  await player.press("m");
  await expect(
    player.getByRole("button", { name: "Mute", exact: true }),
  ).toBeVisible();
  await player.getByLabel("Playback speed").selectOption("1.5");
  await expect
    .poll(() => video.evaluate((v) => (v as HTMLVideoElement).playbackRate))
    .toBe(1.5);
  await player.getByRole("button", { name: "Captions off" }).click();
  await expect(
    player.getByRole("button", { name: "Captions on" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() =>
      video.evaluate((v) => (v as HTMLVideoElement).textTracks[0].mode),
    )
    .toBe("showing");
  await page.getByRole("button", { name: "Next video" }).click();
  await expect(page.locator(".reel-panel video")).toHaveCount(1);
  await expect(
    page.getByRole("region", { name: "Player: A little green inspiration" }),
  ).toBeVisible();
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/reels-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByText("Preview content restrictions", { exact: true }).click();
  await page.getByRole("button", { name: "Restrict selected fixture" }).click();
  await expect(page.locator("video")).toHaveCount(0);
  await page.route("**/media/synthetic-motion.webm", (route) => route.abort());
  await page.goto("/videos/video-studio");
  await expect(
    page.getByText("Media could not be loaded", { exact: true }),
  ).toBeVisible();
  await page.unroute("**/media/synthetic-motion.webm");
  await page.getByRole("button", { name: "Retry media" }).click();
  await expect
    .poll(() =>
      page.locator("video").evaluate((v) => (v as HTMLVideoElement).readyState),
    )
    .toBeGreaterThan(0);
});
test("video comments, saves, sharing, creator revocation and live provider boundary", async ({
  page,
}) => {
  test.setTimeout(60000);
  await account(page);
  await page.goto("/videos/video-coast");
  await page.getByRole("button", { name: "Save video", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Unsave video" }),
  ).toBeVisible();
  await page
    .getByLabel("Video comment", { exact: true })
    .fill("Synthetic video comment");
  await page.getByRole("button", { name: "Comment locally" }).click();
  await expect(
    page
      .locator(".video-comments")
      .getByText("Synthetic video comment", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Share preview link" }).click();
  await expect(page.getByLabel("Media preview link")).toHaveValue(
    "/videos/video-coast",
  );
  let axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/video-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.goto("/videos");
  await page.getByLabel("Media collection").selectOption("saved");
  await expect(
    page.getByRole("button", { name: "Watch Finding a moment to pause" }),
  ).toBeVisible();
  await page.goto("/profile/ava");
  await page.getByRole("button", { name: "Block", exact: true }).click();
  await page.getByRole("button", { name: "Confirm block" }).click();
  await expect(
    page.getByRole("heading", { name: "Profile unavailable" }),
  ).toBeVisible();
  await page.goto("/videos/video-coast");
  await expect(
    page.getByRole("heading", { name: "Video unavailable", exact: true }),
  ).toBeVisible();
  await expect(page.locator("video")).toHaveCount(0);
  await page.goto("/videos/restricted-video");
  await expect(
    page.getByRole("heading", { name: "Video unavailable", exact: true }),
  ).toBeVisible();
  await page.goto("/reels?item=held-reel");
  await expect(page.locator("video")).toHaveCount(0);
  await page.goto("/live");
  await expect(
    page.getByRole("button", {
      name: "Start broadcast (provider unavailable)",
    }),
  ).toBeDisabled();
  await page
    .getByText("Preview live connection states", { exact: true })
    .click();
  await page.getByLabel("Live UI state").selectOption("interrupted-preview");
  await expect(page.getByText(/Simulated safety interruption/)).toBeVisible();
  await page.getByLabel("Broadcast title").fill("Synthetic gathering");
  await page.getByRole("button", { name: "Prepare unsent plan" }).click();
  await expect(
    page.getByText(/No eligibility check, schedule or broadcast was created/),
  ).toBeVisible();
  axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/live-${test.info().project.name}.png`,
    fullPage: true,
  });
});
