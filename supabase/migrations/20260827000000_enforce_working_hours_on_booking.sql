-- book_appointment/reschedule_appointment never validated the requested
-- time against the salon's business hours, the artist's shift, their
-- break, or their time-off — the only server-side temporal guard was the
-- GiST exclude constraint, which only blocks a genuinely *overlapping*
-- appointment for the same stylist. Both RPCs are granted directly to
-- authenticated, so any signed-in user could call either one with an
-- arbitrary p_starts_at (3am, a stylist's day off, mid-break) and it would
-- succeed as long as nothing else overlapped.
--
-- This ports the same rules lib/domain/availability.ts already enforces
-- client-side (salon hours, artist hours, artist break, artist time-off)
-- into one shared SQL check both RPCs call before writing, so the rule is
-- enforced at the same layer as the double-booking constraint rather than
-- being only advisory, client-bypassable math.
--
-- For an "any artist" booking (p_salon_membership_id is null — the
-- appointment stays OPEN, unassigned, per this platform's own design),
-- only the salon-hours check applies; there's no specific artist's
-- shift/break/time-off to check yet. Whichever stylist later claims the
-- open appointment does so within their own shift by construction (the
-- availability engine only ever offers slots inside working hours), so
-- this isn't a gap — accept_open_appointment doesn't move the time.

create or replace function assert_within_working_hours(
  p_salon_id uuid,
  p_location_id uuid,
  p_salon_membership_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_timezone text;
  v_local_start timestamp;
  v_local_end timestamp;
  v_dow int;
  v_open time;
  v_close time;
  v_artist_start time;
  v_artist_end time;
  v_break_start time;
  v_break_end time;
begin
  select timezone into v_timezone from salons where id = p_salon_id;
  if v_timezone is null then
    raise exception 'Salon not found.';
  end if;

  -- Every wall-clock comparison below happens in the salon's own timezone,
  -- never UTC or the DB session's default — same invariant as the TS
  -- availability engine (docs/ARCHITECTURE.md section F).
  v_local_start := p_starts_at at time zone v_timezone;
  v_local_end := p_ends_at at time zone v_timezone;
  v_dow := extract(dow from v_local_start); -- 0=Sun..6=Sat, matches every *_weekly_hours table

  if v_local_start::date <> v_local_end::date then
    raise exception 'Appointments cannot span across midnight.';
  end if;

  select open_time, close_time into v_open, v_close
  from salon_weekly_hours
  where location_id = p_location_id and day_of_week = v_dow;

  if v_open is null then
    raise exception 'Salon is closed on the requested day.';
  end if;
  if v_local_start::time < v_open or v_local_end::time > v_close then
    raise exception 'Requested time is outside salon business hours.';
  end if;

  if p_salon_membership_id is not null then
    select start_time, end_time, break_start, break_end
    into v_artist_start, v_artist_end, v_break_start, v_break_end
    from staff_weekly_hours
    where salon_membership_id = p_salon_membership_id and day_of_week = v_dow;

    if v_artist_start is null then
      raise exception 'Artist does not work on the requested day.';
    end if;
    if v_local_start::time < v_artist_start or v_local_end::time > v_artist_end then
      raise exception 'Requested time is outside the artist''s working hours.';
    end if;
    if v_break_start is not null and v_break_end is not null
       and v_local_start::time < v_break_end and v_local_end::time > v_break_start then
      raise exception 'Requested time overlaps the artist''s break.';
    end if;

    if exists (
      select 1 from staff_time_off
      where salon_membership_id = p_salon_membership_id
        and v_local_start::date between start_date and end_date
    ) then
      raise exception 'Artist is on time off on the requested day.';
    end if;
  end if;
end;
$$;

-- Not granted to authenticated/anon on purpose — internal helper only,
-- called from within the already-SECURITY DEFINER RPCs below.

-- === book_appointment: same signature, same body, one new check =============

create or replace function book_appointment(
  p_salon_id uuid,
  p_location_id uuid,
  p_service_id uuid,
  p_service_variant_id uuid,
  p_artist_preference artist_preference,
  p_salon_membership_id uuid,
  p_starts_at timestamptz,
  p_is_home_service boolean default false,
  p_home_service_address text default null,
  p_home_service_zone_id uuid default null,
  p_payment_method text default null,
  p_payment_detail text default null
)
returns appointments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile_id uuid := auth.uid();
  v_customer_id uuid;
  v_service services;
  v_variant service_variants;
  v_duration int;
  v_buffer int;
  v_price numeric(10, 2);
  v_surcharge numeric(10, 2) := 0;
  v_ends_at timestamptz;
  v_status appointment_status;
  v_membership_id uuid;
  v_appointment appointments;
begin
  if v_profile_id is null then
    raise exception 'Must be authenticated to book.';
  end if;

  if not exists (select 1 from salon_locations where id = p_location_id and salon_id = p_salon_id) then
    raise exception 'Location not found for this salon.';
  end if;

  select * into v_service from services where id = p_service_id and salon_id = p_salon_id and active;
  if v_service is null then
    raise exception 'Service not found for this salon.';
  end if;

  if p_service_variant_id is not null then
    select * into v_variant from service_variants where id = p_service_variant_id and service_id = p_service_id and active;
    if v_variant is null then
      raise exception 'Variant not found for this service.';
    end if;
    v_duration := v_variant.duration_minutes;
    v_buffer := v_variant.buffer_minutes;
    v_price := v_variant.price;
  else
    if v_service.has_variants then
      raise exception 'This service requires a variant.';
    end if;
    v_duration := v_service.base_duration_minutes;
    v_buffer := v_service.buffer_minutes;
    v_price := v_service.base_price;
  end if;

  if p_is_home_service and p_home_service_zone_id is not null then
    select surcharge into v_surcharge from home_service_zones
    where id = p_home_service_zone_id and salon_id = p_salon_id and active;
    v_price := v_price + coalesce(v_surcharge, 0);
  end if;

  v_ends_at := p_starts_at + make_interval(mins => v_duration + v_buffer);

  if p_artist_preference = 'specific' then
    if p_salon_membership_id is null then
      raise exception 'A specific artist is required for a specific-preference booking.';
    end if;
    if not exists (
      select 1 from salon_memberships
      where id = p_salon_membership_id and salon_id = p_salon_id and role = 'stylist' and status = 'active'
        and location_id = p_location_id
    ) then
      raise exception 'Selected artist is not available at this location.';
    end if;
    v_status := 'pending';
    v_membership_id := p_salon_membership_id;
  else
    v_status := 'open';
    v_membership_id := null;
  end if;

  perform assert_within_working_hours(p_salon_id, p_location_id, v_membership_id, p_starts_at, v_ends_at);

  v_customer_id := get_or_create_customer(p_salon_id, v_profile_id);

  insert into appointments (
    salon_id, location_id, customer_id, service_id, service_variant_id, salon_membership_id,
    status, artist_preference, starts_at, ends_at, price,
    is_home_service, home_service_address, home_service_zone_id, home_service_surcharge
  ) values (
    p_salon_id, p_location_id, v_customer_id, p_service_id, p_service_variant_id, v_membership_id,
    v_status, p_artist_preference, p_starts_at, v_ends_at, v_price,
    p_is_home_service, p_home_service_address, p_home_service_zone_id,
    case when p_is_home_service then v_surcharge else null end
  )
  returning * into v_appointment;

  insert into appointment_events (appointment_id, salon_id, actor_profile_id, event_type, previous_status, new_status)
  values (v_appointment.id, p_salon_id, v_profile_id, 'created', null, v_status);

  if p_payment_method is not null then
    insert into appointment_payment_selections (appointment_id, salon_id, method, detail)
    values (v_appointment.id, p_salon_id, p_payment_method, p_payment_detail);
  end if;

  return v_appointment;
end;
$$;

-- === reschedule_appointment: same signature, same body, one new check =======

create or replace function reschedule_appointment(
  p_appointment_id uuid,
  p_new_starts_at timestamptz,
  p_new_salon_membership_id uuid default null
)
returns appointments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile_id uuid := auth.uid();
  v_appointment appointments;
  v_previous_status appointment_status;
  v_salon salons;
  v_service services;
  v_variant service_variants;
  v_duration int;
  v_buffer int;
  v_new_ends_at timestamptz;
  v_is_customer boolean;
  v_is_staff boolean;
  v_membership_id uuid;
  v_old_starts_at timestamptz;
  v_old_ends_at timestamptz;
begin
  select * into v_appointment from appointments where id = p_appointment_id;
  if v_appointment is null then
    raise exception 'Appointment not found.';
  end if;
  v_previous_status := v_appointment.status;
  v_old_starts_at := v_appointment.starts_at;
  v_old_ends_at := v_appointment.ends_at;

  select * into v_salon from salons where id = v_appointment.salon_id;

  select exists (select 1 from customers where id = v_appointment.customer_id and profile_id = v_profile_id) into v_is_customer;
  select exists (select 1 from salon_memberships where salon_id = v_appointment.salon_id and profile_id = v_profile_id and role in ('receptionist', 'manager', 'owner') and status = 'active') into v_is_staff;

  if not v_is_staff and v_appointment.salon_membership_id is not null then
    select exists (select 1 from salon_memberships where id = v_appointment.salon_membership_id and profile_id = v_profile_id and status = 'active') into v_is_staff;
  end if;

  if not v_is_customer and not v_is_staff then
    raise exception 'Not authorized to reschedule this appointment.';
  end if;

  if v_is_customer and not v_is_staff then
    if v_appointment.starts_at <= now() + make_interval(hours => v_salon.cancellation_cutoff_hours) then
      raise exception 'Reschedule window has passed (% hours required).', v_salon.cancellation_cutoff_hours;
    end if;
  end if;

  select * into v_service from services where id = v_appointment.service_id;
  if v_appointment.service_variant_id is not null then
    select * into v_variant from service_variants where id = v_appointment.service_variant_id;
    v_duration := v_variant.duration_minutes;
    v_buffer := v_variant.buffer_minutes;
  else
    v_duration := v_service.base_duration_minutes;
    v_buffer := v_service.buffer_minutes;
  end if;

  v_new_ends_at := p_new_starts_at + make_interval(mins => v_duration + v_buffer);
  v_membership_id := coalesce(p_new_salon_membership_id, v_appointment.salon_membership_id);

  perform assert_within_working_hours(v_appointment.salon_id, v_appointment.location_id, v_membership_id, p_new_starts_at, v_new_ends_at);

  update appointments
  set starts_at = p_new_starts_at,
      ends_at = v_new_ends_at,
      salon_membership_id = case when status = 'open' then null else v_membership_id end
  where id = p_appointment_id and status in ('pending', 'confirmed', 'open')
  returning * into v_appointment;

  if v_appointment is null then
    raise exception 'Appointment cannot be rescheduled from its current status.';
  end if;

  insert into appointment_events (appointment_id, salon_id, actor_profile_id, event_type, previous_status, new_status, metadata)
  values (
    v_appointment.id, v_appointment.salon_id, v_profile_id, 'rescheduled', v_previous_status, v_appointment.status,
    jsonb_build_object('old_starts_at', v_old_starts_at, 'old_ends_at', v_old_ends_at, 'new_starts_at', p_new_starts_at, 'new_ends_at', v_new_ends_at)
  );

  return v_appointment;
end;
$$;
