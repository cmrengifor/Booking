-- Phase 8: notifications table + a trigger on appointment_events that
-- creates them. RPC/system-authored only, per docs/ARCHITECTURE.md — the
-- trigger IS the "system" here, firing in the same transaction as the event
-- it reacts to, so a notification never exists without the event that
-- caused it (or vice versa).

create type notification_type as enum (
  'booking_requested',
  'booking_confirmed',
  'booking_rejected',
  'appointment_rescheduled',
  'appointment_cancelled',
  'appointment_reminder',
  'review_request',
  'open_appointment_available',
  'appointment_assigned'
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons (id) on delete cascade,
  recipient_profile_id uuid not null references profiles (id) on delete cascade,
  type notification_type not null,
  title text not null,
  body text,
  related_appointment_id uuid references appointments (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table notifications is 'In-app notifications. INSERT only via the appointment_events trigger below (system-authored) — no client insert grant.';

create index notifications_recipient_idx on notifications (recipient_profile_id, read_at, created_at desc);

alter table notifications enable row level security;

create policy notifications_select on notifications
  for select
  using (recipient_profile_id = auth.uid());

create policy notifications_update_own on notifications
  for update
  using (recipient_profile_id = auth.uid())
  with check (recipient_profile_id = auth.uid());

revoke insert, delete on notifications from authenticated;

-- === the trigger =============================================================

create or replace function notify_on_appointment_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_appt appointments;
  v_customer_profile_id uuid;
  v_artist_profile_id uuid;
  v_service_name text;
  v_staff record;
begin
  select * into v_appt from appointments where id = new.appointment_id;
  if v_appt is null then
    return new;
  end if;

  select profile_id into v_customer_profile_id from customers where id = v_appt.customer_id;
  select profile_id into v_artist_profile_id from salon_memberships where id = v_appt.salon_membership_id;
  select name into v_service_name from services where id = v_appt.service_id;

  if new.event_type = 'created' and new.new_status = 'pending' then
    insert into notifications (salon_id, recipient_profile_id, type, title, body, related_appointment_id)
    values (v_appt.salon_id, v_customer_profile_id, 'booking_requested', 'Solicitud enviada', v_service_name, v_appt.id);

    if v_artist_profile_id is not null then
      insert into notifications (salon_id, recipient_profile_id, type, title, body, related_appointment_id)
      values (v_appt.salon_id, v_artist_profile_id, 'appointment_assigned', 'Nueva solicitud de reserva', v_service_name, v_appt.id);
    end if;

  elsif new.event_type = 'created' and new.new_status = 'open' then
    for v_staff in
      select profile_id from salon_memberships
      where salon_id = v_appt.salon_id and status = 'active'
        and role in ('stylist', 'receptionist', 'manager', 'owner')
    loop
      insert into notifications (salon_id, recipient_profile_id, type, title, body, related_appointment_id)
      values (v_appt.salon_id, v_staff.profile_id, 'open_appointment_available', 'Cita abierta disponible', v_service_name, v_appt.id);
    end loop;

  elsif new.event_type in ('accepted', 'assigned') then
    insert into notifications (salon_id, recipient_profile_id, type, title, body, related_appointment_id)
    values (v_appt.salon_id, v_customer_profile_id, 'booking_confirmed', 'Reserva confirmada', v_service_name, v_appt.id);

  elsif new.event_type = 'declined' then
    insert into notifications (salon_id, recipient_profile_id, type, title, body, related_appointment_id)
    values (v_appt.salon_id, v_customer_profile_id, 'booking_rejected', 'No se pudo confirmar tu reserva', v_service_name, v_appt.id);

  elsif new.event_type = 'released' then
    if new.new_status = 'open' then
      for v_staff in
        select profile_id from salon_memberships
        where salon_id = v_appt.salon_id and status = 'active'
          and role in ('stylist', 'receptionist', 'manager', 'owner')
          and profile_id <> coalesce(new.actor_profile_id, '00000000-0000-0000-0000-000000000000'::uuid)
      loop
        insert into notifications (salon_id, recipient_profile_id, type, title, body, related_appointment_id)
        values (v_appt.salon_id, v_staff.profile_id, 'open_appointment_available', 'Cita abierta disponible', v_service_name, v_appt.id);
      end loop;
    else
      insert into notifications (salon_id, recipient_profile_id, type, title, body, related_appointment_id)
      values (v_appt.salon_id, v_customer_profile_id, 'booking_rejected', 'No se pudo confirmar tu reserva', v_service_name, v_appt.id);
    end if;

  elsif new.event_type = 'rescheduled' then
    if v_customer_profile_id <> coalesce(new.actor_profile_id, '00000000-0000-0000-0000-000000000000'::uuid) then
      insert into notifications (salon_id, recipient_profile_id, type, title, body, related_appointment_id)
      values (v_appt.salon_id, v_customer_profile_id, 'appointment_rescheduled', 'Cita reagendada', v_service_name, v_appt.id);
    end if;
    if v_artist_profile_id is not null and v_artist_profile_id <> coalesce(new.actor_profile_id, '00000000-0000-0000-0000-000000000000'::uuid) then
      insert into notifications (salon_id, recipient_profile_id, type, title, body, related_appointment_id)
      values (v_appt.salon_id, v_artist_profile_id, 'appointment_rescheduled', 'Cita reagendada', v_service_name, v_appt.id);
    end if;

  elsif new.event_type = 'cancelled' then
    if v_customer_profile_id <> coalesce(new.actor_profile_id, '00000000-0000-0000-0000-000000000000'::uuid) then
      insert into notifications (salon_id, recipient_profile_id, type, title, body, related_appointment_id)
      values (v_appt.salon_id, v_customer_profile_id, 'appointment_cancelled', 'Cita cancelada', v_service_name, v_appt.id);
    end if;
    if v_artist_profile_id is not null and v_artist_profile_id <> coalesce(new.actor_profile_id, '00000000-0000-0000-0000-000000000000'::uuid) then
      insert into notifications (salon_id, recipient_profile_id, type, title, body, related_appointment_id)
      values (v_appt.salon_id, v_artist_profile_id, 'appointment_cancelled', 'Cita cancelada', v_service_name, v_appt.id);
    end if;

  elsif new.event_type = 'completed' then
    insert into notifications (salon_id, recipient_profile_id, type, title, body, related_appointment_id)
    values (v_appt.salon_id, v_customer_profile_id, 'review_request', '¿Cómo estuvo tu cita?', v_service_name, v_appt.id);
  end if;

  return new;
end;
$$;

create trigger appointment_events_notify
  after insert on appointment_events
  for each row
  execute function notify_on_appointment_event();
