-- Guest booking: a near-duplicate of book_appointment that takes the
-- customer's profile_id as an explicit parameter instead of reading
-- auth.uid(). Deliberately NOT granted to anon/authenticated — it's reached
-- only from a Server Action using the service-role admin client, which
-- creates (or reuses) a silent auth.users row for the guest's email first.
-- Regular logged-in booking is untouched; this is an entirely separate path.

create function book_appointment_as_guest(
  p_profile_id uuid,
  p_salon_id uuid,
  p_location_id uuid,
  p_service_id uuid,
  p_service_variant_id uuid,
  p_artist_preference artist_preference,
  p_salon_membership_id uuid,
  p_starts_at timestamptz
)
returns appointments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer_id uuid;
  v_service services;
  v_variant service_variants;
  v_duration int;
  v_buffer int;
  v_price numeric(10, 2);
  v_ends_at timestamptz;
  v_status appointment_status;
  v_membership_id uuid;
  v_appointment appointments;
begin
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

  v_customer_id := get_or_create_customer(p_salon_id, p_profile_id);

  insert into appointments (
    salon_id, location_id, customer_id, service_id, service_variant_id, salon_membership_id,
    status, artist_preference, starts_at, ends_at, price
  ) values (
    p_salon_id, p_location_id, v_customer_id, p_service_id, p_service_variant_id, v_membership_id,
    v_status, p_artist_preference, p_starts_at, v_ends_at, v_price
  )
  returning * into v_appointment;

  insert into appointment_events (appointment_id, salon_id, actor_profile_id, event_type, previous_status, new_status)
  values (v_appointment.id, p_salon_id, p_profile_id, 'created', null, v_status);

  return v_appointment;
end;
$$;

grant execute on function book_appointment_as_guest(uuid, uuid, uuid, uuid, uuid, artist_preference, uuid, timestamptz) to service_role;
