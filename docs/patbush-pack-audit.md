# Pat Busch Wedding Pack — Venuely Schema Audit

Source: real confirmation pack at `/tmp/patbush_zip/` (18 files). What an actual couple receives vs what Venuely currently models.

---

## 1. Missing FIELDS on existing buckets (highest priority)

### catalogue_items / rental_items
- **free vs paid distinction** — Pat Busch uses F-numbers (F1–F40+) for complimentary items and R-numbers (R1–R77) for rentals. Same conceptual "item" but billing-different. Need an `is_complimentary BOOLEAN` (or `pricing_mode = 'free' | 'hire'`).
- **Item code / catalog number** (`F1`, `R18`) — couples reference these on the order form. Need `item_code TEXT`.
- **Replacement / breakage value** — every free AND rental item has a "Replacement Value" column (R250–R60,000). Damaged items deduct from breakage deposit. Need `replacement_value_cents`.
- **Setup area** — rental sheet has columns for "Meet & Greet", "Wedding/Function", "Farewell Breakfast" — same item priced/allocated per area. Need `applicable_areas TEXT[]` or a join to a `venue_areas` table.
- **"Per day" vs flat** — most rentals are "per day" (`R 250,00 per day`). Some are per-cup (Jura R25/cup). Already covered by `pricing_mode` but add `per_unit` (per cup, per brew, per crate of 50 cups).
- **Quantity / par level** vs stock-on-hand — free items list both par (120 plates) and replacement value per unit. `stock_qty` likely already exists; confirm it stores par level.
- **Conditional pricing** ("NAKED" R150 vs "DRESSED" R200 for same Malawian chair) — needs variant rows or a `variants JSONB`.
- **Tiered fee** — Kitchen fee R750 <90 pax, R1000 >90 pax. Need tiered/threshold pricing or two catalogue rows.
- **In-situ vs moved** ("Picnic Benches free in situ, R450 each if moved") — modifier flag.

### accommodation_rooms
- **Bed configuration detail** — every room has explicit bed config (queen + 2 singles, double + bunk, etc.). Need `bed_config JSONB` or fields for queen/double/single/bunk counts.
- **Layout type** — "Open plan", "2 Rooms + bathroom", "Two bedroom semi-private" — `layout_type TEXT`.
- **Max guests vs ideal guests** — Farmhouse Erika has 29 beds but recommends 23–28 ("don't max out"). Need `sleeps_ideal` AND `sleeps_max`.
- **Amenities** — air-con, fireplace, hot tub, braai, spa bath, gas geyser, solar backup, Wi-Fi, microwave. `amenities TEXT[]`.
- **Category / tier** — "Standard Cottage" / "Exclusive Cottage" / "Family Lodge" / "Africamps Boutique Tent" / "Farmhouse Room". `room_category`.
- **Bridal-suite flag** (Oak is "Bridal Suite option").
- **Assignable to guest names** — rooming list has a "NAMES" column the couple fills in. Today our `guests` table doesn't link to `accommodation_rooms.id`. Add `guest.assigned_room_id`.
- **Sub-room / bedroom number** — Farmhouse rooms 1–8 each individually assignable, not the whole house. Need `parent_room_id` for sub-units (Garden Flat is under Erika; rooms 1–8 are under Farmhouse).

### vendor_partners
- **Highlighted / preferred flag** — "highly recommended, regulars". Need `is_preferred BOOLEAN`.
- **Area / region** — Cape Town / Robertson / Paarl / Garden Route. `area TEXT`.
- **LOCAL & ONSITE flag** — separate from "preferred". `is_local BOOLEAN`.
- **Multiple service types per vendor** — Antoinette Events is Coordinator + Decor + Catering + Flowers. Many-to-many to `vendor_service_types`, not single `type` column.
- **More vendor types** — current 7 don't cover: **Food Trucks**, **Coffee/Ice cream**, **Spitbraai**, **Cake**, **Hair & Makeup**, **Stationery**, **Officiants/Pastors**, **Videographers**, **Transport**, **Furniture hire**, **Tent/Marquee hire**. Pack has ~15 categories.

### weddings
- No deposit / balance / payment tracking (proforma shows R195k total → R90k paid → R105k balance). Need `payments` child table.
- No proforma / invoice number.
- No VAT-inclusive flag.

---

## 2. Whole CATEGORIES missing from schema

1. **Documents/Files** — couples receive 17+ PDFs (catalogue, stock lists, floor plans, directions, rooming list, proforma, layout map, venue plan). No `documents` table. Should be a **dedicated portal tab**: "Documents & Floor Plans".
2. **Venue Areas / Spaces** — Oak Tree, Wedding Meadow, Pool, Hall/Lapa, Dam Wall, Poplar Forest, Pine Forest, Farmhouse Lawn. Rentals attach to areas; "extra area fees" (R2,000–R2,750) attach to areas. Needs `venue_areas` table with name, type (ceremony/reception/breakfast/meet-greet), capacity, extra-fee.
3. **Floor plans / Layouts** — venue plan PDF is interactive (couple sketches on it). Floor plans for each accommodation unit. Couple portal needs a "**Floor Plans**" or "**Layout Planner**" tab with the venue overview + per-unit plans uploaded.
4. **Rooming List / Guest Allocation** — sophisticated bed-by-bed assignment matrix (room → bed → named guest). Distinct from a guest list; this is a seating-chart equivalent for accommodation. **Probably its own tab**: "Rooming List".
5. **Payments / Schedule of Account** — proforma shows running ledger: total, deposits paid, dates paid (Nedbank EFT 2026/03/13), balance due, 60-days-prior rule. Needs `payments` table + payment schedule rules per venue.
6. **Breakage Deposit** — R15,000 refundable, all damage/loss deducted. Distinct from booking fee. Needs `breakage_deposit_cents` on `weddings`.
7. **Fees with conditional logic** — kitchen fee tiered on pax, extra-guest fee (>120), extra M&G fee (>100), extra-area fees, corkage, kitchen-staff scullery cost. Needs a `venue_fees` config table per venue (fee name, trigger condition, amount).
8. **Final walk-through / sign-off** — stock-list PDFs say "signed & confirmed during final walk-through with PB management". A workflow milestone, not just a note.
9. **Directions / How-to-find-us / gate code** — every pack has 2 directions PDFs and "enter your code at security gate". `venue.directions_text`, `venue.access_code` (couple-side, time-limited).
10. **Couple-completable "Venue Plan"** — printable PDF couple sketches on and emails back. Needs an interactive equivalent: drag-drop reception layout, or at minimum an upload-back slot.

---

## 3. Real Pat Busch price points (validate seed data)

| Item | Type | Pat Busch price |
|---|---|---|
| Wedding & Accommodation Venue (3-day) | venue fee | **R 180,000** |
| Refundable Breakage Deposit | deposit | **R 15,000** |
| Kitchen fee (<90 pax) | flat | **R 750/day** (R1,000 if >90) |
| Stella chair hire | per item | **R 10** |
| White outdoor bar setup | flat | **R 950** |
| Festoon/Bistro lights (50m) | flat/day | **R 750** |
| Wood-fired hot tub units (Nightjar/Hadeda/Oak) | accommodation | exclusive tier — not priced on these sheets |
| Fairy light curtain (each) | flat/day | **R 200** |
| Jura X8 coffee (Bean-to-Cup) | hybrid | **R 1,000 + R25/cup** |
| Gourmet DIY Coffee Percolator | flat | **R 400 rental + R600 per 50-cup brew** |
| HDTV Projector (Samsung Freestyle) | per day | **R 1,000** |
| JBL Party Box PA | per day | **R 1,500** (+R250 per wireless mic) |
| Hay bale + plank seating | each | **R 25** |
| Steel wedding arch (curved or round) | flat | **R 250** |
| Extra ceremony area (Dam/Meadow) | flat | **R 2,500** |
| Extra guest over 120 | per head | **R 100** |
| Massey-Ferguson tractor transport | flat | **R 1,000** |

**Replacement values to seed (breakage examples):** champagne flute R35, wine glass R20, dinner plate R25, cake lifter+knife set R500, JBL PA R15,000, Jura coffee machine R60,000.

**Action:** if our seeded catalogue uses round-number USD/ZAR placeholders, replace with these. Pat Busch is the lighthouse — numbers should match the proforma.

---

## 4. Wedding pack structure → couple portal tabs

Couples receive these document groups (every pack):

1. **Welcome / Directions** (`How to find us`, `Roadmap`, gate code) → "Getting There" tab or footer card.
2. **Venue layouts** (Aerial view, Map, Per-unit floor plans × 6) → **NEW TAB: "Floor Plans"**.
3. **Catalogue + Free stock list + Rental stock list** → currently scattered between `catalogue` and `rentals`; couples see them as **one decision flow**. Consider merging into a single "Stock & Hire" tab with FREE / RENTAL filter, or keep split but pair them visually.
4. **Preferred Service Providers list** → already `vendor_partners`. But this is a *9-page directory by service type* — needs better visual grouping, area filter, "highly recommended" badge.
5. **Rooming List** (couple fills in bed-by-bed) → **NEW TAB: "Rooming List"** distinct from "Guests".
6. **Wedding Venue Plan** (couple sketches reception layout) → **NEW TAB: "Layout Planner"** or upload slot on Floor Plans tab.
7. **Proforma / Invoice** → **NEW TAB: "Payments"** (running balance, payment dates, breakage deposit, balance due date).
8. **Final walk-through sign-off** — stock lists must be signed at walk-through → "Final Sign-off" milestone in timeline.

**Verdict:** add a top-level **"Documents"** tab as a fallback file repository, PLUS dedicated tabs for Floor Plans, Rooming List, Layout Planner, Payments.

---

## 5. ProformaNo1920 line items

The actual proforma (Heather & Shaun, 6-8 Jan '27) contains:

| Line | Amount |
|---|---|
| Wedding & Accommodation Venue (3-day) | R 180,000 |
| Refundable Breakage deposit | R 15,000 |
| **Subtotal** | R 195,000 |
| **VAT (15%, included)** | R 23,478.26 |
| **Total (incl. VAT)** | R 195,000 |
| Less: payments made (2026/03/13 Nedbank EFT) | -R 90,000 |
| **Balance Due** | R 105,000 |

Plus rules referenced: "Balance of account due 60 days prior to arrival".

**Missing from our cost-summary logic:**
- VAT line (15% ZA, inclusive vs exclusive flag)
- Breakage / refundable deposit (separate from venue fee, refunded after)
- Payment schedule rule (e.g. "balance due X days before event") + reminder logic
- Statement of account (payments history with date + method + reference)
- Kitchen fee (only appears on stock-list sheets, not the venue proforma — added separately at walk-through; couple sees it later)
- Corkage / bar fees — Pat Busch doesn't charge corkage in these docs (DIY bar) but other venues will
- Extra-area fees (R2,000–R2,750) — billed separately when couple picks Dam/Meadow/Pine Forest
- Extra-guest fee (>120 pax → R100/head)
- Damage deductions reconciled post-event from breakage deposit

**Recommendation:** add a `venue_fees` config table + `wedding_charges` line-item table + `payments` ledger. Cost summary should compute: base venue fee + selected extra areas + estimated rentals + kitchen fee (tiered) + extra-guest surcharge + VAT, with breakage deposit shown separately as refundable.

---

## TL;DR — top 5 gaps

1. **Documents/Floor-Plans/Rooming-List/Layout-Planner/Payments** — five missing couple-portal tabs.
2. **Venue Areas + per-area fees + extra-area pricing** — fundamental missing entity.
3. **Replacement value + free-vs-rental flag + item code** on catalogue/rental items.
4. **Payments + breakage deposit + VAT + payment-schedule rules + statement of account** — proforma logic.
5. **Bed-level rooming list** (named guest → specific bed in specific room), with sub-rooms under Farmhouse Erika, ideal-vs-max sleeps, and a much richer accommodation amenities/category schema.
