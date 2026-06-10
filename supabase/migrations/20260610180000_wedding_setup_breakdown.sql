-- Per-wedding set-up and breakdown days (editable by the venue, NOT auto-derived).
-- Power the calendar's phase timeline: Set-up → Wedding Weekend → Breakdown.
alter table weddings
  add column if not exists setup_date     date,
  add column if not exists breakdown_date date;
