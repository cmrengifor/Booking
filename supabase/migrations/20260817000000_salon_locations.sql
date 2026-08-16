-- Salon locations (branches). A salon can now have multiple physical
-- locations, each with its own staff and operating hours — the booking
-- wizard's new first step. Staff (salon_memberships) and hours
-- (salon_weekly_hours) are scoped to one location each; appointments record
-- which location they were booked at explicitly, since an "any artist"
-- open appointment has no salon_membership_id to derive it from.

create table salon_locations (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons (id) on delete cascade,
  name text not null,
  address text,
  contact_phone text,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table salon_locations is 'Physical branches of a salon. salon_memberships and salon_weekly_hours are each scoped to one location.';

create trigger salon_locations_set_updated_at
  before update on salon_locations
  for each row execute function set_updated_at();

create index salon_locations_salon_idx on salon_locations (salon_id, active, sort_order);

alter table salon_locations enable row level security;

create policy salon_locations_select on salon_locations
  for select
  using (active or staff_role_for_salon(salon_id) is not null or is_platform_admin());

create policy salon_locations_write on salon_locations
  for all
  using (staff_role_for_salon(salon_id) in ('owner', 'manager') or is_platform_admin())
  with check (staff_role_for_salon(salon_id) in ('owner', 'manager') or is_platform_admin());

-- One default location per already-existing salon, so this migration is
-- safe against already-seeded data (fictional or real) without any manual step.
insert into salon_locations (salon_id, name, address, contact_phone)
select id, name, address, contact_phone from salons;

alter table salon_memberships add column location_id uuid references salon_locations (id) on delete set null;
alter table artist_profiles add column location_id uuid references salon_locations (id) on delete set null;

-- salon_weekly_hours: salon_id stays (RLS/denormalization pattern
-- unchanged), location_id becomes the actual grouping key.
alter table salon_weekly_hours add column location_id uuid references salon_locations (id) on delete cascade;

update salon_weekly_hours swh
set location_id = (select id from salon_locations sl where sl.salon_id = swh.salon_id limit 1);

alter table salon_weekly_hours alter column location_id set not null;
alter table salon_weekly_hours drop constraint salon_weekly_hours_salon_id_day_of_week_key;
alter table salon_weekly_hours add constraint salon_weekly_hours_location_day_key unique (location_id, day_of_week);

-- appointments: explicit location_id, not always derivable from
-- salon_membership_id (open/any-artist appointments have none).
alter table appointments add column location_id uuid references salon_locations (id) on delete restrict;

update appointments a
set location_id = (select sm.location_id from salon_memberships sm where sm.id = a.salon_membership_id)
where a.salon_membership_id is not null;

update appointments a
set location_id = (select id from salon_locations sl where sl.salon_id = a.salon_id limit 1)
where a.location_id is null;

alter table appointments alter column location_id set not null;
create index appointments_location_idx on appointments (location_id, starts_at);

-- book_appointment gains p_location_id — signature change, so the old
-- 6-arg version is dropped rather than replaced (CREATE OR REPLACE would
-- otherwise leave both overloads defined).
drop function if exists book_appointment(uuid, uuid, uuid, artist_preference, uuid, timestamptz);

create function book_appointment(
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

  v_customer_id := get_or_create_customer(p_salon_id, v_profile_id);

  insert into appointments (
    salon_id, location_id, customer_id, service_id, service_variant_id, salon_membership_id,
    status, artist_preference, starts_at, ends_at, price
  ) values (
    p_salon_id, p_location_id, v_customer_id, p_service_id, p_service_variant_id, v_membership_id,
    v_status, p_artist_preference, p_starts_at, v_ends_at, v_price
  )
  returning * into v_appointment;

  insert into appointment_events (appointment_id, salon_id, actor_profile_id, event_type, previous_status, new_status)
  values (v_appointment.id, p_salon_id, v_profile_id, 'created', null, v_status);

  return v_appointment;
end;
$$;

grant execute on function book_appointment(uuid, uuid, uuid, uuid, artist_preference, uuid, timestamptz) to authenticated;
