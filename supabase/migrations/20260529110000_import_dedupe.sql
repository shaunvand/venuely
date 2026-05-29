-- Smart Import dedupe + undo support.
--
-- `import_batch_id` stamps every row that came from one Smart Import commit so the
-- whole batch can be undone in one shot (see undoImport server action).
--
-- The partial UNIQUE indexes let the commit route UPSERT on (venue_id, item_code)
-- so re-importing the same catalogue/rental sheet UPDATES the existing row instead
-- of creating a duplicate. Only rows that carry an item_code participate; rows
-- without one keep inserting freely (WHERE item_code IS NOT NULL).
--
-- WARNING: this index creation will FAIL if a venue already has duplicate
-- item_codes. Resolve any pre-existing duplicates (collapse or null-out the
-- offending item_code values) BEFORE applying this migration.
--
-- accommodation_rooms / vendor_partners have no item_code column, so they get the
-- batch-id column only (undo still works for them).

alter table catalogue_items     add column if not exists import_batch_id uuid;
alter table rental_items        add column if not exists import_batch_id uuid;
alter table accommodation_rooms add column if not exists import_batch_id uuid;
alter table vendor_partners     add column if not exists import_batch_id uuid;

create unique index if not exists catalogue_items_venue_item_code_uq
  on catalogue_items (venue_id, item_code)
  where item_code is not null;

create unique index if not exists rental_items_venue_item_code_uq
  on rental_items (venue_id, item_code)
  where item_code is not null;

-- Helpful for the undo delete (import_batch_id = $1 and venue_id = $2).
create index if not exists catalogue_items_batch_idx     on catalogue_items     (import_batch_id);
create index if not exists rental_items_batch_idx        on rental_items        (import_batch_id);
create index if not exists accommodation_rooms_batch_idx on accommodation_rooms (import_batch_id);
create index if not exists vendor_partners_batch_idx     on vendor_partners     (import_batch_id);
