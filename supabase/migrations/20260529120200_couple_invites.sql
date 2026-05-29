-- Couple invite & delivery + per-couple/per-guest sub-link lifecycle.
--   wedding_invites    — one row per invite link sent to a couple (email or magic-link token).
--   portal_access_log  — one row per successful portal grant (password or member), for "last opened".
-- weddings gains:
--   portal_salt   — per-wedding salt so rotating access invalidates old password cookies.
--   couple_email  — the couple's contact email captured when an invite is sent.
-- Reuses the existing security-definer helpers (is_owner / is_venue_member) from the initial schema.

-- =====================================================================
-- WEDDING INVITES
-- =====================================================================
create table if not exists wedding_invites (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid references weddings(id) on delete cascade,
  email       text,
  role        text default 'couple',
  token       text unique,
  expires_at  timestamptz,
  accepted_at timestamptz,
  status      text default 'sent',
  created_at  timestamptz default now()
);
create index if not exists wedding_invites_wedding_idx on wedding_invites (wedding_id, created_at desc);
create index if not exists wedding_invites_token_idx on wedding_invites (token);

alter table wedding_invites enable row level security;

-- Venue members / owner manage invites for their venue's weddings.
drop policy if exists "wedding_invites manage" on wedding_invites;
create policy "wedding_invites manage" on wedding_invites for all
  using (
    is_owner()
    or wedding_id in (
      select w.id from weddings w where is_venue_member(w.venue_id)
    )
  )
  with check (
    is_owner()
    or wedding_id in (
      select w.id from weddings w where is_venue_member(w.venue_id)
    )
  );

-- =====================================================================
-- PORTAL ACCESS LOG  (one row per successful grant)
-- =====================================================================
create table if not exists portal_access_log (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid references weddings(id) on delete cascade,
  via         text,
  accessed_at timestamptz default now()
);
create index if not exists portal_access_log_wedding_idx on portal_access_log (wedding_id, accessed_at desc);

alter table portal_access_log enable row level security;

-- Reads: anyone who can manage the wedding (owner / venue staff) — surfaces "last opened".
drop policy if exists "portal_access_log read" on portal_access_log;
create policy "portal_access_log read" on portal_access_log for select
  using (
    is_owner()
    or wedding_id in (
      select w.id from weddings w where is_venue_member(w.venue_id)
    )
  );
-- Writes are performed by the password-gate / state APIs using the service-role key,
-- which bypasses RLS. No anon/authenticated insert policy is granted on purpose.

-- =====================================================================
-- WEDDINGS — per-wedding salt + couple email
-- =====================================================================
alter table weddings add column if not exists portal_salt  text;
alter table weddings add column if not exists couple_email text;
