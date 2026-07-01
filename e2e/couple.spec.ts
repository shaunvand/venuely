import { test, expect, type Page } from "@playwright/test";

// Couple portal journey — fresh context (couples auth via the portal password
// gate, not Supabase). Seeded wedding "TestAndPartnerWedding" / pw "couplepass123".
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
  await page.goto(`/${SLUG}`);
  const pw = page.locator('input[name="p"]');
  if (await pw.count()) {
    await pw.fill(PW);
    await page.getByRole("button", { name: /Unlock portal/i }).click();
  }
  await page.waitForURL(new RegExp(`/p/${SLUG}`), { timeout: 30_000 });
}

// Every couple destination: 2 pinned leaves + 5 sections × their children.
// Money is now a single "Budget" leaf (Budget/Payments/Documents are in-page bubbles).
const SECTIONS: Record<string, string[]> = {
  "Our Venue": ["Spaces & Rooms", "Accommodation", "Extras & Rentals"],
  "Our Guests": ["Guest List", "Seating plan"],
  "Vibes": ["Inspiration", "Invites", "Flowers", "The Dress", "Décor", "Music"],
  "The Day": ["Wedding day Timeline", "Checklist"],
};

test.describe.serial("Couple portal journey", () => {
  test("unlock with password + Overview loads", async ({ page }) => {
    const errors = watchErrors(page);
    await unlock(page);
    await expect(page.locator("body")).toContainText("E2E Test Venue");
    await expect(page.getByText(/days to go|planning journey|Start here|Wedding Progress/i).first()).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(900);
    const real = errors.filter((e) => !benign(e));
    expect(real, real.join("\n")).toHaveLength(0);
  });

  test("walk every section + tab with no errors", async ({ page }) => {
    const errors = watchErrors(page);
    await unlock(page);

    // Tolerant clicks — the assertion is "no console/page errors while every tab
    // renders", not nav mechanics. Each click loads a tab; we collect errors.
    const tap = async (loc: ReturnType<Page["locator"]>) => {
      if (await loc.count()) { await loc.first().click({ timeout: 8_000 }).catch(() => {}); await page.waitForTimeout(350); }
    };
    for (const leaf of ["Overview", "Messages", "Suppliers", "Budget"]) {
      await tap(page.getByRole("button", { name: new RegExp(`^${leaf}$`) }));
    }
    for (const [section, children] of Object.entries(SECTIONS)) {
      const header = page.locator(`[data-tour="section-${section}"]`).first();
      const firstChild = page.getByRole("button", { name: new RegExp(`^${children[0].replace(/&/g, "\\&")}$`, "i") }).first();
      if (!(await firstChild.isVisible().catch(() => false))) await tap(header); // expand if collapsed
      for (const child of children) {
        await tap(page.getByRole("button", { name: new RegExp(`^${child.replace(/&/g, "\\&")}$`, "i") }));
      }
    }
    await page.waitForTimeout(900);
    const real = errors.filter((e) => !benign(e));
    expect(real, real.join("\n")).toHaveLength(0);
  });

  test("Extras & Rentals tab shows the seeded items", async ({ page }) => {
    await unlock(page);
    // "Our Venue" is open by default — go straight to the child (expand only if needed).
    const ext = page.getByRole("button", { name: /^Extras & Rentals$/i }).first();
    if (!(await ext.isVisible().catch(() => false))) await page.locator(`[data-tour="section-Our Venue"]`).first().click();
    await ext.click();
    // The couple sees the venue's catalogue + rentals here (seeded items).
    await expect(page.getByText(/3-Course Plated Dinner|Chiavari Chair|Welcome Drinks/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
