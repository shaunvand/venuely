-- Multi-day events.
-- Until now a wedding had a single `wedding_date`. Real bookings often span a
-- weekend (e.g. Friday welcome dinner → Sunday brunch), so we add an optional
-- `wedding_end_date`. It is nullable: a null end date means a single-day event
-- on `wedding_date` (every existing row keeps working unchanged). When set, the
-- venue calendar renders the booking as a span from wedding_date..wedding_end_date.

alter table weddings
  add column if not exists wedding_end_date date;

-- Keep range sane: an end date, when present, must not precede the start date.
-- Drop-then-add so re-running the migration is idempotent.
alter table weddings drop constraint if exists weddings_date_range_chk;
alter table weddings
  add constraint weddings_date_range_chk
  check (wedding_end_date is null or wedding_date is null or wedding_end_date >= wedding_date);

create index if not exists weddings_end_date_idx on weddings (wedding_end_date);
