import { test, expect, type Page } from "@playwright/test";

// Venue-side WRITE actions beyond "add": edit + delete inventory, record a
// payment, save settings, save portal design, set portal password, rotate access.
// Uses the authenticated venue session (storageState). The password/rotate tests
// run LAST because rotating invalidates the couple's "couplepass123" login.
const SLUG = "TestAndPartnerWedding";

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}
const benign = (e: string) => /favicon|analytics|sentry|ResizeObserver|net::ERR_|Failed to load resource|googletagmanager|maps\.google|hydrat/i.test(e);

test.describe.serial("Venue — CRUD + settings actions", () => {
  test("catalogue item lifecycle: add → edit price → delete", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/venue/catalogue");

    // ── add ──
    await page.getByRole("button", { name: /^\+?\s*Add item$/i }).first().click();
    const addBox = page.locator(".fixed.inset-0").filter({ hasText: "Add new item" });
    const addField = (label: string) => addBox.locator(`div:has(> label:has-text("${label}"))`).first();
    const name = `E2E Lifecycle ${Date.now()}`;
    await addField("Category").locator("input").fill("Menu");
    await addField("Name").locator("input").fill(name);
    await addField("Included or Extra").locator("select").selectOption("extra");
    await addField("Price").locator("input").fill("100");
    await page.getByRole("button", { name: /^Add item$/i }).last().click();
    await expect(page.getByText("Add new item")).toBeHidden({ timeout: 10_000 });
    await page.reload();
    const row = page.locator("li").filter({ hasText: name }).first();
    await expect(row).toBeVisible({ timeout: 15_000 });

    // ── edit (change price 100 → 175 via the edit lightbox) ──
    await row.getByRole("button", { name: /^Edit$/ }).click();
    const editBox = page.locator(".fixed.inset-0").filter({ hasText: "Edit item" });
    await expect(editBox).toBeVisible({ timeout: 10_000 });
    const priceInput = editBox.locator(`div:has(> label:has-text("Price"))`).first().locator("input");
    await priceInput.fill("175");
    await editBox.getByRole("button", { name: /^Save$/ }).click();
    await expect(page.getByText("Edit item")).toBeHidden({ timeout: 10_000 });
    await page.reload();
    await expect(page.locator("li").filter({ hasText: name }).first()).toContainText("175", { timeout: 15_000 });

    // ── delete (window.confirm → accept) ──
    page.once("dialog", (d) => d.accept());
    await page.locator("li").filter({ hasText: name }).first().getByRole("button", { name: /^Remove$/ }).click();
    await expect(page.locator("li").filter({ hasText: name })).toHaveCount(0, { timeout: 12_000 });

    const real = errors.filter((e) => !benign(e));
    expect(real, real.join("\n")).toHaveLength(0);
  });

  test("record a payment on a wedding", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`/venue/weddings/${SLUG}`);
    const ref = `E2Eref${Date.now()}`;
    await page.locator('input[name="paid_at"]').fill("2026-07-01");
    await page.getByPlaceholder("EFT / Card / Yoco").fill("EFT");
    await page.getByPlaceholder("Reference").fill(ref);
    await page.locator('input[name="amount"]').fill("1500");
    await page.getByRole("button", { name: /\+ Add payment/i }).click();
    // The new payment row surfaces with its method + reference (server revalidates).
    const ledgerRow = page.locator("tr").filter({ hasText: "EFT" }).filter({ hasText: ref });
    await expect(ledgerRow).toBeVisible({ timeout: 15_000 });
    const real = errors.filter((e) => !benign(e));
    expect(real, real.join("\n")).toHaveLength(0);
  });

  test("save venue settings", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/venue/settings");
    // Edit a non-identifying field (keep the venue name so other tests' selectors hold).
    const desc = page.locator('textarea[name="description"]');
    await desc.fill(`E2E settings save ${Date.now()}`);
    await page.getByRole("button", { name: /^Save changes$/ }).first().click();
    // updateVenue redirects to ?ok=1 → green "Saved." banner.
    await expect(page).toHaveURL(/ok=1/, { timeout: 15_000 });
    await expect(page.getByText(/Saved\.?/i).first()).toBeVisible({ timeout: 10_000 });
    const real = errors.filter((e) => !benign(e));
    expect(real, real.join("\n")).toHaveLength(0);
  });

  test("save portal design", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/venue/your-venue");
    await page.getByRole("button", { name: /^Save design$/ }).first().click();
    await expect(page.getByText(/Design saved|Saved ✓/i).first()).toBeVisible({ timeout: 15_000 });
    const real = errors.filter((e) => !benign(e));
    expect(real, real.join("\n")).toHaveLength(0);
  });

  // ── password/rotate LAST: these change the couple's access credential ──
  test("set portal password (restores couplepass123)", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`/venue/weddings/${SLUG}`);
    await page.getByRole("button", { name: /Set a password|Change password/i }).first().click();
    await page.getByPlaceholder("New password").fill("couplepass123");
    await page.getByRole("button", { name: /^Save$/ }).first().click();
    await expect(page.getByText(/password protected/i).first()).toBeVisible({ timeout: 15_000 });
    const real = errors.filter((e) => !benign(e));
    expect(real, real.join("\n")).toHaveLength(0);
  });

  test("rotate access code", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`/venue/weddings/${SLUG}`);
    const rotate = page.getByRole("button", { name: /Rotate access code/i }).first();
    await expect(rotate).toBeVisible({ timeout: 12_000 });
    await rotate.click();
    await page.waitForTimeout(2500); // server action runs + revalidates
    const real = errors.filter((e) => !benign(e));
    expect(real, real.join("\n")).toHaveLength(0);
  });
});
