import { defineConfig } from "@playwright/test";

const origin = process.env.E2E_ORIGIN ?? "http://127.0.0.1:8835";
/** Optional: a preinstalled Chromium when the pinned Playwright browser is not downloaded. */
const chromiumPath = process.env.PW_CHROMIUM_PATH?.trim();

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 25_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: origin,
    trace: "retain-on-failure",
    viewport: { width: 1440, height: 900 },
    ...(chromiumPath
      ? { launchOptions: { executablePath: chromiumPath, args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] } }
      : {}),
  },
});
