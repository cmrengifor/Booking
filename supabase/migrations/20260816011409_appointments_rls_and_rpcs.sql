-- Phase 5: appointments RLS (read-only for clients) + the RPC functions that
-- are the ONLY way to write to appointments/appointment_events.
--
-- Gap resolved during implementation, not present in docs/ARCHITECTURE.md as
-- written: the brief gives receptionists "take open appointments" alongside
-- stylists, but a receptionist isn't the person performing the service — so
-- accept_open_appointment() lets a receptionist/manager/owner assign an open
-- appointment TO a named stylist, while a stylist can only self-claim.

-- === appointments / appointment_events RLS ===================================

alter table appointments enable row level security;

create policy appointments_select on appointments
  for select
  using (
    exists (select 1 from customers c where c.id = customer_id and c.profile_id = auth.uid())
    or staff_role_for_salon(salon_id) is not null
    or is_platform_admin()
  );

revoke insert, update, delete on appointments from authenticated;

alter table appointment_events enable row level security;

create policy appointment_events_select on appointment_events
  for select
  using (
    exists (
      select 1 from appointments a
      join customers c on c.id = a.customer_id
      where a.id = appointment_id and c.profile_id = auth.uid()
    )
    or staff_role_for_salon(salon_id) is not null
    or is_platform_admin()
  );

revoke insert, update, delete on appointment_events from authenticated;

-- === get_or_create_customer ===================================================

create or replace function get_or_create_customer(p_salon_id uuid, p_profile_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer_id uuid;
begin
  select id into v_customer_id from customers where salon_id = p_salon_id and profile_id = p_profile_id;
  if v_customer_id is null then
    insert into customers (salon_id, profile_id) values (p_salon_id, p_profile_id)
    returning id into v_customer_id;
  end if;
  return v_customer_id;
end;
$$;

-- === book_appointment ==========================================================

create or replace function book_appointment(
  p_salon_id uuid,
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
  v_profile_id uuid := auth.uid();
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
  if v_profile_id is null then
    raise exception 'Must be authenticated to book.';
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
    ) then
      raise exception 'Selected artist is not available at this salon.';
    end if;
    v_status := 'pending';
    v_membership_id := p_salon_membership_id;
  else
    v_status := 'open';
    v_membership_id := null;
  end if;

  v_customer_id := get_or_create_customer(p_salon_id, v_profile_id);

  insert into appointments (
    salon_id, customer_id, service_id, service_variant_id, salon_membership_id,
    status, artist_preference, starts_at, ends_at, price
  ) values (
    p_salon_id, v_customer_id, p_service_id, p_service_variant_id, v_membership_id,
    v_status, p_artist_preference, p_starts_at, v_ends_at, v_price
  )
  returning * into v_appointment;

  insert into appointment_events (appointment_id, salon_id, actor_profile_id, event_type, previous_status, new_status)
  values (v_appointment.id, p_salon_id, v_profile_id, 'created', null, v_status);

  return v_appointment;
end;
$$;

-- === accept_open_appointment ===================================================

create or replace function accept_open_appointment(
  p_appointment_id uuid,
  p_assign_to_membership_id uuid default null
)
returns appointments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile_id uuid := auth.uid();
  v_appointment appointments;
  v_caller_membership salon_memberships;
  v_target_membership_id uuid;
begin
  select * into v_appointment from appointments where id = p_appointment_id;
  if v_appointment is null then
    raise exception 'Appointment not found.';
  end if;

  select * into v_caller_membership from salon_memberships
  where salon_id = v_appointment.salon_id and profile_id = v_profile_id and status = 'active';

  if v_caller_membership is null or v_caller_membership.role not in ('stylist', 'receptionist', 'manager', 'owner') then
    raise exception 'Not authorized to take open appointments at this salon.';
  end if;

  if v_caller_membership.role = 'stylist' then
    v_target_membership_id := coalesce(p_assign_to_membership_id, v_caller_membership.id);
    if v_target_membership_id <> v_caller_membership.id then
      raise exception 'Stylists can only claim an open appointment for themselves.';
    end if;
  else
    if p_assign_to_membership_id is null then
      raise exception 'Specify which stylist to assign this appointment to.';
    end if;
    v_target_membership_id := p_assign_to_membership_id;
  end if;

  if not exists (
    select 1 from salon_memberships
    where id = v_target_membership_id and salon_id = v_appointment.salon_id and role = 'stylist' and status = 'active'
  ) then
    raise exception 'Target is not an active stylist at this salon.';
  end if;

  update appointments
  set status = 'confirmed', salon_membership_id = v_target_membership_id
  where id = p_appointment_id and status = 'open' and salon_membership_id is null
  returning * into v_appointment;

  if v_appointment is null then
    raise exception 'This appointment was just taken by someone else.';
  end if;

  insert into appointment_events (appointment_id, salon_id, actor_profile_id, event_type, previous_status, new_status, metadata)
  values (v_appointment.id, v_appointment.salon_id, v_profile_id, 'assigned', 'open', 'confirmed', jsonb_build_object('assigned_to', v_target_membership_id));

  return v_appointment;
end;
$$;

-- === accept_pending_appointment ================================================

create or replace function accept_pending_appointment(p_appointment_id uuid)
returns appointments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile_id uuid := auth.uid();
  v_appointment appointments;
  v_authorized boolean := false;
begin
  select * into v_appointment from appointments where id = p_appointment_id;
  if v_appointment is null then
    raise exception 'Appointment not found.';
  end if;

  if exists (select 1 from salon_memberships where id = v_appointment.salon_membership_id and profile_id = v_profile_id and status = 'active') then
    v_authorized := true;
  elsif exists (select 1 from salon_memberships where salon_id = v_appointment.salon_id and profile_id = v_profile_id and role in ('receptionist', 'manager', 'owner') and status = 'active') then
    v_authorized := true;
  end if;

  if not v_authorized then
    raise exception 'Not authorized to accept this appointment.';
  end if;

  update appointments
  set status = 'confirmed'
  where id = p_appointment_id and status = 'pending'
  returning * into v_appointment;

  if v_appointment is null then
    raise exception 'This appointment is no longer pending.';
  end if;

  insert into appointment_events (appointment_id, salon_id, actor_profile_id, event_type, previous_status, new_status)
  values (v_appointment.id, v_appointment.salon_id, v_profile_id, 'accepted', 'pending', 'confirmed');

  return v_appointment;
end;
$$;

-- === decline_pending_appointment ===============================================

create or replace function decline_pending_appointment(p_appointment_id uuid)
returns appointments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile_id uuid := auth.uid();
  v_appointment appointments;
  v_authorized boolean := false;
begin
  select * into v_appointment from appointments where id = p_appointment_id;
  if v_appointment is null then
    raise exception 'Appointment not found.';
  end if;

  if exists (select 1 from salon_memberships where id = v_appointment.salon_membership_id and profile_id = v_profile_id and status = 'active') then
    v_authorized := true;
  elsif exists (select 1 from salon_memberships where salon_id = v_appointment.salon_id and profile_id = v_profile_id and role in ('receptionist', 'manager', 'owner') and status = 'active') then
    v_authorized := true;
  end if;

  if not v_authorized then
    raise exception 'Not authorized to decline this appointment.';
  end if;

  update appointments
  set status = 'cancelled', cancellation_reason = 'declined_by_artist'
  where id = p_appointment_id and status = 'pending'
  returning * into v_appointment;

  if v_appointment is null then
    raise exception 'This appointment is no longer pending.';
  end if;

  insert into appointment_events (appointment_id, salon_id, actor_profile_id, event_type, previous_status, new_status)
  values (v_appointment.id, v_appointment.salon_id, v_profile_id, 'declined', 'pending', 'cancelled');

  return v_appointment;
end;
$$;

-- === release_appointment =======================================================

create or replace function release_appointment(p_appointment_id uuid, p_reason text default null)
returns appointments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile_id uuid := auth.uid();
  v_appointment appointments;
  v_authorized boolean := false;
  v_next_status appointment_status;
begin
  select * into v_appointment from appointments where id = p_appointment_id;
  if v_appointment is null then
    raise exception 'Appointment not found.';
  end if;

  if v_appointment.salon_membership_id is not null
     and exists (select 1 from salon_memberships where id = v_appointment.salon_membership_id and profile_id = v_profile_id and status = 'active') then
    v_authorized := true;
  elsif exists (select 1 from salon_memberships where salon_id = v_appointment.salon_id and profile_id = v_profile_id and role in ('receptionist', 'manager', 'owner') and status = 'active') then
    v_authorized := true;
  end if;

  if not v_authorized then
    raise exception 'Not authorized to release this appointment.';
  end if;

  v_next_status := case when v_appointment.artist_preference = 'any' then 'open' else 'cancelled' end;

  update appointments
  set status = v_next_status,
      salon_membership_id = case when v_next_status = 'open' then null else salon_membership_id end,
      cancellation_reason = case when v_next_status = 'cancelled' then p_reason else cancellation_reason end
  where id = p_appointment_id and status = 'confirmed'
  returning * into v_appointment;

  if v_appointment is null then
    raise exception 'Appointment is not confirmed.';
  end if;

  insert into appointment_events (appointment_id, salon_id, actor_profile_id, event_type, previous_status, new_status)
  values (v_appointment.id, v_appointment.salon_id, v_profile_id, 'released', 'confirmed', v_next_status);

  return v_appointment;
end;
$$;

-- === cancel_appointment =========================================================

create or replace function cancel_appointment(p_appointment_id uuid, p_reason text default null)
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
  v_is_customer boolean;
  v_is_staff boolean;
  v_overridden boolean := false;
begin
  select * into v_appointment from appointments where id = p_appointment_id;
  if v_appointment is null then
    raise exception 'Appointment not found.';
  end if;
  v_previous_status := v_appointment.status;

  select * into v_salon from salons where id = v_appointment.salon_id;

  select exists (select 1 from customers where id = v_appointment.customer_id and profile_id = v_profile_id) into v_is_customer;
  select exists (select 1 from salon_memberships where salon_id = v_appointment.salon_id and profile_id = v_profile_id and role in ('receptionist', 'manager', 'owner') and status = 'active') into v_is_staff;

  if not v_is_customer and not v_is_staff then
    raise exception 'Not authorized to cancel this appointment.';
  end if;

  if v_is_customer and not v_is_staff then
    if v_appointment.starts_at <= now() + make_interval(hours => v_salon.cancellation_cutoff_hours) then
      raise exception 'Cancellation window has passed (% hours required).', v_salon.cancellation_cutoff_hours;
    end if;
  else
    v_overridden := v_appointment.starts_at <= now() + make_interval(hours => v_salon.cancellation_cutoff_hours);
  end if;

  update appointments
  set status = 'cancelled', cancellation_reason = p_reason
  where id = p_appointment_id and status in ('open', 'pending', 'confirmed')
  returning * into v_appointment;

  if v_appointment is null then
    raise exception 'Appointment cannot be cancelled from its current status.';
  end if;

  insert into appointment_events (appointment_id, salon_id, actor_profile_id, event_type, previous_status, new_status, metadata)
  values (
    v_appointment.id, v_appointment.salon_id, v_profile_id, 'cancelled', v_previous_status, 'cancelled',
    case when v_overridden then jsonb_build_object('overridden', true) else '{}'::jsonb end
  );

  return v_appointment;
end;
$$;

-- === reschedule_appointment ======================================================

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

-- === complete_appointment ========================================================

create or replace function complete_appointment(p_appointment_id uuid, p_amount_paid numeric)
returns appointments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile_id uuid := auth.uid();
  v_appointment appointments;
  v_authorized boolean := false;
begin
  select * into v_appointment from appointments where id = p_appointment_id;
  if v_appointment is null then
    raise exception 'Appointment not found.';
  end if;

  if v_appointment.salon_membership_id is not null
     and exists (select 1 from salon_memberships where id = v_appointment.salon_membership_id and profile_id = v_profile_id and status = 'active') then
    v_authorized := true;
  elsif exists (select 1 from salon_memberships where salon_id = v_appointment.salon_id and profile_id = v_profile_id and role in ('receptionist', 'manager', 'owner') and status = 'active') then
    v_authorized := true;
  end if;

  if not v_authorized then
    raise exception 'Not authorized to complete this appointment.';
  end if;

  update appointments
  set status = 'completed', amount_paid = p_amount_paid, payment_status = 'paid'
  where id = p_appointment_id and status = 'confirmed'
  returning * into v_appointment;

  if v_appointment is null then
    raise exception 'Appointment must be confirmed to complete.';
  end if;

  insert into appointment_events (appointment_id, salon_id, actor_profile_id, event_type, previous_status, new_status, metadata)
  values (v_appointment.id, v_appointment.salon_id, v_profile_id, 'completed', 'confirmed', 'completed', jsonb_build_object('amount_paid', p_amount_paid));

  return v_appointment;
end;
$$;

-- === mark_no_show ================================================================

create or replace function mark_no_show(p_appointment_id uuid)
returns appointments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile_id uuid := auth.uid();
  v_appointment appointments;
  v_authorized boolean := false;
begin
  select * into v_appointment from appointments where id = p_appointment_id;
  if v_appointment is null then
    raise exception 'Appointment not found.';
  end if;

  if v_appointment.salon_membership_id is not null
     and exists (select 1 from salon_memberships where id = v_appointment.salon_membership_id and profile_id = v_profile_id and status = 'active') then
    v_authorized := true;
  elsif exists (select 1 from salon_memberships where salon_id = v_appointment.salon_id and profile_id = v_profile_id and role in ('receptionist', 'manager', 'owner') and status = 'active') then
    v_authorized := true;
  end if;

  if not v_authorized then
    raise exception 'Not authorized to mark this appointment as no-show.';
  end if;

  update appointments
  set status = 'no_show'
  where id = p_appointment_id and status = 'confirmed'
  returning * into v_appointment;

  if v_appointment is null then
    raise exception 'Appointment must be confirmed to mark as no-show.';
  end if;

  insert into appointment_events (appointment_id, salon_id, actor_profile_id, event_type, previous_status, new_status)
  values (v_appointment.id, v_appointment.salon_id, v_profile_id, 'no_show', 'confirmed', 'no_show');

  return v_appointment;
end;
$$;

-- === grants =======================================================================
-- authenticated only — booking requires a signed-in profile either way.

grant execute on function book_appointment(uuid, uuid, uuid, artist_preference, uuid, timestamptz) to authenticated;
grant execute on function accept_open_appointment(uuid, uuid) to authenticated;
grant execute on function accept_pending_appointment(uuid) to authenticated;
grant execute on function decline_pending_appointment(uuid) to authenticated;
grant execute on function release_appointment(uuid, text) to authenticated;
grant execute on function cancel_appointment(uuid, text) to authenticated;
grant execute on function reschedule_appointment(uuid, timestamptz, uuid) to authenticated;
grant execute on function complete_appointment(uuid, numeric) to authenticated;
grant execute on function mark_no_show(uuid) to authenticated;
