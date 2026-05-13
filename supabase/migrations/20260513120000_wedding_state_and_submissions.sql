-- Pass 2b — persistent couple portal state + submissions.
--
-- wedding_state: opaque JSONB blob holding the couple-portal client state
-- (catalogue ticks, rental selections with qty+days, guests, room assignments,
-- budget overrides, etc.). The static portal app.js syncs this on every save.
--
-- submissions: append-only log of every time a couple clicks "Send to venue".
-- Lets the venue see when an order was placed and a historical trail of edits.

alter table weddings
  add column if not exists wedding_state jsonb not null default '{}'::jsonb,
  add column if not exists wedding_state_updated_at timestamptz;

create or replace function touch_wedding_state()
returns trigger language plpgsql as $$
begin
  new.wedding_state_updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_wedding_state on weddings;
create trigger touch_wedding_state
  before update of wedding_state on weddings
  for each row execute function touch_wedding_state();

-- Submissions log
create table if not exists submissions (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references weddings(id) on delete cascade,
  kind        text not null check (kind in ('catalogue', 'rentals', 'full')),
  state       jsonb not null,
  totals      jsonb,
  message     text,
  created_at  timestamptz not null default now()
);
create index if not exists submissions_wedding_idx on submissions(wedding_id, created_at desc);

alter table submissions enable row level security;
create policy "submissions read"  on submissions for select
  using (can_access_wedding(wedding_id));
create policy "submissions insert" on submissions for insert
  with check (can_access_wedding(wedding_id));
