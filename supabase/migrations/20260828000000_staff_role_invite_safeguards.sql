-- Phase 3 staff management: invites, role changes, location reassignment.
--
-- Adding role-change surfaced a real gap in the phase1 RLS design: any
-- owner/manager could freely rewrite any salon_memberships row's role
-- (including promoting themselves to owner) or delete/disable the last
-- remaining owner, since salon_memberships_write only ever checked
-- "is the caller an owner or manager of this salon", never who the target
-- row belonged to or what state the salon would be left in. This migration
-- closes that before the new UI makes it reachable:
--
--   1. Any row currently holding role = 'owner' can only be written to
--      (updated or deleted) by another owner (or a platform admin) — a
--      manager can freely manage non-owner rows, same as before, but can no
--      longer touch an owner row at all.
--   2. role itself is now RPC-only for updates (same "one door in" pattern
--      moderate_review() already uses for reviews) via update_staff_role(),
--      which additionally enforces "only an owner can set/unset role =
--      owner" — closing the self-promotion path a raw client call would
--      otherwise still have.
--   3. A trigger guarantees a salon can never end up with zero active
--      owners, regardless of which path is used to get there (delete,
--      disable, or a role change via the RPC).
--   4. activate_pending_invites() implements the activation mechanism the
--      original salon_memberships_identity_check / invited_email columns
--      were designed for but that was never built: on login, link any
--      pending invite matching the caller's verified email to their
--      profile.

drop policy if exists salon_memberships_write on salon_memberships;

create policy salon_memberships_write on salon_memberships
  for all
  using (
    is_platform_admin()
    or (
      staff_role_for_salon(salon_id) in ('owner', 'manager')
      and (role <> 'owner' or staff_role_for_salon(salon_id) = 'owner')
    )
  )
  with check (
    is_platform_admin()
    or (
      staff_role_for_salon(salon_id) in ('owner', 'manager')
      and (role <> 'owner' or staff_role_for_salon(salon_id) = 'owner')
    )
  );

revoke update (role) on salon_memberships from authenticated;

create or replace function enforce_min_one_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_salon_id uuid := coalesce(old.salon_id, new.salon_id);
  v_losing_owner boolean;
  v_remaining_owners int;
begin
  v_losing_owner := old.role = 'owner' and old.status = 'active'
    and (tg_op = 'DELETE' or new.role <> 'owner' or new.status <> 'active');

  if v_losing_owner then
    select count(*) into v_remaining_owners
    from salon_memberships
    where salon_id = v_salon_id
      and role = 'owner'
      and status = 'active'
      and id <> old.id;

    if v_remaining_owners = 0 then
      raise exception 'El salón debe mantener al menos un owner activo.';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger salon_memberships_enforce_min_one_owner
  before update or delete on salon_memberships
  for each row
  execute function enforce_min_one_owner();

create or replace function update_staff_role(p_membership_id uuid, p_new_role salon_role)
returns salon_memberships
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_salon_id uuid;
  v_old_role salon_role;
  v_caller_role salon_role;
  v_row salon_memberships;
begin
  select salon_id, role into v_salon_id, v_old_role
  from salon_memberships
  where id = p_membership_id;

  if v_salon_id is null then
    raise exception 'Staff member not found.';
  end if;

  v_caller_role := staff_role_for_salon(v_salon_id);
  if v_caller_role not in ('owner', 'manager') and not is_platform_admin() then
    raise exception 'Not authorized.';
  end if;

  if (v_old_role = 'owner' or p_new_role = 'owner')
     and v_caller_role <> 'owner' and not is_platform_admin() then
    raise exception 'Solo un owner puede asignar o cambiar el rol de owner.';
  end if;

  update salon_memberships set role = p_new_role
  where id = p_membership_id
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function update_staff_role(uuid, salon_role) to authenticated;

-- Links a pending invite to the profile that just authenticated with the
-- matching email. Idempotent and side-effect-safe to call after every
-- login: the `not exists` guard skips a stale/duplicate invite for someone
-- who already has a membership at that salon, rather than risk colliding
-- with the salon_memberships_salon_profile_key unique index.
create or replace function activate_pending_invites()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update salon_memberships m
  set profile_id = auth.uid(), status = 'active'
  where m.profile_id is null
    and m.status = 'invited'
    and m.invited_email is not null
    and lower(m.invited_email) = lower(auth.email())
    and not exists (
      select 1 from salon_memberships m2
      where m2.salon_id = m.salon_id
        and m2.profile_id = auth.uid()
    );
end;
$$;

grant execute on function activate_pending_invites() to authenticated;
