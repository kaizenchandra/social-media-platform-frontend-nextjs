import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { previewHints } from "../../features/auth/contracts";
async function account(page: Page) {
  const tag = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
  await page.goto("/register");
  await page
    .getByLabel("Display name", { exact: true })
    .fill("Publication preview");
  await page.getByLabel("Email address").fill(`advanced_${tag}@example.test`);
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
test("creator and assistance require review, keep content private, and show unavailable metrics", async ({
  page,
}) => {
  test.setTimeout(90000);
  await account(page);
  await page.goto("/creator");
  await expect(
    page.getByRole("heading", { name: "Analytics unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByText("No owned drafts yet.", { exact: false }),
  ).toBeVisible();
  await page.goto("/assistant");
  await page
    .getByLabel("Synthetic draft or caption context")
    .fill("Synthetic assistance request");
  await page.getByLabel("I consent to this assistance request.").check();
  await page.getByLabel("I am using synthetic text only.").check();
  await page
    .getByRole("button", { name: "Request assistance", exact: true })
    .click();
  await expect(
    page.getByText("AI provider is not connected.", { exact: false }).last(),
  ).toBeVisible();
  await expect(page.getByLabel("Reviewed manual text")).toHaveValue("");
  for (const task of ["caption", "accessibility", "translation", "summary"]) {
    await page.getByLabel("Assistance task").selectOption(task);
    if (task === "translation" || task === "summary") {
      await page
        .getByLabel("Eligible public source")
        .selectOption({ index: 1 });
    } else {
      await page
        .getByLabel(
          task === "accessibility"
            ? "Describe the image context (no media upload)"
            : "Synthetic draft or caption context",
        )
        .fill("Synthetic request context");
    }
    await page
      .getByRole("button", { name: "Request assistance", exact: true })
      .click();
    await expect(
      page.getByText("AI provider is not connected.", { exact: false }).last(),
    ).toBeVisible();
  }
  await page
    .getByLabel("Reviewed manual text")
    .fill("Synthetic manual creator draft");
  await page.getByLabel("This draft contains synthetic details only.").check();
  await page
    .getByRole("button", { name: "Save private draft", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Synthetic manual creator draft",
  );
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Save private draft", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Save private draft", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm save private draft" })
    .click();
  await expect(
    page.getByText("Reviewed manual text saved as a private draft.", {
      exact: false,
    }),
  ).toBeVisible();
  await page.goto("/creator");
  await expect(
    page.getByText("Synthetic manual creator draft", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Planned publication time (ISO UTC)")
    .fill(new Date(Date.now() + 86400000).toISOString());
  await page
    .getByRole("button", { name: "Save schedule plan", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
  await page
    .getByRole("button", { name: "Confirm save schedule plan" })
    .click();
  await expect(
    page.getByRole("button", { name: "Cancel schedule plan", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("No job was queued", { exact: false }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/creator-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Cancel schedule plan", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm cancel schedule plan" })
    .click();
  await expect(page.getByText(/· cancelled/)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("marketplace discovery, buyer entry, private drafts and seller blocking", async ({
  page,
}) => {
  test.setTimeout(90000);
  await account(page);
  await page.goto("/marketplace");
  await page.getByLabel("Search listings").fill("no-such-item-9382");
  await page.getByRole("button", { name: "Search marketplace" }).click();
  await expect(
    page.getByRole("heading", { name: "No matching listings" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Clear filters", exact: true }).click();
  await page.getByLabel("Category filter").selectOption("creative");
  await page.getByRole("button", { name: "Search marketplace" }).click();
  await expect(
    page.getByRole("link", { name: "Synthetic sketch kit", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Synthetic garden planter", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "Synthetic sketch kit", exact: true })
    .click();
  await page.getByRole("link", { name: "Prepare a buyer message" }).click();
  await expect(
    page.getByRole("heading", { name: "Buyer message draft" }),
  ).toBeVisible();
  await expect(
    page.getByText("About Synthetic sketch kit", { exact: false }),
  ).toBeVisible();
  await page
    .getByLabel("Unsent buyer message")
    .fill("Synthetic question about this listing");
  await expect(
    page.getByRole("button", { name: "Send unavailable" }),
  ).toBeDisabled();
  await page.getByRole("link", { name: "Back to listing" }).click();
  await page.getByRole("link", { name: "Report listing", exact: true }).click();
  await expect(page.getByLabel("Synthetic target identifier")).toHaveValue(
    "studio-kit",
  );
  await page.goto("/marketplace");
  const title = `Synthetic private ${crypto.randomUUID().slice(0, 8)}`;
  await page.getByLabel("Listing title").fill(title);
  await page
    .getByLabel("Listing description")
    .fill("Synthetic listing details only");
  await page.getByLabel("I am using synthetic listing details.").check();
  await page
    .getByRole("button", { name: "Save listing draft", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm save listing draft" })
    .click();
  await expect(
    page.getByText("Private synthetic listing saved.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: title, exact: true }),
  ).toHaveCount(0);
  await page.goto("/marketplace?collection=mine");
  await page.getByRole("link", { name: title, exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Manage private listing" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Prepare a buyer message" }),
  ).toHaveCount(0);
  const listingUrl = page.url();
  await page
    .getByRole("button", { name: "Withdraw listing", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm withdraw listing" }).click();
  await expect(
    page.getByText("Withdrawn private listing.", { exact: false }),
  ).toBeVisible();
  await page.goto("/marketplace/studio-kit");
  await page.getByRole("link", { name: /Noah.*@/ }).click();
  await expect(
    page.getByText("Verification, buyer ratings", { exact: false }),
  ).toBeVisible();
  await page.getByRole("link", { name: "View social profile" }).click();
  await page.getByRole("button", { name: "Block", exact: true }).click();
  await page.getByRole("button", { name: "Confirm block" }).click();
  await page.goto("/marketplace/studio-kit");
  await expect(
    page.getByRole("heading", { name: "Listing unavailable" }),
  ).toBeVisible();
  await page.goto("/messages?listing=studio-kit");
  await expect(
    page.getByRole("heading", { name: "Seller messaging unavailable" }),
  ).toBeVisible();
  expect(await page.content()).not.toContain("Synthetic sketch kit");
  await page.goto(listingUrl);
  await expect(
    page.getByText("Withdrawn private listing.", { exact: false }),
  ).toBeVisible();
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("well-being preferences, validation, recommendation controls and accessibility", async ({
  page,
}) => {
  test.setTimeout(90000);
  await account(page);
  await page.goto("/wellbeing");
  await page.getByLabel("Quiet hours time zone").fill("Invalid/Zone");
  await page
    .getByRole("button", { name: "Save well-being preferences", exact: true })
    .click();
  await expect(
    page.getByText("Choose a valid IANA time zone.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Quiet hours time zone").fill("UTC");
  await page
    .getByLabel("Screen-time reminder (minutes; 0 disables)")
    .fill("30");
  await page.getByLabel("Enable quiet hours").check();
  await page.getByLabel("Quiet hours start").fill("00:00");
  await page.getByLabel("Quiet hours end").fill("23:59");
  await page.getByLabel("Allow automatic next-story navigation").check();
  await page.getByLabel("Allow nonessential in-app notifications").uncheck();
  await page
    .getByRole("button", { name: "Save well-being preferences", exact: true })
    .click();
  await expect(
    page.getByText("Well-being preferences saved in development preview.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByLabel("Screen-time reminder (minutes; 0 disables)"),
  ).toHaveValue("30");
  await expect(
    page.getByLabel("Allow automatic next-story navigation"),
  ).toBeChecked();
  await expect(
    page.getByLabel("Allow nonessential in-app notifications"),
  ).not.toBeChecked();
  await page.getByLabel("Default feed").selectOption("chronological");
  await page.getByLabel("Include public discovery in Home").uncheck();
  await page
    .getByRole("button", { name: "Save recommendation controls", exact: true })
    .click();
  await expect(
    page.getByText("Preferences saved", { exact: false }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Default feed")).toHaveValue("chronological");
  await expect(
    page.getByLabel("Include public discovery in Home"),
  ).not.toBeChecked();
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
  await page.screenshot({
    path: `test-results/wellbeing-${test.info().project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
