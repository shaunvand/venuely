-- Richer couple-managed guest list: accessibility, child flag, side, and POPIA
-- consent timestamp (the couple is the responsible party for their guests' PII).
alter table guests
  add column if not exists accessibility_needs text,
  add column if not exists is_child           boolean default false,
  add column if not exists side               text,
  add column if not exists consent_at         timestamptz;
