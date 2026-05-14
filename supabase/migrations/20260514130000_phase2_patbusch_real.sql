-- Phase 2: seed Pat Busch's actual data from the real confirmation pack PDFs.
-- Idempotent — re-applies cleanly via ON CONFLICT.

do $$
declare v_id uuid;
begin
  select id into v_id from venues where slug = 'pat-busch' limit 1;
  if v_id is null then return; end if;

  -- ---------------------------------------------------------------
  -- Payment rules: 15% VAT inclusive, 50% deposit, 60-day balance,
  --                R15k breakage deposit, refund 14 days
  -- ---------------------------------------------------------------
  update payment_rules
     set vat_inclusive = true, vat_rate = 0.1500,
         deposit_pct = 0.5000, balance_days_before = 60,
         breakage_deposit = 15000, breakage_refund_days = 14,
         currency = 'ZAR',
         notes = 'Standard Pat Busch terms — VAT inclusive in all listed prices.'
   where venue_id = v_id;

  -- ---------------------------------------------------------------
  -- VENUE AREAS  (7 main areas + extras)
  -- ---------------------------------------------------------------
  insert into venue_areas (venue_id, name, slug, description, area_kind, sort_order) values
    (v_id, 'Oak Tree',         'oak-tree',       'Ceremony under the 100-year-old oak',                       'main',  10),
    (v_id, 'Wedding Meadow',   'wedding-meadow', 'Open meadow ceremony spot, mountain backdrop',              'main',  20),
    (v_id, 'Hall / Lapa',      'hall-lapa',      'Covered reception hall with fireplace + bar',               'main',  30),
    (v_id, 'Pool Area',        'pool',           'Sundowner / cocktail hour space by the pool',               'extra', 40),
    (v_id, 'Dam Wall',         'dam-wall',       'Sunset ceremony backdrop on the dam wall',                  'extra', 50),
    (v_id, 'Poplar Forest',    'poplar-forest',  'Picnic / pre-drinks area in the poplar grove',              'extra', 60),
    (v_id, 'Pine Forest',      'pine-forest',    'Photo + ceremony spot in the pines',                        'extra', 70)
  on conflict (venue_id, slug) do update set
    name = excluded.name, description = excluded.description,
    area_kind = excluded.area_kind, sort_order = excluded.sort_order;

  -- Default per-day pricing — extras R2,000–R2,750 depending on day type.
  insert into area_pricing (area_id, day_type, price, included_in_base)
  select va.id, 'wedding', case when va.area_kind = 'main' then 0 else 2500 end, va.area_kind = 'main'
    from venue_areas va where va.venue_id = v_id
  on conflict (area_id, day_type) do nothing;
  insert into area_pricing (area_id, day_type, price, included_in_base)
  select va.id, 'mg', case when va.area_kind = 'main' then 0 else 2000 end, va.area_kind = 'main'
    from venue_areas va where va.venue_id = v_id
  on conflict (area_id, day_type) do nothing;
  insert into area_pricing (area_id, day_type, price, included_in_base)
  select va.id, 'farewell', case when va.area_kind = 'main' then 0 else 2000 end, va.area_kind = 'main'
    from venue_areas va where va.venue_id = v_id
  on conflict (area_id, day_type) do nothing;

  -- ---------------------------------------------------------------
  -- ACCOMMODATION TIERS  — enrich existing rows with tier + ideal/max
  -- ---------------------------------------------------------------
  update accommodation_rooms set tier = 'farmhouse', ideal_sleeps = 23, max_sleeps = 29,
    bridal_suite = false,
    amenities = '{Fireplace,Hot tub,Solar,Wi-Fi,Self-catering kitchen}'::text[]
   where venue_id = v_id and lower(name) like '%farmhouse%' or lower(name) like '%erika%';

  update accommodation_rooms set tier = 'family', ideal_sleeps = 4, max_sleeps = 6,
    amenities = '{Fireplace,Wi-Fi,Self-catering kitchen}'::text[]
   where venue_id = v_id and (lower(name) like '%pine%' or lower(name) like '%quince%' or lower(name) like '%fig%');

  update accommodation_rooms set tier = 'exclusive', ideal_sleeps = 2, max_sleeps = 3,
    amenities = '{Slipper bath,Fireplace,Wi-Fi,Coffee station}'::text[]
   where venue_id = v_id and (lower(name) like '%nightjar%' or lower(name) like '%hadeda%' or lower(name) like '%oak%cottage%');

  update accommodation_rooms set tier = 'africamps', ideal_sleeps = 4, max_sleeps = 5,
    amenities = '{Outdoor shower,Deck,Wi-Fi,Self-catering kitchen,Wood-fired hot tub}'::text[]
   where venue_id = v_id and (lower(name) like '%africamps%' or lower(name) like '%tent%' or lower(name) like '%glamp%');

  update accommodation_rooms set tier = 'standard', ideal_sleeps = 2, max_sleeps = 2
   where venue_id = v_id and tier is null;

  -- Flag a bridal suite — pick the most expensive exclusive unit as the bridal default.
  with bridal as (
    select id from accommodation_rooms
     where venue_id = v_id and tier = 'exclusive'
     order by price_per_night desc nulls last limit 1
  )
  update accommodation_rooms set bridal_suite = true where id in (select id from bridal);

  -- ---------------------------------------------------------------
  -- BREAKAGE DEPOSIT  — auto-add as a refundable wedding_charges template
  --   (we don't insert per-wedding here, just the rule above drives it)
  -- ---------------------------------------------------------------

  -- ---------------------------------------------------------------
  -- A handful of REAL Pat Busch rental codes from the 2026 stock list
  -- ---------------------------------------------------------------
  insert into rental_items (venue_id, category, name, description, price, stock_total, item_code, replacement_value, is_free)
  values
    (v_id, 'Furniture', 'Wimbledon chair (NAKED)', 'Wooden Wimbledon-style chair, undressed', 0,   200, 'R1', 250, true),
    (v_id, 'Furniture', 'Wimbledon chair (DRESSED)', 'Wooden Wimbledon-style chair with white cover + sash', 35, 200, 'R2', 250, false),
    (v_id, 'Furniture', 'Wooden trestle table (2.4m)', 'Seats 8–10', 0, 12, 'R5', 4500, true),
    (v_id, 'Lighting',  'Fairy light curtain 4m x 3m', 'Warm white indoor curtain', 450, 6, 'R12', 2800, false),
    (v_id, 'Decor',     'Hessian table runner (3m)', '', 35, 40, 'R18', 180, false),
    (v_id, 'Kitchen',   'Jura coffee machine (per day)', 'Bean-to-cup, +R12/cup', 750, 1, 'R40', 60000, false)
  on conflict do nothing;

end$$;
