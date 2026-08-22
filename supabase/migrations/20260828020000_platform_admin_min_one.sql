-- Phase 4 (Platform Admin) adds a "revoke platform admin access" action.
-- Without a floor, revoking the last remaining platform_admins row would
-- lock the platform out of its own admin area entirely — recoverable only
-- via direct SQL (the exact chicken-and-egg problem platform_admins_write's
-- own RLS already has for bootstrapping the very first admin). Same
-- invariant shape as enforce_min_one_owner() from migration 20260828000000,
-- simplified: platform_admins has no status column, so the only dangerous
-- operation is DELETE itself.

create or replace function enforce_min_one_platform_admin()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_remaining int;
begin
  select count(*) into v_remaining from platform_admins where profile_id <> old.profile_id;

  if v_remaining = 0 then
    raise exception 'Debe quedar al menos un platform admin.';
  end if;

  return old;
end;
$$;

create trigger platform_admins_enforce_min_one
  before delete on platform_admins
  for each row
  execute function enforce_min_one_platform_admin();
