-- Venuely — Phase 0 schema (Supabase Postgres)
-- 2026-05-12
-- Three roles via Supabase Auth: owner, venue_admin, couple
-- RLS scopes per role/venue/wedding.

-- =====================================================================
-- ENUMS
-- =====================================================================
create type user_role as enum ('owner', 'venue_admin', 'couple');
create type wedding_status as enum ('inquiry', 'booked', 'in_planning', 'completed', 'cancelled');
create type payment_status as enum ('pending', 'paid', 'overdue', 'refunded');
create type subscription_status as enum ('trialing', 'active', 'past_due', 'cancelled');

-- =====================================================================
-- PROFILES — extends auth.users
-- =====================================================================
create table profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  role            user_role not null,
  full_name       text,
  phone           text,
  whatsapp        text,
  created_at      timestamptz not null default now()
);

-- =====================================================================
-- VENUES — one row per paying customer
-- =====================================================================
create table venues (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique,           -- e.g. 'pat-busch' → /portal/pat-busch/...
  name                text not null,
  region              text,                            -- 'Robertson', 'Stellenbosch', etc.
  contact_email       text,
  contact_phone       text,
  branding_primary    text default '#0a4a3a',         -- hex; Pat Busch uses deep green
  branding_logo_url   text,
  subscription_status subscription_status not null default 'trialing',
  trial_ends_at       timestamptz,
  yoco_customer_id    text,                            -- Yoco recurring billing handle
  created_at          timestamptz not null default now()
);

-- venue staff membership (many staff per venue)
create table venue_members (
  venue_id    uuid not null references venues(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  is_primary  boolean not null default false,         -- the billing contact
  created_at  timestamptz not null default now(),
  primary key (venue_id, user_id)
);

-- =====================================================================
-- WEDDINGS — one row per wedding at a venue
-- =====================================================================
create table weddings (
  id            uuid primary key default gen_random_uuid(),
  venue_id      uuid not null references venues(id) on delete cascade,
  slug          text not null,                         -- e.g. 'smith-jones-2027' → /portal/pat-busch/smith-jones-2027
  couple_names  text not null,                         -- 'Alex & Sam'
  wedding_date  date,
  guest_count   int,
  status        wedding_status not null default 'inquiry',
  total_budget  numeric(12,2),
  notes         text,
  created_at    timestamptz not null default now(),
  unique (venue_id, slug)
);

-- couple membership (1-2 users per wedding)
create table wedding_members (
  wedding_id  uuid not null references weddings(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (wedding_id, user_id)
);

-- =====================================================================
-- INVENTORY — three separate tables (Catalogue, Rentals, Accommodation)
-- =====================================================================

-- CATALOGUE — venue-owned items (menus, decor, packages) priced per head or fixed
create table catalogue_items (
  id            uuid primary key default gen_random_uuid(),
  venue_id      uuid not null references venues(id) on delete cascade,
  category      text not null,                         -- 'menu' | 'decor' | 'package' | 'beverage'
  name          text not null,
  description   text,
  price         numeric(10,2) not null,
  price_unit    text not null default 'per_person',    -- 'per_person' | 'fixed' | 'per_hour'
  image_url     text,
  active        boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

-- RENTALS — limited-stock items with per-weekend availability
create table rental_items (
  id            uuid primary key default gen_random_uuid(),
  venue_id      uuid not null references venues(id) on delete cascade,
  category      text not null,                         -- 'furniture' | 'tableware' | 'linen' | 'lighting'
  name          text not null,
  description   text,
  price         numeric(10,2) not null,                -- flat rental fee
  stock_total   int not null default 1,                -- how many the venue owns
  image_url     text,
  active        boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

-- per-weekend hold so two weddings on same Saturday can't both reserve the last 50 chairs
create table rental_holds (
  rental_id     uuid not null references rental_items(id) on delete cascade,
  wedding_id    uuid not null references weddings(id) on delete cascade,
  quantity      int not null,
  weekend_of    date not null,                          -- Saturday of the weekend
  created_at    timestamptz not null default now(),
  primary key (rental_id, wedding_id, weekend_of)
);

-- ACCOMMODATION — on-site rooms (destination-wedding wine farms)
create table accommodation_rooms (
  id            uuid primary key default gen_random_uuid(),
  venue_id      uuid not null references venues(id) on delete cascade,
  name          text not null,                         -- 'Vineyard Cottage 1'
  room_type     text,                                  -- 'cottage' | 'suite' | 'lodge'
  sleeps        int not null default 2,
  price_per_night numeric(10,2) not null,
  description   text,
  image_url     text,
  active        boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

-- per-night booking (handles multi-night stays + multi-room weddings)
create table accommodation_bookings (
  id              uuid primary key default gen_random_uuid(),
  room_id         uuid not null references accommodation_rooms(id) on delete cascade,
  wedding_id      uuid not null references weddings(id) on delete cascade,
  guest_name      text,
  check_in        date not null,
  check_out       date not null,
  created_at      timestamptz not null default now()
);

-- =====================================================================
-- WEDDING-LEVEL DATA (couple-facing tabs)
-- =====================================================================

-- couple's selections from catalogue + rentals (the actual "shopping cart")
create table wedding_selections (
  id                uuid primary key default gen_random_uuid(),
  wedding_id        uuid not null references weddings(id) on delete cascade,
  catalogue_item_id uuid references catalogue_items(id) on delete set null,
  rental_item_id    uuid references rental_items(id) on delete set null,
  quantity          int not null default 1,
  notes             text,
  created_at        timestamptz not null default now(),
  check (
    (catalogue_item_id is not null and rental_item_id is null)
    or (catalogue_item_id is null and rental_item_id is not null)
  )
);

-- guest list
create table guests (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references weddings(id) on delete cascade,
  full_name   text not null,
  email       text,
  phone       text,
  rsvp_status text default 'pending',                  -- 'pending' | 'attending' | 'declined'
  table_number int,
  dietary     text,
  plus_one    boolean default false,
  notes       text,
  created_at  timestamptz not null default now()
);

-- suppliers (photographers, florists, etc — couple-managed)
create table suppliers (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references weddings(id) on delete cascade,
  category    text not null,                           -- 'photographer' | 'florist' | 'dj' | ...
  name        text not null,
  contact     text,
  cost        numeric(10,2),
  paid        boolean not null default false,
  notes       text,
  created_at  timestamptz not null default now()
);

-- budget line items
create table budget_items (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references weddings(id) on delete cascade,
  category    text not null,                           -- 'venue' | 'catering' | 'attire' | ...
  label       text not null,
  estimated   numeric(10,2),
  actual      numeric(10,2),
  paid        boolean not null default false,
  created_at  timestamptz not null default now()
);

-- checklist
create table checklist_items (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references weddings(id) on delete cascade,
  label       text not null,
  due_date    date,
  completed   boolean not null default false,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- day-of timeline
create table timeline_items (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references weddings(id) on delete cascade,
  starts_at   time not null,
  label       text not null,
  description text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- =====================================================================
-- PAYMENTS (venue admin tracks couple payments to venue)
-- =====================================================================
create table payments (
  id            uuid primary key default gen_random_uuid(),
  wedding_id    uuid not null references weddings(id) on delete cascade,
  amount        numeric(12,2) not null,
  due_date      date,
  paid_date     date,
  status        payment_status not null default 'pending',
  description   text,
  invoice_url   text,
  created_at    timestamptz not null default now()
);

-- =====================================================================
-- INDEXES
-- =====================================================================
create index on weddings (venue_id);
create index on weddings (wedding_date);
create index on catalogue_items (venue_id, active);
create index on rental_items (venue_id, active);
create index on rental_holds (weekend_of);
create index on accommodation_rooms (venue_id, active);
create index on accommodation_bookings (room_id, check_in, check_out);
create index on wedding_selections (wedding_id);
create index on guests (wedding_id);
create index on suppliers (wedding_id);
create index on budget_items (wedding_id);
create index on checklist_items (wedding_id);
create index on timeline_items (wedding_id);
create index on payments (wedding_id, status);

-- =====================================================================
-- RLS — Row Level Security
-- =====================================================================
alter table profiles                 enable row level security;
alter table venues                   enable row level security;
alter table venue_members            enable row level security;
alter table weddings                 enable row level security;
alter table wedding_members          enable row level security;
alter table catalogue_items          enable row level security;
alter table rental_items             enable row level security;
alter table rental_holds             enable row level security;
alter table accommodation_rooms      enable row level security;
alter table accommodation_bookings   enable row level security;
alter table wedding_selections       enable row level security;
alter table guests                   enable row level security;
alter table suppliers                enable row level security;
alter table budget_items             enable row level security;
alter table checklist_items          enable row level security;
alter table timeline_items           enable row level security;
alter table payments                 enable row level security;

-- helper: is current user an owner?
create or replace function is_owner() returns boolean
language sql security definer stable as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'owner');
$$;

-- helper: does current user belong to this venue (as staff)?
create or replace function is_venue_member(v uuid) returns boolean
language sql security definer stable as $$
  select exists (select 1 from venue_members where venue_id = v and user_id = auth.uid());
$$;

-- helper: does current user belong to this wedding (as couple)?
create or replace function is_wedding_member(w uuid) returns boolean
language sql security definer stable as $$
  select exists (select 1 from wedding_members where wedding_id = w and user_id = auth.uid());
$$;

-- helper: does current user have any access (owner OR venue staff OR couple) to this wedding?
create or replace function can_access_wedding(w uuid) returns boolean
language sql security definer stable as $$
  select is_owner()
      or is_wedding_member(w)
      or exists (
        select 1 from weddings wd
        where wd.id = w and is_venue_member(wd.venue_id)
      );
$$;

-- profiles: everyone reads their own; owner reads all
create policy "profile self read" on profiles for select
  using (id = auth.uid() or is_owner());
create policy "profile self update" on profiles for update
  using (id = auth.uid());

-- venues: owner reads all; venue_members read their venue; couples read the venue of their wedding
create policy "venue read" on venues for select
  using (
    is_owner()
    or is_venue_member(id)
    or exists (
      select 1 from weddings w
      join wedding_members wm on wm.wedding_id = w.id
      where w.venue_id = venues.id and wm.user_id = auth.uid()
    )
  );
create policy "venue write" on venues for all
  using (is_owner() or is_venue_member(id))
  with check (is_owner() or is_venue_member(id));

create policy "venue_members access" on venue_members for all
  using (is_owner() or user_id = auth.uid() or is_venue_member(venue_id))
  with check (is_owner() or is_venue_member(venue_id));

-- weddings: owner all; venue staff for their venue; couple for their wedding
create policy "wedding read" on weddings for select
  using (is_owner() or is_venue_member(venue_id) or is_wedding_member(id));
create policy "wedding write" on weddings for all
  using (is_owner() or is_venue_member(venue_id))
  with check (is_owner() or is_venue_member(venue_id));

create policy "wedding_members access" on wedding_members for all
  using (is_owner() or user_id = auth.uid() or can_access_wedding(wedding_id))
  with check (is_owner() or can_access_wedding(wedding_id));

-- inventory (catalogue/rentals/accommodation): venue staff write, anyone with access reads
create policy "catalogue read" on catalogue_items for select
  using (
    is_owner()
    or is_venue_member(venue_id)
    or exists (select 1 from weddings w join wedding_members wm on wm.wedding_id = w.id
               where w.venue_id = catalogue_items.venue_id and wm.user_id = auth.uid())
  );
create policy "catalogue write" on catalogue_items for all
  using (is_owner() or is_venue_member(venue_id))
  with check (is_owner() or is_venue_member(venue_id));

create policy "rental read" on rental_items for select
  using (
    is_owner()
    or is_venue_member(venue_id)
    or exists (select 1 from weddings w join wedding_members wm on wm.wedding_id = w.id
               where w.venue_id = rental_items.venue_id and wm.user_id = auth.uid())
  );
create policy "rental write" on rental_items for all
  using (is_owner() or is_venue_member(venue_id))
  with check (is_owner() or is_venue_member(venue_id));

create policy "rental_holds access" on rental_holds for all
  using (can_access_wedding(wedding_id))
  with check (can_access_wedding(wedding_id));

create policy "accommodation read" on accommodation_rooms for select
  using (
    is_owner()
    or is_venue_member(venue_id)
    or exists (select 1 from weddings w join wedding_members wm on wm.wedding_id = w.id
               where w.venue_id = accommodation_rooms.venue_id and wm.user_id = auth.uid())
  );
create policy "accommodation write" on accommodation_rooms for all
  using (is_owner() or is_venue_member(venue_id))
  with check (is_owner() or is_venue_member(venue_id));

create policy "accommodation_bookings access" on accommodation_bookings for all
  using (can_access_wedding(wedding_id))
  with check (can_access_wedding(wedding_id));

-- wedding-level data: anyone with access to the wedding
create policy "selections access"  on wedding_selections for all using (can_access_wedding(wedding_id)) with check (can_access_wedding(wedding_id));
create policy "guests access"      on guests             for all using (can_access_wedding(wedding_id)) with check (can_access_wedding(wedding_id));
create policy "suppliers access"   on suppliers          for all using (can_access_wedding(wedding_id)) with check (can_access_wedding(wedding_id));
create policy "budget access"      on budget_items       for all using (can_access_wedding(wedding_id)) with check (can_access_wedding(wedding_id));
create policy "checklist access"   on checklist_items    for all using (can_access_wedding(wedding_id)) with check (can_access_wedding(wedding_id));
create policy "timeline access"    on timeline_items     for all using (can_access_wedding(wedding_id)) with check (can_access_wedding(wedding_id));
create policy "payments access"    on payments           for all using (can_access_wedding(wedding_id)) with check (can_access_wedding(wedding_id));
