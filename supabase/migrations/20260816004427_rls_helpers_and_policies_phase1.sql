-- Phase 1: identity helper functions + RLS for salons, profiles, platform_admins,
-- salon_memberships, customers.
--
-- Every helper is SECURITY DEFINER + owned by the migration role, so it bypasses RLS
-- on the tables it reads internally (Postgres does not apply RLS to a table's owner by
-- default). This is what lets is_platform_admin() read platform_admins without the
-- self-referential-policy recursion problem the architecture doc calls out.

create or replace function current_profile_id()
returns uuid
language sql
stable
set search_path = public, pg_temp
as $$
  select auth.uid();
$$;

create or replace function is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from platform_admins where profile_id = auth.uid()
  );
$$;

create or replace function staff_role_for_salon(p_salon_id uuid)
returns salon_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role
  from salon_memberships
  where salon_id = p_salon_id
    and profile_id = auth.uid()
    and status = 'active'
  limit 1;
$$;

-- === salons ===============================================================

alter table salons enable row level security;

create policy salons_select on salons
  for select
  using (
    status = 'active'
    or staff_role_for_salon(id) is not null
    or is_platform_admin()
  );

-- Tenant creation is a platform-admin action (onboarding), not self-serve.
create policy salons_insert on salons
  for insert
  with check (is_platform_admin());

create policy salons_update on salons
  for update
  using (
    staff_role_for_salon(id) in ('owner', 'manager')
    or is_platform_admin()
  );

-- === profiles ==============================================================
-- Not a tenant table (platform-wide login identity), so it has no salon_id to key
-- RLS on directly. Visibility is: self, platform admin, or a staff/customer
-- relationship shared with the requester at a common salon.

alter table profiles enable row level security;

create policy profiles_select on profiles
  for select
  using (
    id = auth.uid()
    or is_platform_admin()
    or exists (
      select 1
      from salon_memberships requester
      join salon_memberships colleague
        on colleague.salon_id = requester.salon_id
      where requester.profile_id = auth.uid()
        and requester.status = 'active'
        and colleague.profile_id = profiles.id
        and colleague.status = 'active'
    )
    or exists (
      select 1
      from salon_memberships staff
      join customers c on c.salon_id = staff.salon_id
      where staff.profile_id = auth.uid()
        and staff.status = 'active'
        and c.profile_id = profiles.id
    )
  );

create policy profiles_update_self on profiles
  for update
  using (id = auth.uid() or is_platform_admin());

-- No insert policy: profiles are populated only by the handle_new_user trigger
-- (security definer), never written directly by a client.

-- === platform_admins ========================================================

alter table platform_admins enable row level security;

create policy platform_admins_select on platform_admins
  for select
  using (is_platform_admin());

create policy platform_admins_write on platform_admins
  for all
  using (is_platform_admin())
  with check (is_platform_admin());

-- === salon_memberships ======================================================

alter table salon_memberships enable row level security;

create policy salon_memberships_select on salon_memberships
  for select
  using (
    profile_id = auth.uid()
    or staff_role_for_salon(salon_id) is not null
    or is_platform_admin()
  );

create policy salon_memberships_write on salon_memberships
  for all
  using (
    staff_role_for_salon(salon_id) in ('owner', 'manager')
    or is_platform_admin()
  )
  with check (
    staff_role_for_salon(salon_id) in ('owner', 'manager')
    or is_platform_admin()
  );

-- === customers ===============================================================

alter table customers enable row level security;

create policy customers_select on customers
  for select
  using (
    profile_id = auth.uid()
    or staff_role_for_salon(salon_id) is not null
    or is_platform_admin()
  );

-- A customer record can be created by the person themselves (self-serve booking)
-- or by staff of that salon (walk-ins / phone bookings).
create policy customers_insert on customers
  for insert
  with check (
    profile_id = auth.uid()
    or staff_role_for_salon(salon_id) is not null
    or is_platform_admin()
  );

create policy customers_update on customers
  for update
  using (
    profile_id = auth.uid()
    or staff_role_for_salon(salon_id) is not null
    or is_platform_admin()
  );
