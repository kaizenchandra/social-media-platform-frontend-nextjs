import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { previewHints } from "../../features/auth/contracts";

async function signIn(
  page: Page,
  email: string = previewHints.email,
  password: string = previewHints.password,
) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
async function register(page: Page) {
  const email = `preview_${crypto.randomUUID()}@example.test`;
  await page.goto("/register");
  await page
    .getByLabel("Display name", { exact: true })
    .fill("Synthetic member");
  await page.getByLabel("Email address").fill(email);
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
  await page
    .getByLabel("Username", { exact: true })
    .fill(`p_${crypto.randomUUID().replaceAll("-", "").slice(0, 15)}`);
  await page.getByRole("button", { name: "Finish preview onboarding" }).click();
  await expect(page).toHaveURL(/\/account$/);
  return email;
}

test("registration, verification, onboarding and versioned account settings", async ({
  page,
}) => {
  await register(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Synthetic member",
  );
  await page
    .getByLabel("Display name", { exact: true })
    .fill("Updated preview");
  await page.getByLabel("About you").fill("Synthetic biography only.");
  await page.getByRole("button", { name: "Save preview changes" }).click();
  await expect(
    page.getByText("Preview account details updated."),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue(
    "Updated preview",
  );
});

test("invalid credentials and simulated network failure preserve inputs", async ({
  page,
}) => {
  await signIn(page, "offline@example.test");
  await expect(page.getByText(/Simulated network interruption/)).toBeVisible();
  await expect(page.getByLabel("Email address")).toHaveValue(
    "offline@example.test",
  );
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue(
    previewHints.password,
  );
  await page.getByLabel("Email address").fill("member@example.test");
  await page.getByLabel("Password", { exact: true }).fill("wrong");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Email or password is incorrect.")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("MFA gates account access and safe return destinations", async ({
  page,
}) => {
  await signIn(page, "mfa@example.test");
  await expect(page).toHaveURL(/\/mfa$/);
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login\?/);
  await expect(page.getByRole("heading", { name: /Your space/ })).toHaveCount(
    0,
  );
  await signIn(page, "mfa@example.test");
  await page.getByLabel("Verification code").fill("000000");
  await page.getByRole("button", { name: "Confirm code" }).click();
  await expect(page.getByText("The preview code is incorrect.")).toBeVisible();
  await page
    .getByLabel("Verification code")
    .fill(previewHints.verificationCode);
  await page.getByRole("button", { name: "Confirm code" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/reason=signed-out/);
  await page.goto("/login?returnTo=https://attacker.test");
  await page.getByLabel("Email address").fill(previewHints.email);
  await page
    .getByLabel("Password", { exact: true })
    .fill(previewHints.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
});

test("password reset and account recovery invalidate previous sessions", async ({
  page,
}) => {
  const email = await register(page);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/reason=signed-out/);
  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Prepare reset" }).click();
  await expect(page).toHaveURL(/\/reset-password$/);
  await page
    .getByLabel("New password", { exact: true })
    .fill("New-preview-42!");
  await page.getByLabel("Confirm password").fill("New-preview-42!");
  await page
    .getByLabel("Verification code")
    .fill(previewHints.verificationCode);
  await page.getByRole("button", { name: "Reset preview password" }).click();
  await expect(page).toHaveURL(/reason=reset/);
  await signIn(page, email, "New-preview-42!");
  await expect(page).toHaveURL(/\/account$/);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/reason=signed-out/);
  await page.goto("/recovery");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Recovery code").fill(previewHints.recoveryCode);
  await page.getByRole("button", { name: "Start recovery" }).click();
  await expect(page).toHaveURL(/\/reset-password$/);
});

test("device controls, session revocation and expiry recovery", async ({
  page,
}) => {
  await register(page);
  await page
    .getByRole("link", { name: "Devices & sessions", exact: true })
    .click();
  await expect(page).toHaveURL(/\/account\/sessions$/);
  const device = page.getByRole("switch", {
    name: "Trust Example mobile device",
  });
  await expect(device).toBeChecked();
  await device.click();
  await expect(device).not.toBeChecked();
  await page
    .getByRole("button", { name: "End example session", exact: true })
    .click();
  await expect(
    page.getByText("Example mobile device", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Simulate session expiration" })
    .click();
  await expect(page).toHaveURL(/reason=expired/);
  await page.goto("/account/sessions");
  await expect(page).toHaveURL(/\/login\?/);
  await expect(
    page.getByText("Recognized devices", { exact: true }),
  ).toHaveCount(0);
});

test("deactivation requires confirmation and recovery can reactivate the preview", async ({
  page,
}) => {
  const email = await register(page);
  await page
    .getByRole("button", { name: "Deactivate preview account", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Take a break" });
  await dialog.getByRole("button", { name: "Confirm deactivation" }).click();
  await expect(dialog.getByText("Type DEACTIVATE to confirm.")).toBeVisible();
  await dialog
    .getByLabel("Current preview password")
    .fill(previewHints.password);
  await dialog.getByLabel("Type DEACTIVATE to confirm").fill("DEACTIVATE");
  await dialog.getByRole("button", { name: "Confirm deactivation" }).click();
  await expect(page).toHaveURL(/reason=deactivated/);
  await page.goto("/recovery");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Recovery code").fill(previewHints.recoveryCode);
  await page.getByRole("button", { name: "Start recovery" }).click();
  await page
    .getByLabel("New password", { exact: true })
    .fill(previewHints.password);
  await page.getByLabel("Confirm password").fill(previewHints.password);
  await page
    .getByLabel("Verification code")
    .fill(previewHints.verificationCode);
  await page.getByRole("button", { name: "Reset preview password" }).click();
  await signIn(page, email);
  await expect(page).toHaveURL(/\/account$/);
});

test("deletion revokes access and removes the synthetic account", async ({
  page,
}) => {
  const email = await register(page);
  await page
    .getByRole("button", { name: "Delete preview account", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Delete the preview account?",
  });
  await dialog
    .getByLabel("Current preview password")
    .fill(previewHints.password);
  await dialog.getByLabel("Type DELETE to confirm").fill("DELETE");
  await dialog.getByRole("button", { name: "Confirm deletion" }).click();
  await expect(page).toHaveURL(/reason=deleted/);
  await signIn(page, email);
  await expect(page.getByText("Email or password is incorrect.")).toBeVisible();
});

test("auth forms and account have accessible semantics and mobile reflow", async ({
  page,
}) => {
  for (const route of ["/login", "/register", "/mfa", "/recovery"]) {
    await page.goto(route);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
  }
  await register(page);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test("non-hydrated authentication cannot submit credentials into a URL", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:3101/register");
    await expect(page.getByLabel("Email address")).toBeDisabled();
    await expect(
      page.getByRole("button", {
        name: "Create preview account",
        exact: true,
        includeHidden: true,
      }),
    ).toBeDisabled();
    await expect(page.locator("form")).toHaveAttribute("method", "post");
    await expect(
      page
        .getByText("JavaScript is required for this preview.", {
          exact: false,
        })
        .filter({ visible: true }),
    ).toBeVisible();
    expect(new URL(page.url()).search).toBe("");
  } finally {
    await context.close();
  }
});
