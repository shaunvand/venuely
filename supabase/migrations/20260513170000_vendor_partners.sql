-- Vendor partners (caterers, planners, florists, djs, photographers, decor, bar)
create type vendor_type as enum ('caterer','planner','florist','dj','photographer','decor','bar');

create table vendor_partners (
  id              uuid primary key default gen_random_uuid(),
  venue_id        uuid not null references venues(id) on delete cascade,
  vendor_type     vendor_type not null,
  name            text not null,
  description     text,
  contact_email   text,
  contact_phone   text,
  website_url     text,
  price_from      numeric(10,2),
  image_url       text,
  active          boolean not null default true,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);

create index vendor_partners_venue_idx on vendor_partners (venue_id, vendor_type, sort_order);

alter table vendor_partners enable row level security;

drop policy if exists "vendor_partners venue read" on vendor_partners;
create policy "vendor_partners venue read" on vendor_partners
  for select using (
    venue_id in (select venue_id from venue_members where user_id = auth.uid())
    or exists (select 1 from profiles where id = auth.uid() and role = 'owner')
    or active = true
  );

drop policy if exists "vendor_partners venue write" on vendor_partners;
create policy "vendor_partners venue write" on vendor_partners
  for all using (
    venue_id in (select venue_id from venue_members where user_id = auth.uid())
    or exists (select 1 from profiles where id = auth.uid() and role = 'owner')
  );
