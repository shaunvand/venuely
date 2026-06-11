-- Supplier introductions + venue commission tracking.
-- Flow: couple taps "Request introduction" on a recommended supplier → we log an
-- intro (snapshotting the commission terms) and open a venue-CC'd intro email, so
-- the venue is in the thread. When the supplier is booked, commission accrues for
-- the venue to invoice the supplier (Venuely is the ledger, not the money handler).

create table if not exists supplier_intros (
  id               uuid primary key default gen_random_uuid(),
  venue_id         uuid not null references venues(id) on delete cascade,
  wedding_id       uuid not null references weddings(id) on delete cascade,
  vendor_id        uuid references vendor_partners(id) on delete set null, -- null = couple's own supplier
  supplier_name    text not null,
  supplier_type    text,
  supplier_email   text,
  supplier_phone   text,
  -- Commission terms snapshotted at intro time (the venue's per-supplier rate).
  commission_type  text not null default 'percent' check (commission_type in ('percent','fixed')),
  commission_value numeric(10,2) not null default 0,
  -- Lifecycle.
  status           text not null default 'intro_requested'
                     check (status in ('intro_requested','booked','declined')),
  booking_value    numeric(10,2),       -- supplier's agreed price (for percent commission)
  commission_amount numeric(10,2),      -- resolved when booked
  intro_sent_at    timestamptz default now(),
  booked_at        timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists supplier_intros_wedding_idx on supplier_intros(wedding_id);
create index if not exists supplier_intros_venue_idx on supplier_intros(venue_id);

alter table supplier_intros enable row level security;
-- Venue members + owner manage their venue's intros. Couple-side writes go through
-- the portalAccess-gated API route using the service-role client (same pattern as
-- the other /api/wedding/[slug]/* routes), so no couple policy is needed here.
drop policy if exists "supplier_intros venue rw" on supplier_intros;
create policy "supplier_intros venue rw" on supplier_intros for all
  using (venue_id in (select venue_id from venue_members where user_id = auth.uid())
         or exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'owner'::user_role))
  with check (venue_id in (select venue_id from venue_members where user_id = auth.uid())
              or exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'owner'::user_role));
