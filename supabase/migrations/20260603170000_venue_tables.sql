-- Venue seating inventory: the tables/seating the venue has, so the couple portal
-- can offer matching seating options (and a future seating planner can use them).
create table if not exists venue_tables (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues(id) on delete cascade,
  label text not null,
  shape text not null default 'round' check (shape in ('round','square','long','other')),
  seats int not null default 8,
  quantity int not null default 1,
  sort_order int default 0,
  active boolean default true,
  created_at timestamptz not null default now()
);
create index if not exists venue_tables_venue on venue_tables(venue_id, sort_order);
alter table venue_tables enable row level security;
