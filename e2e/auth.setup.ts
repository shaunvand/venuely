import { test as setup, expect } from "@playwright/test";

const authFile = "e2e/.auth/venue.json";

setup("authenticate venue staff", async ({ page }) => {
  const email = process.env.E2E_EMAIL;
  const pass = process.env.E2E_PASS;
  if (!email || !pass) throw new Error("Set E2E_EMAIL and E2E_PASS env vars");

  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByPlaceholder("Your password").fill(pass);
  await page.getByRole("button", { name: "Sign in" }).click();

  // Match on PATHNAME (the domain "venuely.co.za" contains the substring
  // "/venue", which would false-match a naive regex). Venue staff with a venue
  // land on /venue; without one, /onboarding; the router hops via /dashboard.
  await page.waitForURL((url) => {
    const p = url.pathname;
    return p.startsWith("/venue") || p.startsWith("/onboarding") || p.startsWith("/dashboard");
  }, { timeout: 35_000 });
  await expect(page).not.toHaveURL(/\/login/);
  await page.waitForLoadState("networkidle");
  await page.context().storageState({ path: authFile });
});
