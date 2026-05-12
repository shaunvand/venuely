-- Prevent more than one owner row from existing.
-- Closes the race in /onboarding/become-owner where two concurrent
-- requests could both pass the count-then-update check.
--
-- Trick: partial unique index on a constant — every row matching
-- `role = 'owner'` gets the same value `(1)`, so only one can exist.

create unique index if not exists profiles_single_owner
  on profiles ((1))
  where role = 'owner';
