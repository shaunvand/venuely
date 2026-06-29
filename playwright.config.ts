import { defineConfig } from "@playwright/test";

// E2E against LIVE venuely.co.za with a throwaway venue account. Plain Chromium
// (no Dolphin/Anty). Artifacts (screenshot/trace) retained on failure.
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "https://venuely.co.za",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    actionTimeout: 20_000,
    navigationTimeout: 35_000,
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "venue", testMatch: /venue\.spec\.ts/, dependencies: ["setup"], use: { storageState: "e2e/.auth/venue.json" } },
    { name: "couple", testMatch: /couple\.spec\.ts/, dependencies: ["venue"] },
  ],
});
