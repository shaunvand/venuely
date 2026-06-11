-- Mediated supplier messaging. Couples chat from their portal; suppliers reply
-- via a tokenised page (no login) reached from an email notification. Contact
-- info in messages is redacted (Airbnb-style) until the thread is marked booked;
-- the original text (raw_body) is kept for the venue's eyes only.

create table if not exists message_threads (
  id              uuid primary key default gen_random_uuid(),
  venue_id        uuid not null references venues(id) on delete cascade,
  wedding_id      uuid not null references weddings(id) on delete cascade,
  intro_id        uuid references supplier_intros(id) on delete set null,
  vendor_id       uuid references vendor_partners(id) on delete set null, -- null = couple's own supplier
  supplier_name   text not null,
  supplier_type   text,
  supplier_email  text,
  supplier_phone  text,
  -- Unguessable supplier reply credential (64 hex chars, two uuids joined).
  reply_token     text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  status          text not null default 'active' check (status in ('active','booked','closed')),
  couple_unread   int not null default 0,
  last_message_at timestamptz,
  created_at      timestamptz not null default now()
);
-- One thread per wedding+vendor (couple's own suppliers may have several).
create unique index if not exists message_threads_wedding_vendor_uq
  on message_threads (wedding_id, vendor_id) where vendor_id is not null;
create index if not exists message_threads_venue_idx   on message_threads (venue_id);
create index if not exists message_threads_wedding_idx on message_threads (wedding_id);

create table if not exists thread_messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references message_threads(id) on delete cascade,
  venue_id    uuid not null,
  sender      text not null check (sender in ('couple','supplier','venue','system')),
  body        text not null,    -- displayed copy (redacted while not booked)
  raw_body    text,             -- original, only set when flagged; venue-only
  flagged     boolean not null default false,
  flag_reason text,
  created_at  timestamptz not null default now()
);
create index if not exists thread_messages_thread_idx on thread_messages (thread_id);

alter table message_threads enable row level security;
alter table thread_messages enable row level security;

-- Venue members + owner manage their venue's threads. Couple + supplier writes go
-- through the portalAccess/token-gated API routes using the service-role client
-- (same pattern as supplier_intros), so no extra policies are needed.
drop policy if exists "message_threads venue rw" on message_threads;
create policy "message_threads venue rw" on message_threads for all
  using (venue_id in (select venue_id from venue_members where user_id = auth.uid())
         or exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'owner'::user_role))
  with check (venue_id in (select venue_id from venue_members where user_id = auth.uid())
              or exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'owner'::user_role));

drop policy if exists "thread_messages venue rw" on thread_messages;
create policy "thread_messages venue rw" on thread_messages for all
  using (venue_id in (select venue_id from venue_members where user_id = auth.uid())
         or exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'owner'::user_role))
  with check (venue_id in (select venue_id from venue_members where user_id = auth.uid())
              or exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'owner'::user_role));
