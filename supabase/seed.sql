-- Fictional placeholder salon + demo data (per PRODUCT.md — swapped for the
-- real pilot salon's data later; nothing here is a real business or person).
-- Idempotent: safe to re-run against an existing database.

insert into salons (slug, name, timezone, hero_title, hero_subtitle, footer_text, address, contact_phone, contact_email)
values (
  'atelier-noir',
  'Atelier Noir',
  'America/Bogota',
  'Atelier Noir',
  'A quiet, precise kind of luxury.',
  '© Atelier Noir. Placeholder content — Phase 10.',
  'Placeholder address — Phase 10',
  '+57 000 000 0000',
  'hello@atelier-noir.example'
)
on conflict (slug) do nothing;

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
  v_nails_category_id uuid;
  v_manicure_service_id uuid;
begin
  select id into v_salon_id from salons where slug = 'atelier-noir';

  -- Two fictional stylists (auth.users, minimal required columns).
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) values
    (v_owner_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'owner@atelier-noir.example', crypt('placeholder', gen_salt('bf')), now(), '{}', '{"full_name":"Camila Torres"}',
     now(), now(), '', '', '', ''),
    (v_sofia_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'sofia@atelier-noir.example', crypt('placeholder', gen_salt('bf')), now(), '{}', '{"full_name":"Sofia Duarte"}',
     now(), now(), '', '', '', ''),
    (v_valentina_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'valentina@atelier-noir.example', crypt('placeholder', gen_salt('bf')), now(), '{}', '{"full_name":"Valentina Rey"}',
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

  insert into artist_profiles (salon_membership_id, salon_id, display_name, bio, specialties)
  values
    (v_sofia_membership_id, v_salon_id, 'Sofia', 'Precision manicures and hand-painted nail art.', array['Nail art', 'Gel']),
    (v_valentina_membership_id, v_salon_id, 'Valentina', 'Specialist in acrylics and long-lasting sets.', array['Acrylics', 'Sculpted nails'])
  on conflict (salon_membership_id) do nothing;

  -- Salon open Tue–Sat 09:00–18:00, closed Sun/Mon.
  insert into salon_weekly_hours (salon_id, day_of_week, open_time, close_time)
  select v_salon_id, d, '09:00', '18:00'
  from unnest(array[2, 3, 4, 5, 6]) as d
  on conflict (salon_id, day_of_week) do nothing;

  -- Both stylists work the salon's full hours with a 13:00–14:00 break.
  insert into staff_weekly_hours (salon_membership_id, salon_id, day_of_week, start_time, end_time, break_start, break_end)
  select membership_id, v_salon_id, d, '09:00', '18:00', '13:00', '14:00'
  from unnest(array[2, 3, 4, 5, 6]) as d,
       unnest(array[v_sofia_membership_id, v_valentina_membership_id]) as membership_id
  on conflict (salon_membership_id, day_of_week) do nothing;

  -- Services. service_categories has no unique constraint on (salon_id, name),
  -- so idempotency here is "check first" rather than ON CONFLICT.
  select id into v_manicure_category_id from service_categories where salon_id = v_salon_id and name = 'Manicure';
  if v_manicure_category_id is null then
    insert into service_categories (salon_id, name, sort_order)
    values (v_salon_id, 'Manicure', 0)
    returning id into v_manicure_category_id;
  end if;

  select id into v_pedicure_category_id from service_categories where salon_id = v_salon_id and name = 'Pedicure';
  if v_pedicure_category_id is null then
    insert into service_categories (salon_id, name, sort_order)
    values (v_salon_id, 'Pedicure', 1)
    returning id into v_pedicure_category_id;
  end if;

  select id into v_nails_category_id from service_categories where salon_id = v_salon_id and name = 'Uñas';
  if v_nails_category_id is null then
    insert into service_categories (salon_id, name, sort_order)
    values (v_salon_id, 'Uñas', 2)
    returning id into v_nails_category_id;
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
  end if;

  if not exists (select 1 from services where salon_id = v_salon_id and name = 'Pedicure Spa') then
    insert into services (salon_id, category_id, name, description, has_variants, base_price, base_duration_minutes, buffer_minutes, sort_order)
    values (v_salon_id, v_pedicure_category_id, 'Pedicure Spa', 'Soak, scrub, and polish.', false, 35, 60, 10, 0);
  end if;

  if not exists (select 1 from services where salon_id = v_salon_id and name = 'Acrílicas') then
    insert into services (salon_id, category_id, name, description, has_variants, base_price, base_duration_minutes, buffer_minutes, sort_order)
    values (v_salon_id, v_nails_category_id, 'Acrílicas', 'Sculpted full set.', false, 55, 90, 15, 0);
  end if;
end $$;
