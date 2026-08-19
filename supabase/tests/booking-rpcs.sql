-- Integration tests for the booking RPCs against the real, linked database
-- (not a mock) — covers the two invariants the whole booking system leans
-- on: the EXCLUDE-constraint double-booking guard, and cancellation cutoff
-- enforcement (customer vs. staff override). See docs/ARCHITECTURE.md
-- section C / docs/HANDOVER.md section 4 for the design this is testing.
--
-- Seeds one throwaway salon with a location, service, stylist, and
-- customer, calls the real RPCs as each simulated user, and RAISEs if any
-- expectation doesn't hold. Everything is inside one transaction rolled
-- back at the end — nothing persists, no cleanup needed.
--
-- Run with:
--   npx supabase db query --linked -f supabase/tests/booking-rpcs.sql
-- A clean run ends with "booking RPC checks passed" and no exception.

begin;

do $$
declare
  v_salon_id uuid;
  v_location_id uuid;
  v_category_id uuid;
  v_service_id uuid;
  v_stylist_profile uuid := gen_random_uuid();
  v_stylist_membership uuid;
  v_customer_profile uuid := gen_random_uuid();
  v_owner_profile uuid := gen_random_uuid();
  v_appointment_1 appointments;
  v_appointment_2 appointments;
  v_starts_at timestamptz := (now() + interval '30 days')::date + interval '10 hours';
  v_caught boolean;
begin
  insert into salons (slug, name, timezone, cancellation_cutoff_hours)
  values ('__rpc_test', 'RPC Test Salon', 'America/Bogota', 24)
  returning id into v_salon_id;

  insert into salon_locations (salon_id, name) values (v_salon_id, 'Test Location')
  returning id into v_location_id;

  insert into service_categories (salon_id, name) values (v_salon_id, 'Test Category')
  returning id into v_category_id;

  insert into services (salon_id, category_id, name, base_price, base_duration_minutes)
  values (v_salon_id, v_category_id, 'Test Service', 50, 60)
  returning id into v_service_id;

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) values
    (v_stylist_profile, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'stylist@__rpc_test.example', crypt(gen_random_uuid()::text, gen_salt('bf')), now(), '{}', '{"full_name":"RPC Test Stylist"}',
     now(), now(), '', '', '', ''),
    (v_customer_profile, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'customer@__rpc_test.example', crypt(gen_random_uuid()::text, gen_salt('bf')), now(), '{}', '{"full_name":"RPC Test Customer"}',
     now(), now(), '', '', '', ''),
    (v_owner_profile, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'owner@__rpc_test.example', crypt(gen_random_uuid()::text, gen_salt('bf')), now(), '{}', '{"full_name":"RPC Test Owner"}',
     now(), now(), '', '', '', '');

  insert into salon_memberships (salon_id, profile_id, role, status, location_id)
  values (v_salon_id, v_stylist_profile, 'stylist', 'active', v_location_id)
  returning id into v_stylist_membership;

  -- === Happy path: customer books a specific stylist ===
  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_customer_profile::text);

  select * into v_appointment_1 from book_appointment(
    v_salon_id, v_location_id, v_service_id, null, 'specific', v_stylist_membership, v_starts_at
  );

  if v_appointment_1.status <> 'pending' then
    raise exception 'book_appointment: expected status pending, got %', v_appointment_1.status;
  end if;

  -- === EXCLUDE constraint: same stylist, fully overlapping time, must fail ===
  v_caught := false;
  begin
    perform book_appointment(
      v_salon_id, v_location_id, v_service_id, null, 'specific', v_stylist_membership, v_starts_at
    );
  exception
    when exclusion_violation then
      v_caught := true;
  end;
  if not v_caught then
    raise exception 'DOUBLE-BOOKING GUARD FAILED: booked the same stylist twice at an overlapping time without error';
  end if;

  -- === Cutoff enforcement: customer cancelling inside the cutoff window must fail ===
  -- v_starts_at is 30 days out with a 24h cutoff, so move it artificially
  -- close first via a direct update (RPCs don't expose "starts in 2 hours"
  -- as an input) to exercise the actual cutoff branch. `authenticated` has
  -- no direct UPDATE grant on appointments by design — reset to the
  -- connection's own (superuser) role for this one statement.
  reset role;
  update appointments set starts_at = now() + interval '2 hours', ends_at = now() + interval '3 hours'
  where id = v_appointment_1.id;
  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_customer_profile::text);

  v_caught := false;
  begin
    perform cancel_appointment(v_appointment_1.id);
  exception
    when others then
      v_caught := true;
  end;
  if not v_caught then
    raise exception 'CUTOFF GUARD FAILED: customer cancelled an appointment inside the % hour cutoff without error', 24;
  end if;

  -- === Staff override: same near-term appointment, cancelled by an owner, must succeed ===
  reset role;
  insert into salon_memberships (salon_id, profile_id, role, status)
  values (v_salon_id, v_owner_profile, 'owner', 'active');

  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_owner_profile::text);

  select * into v_appointment_2 from cancel_appointment(v_appointment_1.id);
  if v_appointment_2.status <> 'cancelled' then
    raise exception 'STAFF OVERRIDE FAILED: owner cancel did not result in status=cancelled (got %)', v_appointment_2.status;
  end if;

  reset role;

  raise notice 'booking RPC checks passed';
end $$;

rollback;
