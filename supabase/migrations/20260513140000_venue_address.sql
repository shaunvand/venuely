-- Google Places-backed venue address fields.
-- `region` stays as a free-text fallback (manual entries / old rows).
-- `address` is the formatted address from Google.
-- `latitude` / `longitude` for map rendering and distance queries later.
-- `google_place_id` is the canonical Places ID so we can fetch fresh details
--   without re-typing the address.
-- `google_maps_url` is the shareable maps.google.com link Google returns.

alter table venues
  add column if not exists address          text,
  add column if not exists latitude         double precision,
  add column if not exists longitude        double precision,
  add column if not exists google_place_id  text,
  add column if not exists google_maps_url  text;
