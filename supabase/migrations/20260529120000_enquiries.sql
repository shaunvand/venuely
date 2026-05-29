-- Enquiries — top-of-funnel lead capture from the public venue directory.
--
-- A public "request a quote / check availability" form on /v/[slug] inserts a
-- row here as `anon` (no auth). The venue then works the lead through a simple
-- pipeline (new → quoted → booked → lost) in /venue/enquiries, and can convert
-- a won lead into a full couple portal (weddings row) — at which point
-- wedding_id is linked and status flips to 'booked'.
--
-- RLS:
--   INSERT  — open to anon/public (it is a lead form).
--   SELECT  — venue members (is_venue_member) + owner (is_owner).
--   UPDATE  — venue members + owner (status changes, convert-to-wedding link).
-- The helpers is_venue_member(uuid) / is_owner() come from the initial schema.

create table if not exists enquiries (
  id           uuid primary key default gen_random_uuid(),
  venue_id     uuid references venues(id) on delete cascade,
  couple_name  text,
  email        text,
  phone        text,
  event_date   date,
  guest_count  int,
  message      text,
  status       text not null default 'new' check (status in ('new','quoted','booked','lost')),
  source       text,
  consent      boolean default false,
  wedding_id   uuid references weddings(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists enquiries_venue_status_idx
  on enquiries (venue_id, status, created_at desc);

alter table enquiries enable row level security;

-- Anyone (including anon) can submit a lead.
drop policy if exists "enquiries public insert" on enquiries;
create policy "enquiries public insert" on enquiries for insert
  with check (true);

-- Only the venue's staff (or the platform owner) can read its leads.
drop policy if exists "enquiries member read" on enquiries;
create policy "enquiries member read" on enquiries for select
  using (is_owner() or is_venue_member(venue_id));

-- Only the venue's staff (or owner) can move a lead through the pipeline /
-- link it to a created wedding portal.
drop policy if exists "enquiries member update" on enquiries;
create policy "enquiries member update" on enquiries for update
  using (is_owner() or is_venue_member(venue_id))
  with check (is_owner() or is_venue_member(venue_id));

-- =====================================================================
-- PUBLIC DIRECTORY READ ACCESS
-- The public listing pages (/venues, /v/[slug]) use the anon-keyed server
-- client. The base "venue read" policy only exposes venues to their own
-- staff/couples, so anon would see nothing. These additive (OR-combined)
-- policies expose ONLY opted-in (listed = true) venues + their public
-- offerings to anon. media_assets is already public-read (`using (true)`)
-- and venue_areas already exposes active rows publicly.
-- =====================================================================
drop policy if exists "venue public listing read" on venues;
create policy "venue public listing read" on venues for select
  using (listed = true);

drop policy if exists "catalogue public listing read" on catalogue_items;
create policy "catalogue public listing read" on catalogue_items for select
  using (
    active = true
    and venue_id in (select id from venues where listed = true)
  );

drop policy if exists "rental public listing read" on rental_items;
create policy "rental public listing read" on rental_items for select
  using (
    active = true
    and venue_id in (select id from venues where listed = true)
  );

drop policy if exists "accommodation public listing read" on accommodation_rooms;
create policy "accommodation public listing read" on accommodation_rooms for select
  using (
    active = true
    and venue_id in (select id from venues where listed = true)
  );
