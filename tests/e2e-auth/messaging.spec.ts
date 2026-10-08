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
test("messaging preview: queue, retry, replies, collections and permissions", async ({
  page,
}) => {
  await account(page);
  await page.goto("/messages");
  await expect(
    page.getByRole("heading", { name: "Messages", exact: true }),
  ).toBeVisible();
  await page
    .getByText("Preview delivery and permission controls", { exact: true })
    .click();
  await page.getByLabel("Connection", { exact: true }).selectOption("offline");
  await page
    .getByLabel("Message", { exact: true })
    .fill("Synthetic offline greeting");
  await page.getByRole("button", { name: "Queue locally" }).click();
  await expect(
    page.locator(".message-meta").filter({ hasText: /queued/ }),
  ).toBeVisible();
  await page
    .getByLabel("Connection", { exact: true })
    .selectOption("connected");
  await expect(
    page.locator(".message-meta").filter({ hasText: /delivered/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Repeat acknowledgment" }).click();
  await expect(
    page.getByText("Synthetic offline greeting", { exact: true }),
  ).toHaveCount(1);
  const row = page
    .locator(".message-row")
    .filter({ hasText: "Synthetic offline greeting" });
  await row.getByRole("button", { name: "Save", exact: true }).click();
  await row.getByRole("button", { name: "Pin", exact: true }).click();
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByLabel("Message", { exact: true })
    .fill("Synthetic edited greeting");
  await page.getByRole("button", { name: "Save edit" }).click();
  await page.getByLabel("Message collection").selectOption("saved");
  await expect(page.locator(".message-row")).toHaveCount(1);
  await expect(
    page.getByText("Synthetic edited greeting", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Message collection").selectOption("all");
  await page.getByRole("button", { name: "Revoke permission" }).click();
  await expect(page.getByLabel("Message", { exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Restore permission" }).click();
  await page.getByLabel("Fail simulated sends").check();
  await page
    .getByLabel("Message", { exact: true })
    .fill("Synthetic retry greeting");
  await page.getByRole("button", { name: "Send locally" }).click();
  await expect(page.getByRole("button", { name: "Retry (1/3)" })).toBeVisible();
  await page.getByLabel("Fail simulated sends").uncheck();
  await page.getByRole("button", { name: "Retry (1/3)" }).click();
  await expect(
    page.locator(".message-meta").filter({ hasText: /Retried.*delivered/ }),
  ).toBeVisible();
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/messages-${test.info().project.name}.png`,
    fullPage: true,
  });
});
