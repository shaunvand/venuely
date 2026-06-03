-- Couple's own budget tracker (separate from the venue's billing).
create table if not exists wedding_budget (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings(id) on delete cascade,
  category text, description text,
  estimated numeric(12,2), actual numeric(12,2), paid numeric(12,2),
  vendor_name text, due_date date, notes text,
  created_at timestamptz not null default now()
);
create index if not exists wedding_budget_wid on wedding_budget(wedding_id);
alter table wedding_budget enable row level security;
