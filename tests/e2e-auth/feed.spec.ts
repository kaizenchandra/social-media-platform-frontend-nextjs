import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { previewHints } from "../../features/auth/contracts";
async function createAccount(page: Page) {
  const tag = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
  await page.goto("/register");
  await page.getByLabel("Display name", { exact: true }).fill("Feed preview");
  await page.getByLabel("Email address").fill(`feed_${tag}@example.test`);
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
  await page.getByLabel("Username", { exact: true }).fill(`f_${tag}`);
  await page.getByRole("button", { name: "Finish preview onboarding" }).click();
  await expect(page).toHaveURL(/\/account$/);
}
const cards = (page: Page) => page.locator(".feed-card:visible");
test("feed views, cursor pagination and recoverable invalid links", async ({
  page,
}) => {
  await createAccount(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your feed");
  await expect(cards(page)).toHaveCount(4);
  const detailLink = cards(page)
    .nth(2)
    .getByRole("link", { name: "Comments", exact: true });
  await detailLink.scrollIntoViewIfNeeded();
  const scroll = await page.evaluate(() => window.scrollY);
  expect(scroll).toBeGreaterThan(0);
  await detailLink.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Post and conversation",
  );
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your feed");
  await expect
    .poll(async () =>
      Math.abs((await page.evaluate(() => window.scrollY)) - scroll),
    )
    .toBeLessThan(100);
  const first = await cards(page).evaluateAll((rows) =>
    rows.map((row) => row.getAttribute("data-post-id")),
  );
  await page.getByRole("link", { name: "Next posts" }).click();
  await expect(page).toHaveURL(/cursor=/);
  await expect(cards(page).first()).toBeVisible();
  await expect
    .poll(async () => {
      const ids = await cards(page).evaluateAll((rows) =>
        rows.map((row) => row.getAttribute("data-post-id")),
      );
      return ids.length > 0 && ids.every((id) => !first.includes(id));
    })
    .toBe(true);
  const next = await cards(page).evaluateAll((rows) =>
    rows.map((row) => row.getAttribute("data-post-id")),
  );
  expect(next.some((id) => first.includes(id))).toBe(false);
  await page.goto("/?mode=friends");
  await expect(cards(page)).toHaveCount(2);
  await expect(
    cards(page).getByText("Noah Ellis", { exact: true }),
  ).toHaveCount(2);
  await page.goto("/?mode=following");
  await expect(cards(page)).toHaveCount(1);
  await expect(
    cards(page).getByText("Ava Reed", { exact: true }),
  ).toBeVisible();
  await page.goto("/saved");
  await expect(
    page.getByRole("heading", { name: "Nothing saved yet" }),
  ).toBeVisible();
  await page.goto("/?mode=chronological&cursor=invalid");
  await expect(
    page.getByRole("heading", { name: "Feed unavailable" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Start from first page" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your feed");
  const response = await page.request.get("/");
  const body = await response.text();
  expect(body).not.toContain("Awaiting screening");
  expect(body).not.toContain("Restricted media fixture");
});
test("reactions recover from network failure, saves reconcile and public reposts can be undone", async ({
  page,
}) => {
  await createAccount(page);
  await page.goto("/?mode=following");
  const like = cards(page).getByRole("button", { name: "Like", exact: true });
  await expect(like).toBeEnabled();
  await page.route("**/*", (route) =>
    route.request().method() === "POST" &&
    new URL(route.request().url()).pathname === "/"
      ? route.abort("failed")
      : route.continue(),
  );
  await like.click();
  await expect(
    page.getByText(/Connection interrupted\. The update was not confirmed/),
  ).toBeVisible();
  await expect(like).toHaveAttribute("aria-pressed", "false");
  await page.unroute("**/*");
  await like.click();
  await expect(like).toHaveAttribute("aria-pressed", "true");
  await expect(like).toBeEnabled();
  await cards(page).getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    cards(page).getByRole("button", { name: "Unsave" }),
  ).toBeVisible();
  await cards(page)
    .getByRole("button", { name: "Repost", exact: true })
    .click();
  await expect(
    cards(page).getByRole("button", { name: "Undo repost" }),
  ).toBeVisible();
  await cards(page).getByRole("button", { name: "Undo repost" }).click();
  await expect(
    cards(page).getByRole("button", { name: "Repost", exact: true }),
  ).toBeVisible();
  await page.goto("/saved");
  await expect(cards(page)).toHaveCount(1);
  await cards(page).getByRole("button", { name: "Unsave" }).click();
  await expect(
    page.getByRole("heading", { name: "Nothing saved yet" }),
  ).toBeVisible();
});
test("comments, replies, editing, deletion and permission-preserving share/report dialogs", async ({
  page,
}) => {
  await createAccount(page);
  await page.goto("/posts/demo-ava-public");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Post and conversation",
  );
  const unique = crypto.randomUUID().slice(0, 8);
  const rootText = `Synthetic root thought ${unique}`;
  const replyText = `Synthetic reply thought ${unique}`;
  await page.getByLabel("Comment", { exact: true }).fill(rootText);
  await page.getByRole("button", { name: "Send comment" }).click();
  const root = page.locator(".comment-card").filter({ hasText: rootText });
  await expect(root).toBeVisible();
  await root.getByRole("button", { name: "Reply", exact: true }).click();
  await page.getByLabel("Reply", { exact: true }).fill(replyText);
  await page.getByRole("button", { name: "Send reply" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText(replyText, { exact: true })).toBeVisible();
  await root.getByRole("button", { name: "Edit comment" }).click();
  await page
    .getByLabel("Edited comment", { exact: true })
    .fill(`Updated synthetic root ${unique}`);
  await page.getByRole("button", { name: "Save comment" }).click();
  const edited = page
    .locator(".comment-card")
    .filter({ hasText: `Updated synthetic root ${unique}` });
  await expect(edited).toBeVisible();
  await edited
    .getByRole("button", { name: "Delete comment", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm delete comment" }).click();
  await expect(
    page.getByText("Comment deleted", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText(`Updated synthetic root ${unique}`, { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText(replyText, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Share post", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Post link", exact: true }),
  ).toHaveValue(/\/posts\/demo-ava-public$/);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Report post", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Send report (service unavailable)" }),
  ).toBeDisabled();
  await page.getByLabel("Report reason").selectOption("spam");
  await page.getByRole("button", { name: "Prepare preview draft" }).click();
  await expect(page.getByText(/Nothing was sent to reviewers/)).toBeVisible();
});
test("hide/mute preferences restore feeds and revoked friendships remove saved private-audience posts", async ({
  page,
}) => {
  await createAccount(page);
  await page.goto("/?mode=following");
  await cards(page).getByRole("button", { name: "More post actions" }).click();
  await page.getByRole("menuitem", { name: "Hide post" }).click();
  await expect(cards(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Feed preferences" }).click();
  await page.getByRole("button", { name: "Reset hidden posts" }).click();
  await expect(
    page.getByText("0 hidden from feeds. Saved posts are kept separately."),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(cards(page)).toHaveCount(1);
  await cards(page).getByRole("button", { name: "More post actions" }).click();
  await page.getByRole("menuitem", { name: "Mute account" }).click();
  await expect(cards(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Feed preferences" }).click();
  await page.getByRole("button", { name: "Unmute Ava Reed" }).click();
  await expect(page.getByText("No muted accounts.")).toBeVisible();
  await page.getByLabel("Default feed").selectOption("friends");
  await page.getByRole("button", { name: "Save feed preferences" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(cards(page)).toHaveCount(2);
  const friendsPost = cards(page).filter({
    has: page.getByRole("heading", { name: "A weekend with friends" }),
  });
  await expect(
    friendsPost.getByRole("button", { name: "Repost", exact: true }),
  ).toBeDisabled();
  await friendsPost.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    friendsPost.getByRole("button", { name: "Unsave" }),
  ).toBeVisible();
  await expect(
    friendsPost.getByRole("button", { name: "Unsave" }),
  ).toBeEnabled();
  await friendsPost.locator(".post-author").click();
  await expect(page).toHaveURL(/\/profile\/noah$/);
  await page.getByRole("button", { name: "Unfriend", exact: true }).click();
  await page.getByRole("button", { name: "Confirm unfriend" }).click();
  await page.goto("/saved");
  await expect(
    page.getByRole("heading", { name: "Nothing saved yet" }),
  ).toBeVisible();
  await page.goto("/posts/demo-noah-friends");
  await expect(
    page.getByRole("heading", { name: "Post unavailable" }),
  ).toBeVisible();
  expect(await page.content()).not.toContain("Synthetic friends-only post");
});
test("feed keyboard, themes, dialog semantics, reduced motion and enlarged-text reflow", async ({
  page,
}, info) => {
  await createAccount(page);
  await page.goto("/?mode=following");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const preferences = page.getByRole("button", { name: "Feed preferences" });
  await preferences.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Your feed, your choices" }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(preferences).toBeFocused();
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  }
  await page.screenshot({
    path: `/private/tmp/common-phase05-${info.project.name}.png`,
    fullPage: true,
  });
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
  }
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "100%";
  });
  await page.goto("/posts/demo-ava-public");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});
