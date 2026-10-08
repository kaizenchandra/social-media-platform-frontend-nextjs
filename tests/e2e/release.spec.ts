import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";

test("production isolation headers and local performance baseline", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const metrics = { lcp: 0, cls: 0 };
    Object.assign(window, { releaseMetrics: metrics });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) metrics.lcp = entry.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & {
          hadRecentInput: boolean;
          value: number;
        };
        if (!shift.hadRecentInput) metrics.cls += shift.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  const measurements = [];
  for (const route of ["/overview", "/design-system", "/login"]) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    const headers = response!.headers();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["content-security-policy"]).toContain(
      "frame-ancestors 'none'",
    );
    expect(headers["x-powered-by"]).toBeUndefined();
    if (route === "/login")
      expect(headers["cache-control"]).toMatch(/private|no-store/);
    await page.getByRole("heading", { level: 1 }).waitFor();
    await page.waitForTimeout(500);
    measurements.push(
      await page.evaluate((route) => {
        const navigation = performance.getEntriesByType(
          "navigation",
        )[0] as PerformanceNavigationTiming;
        const scripts = (
          performance.getEntriesByType(
            "resource",
          ) as PerformanceResourceTiming[]
        ).filter(
          (entry) =>
            entry.name.includes("/_next/") && entry.name.includes(".js"),
        );
        return {
          route,
          ttfbMs: navigation.responseStart - navigation.requestStart,
          fcpMs:
            performance.getEntriesByName("first-contentful-paint")[0]
              ?.startTime ?? null,
          ...(
            window as unknown as {
              releaseMetrics: { lcp: number; cls: number };
            }
          ).releaseMetrics,
          scriptCount: scripts.length,
          scriptEncodedBytes: scripts.reduce(
            (total, entry) => total + entry.encodedBodySize,
            0,
          ),
          scriptTransferredBytes: scripts.reduce(
            (total, entry) => total + entry.transferSize,
            0,
          ),
        };
      }, route),
    );
  }
  expect(errors).toEqual([]);
  const result = {
    project: testInfo.project.name,
    viewport: testInfo.project.use.viewport,
    environment:
      "local Chromium production; warm server, browser cache retained between routes; no CPU/network throttling; single observation per route; not field percentiles",
    measurements,
  };
  await writeFile(
    `/tmp/common-phase13-performance-${testInfo.project.name}.json`,
    JSON.stringify(result, null, 2),
  );
  await testInfo.attach("local-performance", {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });
});
