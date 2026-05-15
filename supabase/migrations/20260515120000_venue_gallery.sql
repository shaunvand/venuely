-- "Your Venue" gallery: location-categorised photos + videos of the venue itself.

-- Allow video assets.
alter table media_assets drop constraint if exists media_assets_kind_check;
alter table media_assets add constraint media_assets_kind_check
  check (kind in ('photo','floorplan','document','logo','hero','video'));

-- Location grouping for venue gallery (outside, bar, accommodation, ceremony, ...).
alter table media_assets add column if not exists category text;

create index if not exists media_assets_venue_category_idx
  on media_assets (venue_id, owner_type, category, sort_order);
