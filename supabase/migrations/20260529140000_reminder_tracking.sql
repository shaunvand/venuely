-- Reminder send-tracking for the automated reminder runner.
--
-- The cron route (app/app/api/cron/reminders/route.ts) emails couples whose
-- deposit / balance is coming due (within the next 7 days). To make those sends
-- idempotent — so a daily cron never re-emails the same couple — we stamp the
-- wedding the moment a reminder goes out. A non-null stamp means "already sent",
-- and the runner filters those rows out (deposit_reminder_at IS NULL / etc.).
--
-- timestamptz (not date) because these record an exact send moment, unlike the
-- existing deposit_due_at / balance_due_at due-DATE columns (added in
-- 20260514120000_phase1_foundation.sql). Idempotent so re-applying is a no-op.

alter table weddings add column if not exists deposit_reminder_at timestamptz;
alter table weddings add column if not exists balance_reminder_at timestamptz;
