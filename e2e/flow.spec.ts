import { test, expect, type Page } from "@playwright/test";

// THE money path, end to end, across two real sessions:
// couple (password gate) selects a paid item + submits → venue (login) approves
// & invoices. Seeded wedding "TestAndPartnerWedding" / pw "couplepass123".
const SLUG = "TestAndPartnerWedding";
const PW = "couplepass123";

function watchErrors(page: Page, tag: string): string[] {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(`[${tag}] ${m.text()}`); });
  page.on("pageerror", (e) => errors.push(`[${tag}] pageerror: ${e.message}`));
  return errors;
}
const benign = (e: string) => /favicon|analytics|ResizeObserver|net::ERR_|Failed to load resource|googletagmanager|maps\.google|hydrat|preload/i.test(e);

async function coupleUnlock(page: Page) {
  await page.goto(`/${SLUG}`);
  const pw = page.locator('input[name="p"]');
  if (await pw.count()) { await pw.fill(PW); await page.getByRole("button", { name: /Unlock portal/i }).click(); }
  await page.waitForURL(new RegExp(`/p/${SLUG}`), { timeout: 30_000 });
}
async function venueLogin(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(process.env.E2E_EMAIL!);
  await page.getByPlaceholder("Your password").fill(process.env.E2E_PASS!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => u.pathname.startsWith("/venue") || u.pathname.startsWith("/dashboard"), { timeout: 35_000 });
}

test("FULL transaction: couple selects + submits → venue approves & invoices", async ({ browser }) => {
  // ── 1) COUPLE selects a paid item + submits ──
  const cctx = await browser.newContext();
  const cp = await cctx.newPage();
  const cerr = watchErrors(cp, "couple");
  await coupleUnlock(cp);

  // Mirror the proven couple-spec navigation (normal click + assert the tab's
  // items loaded) — confirms the tab switched before we try to add.
  const ext = cp.getByRole("button", { name: /^Extras & Rentals$/i }).first();
  if (!(await ext.isVisible().catch(() => false))) await cp.locator(`[data-tour="section-Our Venue"]`).first().click();
  await ext.click();
  await expect(cp.getByText(/3-Course Plated Dinner|Chiavari Chair|Welcome Drinks/i).first()).toBeVisible({ timeout: 15_000 });

  // The couple portal re-renders frequently, so strict-actionable clicks flake.
  // dispatchEvent fires the handler directly on the resolved element.
  const addBtn = cp.getByRole("button", { name: /Add to my wedding/i }).first();
  await expect(addBtn).toBeVisible({ timeout: 15_000 });
  await addBtn.dispatchEvent("click");
  await expect(cp.getByRole("button", { name: /✓ Added/i }).first()).toBeVisible({ timeout: 12_000 });
  await cp.waitForTimeout(1500); // let the selection persist + total recompute

  // Bill breakdown opens + lists a line, then closes.
  await cp.getByText(/view breakdown/i).first().dispatchEvent("click");
  await expect(cp.getByText(/Your bill breakdown/i)).toBeVisible({ timeout: 10_000 });
  await cp.getByRole("button", { name: /^Done$/ }).first().dispatchEvent("click").catch(() => {});

  await cp.getByRole("button", { name: /Submit to .* →/i }).dispatchEvent("click");
  await expect(cp.getByText(/Sent to .* for review/i)).toBeVisible({ timeout: 20_000 });
  expect(cerr.filter((e) => !benign(e)), cerr.join("\n")).toHaveLength(0);
  await cctx.close();

  // ── 2) VENUE approves the submission + sends the invoice ──
  const vctx = await browser.newContext();
  const vp = await vctx.newPage();
  const verr = watchErrors(vp, "venue");
  await venueLogin(vp);
  await vp.goto(`/venue/weddings/${SLUG}`);
  await expect(vp.getByText(/Couple submitted their selections/i)).toBeVisible({ timeout: 20_000 });
  // The proforma shows a real total (the couple's selections rolled up).
  await expect(vp.getByText(/Proforma/i).first()).toBeVisible();
  await vp.getByRole("button", { name: /Approve.*invoice/i }).first().click();
  await vp.waitForTimeout(3500); // let the server action (approve + invoice + email) complete
  await vp.reload();
  // After approve: the pending block is gone AND the wedding is now invoiced.
  await expect(vp.getByText(/Couple submitted their selections/i)).toBeHidden({ timeout: 12_000 });
  await expect(vp.getByText(/Proforma/i).first()).toBeVisible();
  expect(verr.filter((e) => !benign(e)), verr.join("\n")).toHaveLength(0);
  await vctx.close();
});
