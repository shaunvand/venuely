-- First user ever to sign up becomes the owner and is attached to every venue.
-- Subsequent signups default to role 'couple'.
-- Idempotent — owner uniqueness is also enforced by the partial unique index
-- in 20260512230000_owner_uniqueness.sql.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role user_role;
  v_has_owner boolean;
begin
  select exists (select 1 from public.profiles where role = 'owner') into v_has_owner;
  v_role := case when v_has_owner then 'couple'::user_role else 'owner'::user_role end;

  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    v_role,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );

  -- New owner: auto-link to every existing venue so /venue/* works immediately.
  if v_role = 'owner' then
    insert into public.venue_members (venue_id, user_id, is_primary)
    select v.id, new.id, true from public.venues v
    on conflict (venue_id, user_id) do nothing;
  end if;

  return new;
end;
$$;
