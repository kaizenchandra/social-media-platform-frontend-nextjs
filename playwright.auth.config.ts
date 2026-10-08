import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e-auth",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 2,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3101", trace: "retain-on-failure" },
  projects: [
    {
      name: "auth-desktop",
      use: { browserName: "chromium", viewport: { width: 1440, height: 1000 } },
    },
    {
      name: "auth-mobile",
      use: {
        browserName: "chromium",
        viewport: { width: 320, height: 740 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: "npm run dev -- --webpack --hostname 127.0.0.1 --port 3101",
    env: { COMMON_AUTH_MODE: "mock", COMMON_AUTH_TEST_RUN: "1" },
    url: "http://127.0.0.1:3101/login",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
