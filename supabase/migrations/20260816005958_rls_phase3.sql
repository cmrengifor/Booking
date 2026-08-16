-- Phase 3 RLS: service_categories, services, service_variants,
-- salon_weekly_hours, staff_weekly_hours, staff_time_off, artist_profiles

-- === service_categories / services / service_variants ======================
-- Public reads active rows (public site needs the menu); only owner/manager
-- of that salon writes (services aren't staff-editable per the brief).

alter table service_categories enable row level security;

create policy service_categories_select on service_categories
  for select
  using (active or staff_role_for_salon(salon_id) is not null or is_platform_admin());

create policy service_categories_write on service_categories
  for all
  using (staff_role_for_salon(salon_id) in ('owner', 'manager') or is_platform_admin())
  with check (staff_role_for_salon(salon_id) in ('owner', 'manager') or is_platform_admin());

alter table services enable row level security;

create policy services_select on services
  for select
  using (active or staff_role_for_salon(salon_id) is not null or is_platform_admin());

create policy services_write on services
  for all
  using (staff_role_for_salon(salon_id) in ('owner', 'manager') or is_platform_admin())
  with check (staff_role_for_salon(salon_id) in ('owner', 'manager') or is_platform_admin());

alter table service_variants enable row level security;

create policy service_variants_select on service_variants
  for select
  using (active or staff_role_for_salon(salon_id) is not null or is_platform_admin());

create policy service_variants_write on service_variants
  for all
  using (staff_role_for_salon(salon_id) in ('owner', 'manager') or is_platform_admin())
  with check (staff_role_for_salon(salon_id) in ('owner', 'manager') or is_platform_admin());

-- === salon_weekly_hours ======================================================
-- Public reads (needed to show salon hours / compute availability display);
-- only owner/manager writes.

alter table salon_weekly_hours enable row level security;

create policy salon_weekly_hours_select on salon_weekly_hours
  for select
  using (true);

create policy salon_weekly_hours_write on salon_weekly_hours
  for all
  using (staff_role_for_salon(salon_id) in ('owner', 'manager') or is_platform_admin())
  with check (staff_role_for_salon(salon_id) in ('owner', 'manager') or is_platform_admin());

-- === staff_weekly_hours / staff_time_off =====================================
-- No public read. Any staff of the salon can read (need to see teammates'
-- schedules for the calendar); only owner/manager writes for MVP (see
-- docs/ARCHITECTURE.md decision H.10 — not self-service yet).

alter table staff_weekly_hours enable row level security;

create policy staff_weekly_hours_select on staff_weekly_hours
  for select
  using (staff_role_for_salon(salon_id) is not null or is_platform_admin());

create policy staff_weekly_hours_write on staff_weekly_hours
  for all
  using (staff_role_for_salon(salon_id) in ('owner', 'manager') or is_platform_admin())
  with check (staff_role_for_salon(salon_id) in ('owner', 'manager') or is_platform_admin());

alter table staff_time_off enable row level security;

create policy staff_time_off_select on staff_time_off
  for select
  using (staff_role_for_salon(salon_id) is not null or is_platform_admin());

create policy staff_time_off_write on staff_time_off
  for all
  using (staff_role_for_salon(salon_id) in ('owner', 'manager') or is_platform_admin())
  with check (staff_role_for_salon(salon_id) in ('owner', 'manager') or is_platform_admin());

-- === artist_profiles ==========================================================
-- Public reads published rows (shown on the public site); staff of the salon
-- can read all (including unpublished, for editing); owner/manager writes.

alter table artist_profiles enable row level security;

create policy artist_profiles_select on artist_profiles
  for select
  using (published or staff_role_for_salon(salon_id) is not null or is_platform_admin());

create policy artist_profiles_write on artist_profiles
  for all
  using (staff_role_for_salon(salon_id) in ('owner', 'manager') or is_platform_admin())
  with check (staff_role_for_salon(salon_id) in ('owner', 'manager') or is_platform_admin());
