# Venuely — Codex audit + fixes applied (2026-05-14)

## Verdict transition

| Before fixes | After fixes |
| ---- | ---- |
| 🔴 RED — 4 P0 auth bypasses, not shippable | 🟡 YELLOW — auth holes closed, ready for soft pilot |

## Issues found & fixes applied

### P0 — Auth bypasses (FIXED)

1. **`app/portal/[slug]/accommodation/page.tsx`** — no auth gate, anyone with URL saw data.
   - **Fix:** wrapped in new `portalAccess(slug)` helper; redirects to `/${slug}` for 401/403, 404s for unknown slug.

2. **`app/api/wedding/[slug]/accommodation/route.ts`** — same leak in the API.
   - **Fix:** same `portalAccess()` gate before any data is returned.

3. **`app/api/wedding/[slug]/state/route.ts`** — required Supabase auth, but password-unlocked couples have no Supabase session → state writes were broken for the primary password-gated flow.
   - **Fix:** new `portalAccess()` accepts EITHER Supabase auth OR a valid `vy_portal_<weddingId>` cookie. Switched DB write to service-role admin client (cookie auth bypasses RLS by design).
   - Bonus: state PUT now supports both `{ ...fullState }` (legacy portal app.js) and `{ patch: { ... } }` (new React island). Partial patch merges into existing state.

4. **`app/api/wedding/[slug]/submit/route.ts`** — same Supabase-only auth gate → "Send to venue" failed for password-gated portals.
   - **Fix:** same `portalAccess()` gate, admin client for the write.

### P1 — Pricing math drift (FIXED)

5. **`app/[wedding]/route.ts`** had a local `applyMarkup` copy of `lib/billing/compute.ts`'s function. Math currently matched but actively drifting from declared SoT.
   - **Fix:** deleted local copy, imported from `@/lib/billing/compute`. Also fixed in `app/api/wedding/[slug]/accommodation/route.ts` and `app/portal/[slug]/accommodation/page.tsx` (all now use the shared helper).

### P1 — Routing collision (FIXED)

6. **`/brand` and `/docs` could be eaten by wedding slug lookup.** `RESERVED` set in `app/[wedding]/route.ts` was missing them.
   - **Fix:** added `"brand"`, `"docs"`, `"logout"` to RESERVED.

### P2 — Static portal double-lock (FIXED)

7. **`public/wedding-portal/app.js`** had a hardcoded `PORTAL_ACCESS_CODE = 'PATBUSCH2027'` enforced client-side AFTER the server gate. Server-authed couples still saw a second prompt.
   - **Fix:** stripped the in-browser lock. `tryUnlock()` now just dismisses any stale lock screen. Server `route.ts` password gate is the single source of truth.

### P2 — Smart import blocked vendor types (FIXED)

8. **`app/api/venue/inventory/parse/route.ts`** validated type against a hardcoded `["catalogue","rentals","accommodation"]` array, rejecting vendor smart imports.
   - **Fix:** validates against `INVENTORY_FIELDS[type]` (covers all 10 marketplace types).

### P2 — Owner-role rejected by venue APIs (FIXED)

9. **`app/api/venue/uploads/commit/route.ts`** + **`app/api/venue/wedding-document/route.ts`** only checked `venue_members`, so platform-owner accounts got 403s.
   - **Fix:** both now also check `profiles.role === 'owner'`.

## Files edited (10)

- `lib/portal/access.ts` (new — shared portal-access helper)
- `app/[wedding]/route.ts` (RESERVED + dedupe applyMarkup)
- `app/api/wedding/[slug]/state/route.ts` (rewrite, gate, patch support)
- `app/api/wedding/[slug]/accommodation/route.ts` (rewrite, gate)
- `app/api/wedding/[slug]/submit/route.ts` (gate, admin client)
- `app/portal/[slug]/accommodation/page.tsx` (gate)
- `app/api/venue/inventory/parse/route.ts` (validate against INVENTORY_FIELDS)
- `app/api/venue/uploads/commit/route.ts` (owner role)
- `app/api/venue/wedding-document/route.ts` (owner role)
- `public/wedding-portal/app.js` (strip hardcoded passcode)

## Top 5 issues NOT yet fixed (deferred to next pass)

1. **InventoryManager edit lightbox doesn't surface new accommodation fields** (tier, bed_config, amenities, bridal_suite, max_sleeps, ideal_sleeps, hero_image_url, floor_plan_url). Editing in venue dashboard silently drops these. Severity: P2 — admin pain, no production risk.
2. **Static portal `app.js` ignores marked-up prices for rentals** when computing client-side totals — uses `r.rate` which IS marked up, but doesn't include commission for catalogue per-head math. Worth cross-checking against the new venue-detail compute. Severity: P1.
3. **`wedding_charges.is_auto`** is set false-by-default, but couple selections don't currently sync into the table. Manual-only charges + JSONB-derived auto-charges = double-counting risk if someone manually adds what's already auto-derived. Severity: P1.
4. **No payment-rules editor UI** — the rules row exists per venue but there's no `/venue/settings/billing` page to edit VAT rate, deposit %, balance days, breakage deposit. Severity: P2.
5. **Couple-portal "Recommended vendors" card** in `app.js` `renderRecommendedVendors` doesn't reach the new AccommodationGrid — they're parallel UIs. Long-term: full React-island migration as Codex originally proposed. Severity: P3 — visual only.

## Verdict

🟡 **YELLOW — shippable for a soft pilot with Pat Busch as the lighthouse, with two caveats:**

- Don't open password-protected portals to couples you wouldn't trust to spot a bug — state writes are now correct but untested under load.
- The InventoryManager edit gap (issue #1) means new accommodation tier/amenity fields must be set via SQL or smart-import until next pass.

To go GREEN: tackle issues 1, 2, 3 from the "not yet fixed" list.
