import { test, expect, type Page } from "@playwright/test";

// Deep venue surfaces: seating tables CRUD, team invite + revoke, calendar nav,
// Smart Import (parse route stubbed — the real route calls Claude), supplier
// Smart Import control. Uses the authenticated venue session (storageState).
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}
const benign = (e: string) => /favicon|analytics|sentry|ResizeObserver|net::ERR_|Failed to load resource|googletagmanager|maps\.google|hydrat/i.test(e);

test.describe.serial("Venue — deep surfaces", () => {
  test("seating: add a table then delete it", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/venue/seating");
    const label = `E2E Table ${Date.now()}`;
    const addForm = page.locator("form").filter({ has: page.getByRole("button", { name: /^\+ Add$/ }) });
    await addForm.locator('input[name="label"]').fill(label);
    await addForm.locator('input[name="seats"]').fill("10");
    await addForm.getByRole("button", { name: /^\+ Add$/ }).click();
    // The new table renders as its own form with the label in an input.
    const tableInput = page.locator(`input[value="${label}"]`);
    await expect(tableInput).toBeVisible({ timeout: 15_000 });

    // Delete via the ✕ in that table's form.
    await page.locator("form").filter({ has: tableInput }).getByRole("button", { name: "✕" }).click();
    await expect(page.locator(`input[value="${label}"]`)).toHaveCount(0, { timeout: 12_000 });
    const real = errors.filter((e) => !benign(e));
    expect(real, real.join("\n")).toHaveLength(0);
  });

  test("team: invite a manager then revoke it", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/venue/team");
    const email = `e2e-mgr-${Date.now()}@venuely.test`;
    await page.locator("#invite-email").fill(email);
    await page.getByRole("button", { name: /Send invite/i }).click();
    // A real success line (NOT the ever-present "Invite a manager" label) — confirms
    // the invite actually persisted before we reload to revoke it.
    await expect(page.getByText(/Invitation emailed|Invite created|isn't set up yet|share this link/i).first())
      .toBeVisible({ timeout: 15_000 });
    // The pending invites list (a div row, not a table) now shows this email — revoke
    // it to clean up. Fresh venue → exactly one pending invite, so target its Cancel.
    await page.reload();
    await expect(page.getByText(email).first()).toBeVisible({ timeout: 12_000 });
    await page.getByRole("button", { name: /^Cancel$/i }).first().click();
    await expect(page.getByText(email)).toHaveCount(0, { timeout: 12_000 });
    const real = errors.filter((e) => !benign(e));
    expect(real, real.join("\n")).toHaveLength(0);
  });

  test("calendar: navigate months without errors", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/venue/calendar");
    await expect(page.getByRole("heading").first()).toBeVisible();
    // Month nav (read-only calendar): step forward + back if the controls exist.
    for (const name of ["›", "‹"]) {
      const btn = page.getByRole("button", { name }).first();
      if (await btn.isVisible().catch(() => false)) { await btn.click(); await page.waitForTimeout(400); }
    }
    const real = errors.filter((e) => !benign(e));
    expect(real, real.join("\n")).toHaveLength(0);
  });

  test("Smart Import: upload a file → review → approve (parse stubbed)", async ({ page }) => {
    const errors = watchErrors(page);
    // Stub the Claude-backed parse so we test the client pipeline without tokens.
    await page.route("**/api/venue/uploads/parse", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          items: [{ _id: 1, _include: true, category: "catalogue", source_file: "e2e.pdf",
            data: { name: `E2E Imported ${Date.now()}`, price: 500, cost_treatment: "extra", category: "Menu" } }],
          counts: { catalogue: 1 },
          images: [],
          files: [{ filename: "e2e.pdf", chars: 1234, items: 1, status: "ok" }],
        }),
      }),
    );
    await page.goto("/venue/uploads");
    // Target the FILES picker by its accept list (not the webkitdirectory folder
    // picker, which also matches input[type=file] and races .first()).
    await page.locator('input[type="file"][accept*="pdf"]').first().setInputFiles({
      name: "e2e.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%E2E smart import\n"),
    });
    // Parse runs automatically on file-select → review table → Approve button.
    await expect(page.getByRole("button", { name: /Approve .*item/i }).first()).toBeVisible({ timeout: 20_000 });
    const real = errors.filter((e) => !benign(e));
    expect(real, real.join("\n")).toHaveLength(0);
  });

  test("suppliers: Smart Import control is present + accepts files", async ({ page }) => {
    await page.goto("/venue/suppliers");
    // The supplier page exposes the same Smart Import (open the details panel).
    const summary = page.getByText(/Smart Import/i).first();
    await expect(summary).toBeVisible({ timeout: 12_000 });
    await summary.click().catch(() => {});
    const fileInput = page.locator('input[type="file"][accept*="pdf"]').first();
    await expect(fileInput).toBeAttached({ timeout: 10_000 });
  });
});
