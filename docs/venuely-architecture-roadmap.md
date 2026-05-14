# Venuely — architecture roadmap (Codex audit, 2026-05-14)

## Single biggest pre-work decision

**Stop stuffing structured data into `wedding_state`** (the JSONB blob in `app/api/wedding/[slug]/state/route.ts`). Every new feature — accommodation tiers, venue areas, payments, documents — needs its own normalized table with RLS. Adding them to the blob means patching JSON-merge logic in a dozen places.

Keep the portal shell and routing, but **migrate complex tabs to React islands backed by real Supabase tables**. Do NOT put accommodation tiers, venue areas, documents, payments, or rooming lists into `wedding_state`.

## Phased roadmap

### Phase 1 — Schema foundation (1–2 days)
New normalized tables: `venue_areas`, `area_pricing`, `media_assets`, `wedding_documents`, `wedding_charges`, `payment_ledger`, `payment_rules`. Plus richer fields on `accommodation_rooms`, `catalogue_items`, `rental_items`. Everything else depends on this.

### Phase 2 — Pat Busch core data (1 day)
Seed real accommodation categories (Standard / Exclusive / Family Lodge / Africamps / Farmhouse), parent-room hierarchy, Farmhouse sub-room config, Oak Tree bridal-suite flag, real rental codes + replacement values, all venue areas, VAT 15% inclusive rule, breakage deposit row, 60-day balance rule. Pat Busch must see her actual data, not placeholders.

### Phase 3 — Admin CRUD expansion (2–3 days)
Purpose-built editors for accommodation tiers, venue areas, floor plan image uploads, document uploads, richer inventory fields. Replace generic `InventoryManager` path for these domain objects. **Key risk:** Supabase Storage bucket policy + RLS must be set before this.

### Phase 4 — Financial ledger (2 days)
Replace `wedding_state` total calculations with `wedding_charges` + `payment_ledger`. VAT-inclusive display, breakage deposit line, payment schedule, balance-due. Admin + couple-facing views in sync. **Risk:** existing weddings with totals already in `wedding_state` need a one-off migration.

### Phase 5 — Documents + floor plans (1 day)
Per-wedding document repository (upload, label, link to portal). Floor plan images linked to accommodation units and venue areas.

### Phase 6 — Couple portal React islands (2–3 days)
Migrate Accommodation, Documents, and Payments tabs to React islands (Next.js dynamic). Leave static tabs (timeline, contacts) in HTML/JS. **Risk:** island hydration in the hand-rolled shell needs one script-tag bridge.

### Phase 7 — End-to-end polish (1–2 days)
Pat Busch uploads PDFs, manages rooming lists, prices area choices per day type, views balances, exports a printable pack summary.

## Airbnb-grade accommodation UX

Migrate this tab to a React island **now** — rooming list interaction (drag guest to bed, track occupancy, export) is impossible in raw JS.

Component breakdown:
- Tier filter bar (Standard / Exclusive / Family Lodge / Africamps / Farmhouse) + sleeps filter
- Room card grid: hero photo, tier badge, ideal/max sleeps, bridal-suite flag, nightly rate
- Detail drawer: gallery carousel, floor plan image, bed config breakdown, amenities checklist, "Add to rooming list" action
- Rooming list sidebar: per-unit guest assignment, occupancy counter, total accommodation cost

One `<script type="module">` in `wedding-portal.html` mounts the island into `<div id="accommodation-root">`. Pass `weddingSlug` as a data attribute; the island fetches from `/api/wedding/[slug]/accommodation`.

## Do NOT build yet

1. **Real-time payment splitting / DebiCheck / Stitch InstantPay** — Pat Busch isn't processing card payments through Venuely yet. Build the ledger *display* first; payment collection is a second product decision.
2. **Drag-and-drop reception layout / table planner** — visually impressive but zero revenue leverage pre-launch; couples care about accommodation and payments first.
3. **Multi-venue / public supplier marketplace** — the market brief flags this as long-term moat, but it requires multi-tenancy hardening, public search, and supplier onboarding — none of which Pat Busch needs to be live end-to-end.
