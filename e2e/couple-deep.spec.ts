import { test, expect, type Page } from "@playwright/test";

// Couple AI planner — the real /planner route calls Claude Haiku, so we stub it
// and assert the full client flow (open → ask → reply renders).
const SLUG = "TestAndPartnerWedding";
const PW = "couplepass123";

async function unlock(page: Page) {
  await page.addInitScript((slug) => { try { localStorage.setItem(`venuely_tour_v1_${slug}`, "1"); } catch { /* ignore */ } }, SLUG);
  await page.goto(`/${SLUG}`);
  const pw = page.locator('input[name="p"]');
  if (await pw.count()) { await pw.fill(PW); await page.getByRole("button", { name: /Unlock portal/i }).click(); }
  await page.waitForURL(new RegExp(`/p/${SLUG}`), { timeout: 30_000 });
  const skip = page.getByRole("button", { name: /Skip tour/i }).first();
  if (await skip.isVisible({ timeout: 2_000 }).catch(() => false)) await skip.click().catch(() => {});
}

test("AI planner: open → ask → reply renders (planner route stubbed)", async ({ page }) => {
  const reply = "Here's a suggested 3-course menu from your venue's options.";
  await page.route(`**/api/wedding/${SLUG}/planner`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, reply, actions: [] }) }),
  );
  await unlock(page);

  // Launch the planner (the launcher's accessible name is "Open AI planner";
  // its visible text is "✨ Plan with AI").
  await page.getByRole("button", { name: /Open AI planner|Plan with AI/i }).first().click();
  await expect(page.getByText(/AI Wedding Planner/i)).toBeVisible({ timeout: 10_000 });

  const composer = page.getByPlaceholder(/Ask anything about your wedding/i);
  await composer.fill("What menu do you suggest?");
  await page.getByRole("button", { name: /^Send$/ }).click();

  // The stubbed assistant reply renders in the thread.
  await expect(page.getByText(/suggested 3-course menu/i)).toBeVisible({ timeout: 10_000 });
});
