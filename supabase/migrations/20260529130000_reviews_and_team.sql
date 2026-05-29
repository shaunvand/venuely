-- Reviews / testimonials + multi-manager team seats.
--
--   reviews        — couple/public testimonials for a venue. Public can submit
--                    (status defaults 'pending'); only 'published' reviews are
--                    visible on the public listing. Venue staff/owner moderate.
--   venue_invites  — one row per "invite a manager" link a venue sends. Mirrors
--                    the wedding_invites shape (token + expiry + accepted_at) so
--                    the auth callback can redeem it into a venue_members row.
--
-- Reuses the existing security-definer helpers is_owner() / is_venue_member(uuid)
-- from the initial schema (20260512212027_initial_schema.sql).

-- =====================================================================
-- REVIEWS
-- =====================================================================
create table if not exists reviews (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid references venues(id) on delete cascade,
  wedding_id  uuid references weddings(id) on delete set null,
  author_name text,
  rating      int check (rating between 1 and 5),
  body        text,
  status      text not null default 'pending' check (status in ('pending','published','hidden')),
  created_at  timestamptz not null default now()
);

create index if not exists reviews_venue_status_idx
  on reviews (venue_id, status, created_at desc);

alter table reviews enable row level security;

-- Anyone (including anon) can submit a review. It lands as 'pending' and is not
-- visible publicly until a venue member publishes it (the moderation step).
-- We constrain the insert to a real, publicly-listed venue and force the
-- incoming status to 'pending' so a crafted client can't self-publish.
drop policy if exists "reviews public insert" on reviews;
create policy "reviews public insert" on reviews for insert
  with check (
    status = 'pending'
    and venue_id in (select id from venues where listed = true)
  );

-- Public listing read: only published reviews, and only for listed venues.
drop policy if exists "reviews public read" on reviews;
create policy "reviews public read" on reviews for select
  using (
    status = 'published'
    and venue_id in (select id from venues where listed = true)
  );

-- Venue staff / owner can see ALL their venue's reviews (any status) to moderate.
drop policy if exists "reviews member read" on reviews;
create policy "reviews member read" on reviews for select
  using (is_owner() or is_venue_member(venue_id));

-- Venue staff / owner moderate (publish / hide) their venue's reviews.
drop policy if exists "reviews member update" on reviews;
create policy "reviews member update" on reviews for update
  using (is_owner() or is_venue_member(venue_id))
  with check (is_owner() or is_venue_member(venue_id));

-- =====================================================================
-- VENUE INVITES  (multi-manager team seats)
-- =====================================================================
create table if not exists venue_invites (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid references venues(id) on delete cascade,
  email       text,
  role        text default 'venue_admin',
  token       text unique,
  expires_at  timestamptz,
  accepted_at timestamptz,
  status      text default 'sent',
  created_at  timestamptz default now()
);

create index if not exists venue_invites_venue_idx on venue_invites (venue_id, created_at desc);
create index if not exists venue_invites_token_idx on venue_invites (token);

alter table venue_invites enable row level security;

-- Venue members / owner manage invites for their own venue.
drop policy if exists "venue_invites manage" on venue_invites;
create policy "venue_invites manage" on venue_invites for all
  using (is_owner() or is_venue_member(venue_id))
  with check (is_owner() or is_venue_member(venue_id));
-- Note: invite redemption (insert venue_members + mark accepted) is performed
-- in app/auth/callback by the service-role client, which bypasses RLS — so no
-- anon/authenticated policy is needed for the token-lookup / accept path.
