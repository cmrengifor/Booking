-- Phase 5 gap found while building the public booking flow: the availability
-- engine (Phase 4) needs staff_weekly_hours, staff_time_off, and existing
-- appointment intervals — but all three are correctly staff-only under RLS
-- (docs/ARCHITECTURE.md section D), and an anonymous booking visitor is
-- neither staff nor the appointment's own customer.
--
-- Resolution: three narrow SECURITY DEFINER functions that expose only the
-- shape availability math actually needs (schedule times, time-off ranges,
-- busy windows), and only for artists who already have a *published*
-- artist_profile — i.e., only for people the salon has chosen to put in
-- front of the public anyway. No appointment details, no customer identity,
-- no access to non-public staff (e.g. a receptionist's schedule) leak
-- through this. This is the same pattern as is_platform_admin(): a
-- deliberate, minimal, purpose-built exception, not a blanket RLS bypass.

create or replace function get_public_artist_weekly_hours(p_salon_membership_id uuid)
returns table (day_of_week smallint, start_time time, end_time time, break_start time, break_end time)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select h.day_of_week, h.start_time, h.end_time, h.break_start, h.break_end
  from staff_weekly_hours h
  where h.salon_membership_id = p_salon_membership_id
    and exists (
      select 1 from artist_profiles ap
      where ap.salon_membership_id = p_salon_membership_id and ap.published
    );
$$;

create or replace function get_public_artist_time_off(p_salon_membership_id uuid, p_from date, p_to date)
returns table (start_date date, end_date date)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select t.start_date, t.end_date
  from staff_time_off t
  where t.salon_membership_id = p_salon_membership_id
    and t.end_date >= p_from and t.start_date <= p_to
    and exists (
      select 1 from artist_profiles ap
      where ap.salon_membership_id = p_salon_membership_id and ap.published
    );
$$;

create or replace function get_public_busy_intervals(p_salon_membership_id uuid, p_from timestamptz, p_to timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select a.starts_at, a.ends_at
  from appointments a
  where a.salon_membership_id = p_salon_membership_id
    and a.status in ('pending', 'confirmed')
    and a.starts_at < p_to and a.ends_at > p_from
    and exists (
      select 1 from artist_profiles ap
      where ap.salon_membership_id = p_salon_membership_id and ap.published
    );
$$;

grant execute on function get_public_artist_weekly_hours(uuid) to anon, authenticated;
grant execute on function get_public_artist_time_off(uuid, date, date) to anon, authenticated;
grant execute on function get_public_busy_intervals(uuid, timestamptz, timestamptz) to anon, authenticated;
