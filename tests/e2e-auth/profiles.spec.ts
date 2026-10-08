import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { previewHints } from "../../features/auth/contracts";
async function createAccount(page: Page) {
  const tag = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
  await page.goto("/register");
  await page
    .getByLabel("Display name", { exact: true })
    .fill("Profile preview");
  await page.getByLabel("Email address").fill(`profile_${tag}@example.test`);
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
  await page.getByLabel("Username", { exact: true }).fill(`p_${tag}`);
  await page.getByRole("button", { name: "Finish preview onboarding" }).click();
  await expect(page).toHaveURL(/\/account$/);
  return `p_${tag}`;
}
const card = (page: Page, username: string) =>
  page
    .locator(".connection-card")
    .filter({ has: page.locator(`a[href='/profile/${username}']`) });
test("guest profile excludes friend/private content and cannot mutate", async ({
  page,
}) => {
  await page.goto("/profile/ava");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ava Reed");
  await expect(page.getByText("Public visitor", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit profile" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("button", { name: "Add friend" })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "A weekend with friends" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Notes for myself" }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "Media", exact: true }).click();
  await expect(page.locator(".profile-gallery figure")).toHaveCount(1);
  const response = await page.request.get("/profile/ava");
  const body = await response.text();
  expect(body).not.toContain("Synthetic friends-only post");
  expect(body).not.toContain("Synthetic private post");
  expect(body).not.toContain("Awaiting screening");
});
test("owner edits profile artwork/details/audiences and features only permitted posts", async ({
  page,
}) => {
  const username = await createAccount(page);
  const publicResponse = await page.request.get(`/profile/${username}`, {
    headers: { Cookie: "" },
  });
  expect(publicResponse.status()).toBe(200);
  const publicBody = await publicResponse.text();
  expect(publicBody).toContain("Profile preview");
  expect(publicBody).not.toContain("Synthetic private post");
  await page.goto("/profile");
  await expect(
    page.getByRole("heading", { name: "Notes for myself" }),
  ).toBeVisible();
  const trigger = page.getByRole("button", { name: "Edit profile" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Edit your profile" });
  await dialog
    .getByLabel("Display name", { exact: true })
    .fill("Updated profile preview");
  await dialog
    .getByLabel("Biography")
    .fill("A synthetic biography with room for connection.");
  await dialog
    .getByLabel("Location", { exact: true })
    .fill("Private sample location");
  await dialog.getByLabel("Avatar artwork").selectOption("studio");
  await dialog.getByLabel("Cover artwork").selectOption("coast");
  await dialog.getByLabel("Who can view this profile?").selectOption("private");
  await dialog.getByRole("button", { name: "Save profile" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Updated profile preview",
  );
  await expect(page.locator(".profile-cover")).toHaveAttribute(
    "src",
    "/artwork/coast.svg",
  );
  await expect(page.locator(".profile-identity .avatar img")).toHaveAttribute(
    "src",
    "/artwork/studio.svg",
  );
  await page
    .locator(".profile-post")
    .filter({ has: page.getByRole("heading", { name: "Notes for myself" }) })
    .getByRole("button", { name: "Feature this post" })
    .click();
  await page.getByRole("tab", { name: "Featured", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Notes for myself" }),
  ).toBeVisible();
  const guest = await page.context().browser()!.newContext();
  try {
    const other = await guest.newPage();
    await other.goto(`http://127.0.0.1:3101/profile/${username}`);
    await expect(other.getByRole("heading", { level: 1 })).toHaveText(
      "Profile unavailable",
    );
    expect(await other.content()).not.toContain("Private sample location");
  } finally {
    await guest.close();
  }
  await page.goto("/account");
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue(
    "Updated profile preview",
  );
});
test("incoming acceptance, friendship removal and outgoing cancellation transition correctly", async ({
  page,
}) => {
  await createAccount(page);
  await page.goto("/connections");
  await card(page, "milo")
    .getByRole("button", { name: "Accept", exact: true })
    .click();
  await expect(
    page.getByText("Friend request accepted.").first(),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Friends", exact: true }).click();
  await expect(card(page, "milo")).toBeVisible();
  await card(page, "milo")
    .getByRole("button", { name: "Unfriend", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm unfriend" })
    .click();
  await expect(card(page, "milo")).toHaveCount(0);
  await expect(page.getByText("Friend removed.").first()).toBeVisible();
  await page.goto("/profile/milo");
  await page.getByRole("button", { name: "Add friend" }).click();
  await expect(
    page.getByRole("button", { name: "Cancel request" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel request" }).click();
  await expect(page.getByRole("button", { name: "Add friend" })).toBeVisible();
});
test("rejects requests, supports favorites/restrictions, and blocks without restoring connections on unblock", async ({
  page,
}) => {
  await createAccount(page);
  await page.goto("/connections");
  await card(page, "milo")
    .getByRole("button", { name: "Reject", exact: true })
    .click();
  await expect(
    page.getByText("Friend request rejected.").first(),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No incoming requests" }),
  ).toBeVisible();
  await page.goto("/profile/ava");
  await expect(
    page.getByRole("button", { name: "Unfollow", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add favorite" }).click();
  await expect(
    page.getByRole("button", { name: "Remove favorite" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Restrict", exact: true }).click();
  await expect(page.getByText("Restricted", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Block", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm block" })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Profile unavailable",
  );
  await page.goto("/connections");
  await page.getByRole("tab", { name: "Favorites", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No favorites" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Privacy", exact: true }).click();
  await card(page, "ava")
    .getByRole("button", { name: "Unblock", exact: true })
    .click();
  await expect(card(page, "ava")).toHaveCount(0);
  await page.goto("/profile/ava");
  await expect(
    page.getByRole("button", { name: "Follow", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Remove favorite" }),
  ).toHaveCount(0);
});
test("failed connection mutation keeps its state and recovers after reload", async ({
  page,
}) => {
  await createAccount(page);
  await page.goto("/profile/leila");
  await expect(
    page.getByRole("button", { name: "Follow", exact: true }),
  ).toBeEnabled();
  await page.route("**/profile/leila", (route) =>
    route.request().method() === "POST"
      ? route.abort("failed")
      : route.continue(),
  );
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(
    page.getByText(
      "Connection interrupted. Your input is preserved. Try again.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Follow", exact: true }),
  ).toBeVisible();
  await page.unroute("**/profile/leila");
  await page.getByRole("button", { name: "Reload connection" }).click();
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Unfollow", exact: true }),
  ).toBeVisible();
});
test("profile and connection screens support keyboard focus, themes, axe and enlarged text reflow", async ({
  page,
}, info) => {
  await createAccount(page);
  await page.goto("/profile");
  const trigger = page.getByRole("button", { name: "Edit profile" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Edit your profile" }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  for (const path of ["/profile", "/connections"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
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
      path: `/private/tmp/common-phase04-${info.project.name}-${path.slice(1)}.png`,
      fullPage: true,
    });
    await page.evaluate(
      () => (document.documentElement.style.fontSize = "200%"),
    );
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    const originalViewport = page.viewportSize()!;
    await page.setViewportSize({ width: 768, height: 1024 });
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await page.evaluate(
      () => (document.documentElement.style.fontSize = "100%"),
    );
    await page.screenshot({
      path: `/private/tmp/common-phase04-tablet-${info.project.name}-${path.slice(1)}.png`,
      fullPage: true,
    });
    await page.setViewportSize(originalViewport);
  }
});
