-- Seat-level seating plan: per-wedding tables + per-guest seat assignment.
create table if not exists wedding_tables (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings(id) on delete cascade,
  name text not null,
  shape text not null default 'long',        -- long | horseshoe | individual
  seats int not null default 8,
  include_ends boolean not null default true,
  sort_order int default 0,
  created_at timestamptz not null default now()
);
create index if not exists wedding_tables_wid on wedding_tables(wedding_id);
alter table wedding_tables enable row level security;
alter table guests add column if not exists seat_table_id uuid;
alter table guests add column if not exists seat_index int;
