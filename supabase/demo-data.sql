-- Bulk demo dataset for the "Atelier Noir" fictional salon — 4 locations,
-- 12 stylists, ~20 customers, ~180 historical + upcoming appointments.
-- Deliberately separate from seed.sql (which stays the minimal 2-location/
-- 2-stylist baseline every other migration/RLS check was written against).
--
-- This existed only as one-off ad-hoc inserts run directly against the live
-- database in an earlier session (never saved anywhere) — this script is a
-- reconstruction that reproduces an equivalent-shaped environment, not a
-- byte-for-byte replay of the exact original rows. Idempotent: safe to
-- re-run, everything is guarded by `on conflict do nothing` / existence
-- checks, and appointment inserts silently skip on an EXCLUDE-constraint
-- overlap instead of failing the whole script.
--
-- Requires seed.sql to have run first (needs the salon, Chapinero/Zona Rosa
-- locations, and the two original stylists to already exist).
--
-- Run with:
--   npx supabase db query --linked -f supabase/seed.sql
--   npx supabase db query --linked -f supabase/demo-data.sql

do $$
declare
  v_salon_id uuid;
  v_chapinero_id uuid;
  v_zonarosa_id uuid;
  v_usaquen_id uuid;
  v_suba_id uuid;
  v_service_ids uuid[];
  v_variant_ids uuid[];
  v_customer_ids uuid[] := '{}';
  v_membership_ids uuid[] := '{}';
  v_stylist record;
  v_stylist_id uuid;
  v_membership_id uuid;
  v_i int;
  v_customer_id uuid;
  v_status text;
  v_starts_at timestamptz;
  v_duration int;
  v_price numeric;
  v_service_idx int;
  v_chosen_service_id uuid;
  v_chosen_variant_id uuid;
  v_chosen_location_id uuid;
  v_customer_record_id uuid;
  v_appointments_created int := 0;
begin
  select id into v_salon_id from salons where slug = 'atelier-noir';
  if v_salon_id is null then
    raise exception 'Run seed.sql first — atelier-noir salon does not exist yet.';
  end if;

  select id into v_chapinero_id from salon_locations where salon_id = v_salon_id and name = 'Chapinero';
  select id into v_zonarosa_id from salon_locations where salon_id = v_salon_id and name = 'Zona Rosa';
  if v_chapinero_id is null or v_zonarosa_id is null then
    raise exception 'Run seed.sql first — Chapinero/Zona Rosa locations do not exist yet.';
  end if;

  -- === Two more locations ===
  insert into salon_locations (salon_id, name, address, sort_order)
  select v_salon_id, 'Usaquén', 'Cl. 119 # 6-24, Usaquén, Bogotá', 3
  where not exists (select 1 from salon_locations where salon_id = v_salon_id and name = 'Usaquén')
  returning id into v_usaquen_id;
  if v_usaquen_id is null then
    select id into v_usaquen_id from salon_locations where salon_id = v_salon_id and name = 'Usaquén';
  end if;

  insert into salon_locations (salon_id, name, address, sort_order)
  select v_salon_id, 'Suba', 'Av. Suba # 100-20, Suba, Bogotá', 4
  where not exists (select 1 from salon_locations where salon_id = v_salon_id and name = 'Suba')
  returning id into v_suba_id;
  if v_suba_id is null then
    select id into v_suba_id from salon_locations where salon_id = v_salon_id and name = 'Suba';
  end if;

  -- === Ten more stylists, three per new-ish location, matching names
  -- already used in prior demo/QA sessions of this app ===
  for v_stylist in
    select * from (values
      ('Camila Ríos', 'camila.rios', v_chapinero_id),
      ('Daniela Torres', 'daniela.torres', v_chapinero_id),
      ('Isabella Moreno', 'isabella.moreno', v_zonarosa_id),
      ('Mariana Castro', 'mariana.castro', v_zonarosa_id),
      ('Laura Jiménez', 'laura.jimenez', v_usaquen_id),
      ('Natalia Vargas', 'natalia.vargas', v_usaquen_id),
      ('Andrea Salazar', 'andrea.salazar', v_usaquen_id),
      ('Paula Restrepo', 'paula.restrepo', v_suba_id),
      ('Juliana Ortiz', 'juliana.ortiz', v_suba_id),
      ('Carolina Mejía', 'carolina.mejia', v_suba_id)
    ) as t(display_name, email_local, location_id)
  loop
    select p.id into v_stylist_id
    from auth.users u join profiles p on p.id = u.id
    where u.email = v_stylist.email_local || '@atelier-noir.example';

    if v_stylist_id is null then
      v_stylist_id := gen_random_uuid();
      insert into auth.users (
        id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, recovery_token,
        email_change_token_new, email_change
      ) values (
        v_stylist_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        v_stylist.email_local || '@atelier-noir.example', crypt(gen_random_uuid()::text, gen_salt('bf')), now(),
        '{}', jsonb_build_object('full_name', v_stylist.display_name),
        now(), now(), '', '', '', ''
      );
    end if;

    insert into salon_memberships (salon_id, profile_id, role, status, location_id)
    values (v_salon_id, v_stylist_id, 'stylist', 'active', v_stylist.location_id)
    on conflict (salon_id, profile_id) where profile_id is not null do nothing
    returning id into v_membership_id;
    if v_membership_id is null then
      select id into v_membership_id from salon_memberships where salon_id = v_salon_id and profile_id = v_stylist_id;
    end if;

    insert into artist_profiles (salon_membership_id, salon_id, display_name, bio, specialties)
    values (v_membership_id, v_salon_id, v_stylist.display_name,
            'Especialista en cuidado de uñas con atención al detalle.', array['Manicure', 'Pedicure'])
    on conflict (salon_membership_id) do nothing;

    v_membership_ids := array_append(v_membership_ids, v_membership_id);
  end loop;

  -- Prepend the two original stylists so appointment generation below
  -- spreads across all 12, not just the 10 new ones.
  select array_agg(id) into v_membership_ids
  from salon_memberships
  where salon_id = v_salon_id and role = 'stylist' and status = 'active';

  -- === Fifteen more customers ===
  for v_i in 1..15 loop
    select p.id into v_customer_id
    from auth.users u join profiles p on p.id = u.id
    where u.email = 'demo-customer-' || v_i || '@atelier-noir.example';

    if v_customer_id is null then
      v_customer_id := gen_random_uuid();
      insert into auth.users (
        id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, recovery_token,
        email_change_token_new, email_change
      ) values (
        v_customer_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'demo-customer-' || v_i || '@atelier-noir.example', crypt(gen_random_uuid()::text, gen_salt('bf')), now(),
        '{}', jsonb_build_object('full_name', 'Demo Cliente ' || v_i),
        now(), now(), '', '', '', ''
      );
    end if;

    v_customer_id := get_or_create_customer(v_salon_id, v_customer_id);
    v_customer_ids := array_append(v_customer_ids, v_customer_id);
  end loop;

  select array_agg(id) into v_service_ids from services where salon_id = v_salon_id and active and not has_variants;
  select array_agg(id) into v_variant_ids from service_variants where salon_id = v_salon_id and active;

  -- Appointment generation isn't naturally idempotent (nothing to
  -- "on conflict" against for randomly-timed rows) — skip it on a re-run
  -- once there's already a realistic volume, rather than piling up more
  -- appointments every time this script runs.
  select count(*) into v_appointments_created from appointments where salon_id = v_salon_id;
  if v_appointments_created >= 100 then
    raise notice 'demo-data: % appointments already exist for this salon, skipping generation', v_appointments_created;
    return;
  end if;
  v_appointments_created := 0;

  -- === ~140 historical appointments over the last 14 days, mixed statuses,
  -- ~40 upcoming pending/confirmed ones ===
  for v_i in 1..220 loop
    v_membership_id := v_membership_ids[1 + floor(random() * array_length(v_membership_ids, 1))::int];
    select location_id into v_chosen_location_id from salon_memberships where id = v_membership_id;
    v_customer_record_id := v_customer_ids[1 + floor(random() * array_length(v_customer_ids, 1))::int];

    v_chosen_variant_id := null;
    if random() < 0.7 and v_service_ids is not null and array_length(v_service_ids, 1) > 0 then
      v_service_idx := 1 + floor(random() * array_length(v_service_ids, 1))::int;
      v_chosen_service_id := v_service_ids[v_service_idx];
      select base_duration_minutes, base_price into v_duration, v_price
      from services where id = v_chosen_service_id;
    elsif v_variant_ids is not null and array_length(v_variant_ids, 1) > 0 then
      v_service_idx := 1 + floor(random() * array_length(v_variant_ids, 1))::int;
      v_chosen_variant_id := v_variant_ids[v_service_idx];
      select service_id, duration_minutes, price into v_chosen_service_id, v_duration, v_price
      from service_variants where id = v_chosen_variant_id;
    else
      continue;
    end if;

    if v_duration is null or v_price is null then
      continue;
    end if;

    if v_i <= 180 then
      -- historical: last 14 days, business hours
      v_starts_at := (now() - (random() * interval '14 days'))::date
        + make_interval(hours => 9 + floor(random() * 8)::int, mins => (floor(random() * 4) * 15)::int);
      v_status := (array['completed', 'completed', 'completed', 'cancelled', 'no_show'])[1 + floor(random() * 5)::int];
    else
      -- upcoming: next 14 days, business hours
      v_starts_at := (now() + (random() * interval '14 days'))::date
        + make_interval(hours => 9 + floor(random() * 8)::int, mins => (floor(random() * 4) * 15)::int);
      v_status := (array['pending', 'confirmed'])[1 + floor(random() * 2)::int];
    end if;

    begin
      insert into appointments (
        salon_id, location_id, customer_id, service_id, service_variant_id, salon_membership_id,
        status, artist_preference, starts_at, ends_at, price
      ) values (
        v_salon_id, v_chosen_location_id, v_customer_record_id,
        v_chosen_service_id, v_chosen_variant_id,
        v_membership_id, v_status::appointment_status, 'specific',
        v_starts_at, v_starts_at + make_interval(mins => v_duration), v_price
      );
      v_appointments_created := v_appointments_created + 1;
    exception
      when exclusion_violation then
        -- overlapping slot for this stylist, skip and move on — expected
        -- and fine at this insert volume, not a bug.
        null;
      when others then
        raise notice 'demo-data: skipped one appointment insert (%): %', sqlstate, sqlerrm;
    end;
  end loop;

  raise notice 'Demo data ready: % stylists, % customers, % new appointments inserted',
    array_length(v_membership_ids, 1), array_length(v_customer_ids, 1), v_appointments_created;
end $$;
