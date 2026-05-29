-- Fix an AND/OR precedence bug in 20260514130000_phase2_patbusch_real.sql.
--
-- The original "farmhouse" tier UPDATE read:
--   ... where venue_id = v_id and lower(name) like '%farmhouse%' or lower(name) like '%erika%';
-- Because AND binds tighter than OR, Postgres parsed this as:
--   (venue_id = v_id AND name LIKE '%farmhouse%') OR (name LIKE '%erika%')
-- so ANY room named like '%erika%' in ANY OTHER venue was mis-tagged as Pat Busch's
-- 'farmhouse' tier (23/29 sleeps, breakage amenities).
--
-- This corrective UPDATE re-applies the INTENDED logic, scoped strictly to Pat Busch's
-- venue, with the OR group properly parenthesised. It is a no-op when the Pat Busch
-- venue is absent.

do $$
declare v_id uuid;
begin
  select id into v_id from venues where slug = 'pat-busch' limit 1;
  if v_id is null then return; end if;

  update accommodation_rooms
     set tier = 'farmhouse', ideal_sleeps = 23, max_sleeps = 29,
         bridal_suite = false,
         amenities = '{Fireplace,Hot tub,Solar,Wi-Fi,Self-catering kitchen}'::text[]
   where venue_id = v_id
     and (lower(name) like '%farmhouse%' or lower(name) like '%erika%');
end$$;
