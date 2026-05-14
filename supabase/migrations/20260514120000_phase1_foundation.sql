-- Phase 1 foundation: normalised tables for areas, media, documents, charges, payments, rules.
-- All RLS-gated to venue members + active rows visible to portal viewers.

-- =====================================================================
-- VENUE AREAS  (Oak Tree, Wedding Meadow, Pool, Hall/Lapa, etc.)
-- =====================================================================
create table if not exists venue_areas (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references venues(id) on delete cascade,
  name        text not null,
  slug        text not null,
  description text,
  area_kind   text not null default 'main' check (area_kind in ('main','extra','overflow')),
  image_url   text,
  active      boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  unique (venue_id, slug)
);
create index if not exists venue_areas_venue_idx on venue_areas (venue_id, sort_order);

-- per-day-type pricing for each area (M&G / Wedding / Farewell breakfast).
create table if not exists area_pricing (
  id            uuid primary key default gen_random_uuid(),
  area_id       uuid not null references venue_areas(id) on delete cascade,
  day_type      text not null check (day_type in ('mg','wedding','farewell','any')),
  price         numeric(10,2) not null default 0,
  included_in_base boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (area_id, day_type)
);

alter table venue_areas enable row level security;
alter table area_pricing enable row level security;
drop policy if exists "venue_areas read" on venue_areas;
create policy "venue_areas read" on venue_areas for select using (
  active = true
  or venue_id in (select venue_id from venue_members where user_id = auth.uid())
  or exists (select 1 from profiles where id = auth.uid() and role = 'owner')
);
drop policy if exists "venue_areas write" on venue_areas;
create policy "venue_areas write" on venue_areas for all using (
  venue_id in (select venue_id from venue_members where user_id = auth.uid())
  or exists (select 1 from profiles where id = auth.uid() and role = 'owner')
);
drop policy if exists "area_pricing read" on area_pricing;
create policy "area_pricing read" on area_pricing for select using (true);
drop policy if exists "area_pricing write" on area_pricing;
create policy "area_pricing write" on area_pricing for all using (
  area_id in (select id from venue_areas where venue_id in (select venue_id from venue_members where user_id = auth.uid()))
  or exists (select 1 from profiles where id = auth.uid() and role = 'owner')
);

-- =====================================================================
-- MEDIA ASSETS  (photos, floor plans, gallery images — polymorphic)
-- =====================================================================
create table if not exists media_assets (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references venues(id) on delete cascade,
  owner_type  text not null check (owner_type in ('venue','area','accommodation','catalogue','rental','vendor','wedding')),
  owner_id    uuid,
  kind        text not null default 'photo' check (kind in ('photo','floorplan','document','logo','hero')),
  url         text not null,
  label       text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists media_assets_owner_idx on media_assets (owner_type, owner_id, sort_order);
create index if not exists media_assets_venue_idx on media_assets (venue_id);

alter table media_assets enable row level security;
drop policy if exists "media_assets read" on media_assets;
create policy "media_assets read" on media_assets for select using (true);
drop policy if exists "media_assets write" on media_assets;
create policy "media_assets write" on media_assets for all using (
  venue_id in (select venue_id from venue_members where user_id = auth.uid())
  or exists (select 1 from profiles where id = auth.uid() and role = 'owner')
);

-- =====================================================================
-- WEDDING DOCUMENTS  (per-wedding PDF / file pack)
-- =====================================================================
create table if not exists wedding_documents (
  id              uuid primary key default gen_random_uuid(),
  wedding_id      uuid not null references weddings(id) on delete cascade,
  label           text not null,
  url             text not null,
  kind            text not null default 'document' check (kind in ('document','floorplan','contract','proforma','statement','image','other')),
  visible_to_couple boolean not null default true,
  uploaded_by     uuid references profiles(id) on delete set null,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists wedding_documents_wedding_idx on wedding_documents (wedding_id, sort_order);

alter table wedding_documents enable row level security;
drop policy if exists "wedding_documents read" on wedding_documents;
create policy "wedding_documents read" on wedding_documents for select using (
  wedding_id in (
    select w.id from weddings w
    where w.venue_id in (select venue_id from venue_members where user_id = auth.uid())
       or w.id in (select wedding_id from wedding_members where user_id = auth.uid())
  )
  or exists (select 1 from profiles where id = auth.uid() and role = 'owner')
);
drop policy if exists "wedding_documents write" on wedding_documents;
create policy "wedding_documents write" on wedding_documents for all using (
  wedding_id in (
    select w.id from weddings w
    where w.venue_id in (select venue_id from venue_members where user_id = auth.uid())
  )
  or exists (select 1 from profiles where id = auth.uid() and role = 'owner')
);

-- =====================================================================
-- WEDDING CHARGES  (denormalised line items rolled up into the proforma)
-- =====================================================================
create table if not exists wedding_charges (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references weddings(id) on delete cascade,
  kind        text not null check (kind in ('venue','area','catalogue','rental','accommodation','vendor','breakage','vat','discount','custom')),
  label       text not null,
  reference_table text,
  reference_id    uuid,
  day_type    text check (day_type in ('mg','wedding','farewell','any')),
  qty         numeric(10,2) not null default 1,
  unit_price  numeric(12,2) not null default 0,
  amount      numeric(12,2) not null default 0,    -- qty * unit_price (denormalised for fast totals)
  is_refundable boolean not null default false,
  is_auto     boolean not null default false,       -- generated by couple-portal selection vs. manual venue add
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists wedding_charges_wedding_idx on wedding_charges (wedding_id, kind);

alter table wedding_charges enable row level security;
drop policy if exists "wedding_charges read" on wedding_charges;
create policy "wedding_charges read" on wedding_charges for select using (
  wedding_id in (
    select w.id from weddings w
    where w.venue_id in (select venue_id from venue_members where user_id = auth.uid())
       or w.id in (select wedding_id from wedding_members where user_id = auth.uid())
  )
  or exists (select 1 from profiles where id = auth.uid() and role = 'owner')
);
drop policy if exists "wedding_charges write" on wedding_charges;
create policy "wedding_charges write" on wedding_charges for all using (
  wedding_id in (
    select w.id from weddings w
    where w.venue_id in (select venue_id from venue_members where user_id = auth.uid())
  )
  or exists (select 1 from profiles where id = auth.uid() and role = 'owner')
);

-- =====================================================================
-- PAYMENT LEDGER  (one row per couple payment in / refund out)
-- =====================================================================
create table if not exists payment_ledger (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references weddings(id) on delete cascade,
  amount      numeric(12,2) not null,
  direction   text not null default 'in' check (direction in ('in','out')),
  kind        text not null default 'payment' check (kind in ('deposit','progress','balance','breakage','refund','adjustment','payment')),
  method      text,
  reference   text,
  paid_at     timestamptz not null default now(),
  notes       text,
  created_at  timestamptz not null default now()
);
create index if not exists payment_ledger_wedding_idx on payment_ledger (wedding_id, paid_at desc);

alter table payment_ledger enable row level security;
drop policy if exists "payment_ledger read" on payment_ledger;
create policy "payment_ledger read" on payment_ledger for select using (
  wedding_id in (
    select w.id from weddings w
    where w.venue_id in (select venue_id from venue_members where user_id = auth.uid())
       or w.id in (select wedding_id from wedding_members where user_id = auth.uid())
  )
  or exists (select 1 from profiles where id = auth.uid() and role = 'owner')
);
drop policy if exists "payment_ledger write" on payment_ledger;
create policy "payment_ledger write" on payment_ledger for all using (
  wedding_id in (
    select w.id from weddings w
    where w.venue_id in (select venue_id from venue_members where user_id = auth.uid())
  )
  or exists (select 1 from profiles where id = auth.uid() and role = 'owner')
);

-- =====================================================================
-- PAYMENT RULES  (per-venue policy: deposit %, balance days, VAT, breakage)
-- =====================================================================
create table if not exists payment_rules (
  id           uuid primary key default gen_random_uuid(),
  venue_id     uuid not null references venues(id) on delete cascade,
  vat_inclusive boolean not null default true,
  vat_rate      numeric(5,4) not null default 0.1500,
  deposit_pct   numeric(5,4) not null default 0.5000,
  balance_days_before int not null default 60,
  breakage_deposit numeric(10,2) not null default 0,
  breakage_refund_days int not null default 14,
  currency      text not null default 'ZAR',
  notes         text,
  unique (venue_id)
);

alter table payment_rules enable row level security;
drop policy if exists "payment_rules read" on payment_rules;
create policy "payment_rules read" on payment_rules for select using (
  venue_id in (select venue_id from venue_members where user_id = auth.uid())
  or exists (select 1 from profiles where id = auth.uid() and role = 'owner')
);
drop policy if exists "payment_rules write" on payment_rules;
create policy "payment_rules write" on payment_rules for all using (
  venue_id in (select venue_id from venue_members where user_id = auth.uid())
  or exists (select 1 from profiles where id = auth.uid() and role = 'owner')
);

-- Backfill a default rule row for every existing venue.
insert into payment_rules (venue_id)
select v.id from venues v
where not exists (select 1 from payment_rules pr where pr.venue_id = v.id);

-- =====================================================================
-- ENRICH EXISTING INVENTORY TABLES
-- =====================================================================
-- Accommodation: tier, parent, bed config, amenities, bridal flag, max_sleeps, gallery
alter table accommodation_rooms add column if not exists tier text default 'standard'
  check (tier in ('standard','exclusive','family','africamps','farmhouse','custom'));
alter table accommodation_rooms add column if not exists parent_room_id uuid references accommodation_rooms(id) on delete set null;
alter table accommodation_rooms add column if not exists bed_config jsonb default '{}'::jsonb;
alter table accommodation_rooms add column if not exists amenities text[] default '{}'::text[];
alter table accommodation_rooms add column if not exists bridal_suite boolean not null default false;
alter table accommodation_rooms add column if not exists max_sleeps int;
alter table accommodation_rooms add column if not exists ideal_sleeps int;
alter table accommodation_rooms add column if not exists hero_image_url text;
alter table accommodation_rooms add column if not exists floor_plan_url text;

-- Rentals: item code, replacement value, free flag, dressed/naked variant, tier pricing
alter table rental_items add column if not exists item_code text;
alter table rental_items add column if not exists replacement_value numeric(10,2);
alter table rental_items add column if not exists is_free boolean not null default false;
alter table rental_items add column if not exists variant text;
alter table rental_items add column if not exists tier_pricing jsonb;

-- Catalogue: item code, free flag
alter table catalogue_items add column if not exists item_code text;
alter table catalogue_items add column if not exists is_free boolean not null default false;

-- Wedding: deposit + balance schedule snapshots, area selections
alter table weddings add column if not exists deposit_due_at date;
alter table weddings add column if not exists balance_due_at date;
alter table weddings add column if not exists area_selections jsonb default '[]'::jsonb;

