-- Allocate guests to accommodation rooms (mirrors seating's table_number).
alter table guests add column if not exists room_id uuid;
create index if not exists guests_room_id_idx on guests(room_id);
