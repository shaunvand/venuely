-- Portal password (optional, hashed) + invoice tracking on each wedding.
alter table weddings add column if not exists portal_password_hash text;
alter table weddings add column if not exists invoiced_at timestamptz;
alter table weddings add column if not exists invoice_total numeric(12,2);
alter table weddings add column if not exists couple_paid_at timestamptz;
