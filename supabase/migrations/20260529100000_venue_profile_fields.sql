-- Public venue-profile / listing fields.
-- `description` is the public "about / our story" blurb shown on the listing.
-- `directions` is the free-text "how to get here" note.
-- `website` is the venue's own website URL.
-- `included_items` is a JSONB array of "what's included" strings.
-- `capacity_min` / `capacity_max` bound the guest count the venue can host.
-- `setting_type` is 'indoor' | 'outdoor' | 'both'.
-- `ceremony_types` / `amenities` are free-text tag arrays for filtering.
-- `listed` flags whether the venue appears in the public directory.

alter table venues
  add column if not exists description     text,
  add column if not exists directions      text,
  add column if not exists website         text,
  add column if not exists included_items  jsonb,
  add column if not exists capacity_min    int,
  add column if not exists capacity_max    int,
  add column if not exists setting_type    text,
  add column if not exists ceremony_types  text[],
  add column if not exists amenities       text[],
  add column if not exists listed          boolean not null default false;
