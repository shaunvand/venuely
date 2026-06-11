-- Seasonal pricing + area sub-categories (venue-named groups) + offsite spaces.
-- Decisions: venue-defined date ranges (recurring yearly), season affects the
-- WEDDING-day price only, venue-named groups each Included or Extra, offsite
-- (outside-venue) spaces are non-included + seasonal.

-- 1) Area sub-categories — venue-named groups, each Included or Extra, located at
--    the venue or offsite (outside the venue).
create table if not exists venue_area_groups (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references venues(id) on delete cascade,
  name        text not null,
  included    boolean not null default false,            -- Included with booking vs Extra (paid)
  location    text not null default 'venue' check (location in ('venue','offsite')),
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists venue_area_groups_venue_idx on venue_area_groups(venue_id);

-- 2) Venue-defined seasons — recurring yearly date ranges the venue names + prices.
--    start>end (by month/day) wraps across the year-end (e.g. Dec→Feb).
create table if not exists venue_seasons (
  id           uuid primary key default gen_random_uuid(),
  venue_id     uuid not null references venues(id) on delete cascade,
  name         text not null,                            -- e.g. Peak / High / Mid / Low
  start_month  int not null check (start_month between 1 and 12),
  start_day    int not null check (start_day between 1 and 31),
  end_month    int not null check (end_month between 1 and 12),
  end_day      int not null check (end_day between 1 and 31),
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists venue_seasons_venue_idx on venue_seasons(venue_id);

-- 3) Areas belong to an optional sub-category group.
alter table venue_areas add column if not exists group_id uuid references venue_area_groups(id) on delete set null;
create index if not exists venue_areas_group_idx on venue_areas(group_id);

-- 4) area_pricing gains a season dimension. season_id is NULL for the
--    non-seasonal day types (mg/farewell) and for a wedding fallback price;
--    for the wedding day type there is one row per season. Replace the old
--    unique(area_id, day_type) with a season-aware uniqueness (nulls coalesced).
alter table area_pricing add column if not exists season_id uuid references venue_seasons(id) on delete cascade;
alter table area_pricing drop constraint if exists area_pricing_area_id_day_type_key;
create unique index if not exists area_pricing_area_day_season_uniq
  on area_pricing (area_id, day_type, coalesce(season_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- RLS — mirror venue_areas (venue members + owner; couples read via area read path).
alter table venue_area_groups enable row level security;
alter table venue_seasons enable row level security;

drop policy if exists "venue_area_groups rw" on venue_area_groups;
create policy "venue_area_groups rw" on venue_area_groups for all
  using (venue_id in (select venue_id from venue_members where user_id = auth.uid())
         or exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'owner'::user_role)
         or true)  -- read open for couple portals (area pricing is shown to booked couples)
  with check (venue_id in (select venue_id from venue_members where user_id = auth.uid())
              or exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'owner'::user_role));

drop policy if exists "venue_seasons rw" on venue_seasons;
create policy "venue_seasons rw" on venue_seasons for all
  using (venue_id in (select venue_id from venue_members where user_id = auth.uid())
         or exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'owner'::user_role)
         or true)
  with check (venue_id in (select venue_id from venue_members where user_id = auth.uid())
              or exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'owner'::user_role));
