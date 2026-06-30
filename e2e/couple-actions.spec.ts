import { test, expect, type Page, type Locator } from "@playwright/test";

// Couple-side WRITE actions: guest add + RSVP, supplier messaging, document
// upload, included-item toggle. Couples auth via the portal password gate.
// Seeded wedding "TestAndPartnerWedding" / pw "couplepass123" + one seeded
// recommended vendor "E2E Photography" (so a message thread can be started).
const SLUG = "TestAndPartnerWedding";
const PW = "couplepass123";

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}
const benign = (e: string) => /favicon|analytics|ResizeObserver|net::ERR_|Failed to load resource|googletagmanager|maps\.google|hydrat|preload/i.test(e);

async function unlock(page: Page) {
  // First visit auto-opens the 9-step PortalTour (modal blocks the content pane).
  // Pre-seed its "seen" flag so it never opens — must run before any navigation.
  await page.addInitScript((slug) => {
    try { localStorage.setItem(`venuely_tour_v1_${slug}`, "1"); } catch { /* ignore */ }
  }, SLUG);
  await page.goto(`/${SLUG}`);
  const pw = page.locator('input[name="p"]');
  if (await pw.count()) { await pw.fill(PW); await page.getByRole("button", { name: /Unlock portal/i }).click(); }
  await page.waitForURL(new RegExp(`/p/${SLUG}`), { timeout: 30_000 });
  // Belt-and-braces: if a tour modal still slipped in, skip it.
  const skip = page.getByRole("button", { name: /Skip tour/i }).first();
  if (await skip.isVisible({ timeout: 2_000 }).catch(() => false)) { await skip.click().catch(() => {}); }
}

// Open a section (if collapsed) then click a child leaf. The portal re-renders, so
// dispatchEvent is the reliable way to fire the handler on the resolved element.
async function goLeaf(page: Page, section: string, leaf: string) {
  const child = page.getByRole("button", { name: new RegExp(`^${leaf.replace(/&/g, "\\&")}$`, "i") }).first();
  if (!(await child.isVisible().catch(() => false))) {
    await page.locator(`[data-tour="section-${section}"]`).first().click({ timeout: 8_000 }).catch(() => {});
    await page.waitForTimeout(300);
  }
  await child.click({ timeout: 8_000 }).catch(() => {});
  await page.waitForTimeout(500);
}

test.describe.serial("Couple portal — write actions", () => {
  test("add a guest + set RSVP to attending", async ({ page }) => {
    const errors = watchErrors(page);
    await unlock(page);
    await goLeaf(page, "Our Guests", "Guest List");

    const name = `E2E Guest ${Date.now()}`;
    await page.getByPlaceholder("Full name").first().fill(name);
    await page.getByRole("button", { name: /^\+\s*Add$/ }).first().click();
    // The new guest row's name renders in an editable input (React defaultValue
    // sets the HTML value attribute) — match by that, not text.
    const nameInput = page.locator(`input[value="${name}"]`);
    await expect(nameInput).toBeVisible({ timeout: 12_000 });

    // Set that guest's RSVP — the select sits in the same row as the name input.
    const row = page.locator("div").filter({ has: nameInput }).last();
    await row.locator("select").first().selectOption("attending");
    await page.waitForTimeout(800); // onChange PATCH persists

    // Reload + confirm both the guest and its RSVP stuck.
    await page.reload();
    await goLeaf(page, "Our Guests", "Guest List");
    const persisted = page.locator(`input[value="${name}"]`);
    await expect(persisted).toBeVisible({ timeout: 12_000 });
    await expect(page.locator("div").filter({ has: persisted }).last().locator("select").first()).toHaveValue("attending");
    const real = errors.filter((e) => !benign(e));
    expect(real, real.join("\n")).toHaveLength(0);
  });

  test("message a recommended supplier", async ({ page }) => {
    const errors = watchErrors(page);
    await unlock(page);
    // Suppliers is now its own top-level tab.
    await page.getByRole("button", { name: /^Suppliers$/ }).first().click();
    await page.waitForTimeout(500);

    // The seeded vendor card carries a "💬 Message supplier" button.
    const msgBtn = page.getByRole("button", { name: /Message supplier/i }).first();
    await expect(msgBtn).toBeVisible({ timeout: 12_000 });
    await msgBtn.dispatchEvent("click");

    // CouplePortal switches to Messages with the composer focused on this vendor.
    const composer = page.getByPlaceholder(/^Message .+…$/).first();
    await expect(composer).toBeVisible({ timeout: 12_000 });
    // NB: no digits — the server redacts anything that looks like a phone number,
    // so a timestamp in the body would be replaced with "[hidden]".
    const text = "Hi, are you available for our wedding day?";
    await composer.fill(text);
    // Send via the paper-plane button (aria-label) — fall back to Enter.
    const send = page.getByRole("button", { name: /Send message/i }).first();
    if (await send.isEnabled().catch(() => false)) await send.dispatchEvent("click");
    else await composer.press("Enter");

    // The sent bubble shows the message text (body isn't redacted here).
    await expect(page.getByText(/are you available for our wedding/i).first()).toBeVisible({ timeout: 12_000 });
    const real = errors.filter((e) => !benign(e));
    expect(real, real.join("\n")).toHaveLength(0);
  });

  test("upload a payment document", async ({ page }) => {
    const errors = watchErrors(page);
    await unlock(page);
    // Documents is now an in-page gate-bubble under the Budget tab.
    await page.getByRole("button", { name: /^Budget$/ }).first().click();
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: /^Documents$/ }).first().click();
    await page.waitForTimeout(400);

    // The visible "Upload a document" button proxies a hidden file input.
    await expect(page.getByText(/Upload a document/i).first()).toBeVisible({ timeout: 12_000 });
    const fileInput = page.locator('input[type="file"]').first();
    const fname = `e2e-contract-${Date.now()}.pdf`;
    await fileInput.setInputFiles({ name: fname, mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%E2E test document\n") });

    // The uploaded doc appears in the list (filename is the default label) with an Open link.
    await expect(page.getByText(fname, { exact: false }).first()).toBeVisible({ timeout: 20_000 });
    const real = errors.filter((e) => !benign(e));
    expect(real, real.join("\n")).toHaveLength(0);
  });

  test("toggle an included item on", async ({ page }) => {
    await unlock(page);
    await goLeaf(page, "Our Venue", "Extras & Rentals");
    // An "included" item shows "+ Include"; clicking flips it to "✓ Included".
    const inc = page.getByRole("button", { name: /^\+\s*Include$/i }).first();
    if (await inc.isVisible().catch(() => false)) {
      await inc.dispatchEvent("click");
      await expect(page.getByRole("button", { name: /✓ Included/i }).first()).toBeVisible({ timeout: 10_000 });
    } else {
      // No included-type item on this tab — assert the paid toggle exists instead.
      await expect(page.getByRole("button", { name: /Add to my wedding|✓ Added/i }).first()).toBeVisible({ timeout: 10_000 });
    }
  });
});
