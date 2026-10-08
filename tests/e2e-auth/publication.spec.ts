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
async function compose(page: Page, scenario = "low-risk") {
  await page.goto("/create");
  await page
    .getByLabel("Post text", { exact: true })
    .fill(`Synthetic publication thought ${crypto.randomUUID().slice(0, 8)}`);
  await page.getByLabel("Simulated workflow scenario").selectOption(scenario);
  await page
    .getByLabel("I am using only benign synthetic text and media.")
    .check();
}
const state = (page: Page, value: string) =>
  page
    .locator(".publication-summary:visible")
    .getByText(`Simulated ${value}`, { exact: true });
test("local multi-media previews, rich formatting, drafts and low-risk simulation never publish", async ({
  page,
}) => {
  await account(page);
  await compose(page);
  await page.getByLabel("Image or video attachments").setInputFiles({
    name: "undecodable.png",
    mimeType: "image/png",
    buffer: Buffer.from("benign undecodable fixture"),
  });
  await expect(
    page.getByText("Local preview unavailable", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remove attachment 1" }).click();
  const video = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#93c5fd";
    ctx.fillRect(0, 0, 64, 64);
    const stream = canvas.captureStream(5),
      recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });
    recorder.start();
    await new Promise((resolve) => setTimeout(resolve, 300));
    recorder.stop();
    await stopped;
    stream.getTracks().forEach((track) => track.stop());
    return [...new Uint8Array(await new Blob(chunks).arrayBuffer())];
  });
  await page.getByLabel("Image or video attachments").setInputFiles([
    {
      name: "synthetic.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    },
    {
      name: "synthetic.webm",
      mimeType: "video/webm",
      buffer: Buffer.from(video),
    },
  ]);
  await page.getByLabel("Image description 1").fill("Synthetic blue pixel");
  await page.getByLabel("Video description 2").fill("A synthetic blue square");
  await expect(page.locator(".attachment-card")).toHaveCount(2);
  await expect(page.locator(".attachment-card img")).toHaveAttribute(
    "src",
    /^blob:/,
  );
  await expect
    .poll(() =>
      page
        .locator(".attachment-card video")
        .evaluate((video) => (video as HTMLVideoElement).readyState),
    )
    .toBeGreaterThan(0);
  await page
    .getByLabel("Post text", { exact: true })
    .fill("**Synthetic bold**\n- A quiet thought");
  await page.getByLabel("Intended audience").selectOption("public");
  await page
    .getByLabel("AI-generated media disclosure")
    .selectOption("ai-generated");
  await page.getByRole("button", { name: "Preview post", exact: true }).click();
  await expect(page.getByRole("dialog").locator("strong")).toContainText(
    "Synthetic bold",
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Save private draft" }).click();
  await expect(
    page.getByText("Draft saved privately", { exact: true }),
  ).toBeVisible();
  await page.goto("/drafts");
  await page.getByRole("link", { name: "Edit private draft" }).click();
  await expect(page.getByLabel("Post text", { exact: true })).toHaveValue(
    "**Synthetic bold**\n- A quiet thought",
  );
  await expect(
    page.getByText("Reselect draft attachments", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remove attachment 2" }).click();
  await page.getByRole("button", { name: "Remove attachment 1" }).click();
  await page
    .getByLabel("I am using only benign synthetic text and media.")
    .check();
  await page.getByRole("button", { name: "Start simulated upload" }).click();
  await expect(state(page, "APPROVED")).toBeVisible({ timeout: 15000 });
  await expect(
    page.getByRole("button", { name: "Publish (backend unavailable)" }),
  ).toBeDisabled();
  await page.getByRole("link", { name: "Open status page" }).click();
  const body = await (await page.request.get(page.url())).text();
  expect(body).not.toContain("blob:");
  expect(body).not.toContain("synthetic.webm"); // New revision explicitly removed its files.
  await page.goto("/");
  expect(await page.content()).not.toContain("A quiet thought");
});
test("upload interruption retries and cancellation stays terminal", async ({
  page,
}) => {
  await account(page);
  await compose(page, "upload-interruption");
  await page.getByRole("button", { name: "Start simulated upload" }).click();
  await expect(state(page, "FAILED")).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Retry simulated upload" }).click();
  await expect(state(page, "APPROVED")).toBeVisible({ timeout: 15000 });
  await compose(page);
  await page.getByRole("button", { name: "Start simulated upload" }).click();
  await expect(
    page.getByRole("button", { name: "Cancel workflow" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Cancel workflow" }).click();
  await expect(state(page, "CANCELLED")).toBeVisible();
  await page.getByRole("button", { name: "Refresh status" }).click();
  await expect(state(page, "CANCELLED")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue simulation" }),
  ).toHaveCount(0);
});
test("review and moderation-timeout fixtures stay held with publication forbidden", async ({
  page,
}) => {
  await account(page);
  for (const scenario of ["review", "moderation-timeout"]) {
    await compose(page, scenario);
    await page.getByRole("button", { name: "Start simulated upload" }).click();
    await expect(state(page, "REVIEW_REQUIRED")).toBeVisible({
      timeout: 15000,
    });
    await expect(
      page.getByText("Simulated review target", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Refresh status" }).click();
    await expect(state(page, "REVIEW_REQUIRED")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Publish (backend unavailable)" }),
    ).toBeDisabled();
    if (scenario === "moderation-timeout")
      await expect(page.getByText(/review target is overdue/)).toBeVisible();
  }
});
test("rejected/restricted fixtures expose explanations and owner-only unsent appeal options", async ({
  page,
  browser,
}) => {
  await account(page);
  for (const scenario of ["rejected", "restricted"]) {
    await compose(page, scenario);
    await page.getByRole("button", { name: "Start simulated upload" }).click();
    await expect(state(page, scenario.toUpperCase())).toBeVisible({
      timeout: 15000,
    });
    expect(
      await page.locator(".publication-status").getAttribute("data-media-url"),
    ).toBeNull();
    await page.getByRole("link", { name: "Review appeal options" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Appeal options",
    );
    await page
      .getByLabel("Why would you appeal?")
      .fill("Synthetic appeal note about the scripted fixture.");
    await page
      .getByRole("button", { name: "Prepare local appeal note" })
      .click();
    await expect(
      page.getByText(/Local appeal note prepared. Nothing was sent/),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send appeal (service unavailable)" }),
    ).toBeDisabled();
    const other = await browser.newContext();
    try {
      const visitor = await other.newPage();
      await visitor.goto(page.url());
      await expect(visitor).toHaveURL(/\/login\?/);
    } finally {
      await other.close();
    }
  }
});
test("failed draft mutation preserves inputs and retry recovers", async ({
  page,
}) => {
  await account(page);
  await compose(page);
  const text = await page.getByLabel("Post text", { exact: true }).inputValue();
  await page.route("**/create", (route) =>
    route.request().method() === "POST"
      ? route.abort("failed")
      : route.continue(),
  );
  await page.getByRole("button", { name: "Save private draft" }).click();
  await expect(
    page.getByText(/Connection interrupted. Nothing was confirmed/),
  ).toBeVisible();
  await expect(page.getByLabel("Post text", { exact: true })).toHaveValue(text);
  await page.unroute("**/create");
  await page.getByRole("button", { name: "Retry draft action" }).click();
  await expect(
    page.getByText("Draft saved privately", { exact: true }),
  ).toBeVisible();
});
test("composer/preview/safety keyboard, themes, reduced motion, axe and responsive reflow", async ({
  page,
}, info) => {
  await account(page);
  await compose(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const preview = page.getByRole("button", {
    name: "Preview post",
    exact: true,
  });
  await preview.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Private post preview" }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(preview).toBeFocused();
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
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: `/private/tmp/common-phase06-${info.project.name}.png`,
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
  await page.goto("/safety");
  await page.getByLabel("Media safety concern").selectOption("deepfake");
  await expect(
    page.getByRole("heading", { name: "Synthetic media and authenticity" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Submit private report (service unavailable)",
    }),
  ).toBeDisabled();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});
