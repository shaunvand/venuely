# Couple Portal — IA & First-Run Experience Audit + Redesign Strategy
_2026-06 · scope: `components/CouplePortal.tsx`_

## Problem
The couple portal lands a first-time user on ~19 sidebar destinations (12 flat + a 7-item "For the Vibes" group) plus 2 off-nav pages (Reminders, Documents). Flat, no journey ordering, inconsistent naming ("Our Venue" vs "Venue stock / Rentals"), and no guided tour. Only onboarding today = the "Start here / your next step" card on Overview.

## Recommended IA — 5 sections + 2 pinned
Pinned (never collapse): **Overview**, **Messages**.

1. **Our Venue** — Spaces & Rooms (Our Venue + Accommodation + Extras & Rentals). _Expanded day 1._
2. **Our Guests** — Guest List, Seating, Reminders. _Collapsed until a guest is added._
3. **Money** — Budget, Payments & Invoices, Documents. _Collapsed until budget set._
4. **Suppliers & Style** — Vendors, Inspiration, Invites, Florals, Attire, Décor, Music, Contacts. _Collapsed; dimmed until spaces confirmed._
5. **The Day** — Run Sheet (Timeline), Checklist. _Appears ≤180 days out, auto-expands ≤90 days._

Every current tab maps into one of these (Accommodation logically belongs under Our Guests too via cross-link).

## Journey / phase model
Set Up → Your People → Money → Style & Vendors → The Day. Show a vertical phase progress bar beside the sidebar (5 segments, brand-colour when a phase has ≥1 done) + a "You're in: …" chip under the venue logo. Non-linear (click anything) but visually orienting.

## Progressive disclosure (so day 1 ≠ 19 tabs)
Day 1 active: Overview, Our Venue → Spaces, Messages, Money → Budget. Everything else dimmed/locked with an unlock hint:
- Spaces confirmed → un-dim Suppliers & Style
- First guest added → unlock Seating + Reminders
- Budget saved → activate Payments
- Date ≤180d → reveal The Day (urgency badge); ≤90d → auto-expand
Tie to the existing "Start here" card ("Step 1 of 5: Confirm your spaces") and rename "X of 6 areas done" → "X of 5 stages complete". Add completion pips on section headers.

## First-run guided tour — spotlight/coachmark overlay
8 steps: 1) welcome/header, 2) phase bar, 3) Start-here card, 4) Our Venue, 5) Our Guests, 6) Money, 7) Suppliers & Style, 8) The Day → CTA lands on Spaces. Skippable every step, resumable (last step), re-launchable via a "Take the tour" link (sidebar footer + Overview).

**Persistence:** `localStorage` `venuely_tour_v1_{userId}` (survives tab close) + mirror to a Supabase profile flag `tour_completed_at` for cross-device.

**Positioning pitfalls (learned the hard way here):** any ancestor with `transform`/`filter`/`will-change` breaks `position: fixed`. So:
- Render the overlay via `createPortal(<Tour/>, document.body)` — never inside CouplePortal's animated tree.
- Position from `getBoundingClientRect()` (viewport-relative, transform-safe); recompute on scroll/resize via ResizeObserver.
- Scroll a clipped sidebar item into view before measuring.
- On mobile, programmatically open the drawer + wait for `transitionend` before measuring steps 4–8.

## Implementation
Hand-rolled spotlight (~200 lines, no dep) is recommended over react-joyride (~40KB, has the transform bug) or driver.js (~15KB, Tailwind specificity friction). Structure: `TourContext`, `TourPortal` (portal to body), `TourSpotlight`, `TourTooltip`, `useTourTargets` (ref map), `tourSteps.ts`. Guard all `localStorage`/`getBoundingClientRect` in `useEffect` (SSR/hydration). Drive tab changes through the existing nav setter (keeps sessionStorage tab state in sync).

## Mobile
5 sections = drawer accordion; Overview/Messages pinned above. Phase bar → horizontal dot strip at drawer top. Tour steps 4–8 open the drawer first; tooltips flip below-target; ≥44px touch targets; pin tooltip to viewport bottom on tiny screens.

## Roadmap
**Ship this week (low-risk, no big refactor):**
1. Rename "Venue stock / Rentals" → "Extras & Rentals", place next to Our Venue.
2. Surface Reminders + Documents in the sidebar (currently off-nav → undiscoverable).
3. Rename "For the Vibes" group → "Style & Vendors".
4. Update "Start here" card to phase language ("Step 1 of 5 …").
5. Dim Seating until ≥1 guest (hover hint: "Add guests first to unlock seating").
6. Add a "Take the tour" link (scaffold the tour flag now).

**Bigger redesign (1–2 wks each):**
1. Full 5-section accordion sidebar + completion pips.
2. 8-step portal spotlight tour + localStorage/Supabase seen-state.
3. Phase progress bar + `useProgressiveDisclosure(coupleData)` lock/dim/active engine.
4. Move Accommodation under Our Guests.
