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
test("group collaboration, invitations, permissions and revocation", async ({
  page,
}) => {
  await account(page);
  await page.goto("/groups");
  await expect(
    page.getByRole("heading", { name: "Group conversations", exact: true }),
  ).toBeVisible();
  await page.getByText("Preview membership controls", { exact: true }).click();
  await page.getByRole("button", { name: "Members", exact: true }).click();
  await page.getByLabel("Simulate failed invitation").check();
  await page.getByRole("button", { name: "Invite locally" }).click();
  await expect(page.getByText(/Simulated invitation failed/)).toBeVisible();
  await page
    .getByRole("button", { name: "Retry invitation to Noah Ellis" })
    .click();
  await page.getByLabel("Preview participant").selectOption("noah");
  await expect(page.getByText(/Accept to see content/)).toBeVisible();
  await page.getByRole("button", { name: "Accept local invitation" }).click();
  await expect(
    page.getByText("No accessible messages in this view."),
  ).toBeVisible();
  await page
    .getByLabel("Group message", { exact: true })
    .fill("Synthetic new-member greeting");
  await page.getByRole("button", { name: "Send to group locally" }).click();
  await expect(
    page.getByText("Synthetic new-member greeting", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Conversation topic").selectOption("announcements");
  await expect(
    page.getByLabel("Group message", { exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Members", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Remove Maya Chen" }),
  ).toBeDisabled();
  await page.getByLabel("Preview participant").selectOption("self");
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await page
    .getByLabel("Group message", { exact: true })
    .fill("Synthetic project plan");
  await page.getByLabel("Mention member").selectOption("leo");
  await page.getByRole("button", { name: "Send to group locally" }).click();
  const row = page
    .locator(".message-row")
    .filter({ hasText: "Synthetic project plan" });
  await row.getByRole("button", { name: "Pin", exact: true }).click();
  await row.getByRole("button", { name: "Thread (0)" }).click();
  await page
    .getByLabel("Thread reply", { exact: true })
    .fill("Synthetic threaded detail");
  await page.getByRole("button", { name: "Reply locally" }).click();
  await expect(
    page.getByText("Synthetic threaded detail", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close thread" }).click();
  await page.getByLabel("Search group content").fill("threaded detail");
  await expect(row).toBeVisible();
  await page
    .getByRole("button", { name: "Collaboration", exact: true })
    .click();
  await page.getByLabel("Shared item title").fill("Synthetic shared note");
  await page
    .getByLabel("Shared item details")
    .fill("Plan a morning at the garden.");
  await page.getByRole("button", { name: "Add shared item locally" }).click();
  await expect(
    page.getByRole("heading", { name: "Synthetic shared note" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Polls", exact: true }).click();
  await page.getByRole("button", { name: "10 AM · 0 votes" }).click();
  await expect(
    page.getByRole("button", { name: "10 AM · 1 votes" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Group notifications").selectOption("mentions");
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/groups-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Simulate removal by Maya" }).click();
  await expect(page.getByText(/You were removed/)).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Group sections" }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Group message", { exact: true })).toHaveCount(
    0,
  );
});
