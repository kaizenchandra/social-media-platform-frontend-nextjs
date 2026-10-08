import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("shell navigation, landmarks and reflow", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/overview");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Good connections",
  );
  await expect(page.getByRole("main")).toHaveAttribute("id", "main-content");
  if (testInfo.project.name === "desktop") {
    await expect(
      page.getByRole("navigation", { name: "Primary", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("complementary", { name: "Context", exact: true }),
    ).toBeVisible();
  } else {
    await expect(
      page.getByRole("button", { name: "Open navigation" }),
    ).toBeVisible();
  }
  if (testInfo.project.name === "mobile")
    await expect(
      page.getByRole("navigation", { name: "Mobile", exact: true }),
    ).toBeVisible();
  await page
    .getByRole("link", { name: "Explore the component library" })
    .click();
  await expect(page).toHaveURL(/\/design-system$/);
  for (const size of [100, 200]) {
    await page.evaluate((size) => {
      document.documentElement.style.fontSize = `${size}%`;
    }, size);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
  }
  await page.goto("/overview");
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
  expect(errors).toEqual([]);
});

test("keyboard skip link, modal focus trap and return focus", async ({
  page,
}) => {
  await page.goto("/design-system");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to main content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  const trigger = page.getByRole("button", {
    name: "Open dialog",
    exact: true,
  });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "A moment of focus" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAccessibleDescription(/keyboard focus/);
  for (let step = 0; step < 5; step++) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((node) => node.contains(document.activeElement)),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await page.getByRole("button", { name: "Open sheet", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "A little more room" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Open sheet", exact: true }),
  ).toBeFocused();
});

test("theme selection persists, follows system and remains usable without storage", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/overview");
  await page.getByRole("button", { name: /Appearance:/ }).click();
  await page.getByRole("menuitem", { name: "Dark theme", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: /Appearance:/ }).click();
  await page
    .getByRole("menuitem", { name: "System theme", exact: true })
    .click();
  await page.emulateMedia({ colorScheme: "dark" });
  expect(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).colorScheme,
    ),
  ).toBe("dark");
  await page.evaluate(() => {
    Object.defineProperty(Storage.prototype, "setItem", {
      value: () => {
        throw new Error("Unavailable");
      },
    });
  });
  await page.getByRole("button", { name: /Appearance:/ }).click();
  await page
    .getByRole("menuitem", { name: "Light theme", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("screen reader semantics and contrast in both themes and modal", async ({
  page,
}) => {
  await page.goto("/design-system");
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
  await page.getByRole("button", { name: "Open dialog", exact: true }).click();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("reduced motion and compact navigation focus", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/design-system");
  expect(
    await page
      .locator(".skeleton")
      .first()
      .evaluate((node) => getComputedStyle(node).animationName),
  ).toBe("none");
  if (testInfo.project.name !== "desktop") {
    const trigger = page.getByRole("button", { name: "Open navigation" });
    await trigger.click();
    const sheet = page.getByRole("dialog", { name: "Find your way" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("link", { name: "Overview", exact: true }).click();
    await expect(page).toHaveURL(/\/overview$/);
    await expect(sheet).not.toBeVisible();
    await expect(trigger).toBeFocused();
  }
});

test("feedback, tab keys and not found recovery", async ({ page }) => {
  await page.goto("/design-system");
  await page.getByRole("button", { name: "Validate example" }).click();
  await expect(page.getByLabel("Display name example")).toBeFocused();
  await expect(page.getByText("Enter a name to continue.")).toBeVisible();
  await page.getByRole("tab", { name: "Details", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Principles", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByText("Example recovered")).toBeVisible();
  await page.getByRole("button", { name: "Show toast", exact: true }).click();
  await expect(
    page.getByText("Example action complete", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Dismiss notification" }).click();
  await page.goto("/does-not-exist");
  await expect(page.getByText("This page isn’t here")).toBeVisible();
  await page.getByRole("link", { name: "Back to overview" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Good connections",
  );
});

test("dropdown arrow keys skip disabled actions and restore focus", async ({
  page,
}) => {
  await page.goto("/design-system");
  const trigger = page.getByRole("button", { name: "More example actions" });
  await trigger.focus();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("menuitem", { name: "Show notification" }),
  ).toBeFocused();
  await expect(
    page.getByRole("menuitem", { name: "Unavailable action" }),
  ).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("menuitem", { name: "Show notification" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});
