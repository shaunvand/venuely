# Venuely — Whole-System Audit (2026-06, go-to-market)

5 parallel read-only audits: venue dashboard, couple journey + onboarding, billing/payments, API security + email, DB schema/migrations. **Overall: the system is in good shape** — no critical auth holes, schema is clean, money math is sound at the core. Bugs were concentrated in (a) three hand-rolled copies of the billing quantity math diverging, and (b) the recurring `position:fixed`-in-a-transform modal trap.

## ✅ FIXED & DEPLOYED

**Batch 1 (932ddea)**
- **Deposit re-charge of a fully-paid couple** — `paystack/checkout/route.ts`: `Math.min(deposit, balance_due || deposit)` re-charged the full deposit when balance was 0. Now `Math.min(deposit, balance_due)`. *(real money)*
- **Venue proforma divergence** — `venue/weddings/[slug]/page.tsx` multiplied EVERY catalogue item by the estimate guest count (R2,000 flat → R300,000). Now uses `catalogueQuantity` (price_unit + thresholds) + confirmed-RSVP heads, identical to `charges.ts` → proforma == invoice == couple total.
- **Couple "Catering" progress driven by rentals** — `CoupleOverview`: `cateringDone = rentReserved>0`. Now derived from catalogue selections (catalogue passed in).
- **Wizard "preview" opened the dead legacy portal** — `onboarding/wizard/page.tsx` → now `/${slug}` (real portal).
- **WelcomeImportModal transform trap** — portalled to `document.body` (was rendering below the fold on first login).
- **"1 January 1970"** on date-TBD recent weddings — null-guarded.

**Batch 2 — security hardening (b3b5b78)**
- **Public-bucket MIME allowlist** — gallery + wedding-document upload now derive extension from a validated MIME allowlist (svg/html rejected → no stored-XSS).
- **wedding-document DELETE** now verifies venue membership (404/403, not a silent RLS no-op).
- **yoco webhook** `JSON.parse` guarded (malformed body → 400, not 500).

## 🔧 REMAINING BUGS (recommend fixing next — safe, scoped)
- **Couple bill-breakdown modal** (`CouplePortal.tsx` ~903) still uses the *estimate* guest count and omits accommodation nights, so itemized lines don't sum to the headline once RSVPs exist. Fix: pass confirmed-RSVP heads + show `× nights`. (billing M2/M3)
- **WeddingRowActions ⋯ menu clipped** (`WeddingRowActions.tsx:122` inside `WeddingsTable` `overflow-x-auto`) → delete / mark-paid unreachable on bottom rows. Fix: portal the menu.
- **Accommodation tab double guest editor** (`CouplePortal.tsx` ~751) — `GuestManager` + `RoomAllocator` both fetch guests, desync live. Fix: show only `RoomAllocator` here.
- **SpacesSection toggle** (`SpacesSection.tsx:60`) has no failure rollback — a failed save leaves a paid space looking selected.
- **Latent fixed-modal fragility** — InventoryManager/AreaManager/VendorPartnersManager modals aren't portalled (work today only because their pages lack a transformed ancestor). Recommend a shared portalled `<Modal>` primitive to kill the whole class.
- Minor security: smart-import `fetch` should use `safeFetch` (SSRF); enquiry/review endpoints want rate-limiting/captcha before launch; timing-safe compares on cron secret + portal password.
- Minor billing: platform fee taxes the refundable breakage deposit; Paystack refunds don't mirror to the wedding ledger; RSVP "attending" defined two ways (regex vs exact).

## 🧭 STRATEGIC SIMPLIFICATIONS (product decisions — need sign-off)
These shorten the customer journey for GTM but change UX, so they're recommendations, not auto-applied:
1. **Collapse the venue welcome stack** — a new venue meets VenuelyOpener + WelcomeCover + DashboardWelcomeModal + WelcomeImportModal + setup-checklist + sidebar pulses in one session. Pick ONE primary path.
2. **Unify the 3 import surfaces** (`/venue/uploads`, embedded BulkUploader on rentals/suppliers, InventoryManager Excel lightbox) into one named "Smart Import".
3. **Flatten the inventory model** — Catalogue/Rentals/Areas/Seating/Accommodation/Suppliers are 6 near-identical card UIs with included-vs-extra encoded 3 ways. One "Inventory" hub + one included/extra concept.
4. **Consolidate money surfaces** — Payments / Payouts & fees / per-wedding proforma / "Payment setup" → one money area (mirrors the couple-side Budget+Payments+Documents merge).
5. **One "Share portal" panel + one canonical URL** — link/password/rotate are spread across 4 places and the URL is shown 3 ways (`/p/{slug}`, `/{slug}`, `portal/{slug}`).
6. **Couple side:** make the "Start here / Step N of 5" engine the spine; de-emphasise the duplicate Wedding-Progress chips + donut cards; fold Flowers/Dress/Décor/Music/Contacts under one "Wishlists" (or reveal nearer the day); present onboarding as 3 steps (Import → Spaces → Go live) with Basics as a pre-step and the AI calls behind explicit clicks.

## Verified healthy (no action)
Auth/RLS tenant isolation (every service-role route gated + RLS-backstopped), Paystack signature + idempotency + cents math, inbound-email Svix verification + redaction, email recipient scoping (no broadcast/wrong-recipient path), schema (all 49 code tables exist live; the one drift — `wedding_documents.file_path` — already fixed by migration `20260624090000`).
