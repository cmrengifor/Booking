-- decline_pending_appointment previously hardcoded cancellation_reason to
-- 'declined_by_artist' with no way to say *why* — the admin UI now offers a
-- staff member a short reason (artist unavailable / time no longer
-- available / other free text) that gets stored and used to explain the
-- rejection to the customer by email.

-- CREATE OR REPLACE can't add a parameter — a different arg list is a
-- distinct overload in Postgres, which would leave the old 1-arg signature
-- around and make plain 1-arg calls ambiguous. Drop it explicitly first.
drop function if exists decline_pending_appointment(uuid);

create function decline_pending_appointment(p_appointment_id uuid, p_reason text default null)
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
  set status = 'cancelled', cancellation_reason = coalesce(p_reason, 'declined_by_artist')
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

grant execute on function decline_pending_appointment(uuid, text) to authenticated;
