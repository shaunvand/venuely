-- More couple-managed planning lists (checklist, flowers, dress, decor).
create table if not exists wedding_checklist (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings(id) on delete cascade,
  title text not null, due_date date, done boolean default false, notes text,
  sort_order int default 0, created_at timestamptz not null default now()
);
create table if not exists wedding_flowers (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings(id) on delete cascade,
  title text not null, category text, notes text, created_at timestamptz not null default now()
);
create table if not exists wedding_dress (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings(id) on delete cascade,
  title text not null, shop text, notes text, created_at timestamptz not null default now()
);
create table if not exists wedding_decor (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings(id) on delete cascade,
  title text not null, area text, notes text, created_at timestamptz not null default now()
);
create index if not exists wedding_checklist_wid on wedding_checklist(wedding_id);
create index if not exists wedding_flowers_wid on wedding_flowers(wedding_id);
create index if not exists wedding_dress_wid on wedding_dress(wedding_id);
create index if not exists wedding_decor_wid on wedding_decor(wedding_id);
alter table wedding_checklist enable row level security;
alter table wedding_flowers enable row level security;
alter table wedding_dress enable row level security;
alter table wedding_decor enable row level security;
