-- Paystack commission rail (1% of money transacted, no monthly fee).
-- Rail = Paystack Subaccounts: the couple pays the full amount, Paystack settles
-- T+1 with the platform fee taken off the top and the venue's net routed to the
-- venue's bank subaccount. This migration is the storage scaffold; it can be
-- applied before any Paystack key exists — nothing here calls Paystack.

-- =====================================================================
-- VENUE PAYOUT / SUBACCOUNT FIELDS
-- =====================================================================
alter table venues add column if not exists paystack_subaccount_code text;
alter table venues add column if not exists payout_bank_code         text;
alter table venues add column if not exists payout_account_last4     text;
alter table venues add column if not exists payouts_verified_at      timestamptz;

-- =====================================================================
-- PLATFORM PAYMENTS  (one row per money-movement event we observe via Paystack)
-- =====================================================================
create table if not exists platform_payments (
  id            uuid primary key default gen_random_uuid(),
  venue_id      uuid references venues(id) on delete cascade,
  wedding_id    uuid references weddings(id) on delete set null,
  provider      text not null default 'paystack',
  provider_ref  text,                                  -- Paystack reference / event id
  event_type    text not null check (event_type in ('charge_succeeded','split_settled','refund','chargeback')),
  gross_amount  numeric(12,2),                         -- full amount the couple paid (major units, ZAR)
  platform_fee  numeric(12,2),                         -- our 1% (off the top)
  venue_net     numeric(12,2),                         -- gross - platform_fee, settled to the venue
  currency      text not null default 'ZAR',
  raw_payload   jsonb,
  created_at    timestamptz not null default now(),
  unique (provider, provider_ref)
);

create index if not exists platform_payments_venue_idx on platform_payments (venue_id, created_at desc);

-- =====================================================================
-- RLS: owner full access; venue members may SELECT their own venue's rows.
-- Webhook writes use the service-role key and bypass RLS.
-- =====================================================================
alter table platform_payments enable row level security;

drop policy if exists "platform_payments read" on platform_payments;
create policy "platform_payments read" on platform_payments for select using (
  venue_id in (select venue_id from venue_members where user_id = auth.uid())
  or exists (select 1 from profiles where id = auth.uid() and role = 'owner')
);

drop policy if exists "platform_payments owner write" on platform_payments;
create policy "platform_payments owner write" on platform_payments for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'owner')
);
