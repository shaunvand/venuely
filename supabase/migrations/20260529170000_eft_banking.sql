-- EFT invoicing (no card gateway).
-- 1) Each venue stores the bank details that appear on the invoice couples
--    receive, so couples pay the venue directly by EFT. AI-extracted from an
--    uploaded bank statement (proof kept at bank_statement_url) then reviewed.
-- 2) platform_settings is a single-row table holding Venuely's OWN bank details,
--    used on the 1% commission invoices issued to venues. Managed in the admin
--    portal; RLS-enabled with no policies → only the service role can touch it.

alter table venues
  add column if not exists bank_name            text,
  add column if not exists bank_account_name    text,
  add column if not exists bank_account_number  text,
  add column if not exists bank_branch_code     text,
  add column if not exists bank_swift           text,
  add column if not exists bank_iban            text,
  add column if not exists bank_statement_url   text,
  add column if not exists bank_verified_at     timestamptz;

create table if not exists platform_settings (
  id              int primary key default 1 check (id = 1),
  bank_name       text,
  account_name    text,
  account_number  text,
  branch_code     text,
  swift           text,
  iban            text,
  invoice_from    text,        -- e.g. "Venuely (Pty) Ltd"
  invoice_email   text,        -- reply-to / billing email
  vat_number      text,
  updated_at      timestamptz not null default now()
);

insert into platform_settings (id) values (1) on conflict (id) do nothing;

alter table platform_settings enable row level security;
