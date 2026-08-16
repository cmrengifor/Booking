-- Fictional placeholder salon + demo data (per PRODUCT.md — swapped for the
-- real pilot salon's data later; nothing here is a real business or person).
-- Idempotent: safe to re-run against an existing database.

insert into salons (slug, name, timezone, hero_title, hero_subtitle, hero_image_url, footer_text, address, contact_phone, contact_email)
values (
  'atelier-noir',
  'Atelier Noir',
  'America/Bogota',
  'Atelier Noir',
  'A quiet, precise kind of luxury.',
  'https://images.unsplash.com/photo-1610992015732-2449b76344bc?w=2000&q=80',
  '© Atelier Noir. Placeholder content.',
  'Placeholder address — real pilot salon data replaces this',
  '+57 000 000 0000',
  'hello@atelier-noir.example'
)
on conflict (slug) do update set
  hero_image_url = excluded.hero_image_url,
  footer_text = excluded.footer_text,
  address = excluded.address;

do $$
declare
  v_salon_id uuid;
  v_owner_id uuid := '10000000-0000-0000-0000-000000000003';
  v_sofia_id uuid := '10000000-0000-0000-0000-000000000001';
  v_valentina_id uuid := '10000000-0000-0000-0000-000000000002';
  v_sofia_membership_id uuid;
  v_valentina_membership_id uuid;
  v_manicure_category_id uuid;
  v_pedicure_category_id uuid;
  v_legacy_unas_category_id uuid;
  v_manicure_service_id uuid;
  v_acrilicas_service_id uuid;
  v_manicure_gel_variant_id uuid;
  v_customer_id uuid := '10000000-0000-0000-0000-000000000005';
  v_customer_record_id uuid;
  v_sofia_appt_id uuid;
  v_valentina_appt_id uuid;
  v_chapinero_id uuid;
  v_zonarosa_id uuid;
begin
  select id into v_salon_id from salons where slug = 'atelier-noir';

  -- Two fictional stylists (auth.users, minimal required columns).
  --
  -- Password is a fresh random value every time this ever runs on a new
  -- database, NOT a fixed word — this repo is public, so a guessable
  -- password here would be a real, working credential handed to anyone
  -- who reads this file, not just a fictional detail. To actually sign
  -- in as one of these accounts for local dev/testing, reset the
  -- password yourself via the Supabase dashboard or
  -- `supabase auth admin` against your own project — never commit a
  -- real usable value back into this file.
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) values
    (v_owner_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'owner@atelier-noir.example', crypt(gen_random_uuid()::text, gen_salt('bf')), now(), '{}', '{"full_name":"Camila Torres"}',
     now(), now(), '', '', '', ''),
    (v_sofia_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'sofia@atelier-noir.example', crypt(gen_random_uuid()::text, gen_salt('bf')), now(), '{}', '{"full_name":"Sofia Duarte"}',
     now(), now(), '', '', '', ''),
    (v_valentina_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'valentina@atelier-noir.example', crypt(gen_random_uuid()::text, gen_salt('bf')), now(), '{}', '{"full_name":"Valentina Rey"}',
     now(), now(), '', '', '', '')
  on conflict (id) do nothing;

  insert into salon_memberships (salon_id, profile_id, role, status)
  values
    (v_salon_id, v_owner_id, 'owner', 'active'),
    (v_salon_id, v_sofia_id, 'stylist', 'active'),
    (v_salon_id, v_valentina_id, 'stylist', 'active')
  on conflict (salon_id, profile_id) where profile_id is not null do nothing;

  select id into v_sofia_membership_id from salon_memberships where salon_id = v_salon_id and profile_id = v_sofia_id;
  select id into v_valentina_membership_id from salon_memberships where salon_id = v_salon_id and profile_id = v_valentina_id;

  insert into artist_profiles (salon_membership_id, salon_id, display_name, bio, specialties, headshot_url, about_me, interests)
  values
    (v_sofia_membership_id, v_salon_id, 'Sofia', 'Precision manicures and hand-painted nail art.', array['Nail art', 'Gel'],
     'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=800&q=80',
     'Sofia se formó en Bogotá y São Paulo antes de especializarse en nail art hecho a mano. Le obsesiona la precisión de una línea bien trazada.',
     array['Cat lover', 'Vinilos de jazz', 'Café de especialidad']),
    (v_valentina_membership_id, v_salon_id, 'Valentina', 'Specialist in acrylics and long-lasting sets.', array['Acrylics', 'Sculpted nails'],
     'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=800&q=80',
     'Valentina lleva ocho años esculpiendo acrílicos y encontró en las líneas largas y limpias su firma. Fuera del salón casi siempre anda con las manos en la tierra.',
     array['Plantas', 'Running', 'Cine de autor'])
  on conflict (salon_membership_id) do update set
    headshot_url = excluded.headshot_url,
    about_me = excluded.about_me,
    interests = excluded.interests;

  -- Two fictional branches. The migration auto-created one default location
  -- per existing salon (named after the salon itself) so it's safe to
  -- rename here rather than insert a duplicate.
  select id into v_chapinero_id from salon_locations where salon_id = v_salon_id order by created_at limit 1;
  if v_chapinero_id is null then
    insert into salon_locations (salon_id, name, address, contact_phone, sort_order)
    values (v_salon_id, 'Chapinero', 'Cra. 13 # 54-10, Chapinero, Bogotá', '+57 000 000 0001', 0)
    returning id into v_chapinero_id;
  else
    update salon_locations
    set name = 'Chapinero', address = 'Cra. 13 # 54-10, Chapinero, Bogotá', contact_phone = '+57 000 000 0001', sort_order = 0
    where id = v_chapinero_id and name <> 'Chapinero';
  end if;

  select id into v_zonarosa_id from salon_locations where salon_id = v_salon_id and name = 'Zona Rosa';
  if v_zonarosa_id is null then
    insert into salon_locations (salon_id, name, address, contact_phone, sort_order)
    values (v_salon_id, 'Zona Rosa', 'Cl. 82 # 12-15, Zona Rosa, Bogotá', '+57 000 000 0002', 1)
    returning id into v_zonarosa_id;
  end if;

  -- Sofia works out of Chapinero, Valentina out of Zona Rosa — each
  -- location has its own team, per the improvements backlog decision.
  update salon_memberships set location_id = v_chapinero_id where id = v_sofia_membership_id;
  update salon_memberships set location_id = v_zonarosa_id where id = v_valentina_membership_id;
  update artist_profiles set location_id = v_chapinero_id where salon_membership_id = v_sofia_membership_id;
  update artist_profiles set location_id = v_zonarosa_id where salon_membership_id = v_valentina_membership_id;

  -- Chapinero open Tue–Sat 09:00–18:00; Zona Rosa Tue–Sat 10:00–19:00 —
  -- deliberately different so the location filter is easy to verify.
  insert into salon_weekly_hours (salon_id, location_id, day_of_week, open_time, close_time)
  select v_salon_id, v_chapinero_id, d, '09:00', '18:00'
  from unnest(array[2, 3, 4, 5, 6]) as d
  on conflict (location_id, day_of_week) do nothing;

  insert into salon_weekly_hours (salon_id, location_id, day_of_week, open_time, close_time)
  select v_salon_id, v_zonarosa_id, d, '10:00', '19:00'
  from unnest(array[2, 3, 4, 5, 6]) as d
  on conflict (location_id, day_of_week) do nothing;

  -- Both stylists work their location's full hours with a 13:00–14:00 break.
  -- ON CONFLICT updates (not "do nothing") so a re-run converges Valentina's
  -- hours onto Zona Rosa's window even though rows already existed from
  -- before locations existed.
  insert into staff_weekly_hours (salon_membership_id, salon_id, day_of_week, start_time, end_time, break_start, break_end)
  select v_sofia_membership_id, v_salon_id, d, '09:00', '18:00', '13:00', '14:00'
  from unnest(array[2, 3, 4, 5, 6]) as d
  on conflict (salon_membership_id, day_of_week) do update set
    start_time = excluded.start_time, end_time = excluded.end_time,
    break_start = excluded.break_start, break_end = excluded.break_end;

  insert into staff_weekly_hours (salon_membership_id, salon_id, day_of_week, start_time, end_time, break_start, break_end)
  select v_valentina_membership_id, v_salon_id, d, '10:00', '19:00', '13:00', '14:00'
  from unnest(array[2, 3, 4, 5, 6]) as d
  on conflict (salon_membership_id, day_of_week) do update set
    start_time = excluded.start_time, end_time = excluded.end_time,
    break_start = excluded.break_start, break_end = excluded.break_end;

  -- Services. service_categories has no unique constraint on (salon_id, name),
  -- so idempotency here is "check first" rather than ON CONFLICT.
  select id into v_manicure_category_id from service_categories where salon_id = v_salon_id and name in ('Manicure', 'Manicure y Uñas');
  if v_manicure_category_id is null then
    insert into service_categories (salon_id, name, sort_order)
    values (v_salon_id, 'Manicure y Uñas', 0)
    returning id into v_manicure_category_id;
  else
    update service_categories set name = 'Manicure y Uñas' where id = v_manicure_category_id and name <> 'Manicure y Uñas';
  end if;

  select id into v_pedicure_category_id from service_categories where salon_id = v_salon_id and name = 'Pedicure';
  if v_pedicure_category_id is null then
    insert into service_categories (salon_id, name, sort_order)
    values (v_salon_id, 'Pedicure', 1)
    returning id into v_pedicure_category_id;
  end if;

  -- "Uñas" used to be a separate category from "Manicure" for the same
  -- service line — folded into one (improvements backlog item 9). Reconcile
  -- any already-seeded row from before this change; never created again.
  select id into v_legacy_unas_category_id from service_categories where salon_id = v_salon_id and name = 'Uñas';
  if v_legacy_unas_category_id is not null then
    update services set category_id = v_manicure_category_id where category_id = v_legacy_unas_category_id;
    delete from service_categories where id = v_legacy_unas_category_id;
  end if;

  if not exists (select 1 from services where salon_id = v_salon_id and name = 'Manicure') then
    insert into services (salon_id, category_id, name, description, has_variants, buffer_minutes, sort_order)
    values (v_salon_id, v_manicure_category_id, 'Manicure', 'From a classic finish to hand-painted gel.', true, 10, 0)
    returning id into v_manicure_service_id;

    insert into service_variants (service_id, salon_id, name, price, duration_minutes, buffer_minutes, sort_order)
    values
      (v_manicure_service_id, v_salon_id, 'Clásica', 25, 45, 10, 0),
      (v_manicure_service_id, v_salon_id, 'Gel', 40, 60, 15, 1),
      (v_manicure_service_id, v_salon_id, 'French Gel', 50, 75, 15, 2);
  else
    select id into v_manicure_service_id from services where salon_id = v_salon_id and name = 'Manicure';
  end if;

  if not exists (select 1 from services where salon_id = v_salon_id and name = 'Pedicure Spa') then
    insert into services (salon_id, category_id, name, description, has_variants, base_price, base_duration_minutes, buffer_minutes, sort_order)
    values (v_salon_id, v_pedicure_category_id, 'Pedicure Spa', 'Soak, scrub, and polish.', false, 35, 60, 10, 0);
  end if;

  if not exists (select 1 from services where salon_id = v_salon_id and name = 'Acrílicas') then
    insert into services (salon_id, category_id, name, description, has_variants, base_price, base_duration_minutes, buffer_minutes, sort_order)
    values (v_salon_id, v_manicure_category_id, 'Acrílicas', 'Sculpted full set.', false, 55, 90, 15, 1)
    returning id into v_acrilicas_service_id;
  else
    select id into v_acrilicas_service_id from services where salon_id = v_salon_id and name = 'Acrílicas';
  end if;

  -- One fictional past customer with two completed + reviewed appointments,
  -- so the landing page has real "reseña de servicio" content per artist
  -- (improvements backlog item 5) instead of an empty reviews section.
  select id into v_manicure_gel_variant_id from service_variants where service_id = v_manicure_service_id and name = 'Gel';

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) values
    (v_customer_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'cliente.demo@atelier-noir.example', crypt(gen_random_uuid()::text, gen_salt('bf')), now(), '{}', '{"full_name":"Camila Rojas"}',
     now(), now(), '', '', '', '')
  on conflict (id) do nothing;

  insert into customers (salon_id, profile_id)
  values (v_salon_id, v_customer_id)
  on conflict (salon_id, profile_id) do nothing;

  select id into v_customer_record_id from customers where salon_id = v_salon_id and profile_id = v_customer_id;

  if not exists (select 1 from appointments where customer_id = v_customer_record_id and salon_membership_id = v_sofia_membership_id) then
    insert into appointments (salon_id, customer_id, service_id, service_variant_id, salon_membership_id, status, artist_preference, starts_at, ends_at, price, payment_status)
    values (
      v_salon_id, v_customer_record_id, v_manicure_service_id, v_manicure_gel_variant_id, v_sofia_membership_id,
      'completed', 'specific', now() - interval '14 days', now() - interval '14 days' + interval '60 minutes', 40, 'paid'
    )
    returning id into v_sofia_appt_id;

    insert into reviews (salon_id, appointment_id, customer_id, salon_membership_id, service_id, rating, comment, status)
    values (
      v_salon_id, v_sofia_appt_id, v_customer_record_id, v_sofia_membership_id, v_manicure_service_id,
      5, 'El gel quedó perfecto, ni una burbuja, y la línea del french fue impecable.', 'published'
    );
  end if;

  if not exists (select 1 from appointments where customer_id = v_customer_record_id and salon_membership_id = v_valentina_membership_id) then
    insert into appointments (salon_id, customer_id, service_id, salon_membership_id, status, artist_preference, starts_at, ends_at, price, payment_status)
    values (
      v_salon_id, v_customer_record_id, v_acrilicas_service_id, v_valentina_membership_id,
      'completed', 'specific', now() - interval '7 days', now() - interval '7 days' + interval '90 minutes', 55, 'paid'
    )
    returning id into v_valentina_appt_id;

    insert into reviews (salon_id, appointment_id, customer_id, salon_membership_id, service_id, rating, comment, status)
    values (
      v_salon_id, v_valentina_appt_id, v_customer_record_id, v_valentina_membership_id, v_acrilicas_service_id,
      5, 'Las uñas duraron casi un mes sin despostillarse, se nota la técnica.', 'published'
    );
  end if;

  -- Portfolio (Phase 10 CMS content). Verified-resolving Unsplash URLs.
  if not exists (select 1 from portfolio_items where salon_id = v_salon_id) then
    insert into portfolio_items (salon_id, salon_membership_id, service_id, image_url, title, sort_order)
    values
      (v_salon_id, v_sofia_membership_id, v_manicure_service_id, 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=1200&q=80', 'Noir & gold', 0),
      (v_salon_id, v_sofia_membership_id, v_manicure_service_id, 'https://images.unsplash.com/photo-1519014816548-bf5fe059798b?w=1200&q=80', 'Hand-painted script', 1),
      (v_salon_id, v_valentina_membership_id, v_acrilicas_service_id, 'https://images.unsplash.com/photo-1607779097040-26e80aa78e66?w=1200&q=80', 'Studio detail', 2);
  else
    -- Backfill service_id on rows seeded before this column existed.
    update portfolio_items set service_id = v_manicure_service_id
      where salon_id = v_salon_id and title in ('Noir & gold', 'Hand-painted script') and service_id is null;
    update portfolio_items set service_id = v_acrilicas_service_id
      where salon_id = v_salon_id and title = 'Studio detail' and service_id is null;
  end if;

  if not exists (select 1 from brands where salon_id = v_salon_id) then
    insert into brands (salon_id, name, sort_order)
    values
      (v_salon_id, 'OPI', 0),
      (v_salon_id, 'CND Shellac', 1),
      (v_salon_id, 'Essie', 2),
      (v_salon_id, 'Mavala', 3);
  end if;

  if not exists (select 1 from faqs where salon_id = v_salon_id) then
    insert into faqs (salon_id, question, answer, sort_order)
    values
      (v_salon_id, '¿Puedo elegir un artista específico?', 'Sí — al reservar puedes elegir un artista de tu preferencia o dejar que cualquier artista disponible tome tu cita.', 0),
      (v_salon_id, '¿Cuál es la política de cancelación?', 'Puedes cancelar o reagendar sin costo hasta 24 horas antes de tu cita desde tu cuenta.', 1),
      (v_salon_id, '¿Necesito dejar un depósito?', 'No por ahora — los pagos en línea llegan más adelante. El pago se realiza en el salón.', 2),
      (v_salon_id, '¿Cuánto dura una cita de manicure?', 'Entre 45 y 75 minutos según el servicio elegido, incluyendo el tiempo de preparación.', 3);
  end if;
end $$;
