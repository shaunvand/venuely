-- Pricing pivot: from R1499/mo flat to 1% of wedding spend going through the platform.
-- Stored per-venue so we can offer custom rates / pilot deals without code changes.
alter table venues add column if not exists platform_fee_rate numeric(6,4) not null default 0.0100;
alter table venues add column if not exists platform_fee_active boolean not null default true;

-- Optional: when a wedding becomes "booked" or invoiced we'll snapshot the fee owed.
alter table weddings add column if not exists platform_fee_owed numeric(12,2);
alter table weddings add column if not exists platform_fee_paid_at timestamptz;
