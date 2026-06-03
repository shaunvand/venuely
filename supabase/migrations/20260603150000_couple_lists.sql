-- Couple-managed lists: day timeline, contacts (vendor + emergency), song requests.
-- RLS enabled, no policies → service role only (couple writes via portalAccess API).
create table if not exists wedding_timeline (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings(id) on delete cascade,
  start_time text, title text not null, location text, responsible text,
  notes text, sort_order int default 0, created_at timestamptz not null default now()
);
create table if not exists wedding_contacts (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings(id) on delete cascade,
  role text, name text not null, company text, phone text, email text,
  is_emergency boolean default false, notes text, created_at timestamptz not null default now()
);
create table if not exists wedding_songs (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings(id) on delete cascade,
  moment text, title text not null, artist text, notes text,
  sort_order int default 0, created_at timestamptz not null default now()
);
create index if not exists wedding_timeline_wid on wedding_timeline(wedding_id);
create index if not exists wedding_contacts_wid on wedding_contacts(wedding_id);
create index if not exists wedding_songs_wid on wedding_songs(wedding_id);
alter table wedding_timeline enable row level security;
alter table wedding_contacts enable row level security;
alter table wedding_songs enable row level security;
