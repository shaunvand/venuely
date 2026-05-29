# Venuely — System Review & Redesign Blueprint
*2026-05-29 · grounded in a full 8-subsystem code audit + 4 design tracks · benchmarks: LekkeSlaap, Airbnb host, HoneyBook, Perfect Venue*

---

## Bottom line

Venuely has **unusually strong plumbing wired to a single hardcoded tenant, with no top-of-funnel and no money collection.**

The hard parts are already built and good: an AI multi-file Smart Import, a commission/markup engine (`applyMarkup`/`computeTotals`), a clean RLS multi-tenant spine, Google-Places address picker, Yoco webhook HMAC verification, a 10-tab couple portal. But:

- The couple portal is **hardcoded to Pat Busch** and a second venue's couples would literally see "Heather & Shaun / Pat Busch / 7 Jan 2027" — *the #1 blocker to selling to anyone else.* (verified in `public/wedding-portal/app.js:8-19`)
- There is **no public venue listing** — the whole app is behind `/signup`, so a couple searching for a venue can never find one. LekkeSlaap's entire product is exactly that marketplace.
- There is **no way to invite/deliver a portal to a couple**, and no per-couple identity (`wedding_members` is never written).
- The **pricing model contradicts itself and collects R0**: the site sells "1% of spend, no monthly fee" while the code provisions a R1499/mo trial that never actually charges and is never enforced. (verified in `onboarding/setup-venue/actions.ts:65-66`)
- **Smart Import silently loses the exact files owners have** (image-only PDFs, Word docs), writes straight to live inventory with no preview/undo/dedupe, and never captures commission.

So the work is **not** polishing CRUD. It's: (1) make the existing plumbing multi-tenant, (2) add the missing funnel-top (listing + enquiry) and money rail (commission), (3) make import never lose data. Everything below is sequenced so each phase unblocks the next.

Repo root for all paths: `C:\Users\shaun\Documents\Claude\Projects\PatBusch-Portal\app\`

---

## 1. How it works today (the review)

**There is no server to manage.** Venuely runs on managed services: GitHub (source) → Render (auto-deploy on push to `master`) → Supabase (Postgres + Auth + RLS + Storage). Payments scaffolded on Yoco. AI parsing via the Anthropic SDK; file parsing via `xlsx` + `unpdf`/`pdf-parse` + `@napi-rs/canvas` + `jszip`. Three roles: `owner` (you), `venue_admin` (the paying venue owners), `couple`.

**The owner's journey today:**
1. Land on `venuely.co.za` → click "Get Started" → 3-field signup (name, work email, password).
2. Confirm email (a static dead-end page — no resend, no auto-advance).
3. `/dashboard` routes a 0-venue `venue_admin` to `/onboarding/setup-venue` — a single form with an optional "paste your website" import and a Google address picker.
4. Land on `/venue`; a `WelcomeImportModal` immediately nags them to import *again* (this time files).
5. Manage inventory across separate Catalogue / Rentals / Accommodation / Areas / Marketplace screens.
6. Create a wedding at `/venue/weddings`; copy the portal URL by hand and send it to the couple themselves.

**What's genuinely good:** the `/dashboard` smart-router; the URL-import "we'll fill it in for you" move; live slug-availability with suggestions; the address picker hiding all GIS complexity; the schema-driven `InventoryManager` powering all 10 inventory types from one component; commission baked end-to-end through `applyMarkup`; per-file Smart Import transparency; Unsplash licence-correct image fallback; download templates; a clean RLS tenancy spine.

---

## 2. The five things blocking "simple & effortless"

Ranked by impact. ✅ = personally verified against code.

1. **✅ The couple portal is single-tenant.** `public/wedding-portal/app.js:8-19` opens with `// WHITE-LABEL CONFIG — swap these values for each venue` and a literal `VENUE` const (Pat Busch, Heather & Shaun, 7 Jan 2027, `info@patbusch.co.za`) plus an F-code→image map and default suppliers/checklist. `app/[wedding]/route.ts` *already injects* the correct `window.WEDDING_*`/`VENUE_*` globals and live marked-up inventory — `app.js` just ignores them. Only the Accommodation tab was migrated to a live React island. **Until this is fixed, nothing a new owner imports reaches a couple.**

2. **No funnel-top.** Zero public listing routes exist (`/venues`, `/v/[slug]` — none). The app is entirely behind `/signup`. A couple cannot discover a venue. No enquiry/lead/"request a quote" path exists either. The funnel has no top.

3. **No couple delivery + no per-couple identity.** Owner copies the URL by hand; the password is conveyed out-of-band; the lock screen says "your access code was in your booking confirmation email" — an email the app never sends. `wedding_members` + the `is_wedding_member`/`can_access_wedding` RLS helpers exist but **no code ever writes a membership row**, so "per-couple sub-links" don't exist — it's one shared password per wedding.

4. **✅ Money is contradictory and collects R0.** Site + `/admin/billing` say "1%, no monthly fee"; `admin/billing/actions.ts` hardcodes `MONTHLY_R=1499` as a *one-time* Yoco checkout (not recurring, never called); `onboarding/setup-venue/actions.ts:65-66` provisions a 14-day trial toward that flat fee; `trial_ends_at` is never read; the 1% fee is a manual honour-system tally (timestamps only, no money moves).

5. **Smart Import loses real files & has no safety net.** Image-only/scanned PDFs (the common designed rate card) yield **zero** inventory — though the rasterise+vision path already exists for galleries. DOCX silently decodes as garbage (no parser). Website import reads the homepage only. Commit is all-or-nothing (says "nothing saved" when some saved). Parsed rows write straight to live inventory with no preview/dedupe/undo (`item_code` column exists but is unused as a key, so re-import duplicates). Commission is never extracted.

**Plus P0 security holes** (must close before a 2nd real venue): storage RLS lets any logged-in user delete *any* venue's media; `media_assets`/`area_pricing` are public-read `using(true)`; `/api/venue/inventory/image` trusts a client-supplied `venue_id`; portal password arrives via `GET ?p=` (lands in logs) with a fixed salt and no throttle; a SQL precedence bug in the Pat Busch seed mis-tags other tenants' rooms.

---

## 3. Redesigned owner flow — import-first, LekkeSlaap/Airbnb-grade

**North star:** a non-technical owner drops their existing mess of files (or one website URL) into a single guided wizard and, with confirm-only tapping, ends with a fully-populated, couple-ready venue.

**Principles:** import is the *spine* (one source fans out to profile + gallery + catalogue + rentals + accommodation + vendors + areas); confirm-don't-type; nothing touches live inventory until "commit" (staging + undo); no dead-ends, save-as-you-go; re-import is idempotent (upsert on `item_code`); never silently drop a file; show "this is what couples will see"; reuse before rebuild.

**The wizard ("Venuely Setup")** — replaces the lone setup form + the re-nagging modal:
- **Step 0 — Resumable shell:** "Set up [Venue] — about 10 minutes", left-rail progress, "Save & finish later". Creates a stub venue on first save so the owner is never trapped.
- **Step 1 — Basics:** name + live slug, Google address pin, contact, **a new "About your venue" box** (today the scraped description is thrown away), **venue facts** (capacity, indoor/outdoor, ceremony types, amenities), **logo upload** (reuse the gallery uploader — today it's paste-a-URL only). Same field component reused in Settings to kill double-entry.
- **Step 2 — Source Tray (the one import surface):** one drop-zone, four tabs that all feed one review — (a) drop mixed files, (b) one master workbook, (c) paste your website URL, (d) paste from your Google/LekkeSlaap listing.
- **Step 3 — Review once:** all detected items grouped by destination, every pricing-critical field editable (Included/Extra, commission, price unit, stock — today hidden), duplicates flagged "already have this — update or skip".
- **Step 4 — Commit:** transactional, deduped, "Catalogue 24 added, Rentals 30 (3 updated)…", with a 10-minute **Undo**.
- **Step 5 — Your spaces:** detected areas as editable rows (not one-at-a-time with Pat Busch's 2500/2000/2000 baked in).
- **Step 6 — Review & go live:** a live "what couples see" preview + a completeness checklist.

### File-type matrix

| Source | Today | Fix (reuses) |
|---|---|---|
| Text PDF | works | keep; surface `stop_reason` so truncated long lists warn instead of dropping the tail |
| **Image-only / scanned PDF** | **broken (0 items)** | on `chars<50`, call `extractPdfImages()` → send page PNGs to Claude **vision** with the same `CATEGORY_GUIDE`/`FIELDS_SCHEMA` (the exact pattern already proven in `gallery/smart-import`) |
| XLSX/XLS | works | match embedded photos to items by the **parsed sheet+row anchor** (already computed, then thrown away) instead of a positional counter |
| CSV/TXT | works | add master-workbook fan-out across destinations |
| **DOCX** | **broken (garbage)** | add a docx branch to `extractFile` using the **already-installed `jszip`** (read `word/document.xml`, strip tags). `.doc` → explicit "save as .docx/PDF" |
| Loose photos | missing | route to the gallery vision tagger (auto-categorise by location) |
| ZIP | missing | `jszip`-expand and dispatch each entry to its extractor |
| **Website URL** | **homepage-only** | bounded 1-level same-origin crawl (3-5 pages matching `rates\|accommodation\|menu\|stay`); capture the description it already scrapes |
| Google/LekkeSlaap listing | missing | v1: treat as a website source; v2: Google Places photos/hours |

**New plumbing:** `import_jobs` + `import_rows` staging tables; `import_job_id` stamped on every committed row (powers Undo); unique `(venue_id, item_code)` for upsert dedupe.

---

## 4. Commission & revenue — the overlooked money model

**North star:** the couple pays once, the venue is paid the next business day minus a small transparent fee, and the founder's revenue is collected automatically and reconciled to money that actually moved.

**Recommendation: commit to ONE model — 1% of money transacted through the platform, no monthly fee — and make it real via Paystack Subaccounts.**

Why: it matches the live-site promise and LekkeSlaap's spirit (no monthly, earn a % of bookings, one login). 1% of a R200k wedding ≈ R2,000 — comparable to the old R1499/mo target but with far better optics and a "we win when you win" alignment that fits the "revenue protection" positioning. Drop R1499/mo: it contradicts the site, is 3-6× local comparables, only ever charged once anyway (the Yoco "subscription" is a one-time checkout), and is the wrong incentive.

**The rail is already chosen by your own research** (`docs/venuely-payments-comparison.md`, `venuely-realtime-split-research.md`): **Paystack Subaccounts** — couple pays full, T+1 settled split, platform fee off the top, venue gets the rest. Yoco has no split (waitlisted); PayShap's R50k cap kills R200k weddings; DebiCheck-via-Stitch is the FICA-light fallback.

**What's a code bug vs a business decision:**
- *Code bugs (just fix):* Yoco "subscription" charges once; `trial_ends_at` never enforced; MRR hardcoded R0 (`admin/page.tsx:32`); `markInvoiced` trusts a client-bound total instead of recomputing; webhook has no idempotency/audit row.
- *Business decisions (you choose — see §8):* the headline %, the fee base, who bears the fee (couple-visible vs venue-absorbed), any once-off activation fee, Pat Busch's pilot rate.

**Build:** delete the R1499 path; reconcile copy; add an append-only `platform_payments` audit table + idempotent webhook; a one-screen Paystack bank-verify onboarding (live name-resolve, modelled on the address picker); couple deposit/balance split-checkout reconciled against `payment_ledger`; **capture commission at import** so the markup is actually set (today left at 0); a real founder revenue dashboard.

**Overlooked extra revenue:** the `vendor_partners` marketplace currently earns the platform nothing — add **featured/paid vendor listings**, a **referral cut** on vendor bookings, and **lead fees**, all billed through the same split rail.

---

## 5. Couples portal integration + sub-links

**North star:** the moment the owner clicks "Send portal to couple", the couple gets a one-tap WhatsApp/email link to a fully-branded portal showing THEIR names, THEIR date, and THIS venue's real catalogue/rooms/areas/"Our Venue" story — zero Pat Busch text, zero copy-paste for the owner.

**Approach (wire, don't rewrite):**
- **Make it multi-tenant (the keystone):** `route.ts` already injects the globals — `Object.assign` them into the `VENUE` const in `app.js` (~30 lines) so header/title/lock-screen/countdown render the real couple+venue; make the "Our Venue" tab read injected `about`/`directions`/`included`/`areas`/`gallery`; drop the F-code image map + default seeds. A full React rewrite of a working 4000-line portal is exactly the over-engineering to avoid.
- **Venue profile = portal content:** add `venues.about/directions/map_url/website/included_items`; completing the wizard profile (§3) instantly enriches every couple portal. (Pre-fill `about` from the description Smart Import already scrapes and discards.)
- **One source of truth:** declare `weddings.wedding_state` (the JSON blob couples actually edit) canonical; repoint the owner-dashboard counts (today reading the empty relational tables) at it; retire the dead `/portal/[venue]/[wedding]` relational tree.
- **Send portal to couple:** a `sendPortalInvite` action — capture couple email/WhatsApp, auto-generate the password or a magic-link, email via the existing Resend client, return a `wa.me` link + QR. Closes the gap the lock screen pretends doesn't exist.
- **Per-couple identity:** the magic-link writes `wedding_members` on `/auth/callback`, activating the dormant `can_access_wedding` RLS — real per-person access that can be revoked without locking out the partner.
- **Sub-links:** per-couple link lifecycle (rotate/revoke/expiry/access log) **and per-guest RSVP sub-links** at `/[wedding]/rsvp` (the slug router already accepts arbitrary slugs) writing into `wedding_state.guests` — surfaced as "Get RSVP link" + QR in the Guest List tab.

---

## 6. Overlooked features (vs LekkeSlaap / Airbnb / HoneyBook / Perfect Venue)

- **Public SEO venue listing / discovery microsite** — LekkeSlaap's core; Venuely has none. `/venues` (filter by region/capacity/style) + `/v/[slug]` (hero gallery, about, areas, map, "Request a quote" CTA). The top of the funnel that makes everything else matter.
- **Inbound enquiry capture + lightweight CRM** — no "request a quote" path or lead table exists. An `enquiries` table + public form (reuse Resend) + a `/venue/enquiries` pipeline whose "Convert to booked" *creates the portal* — wiring search → enquiry → portal end-to-end.
- **Availability & booking calendar** — `rental_holds`/`accommodation_bookings` tables exist but no UI reads/writes them, so double-booking is structurally possible. Owner calendar + couple stock guards make "inventory" actually protect something.
- **Quotes/proposals + deposit/payment-schedule editor** — `payment_rules` (VAT/deposit%/balance-days/breakage) has no editor UI (Codex deferred #4). Add a billing-settings card + a shareable quote derived from the existing proforma engine. E-sign contracts as a P2 extension.
- **Missing couple tabs** your own pack-audit flagged: Floor Plans, Rooming List, Layout Planner.
- **Reviews/testimonials** (LekkeSlaap leads with these); **team seats** (`venue_members` only ever holds one user); **notifications lifecycle** (only a manual WhatsApp link today); **real analytics** (MRR is R0); **POPIA** consent/retention for couple data.

---

## 7. Unified roadmap (sequenced by unblock-count)

- **Phase 0 — Ship-blockers (before Pat Busch).** Close the 4 cross-tenant security holes + the seed precedence bug; you decide the pricing model and code picks ONE (delete the other), enforce `trial_ends_at`. *Effort: M.*
- **Phase 1 — Keystone: one data-driven, multi-tenant couple portal.** Wire the injected globals into `app.js`; make Our-Venue + catalogue/rentals read live inventory; retire the divergent relational portal. Bundle the S inventory edit-bug fixes so portal prices are correct. *Effort: L. Unblocks the entire multi-venue thesis.*
- **Phase 2 — Build the funnel top.** Public `/venues` + `/v/[slug]` listing; enquiry table + public form + pipeline; "Send portal to couple" invite (+ `wedding_members`). Fold in venue-profile completeness (description/facts/logo/editable areas). *Effort: L.*
- **Phase 3 — Make money real.** Paystack Subaccounts split + trial paywall + real fee collection; activate the availability calendar; payment-rules UI + shareable quote. *Effort: L.*
- **Phase 4 — Harden the moat.** Smart Import data-loss fixes (image-PDF vision, DOCX, truncation, partial-commit report, dedupe/staging); the guided wizard + live resend/auto-advance check-email. *Effort: M.*
- **Phase 5 — Table-stakes.** Floor Plans/Rooming List/Layout Planner; notification lifecycle; reviews; team seats; analytics; POPIA. *Effort: L.*

---

## 8. Quick wins I can ship now (high-leverage, low-effort, build on existing code)

Each is a small, contained change:

1. **Multi-tenant portal (~15-30 lines).** `Object.assign` the injected globals into the `VENUE` const in `…\app\public\wedding-portal\app.js` (around `init()` 1947-1951). Instantly stops every couple seeing "Heather & Shaun / Pat Busch". *The single highest-leverage change in the codebase.*
2. **Fix silent edit-save bug.** Add `cost_treatment` (+ commission) to the `.select()` in `…\app\app\venue\accommodation\page.tsx` and `…\app\app\venue\catalogue\page.tsx`. One line each; today editing any room/catalogue item silently does nothing.
3. **Surface rich accommodation fields.** Add `tier/max_sleeps/ideal_sleeps/bridal_suite/amenities/floor_plan_url` to `INVENTORY_FIELDS.accommodation` in `…\app\lib\inventory\schemas.ts` (the form renders dynamically — no component change). Closes Codex #1.
4. **Capture the discarded description.** Add `venues.description`, write `Imported.description` (scraped then thrown away in `SetupVenueForm.tsx:11`), render in onboarding + settings.
5. **Logo upload.** Swap the paste-a-URL inputs for the existing `/api/venue/gallery` uploader (`YourVenueManager.upload`).
6. **DOCX import.** Add a docx branch to `…\app\app\api\venue\uploads\parse\route.ts` `extractFile` using the already-installed `jszip`.
7. **Image-only-PDF vision fallback** in the same file (reuse `extractPdfImages` + the gallery vision call).
8. **Transactional commit + "what saved" report** in `…\app\app\api\venue\uploads\commit\route.ts` (stop the "nothing saved" lie).
9. **Live check-email page.** Add `supabase.auth.resend` + `onAuthStateChange` auto-advance to `…\app\app\signup\check-email\page.tsx`.
10. **Patch cross-tenant media queries.** Add `.eq('venue_id', access.wedding.venue_id)` to the `media_assets` queries in the accommodation route + booking page.
11. **Real MRR.** Wire `admin/page.tsx:32` to the platform-fee aggregation already computed in `admin/billing/page.tsx`.
12. **Billing-settings card** in `…\app\app\venue\settings` writing `payment_rules` (Codex #4).

---

## 9. Decisions only you can make (these gate the build)

1. **Pricing model** *(blocks Phase 0 + the whole revenue rail).* Commit to: **(a)** 1% commission / no monthly (matches the site; needs Paystack split) — *recommended*; or **(b)** flat R1499/mo (needs real recurring billing). Today both ship and both collect R0.
2. **Fee base** — 1% of *full* wedding spend, or only money transacted *through the platform*? (Recommend the latter — it's the only base you can actually collect on.)
3. **Who bears the fee** — couple-visible "service fee" (Airbnb-style) or venue-absorbed from the split (LekkeSlaap-style)? (Recommend venue-absorbed by default, optional transparency toggle.)
4. **Once-off activation fee** (LekkeSlaap charges R600) — yes (self-selects committed venues, day-1 cash) or zero-friction? (Recommend zero for the pilot.)
5. **Public marketplace vs private tool** — should venues be publicly discoverable (LekkeSlaap model, needs the public listing + POPIA review) or is Venuely a hand-onboarded private tool? Decides whether Phase 2's listing is the headline or skippable.
6. **Couple access default** — shared password (zero friction) vs magic-link (per-person revocation)? (Recommend password-default, magic-link opt-in.)
7. **Retire the relational `/portal` tree** in favour of `wedding_state`? (Recommended — couples already edit the blob.) Note this conflicts with the old roadmap's "stop stuffing `wedding_state`" mandate, so it needs an explicit call.
8. **Pat Busch pilot rate** — waive the fee (`platform_fee_active=false`) during the pilot? The per-venue columns already support it.

---

## 10. Implementation status (2026-05-29)

Built on branch **`venuely-redesign-2026-05-29`** (NOT merged, NOT deployed — master still auto-deploys the live site). Every wave builds green (`npm run build`, exit 0). Decision taken: **1% of platform-transacted spend, no monthly fee, Paystack rail.**

Commits: `d46feb1` (W1) · `1b5dd13` (W2) · `8ec222f` (W3) · `5b8d6e9` (nav) · `06d89a0` (W4) · `3e4bbbf` (W5). **81 files, +9,160/−486 vs master.**

> **Billing rule (clarified by founder 2026-05-29):** Venuely's fee = **1% of the couple's BASE payment to the venue, excluding the venue's commission/markup** — the venue keeps 100% of its commission. Implemented as `fee = rate × (grand_total − commission_total)` across `compute.ts`, `markInvoiced`, the manage-page breakdown, and the Paystack split (fixed `transaction_charge`).

**Done — Wave 1 (multi-tenant + pricing + security + quick wins):** portal reads injected globals (real couple/date/venue + data-driven Our-Venue); R1499 path deleted, copy reconciled, real "Fees collected (MTD)", `markInvoiced` recomputes server-side, webhook idempotency; storage-RLS scoped to venue, seed precedence fix; rich accommodation fields editable, silent edit-save bug fixed, Select-all scoped, venue description/directions/website + logo upload, live resend/auto-advance check-email, no re-nag modal, couple rentals honour markup.

**Done — Wave 2 (import + onboarding):** DOCX + image-only-PDF vision + website crawl + truncation surfacing + anchor image-matching; full-fidelity review cards; deduped/transactional commit with "what saved" report + 10-min Undo; 4-step `/onboarding/wizard`; editable areas; couple catalogue/accommodation honour markup.

**Done — Wave 3 (funnel + money):** public `/venues` + `/v/[slug]` SEO listing (opt-in via `listed`); `EnquiryForm` + `/api/enquiry` + `/venue/enquiries` CRM with convert-to-portal; `sendPortalInvite` (email/WhatsApp/QR) + `wedding_invites` + `wedding_members` on auth callback + rotate/revoke + `portal_access_log`; password gate hardened (POST + per-wedding salt + throttle); per-guest RSVP sub-link `/[wedding]/rsvp`; Paystack scaffold (env-gated): `paystack.ts`, `/venue/billing` connect-payouts, checkout + webhook, `platform_payments`, non-blocking readiness helper. Sidebar links wired.

**Done — Wave 4 (fee correction + calendar + portal SoT + reviews/team):** fee = 1% of base (venue keeps commission) across compute/markInvoiced/manage-page/Paystack split + webhook; availability calendar (`/venue/calendar`) with double-booking flags, couple accommodation writes `accommodation_bookings` + remaining-capacity badges; relational `/portal/[venue]/[wedding]` retired (redirects to `/[slug]`), owner Overview counts now read `wedding_state`; reviews (public submit + `/v/[slug]` display + owner moderation) + team seats (`/venue/team` invite → `venue_members`).

**Done — Wave 5 (portal tabs + reminders + POPIA + analytics):** couple portal "Pay deposit/balance" → Paystack checkout, "Get RSVP link" (copy/WhatsApp/QR), new Floor Plans / Rooming List / Layout Planner tabs; payment-reminder email/WhatsApp helpers + manage-page buttons; `/privacy` POPIA page; owner/founder funnel analytics (enquiries, conversion, listed venues).

**7 new migrations written, NONE applied:** `20260529100000_venue_profile_fields`, `100100_storage_security`, `100200_fix_patbusch_seed_precedence`, `110000_import_dedupe`, `120000_enquiries`, `120100_paystack_platform_payments`, `120200_couple_invites`, `130000_reviews_and_team`.

### Go-live checklist (in order)
1. **Resolve any duplicate `item_code`s** per venue in `catalogue_items`/`rental_items` (the dedupe unique index will fail to create otherwise).
2. **Apply the 6 migrations in timestamp order** via Supabase. Until applied, the branch must NOT be merged/deployed — code references new columns/tables and would error at runtime.
3. **Env vars** on Render: confirm `RESEND_API_KEY` (enquiry/invite emails) and add `PAYSTACK_SECRET_KEY` + `PAYSTACK_PUBLIC_KEY` when ready to collect (until then, billing shows "setup coming", build/runtime fine).
4. **Set `listed=true`** on venues that should appear in the public directory (default false → directory empty until then).
5. **Review + merge** the branch to master (triggers Render deploy). Smoke-test the couple portal for a non-Pat-Busch venue, the wizard, an enquiry, and an invite.

### Still open (genuine remainders after W1–W5)
- **Automated reminders** — only manual "send reminder" buttons exist; scheduled deposit/balance reminders need a cron (Render cron or Supabase scheduled fn).
- **Password-only couples can't pay-by-link yet** — `/api/paystack/checkout` requires a Supabase session; let it authorise via the `vy_portal_<id>` cookie so cookie-only couples can pay (signed-in members/owners already can).
- **Venue UI to upload floor-plan media** (`kind='floorplan'`) so the new Floor Plans tab populates (per-room `floor_plan_url` is already editable in InventoryManager).
- **Rental-hold writing at booking time** — the calendar reads `rental_holds`; accommodation bookings are written on couple confirm, but rental holds aren't yet written on book/convert.
- **Webhook durability** — idempotency is in-process + unique `provider_ref`; add a persisted events table for multi-instance.
- **Proforma builder dedup** — `buildWeddingCharges` logic is duplicated across `weddings/actions.ts`, the `[slug]` page, and `reminder-actions.ts`; extract to a shared non-`'use server'` module.
- **Import** — ZIP / loose-photo fan-out (skipped to protect the build).
