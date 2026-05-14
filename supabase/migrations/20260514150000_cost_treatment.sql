-- Per-item "Included in venue cost" vs "Extra / paid separately" flag.
-- When "included" → display the item + its value but DON'T add to wedding total.
-- When "extra"    → normal behaviour (add to wedding total).

alter table catalogue_items     add column if not exists cost_treatment text not null default 'extra'
  check (cost_treatment in ('included','extra'));
alter table rental_items        add column if not exists cost_treatment text not null default 'extra'
  check (cost_treatment in ('included','extra'));
alter table accommodation_rooms add column if not exists cost_treatment text not null default 'extra'
  check (cost_treatment in ('included','extra'));
alter table vendor_partners     add column if not exists cost_treatment text not null default 'extra'
  check (cost_treatment in ('included','extra'));

-- Sync with existing free flags where they're set.
update catalogue_items set cost_treatment = 'included' where is_free = true;
update rental_items     set cost_treatment = 'included' where is_free = true;
