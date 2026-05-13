-- Public signups become venue_admin (each gets their own venue).
-- Owner role is reserved for the SaaS operator (manually provisioned).
-- Removes the prior 'first signup auto-becomes owner' rule.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    'venue_admin'::user_role,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$;
