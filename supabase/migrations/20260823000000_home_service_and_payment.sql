-- Fase N: servicio a domicilio (home service) — a zone-priced surcharge
-- layered on top of a normal booking. Fase O: a payment-method selection
-- captured at booking time, purely informational scaffolding for a future
-- real payment gateway integration (nothing here moves money).
--
-- Both book_appointment and book_appointment_as_guest gain the same new
-- optional parameters so the two booking paths (logged-in vs guest) stay
-- in lockstep. CREATE OR REPLACE can't add parameters, so both are
-- dropped and recreated.

create table home_service_zones (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons (id) on delete cascade,
  name text not null,
  surcharge numeric(10, 2) not null default 0,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

comment on table home_service_zones is 'Neighborhoods/zones a salon covers for at-home service, each with a flat surcharge. Owner/manager-managed, mirrors service_promotions.';

alter table home_service_zones enable row level security;

create policy home_service_zones_select on home_service_zones
  for select
  using (true);

create policy home_service_zones_write on home_service_zones
  for all
  using (staff_role_for_salon(salon_id) in ('owner', 'manager') or is_platform_admin())
  with check (staff_role_for_salon(salon_id) in ('owner', 'manager') or is_platform_admin());

alter table appointments add column is_home_service boolean not null default false;
alter table appointments add column home_service_address text;
alter table appointments add column home_service_zone_id uuid references home_service_zones (id) on delete set null;
alter table appointments add column home_service_surcharge numeric(10, 2);

create table appointment_payment_selections (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references appointments (id) on delete cascade,
  salon_id uuid not null references salons (id) on delete cascade,
  method text not null check (method in ('pse', 'transferencia', 'efectivo')),
  detail text,
  created_at timestamptz not null default now()
);

comment on table appointment_payment_selections is 'Customer''s stated payment intent at booking time — informational only, no real charge happens yet. Written only by the booking RPCs (service-role/SECURITY DEFINER path), no direct client grant.';

alter table appointment_payment_selections enable row level security;

create policy appointment_payment_selections_select on appointment_payment_selections
  for select
  using (staff_role_for_salon(salon_id) is not null or is_platform_admin());

-- === book_appointment (logged-in) ============================================

drop function if exists book_appointment(uuid, uuid, uuid, uuid, artist_preference, uuid, timestamptz);

create function book_appointment(
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

grant execute on function book_appointment(uuid, uuid, uuid, uuid, artist_preference, uuid, timestamptz, boolean, text, uuid, text, text) to authenticated;

-- === book_appointment_as_guest =================================================

drop function if exists book_appointment_as_guest(uuid, uuid, uuid, uuid, uuid, artist_preference, uuid, timestamptz);

create function book_appointment_as_guest(
  p_profile_id uuid,
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

  v_customer_id := get_or_create_customer(p_salon_id, p_profile_id);

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
  values (v_appointment.id, p_salon_id, p_profile_id, 'created', null, v_status);

  if p_payment_method is not null then
    insert into appointment_payment_selections (appointment_id, salon_id, method, detail)
    values (v_appointment.id, p_salon_id, p_payment_method, p_payment_detail);
  end if;

  return v_appointment;
end;
$$;

grant execute on function book_appointment_as_guest(uuid, uuid, uuid, uuid, uuid, artist_preference, uuid, timestamptz, boolean, text, uuid, text, text) to service_role;

-- Fictional demo zones (real pricing to be set by the owner later).
insert into home_service_zones (salon_id, name, surcharge, sort_order)
select id, zone.name, zone.surcharge, zone.sort_order
from salons,
  (values
    ('Chapinero / Zona Rosa', 15000, 1),
    ('Usaquén', 20000, 2),
    ('Suba', 25000, 3),
    ('Kennedy', 30000, 4),
    ('Fontibón', 30000, 5)
  ) as zone(name, surcharge, sort_order)
where salons.slug = 'atelier-noir';
