-- Guest contributions (guest -> couple) + reminder config. Couple->venue payments
-- already live via payment_ledger + deposit/balance reminders.
alter table guests add column if not exists amount_due numeric not null default 0;
alter table guests add column if not exists amount_paid numeric not null default 0;
alter table guests add column if not exists payment_note text;
alter table guests add column if not exists payment_reminder_at timestamptz;
alter table guests add column if not exists rsvp_reminder_at timestamptz;
-- Per-wedding reminder settings: cadence + customisable templates + payment instructions.
alter table weddings add column if not exists reminder_settings jsonb not null default '{}'::jsonb;
