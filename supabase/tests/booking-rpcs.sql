-- Integration tests for the booking RPCs against the real, linked database
-- (not a mock). Covers:
--   - the EXCLUDE-constraint double-booking guard
--   - cancellation cutoff enforcement (customer vs. staff override)
--   - business-hours/break enforcement added on top of book_appointment and
--     reschedule_appointment (see the enforce_working_hours_on_booking
--     migration) — the "any artist" salon-hours-only path too
--   - the home-service surcharge and payment-selection branches of
--     book_appointment, which the original version of this file never
--     exercised (it called the pre-home-service 7-arg signature; the
--     function grew 5 new trailing params with defaults, so the old call
--     kept compiling without ever touching the new code paths)
--   - reschedule_appointment's own authorization/cutoff branch and its
--     interaction with the EXCLUDE constraint on the *new* slot
--   - all 6 admin appointment-lifecycle RPCs (accept_open_appointment,
--     accept_pending_appointment, decline_pending_appointment,
--     release_appointment, complete_appointment, mark_no_show): one happy
--     path per allowed caller, plus the wrong-role/wrong-status negative
--     case for each
--
-- See docs/ARCHITECTURE.md section C / docs/HANDOVER.md section 4 for the
-- design this is testing.
--
-- Seeds one throwaway salon with a location, service, two stylists, a
-- receptionist, an owner, a customer, and an unrelated "outsider" profile,
-- gives the location/stylists wide-open (00:00-23:59, no break) weekly
-- hours so working-hours enforcement doesn't interfere with tests that
-- aren't about it, calls the real RPCs as each simulated user, and RAISEs
-- if any expectation doesn't hold. Everything is inside one transaction
-- rolled back at the end — nothing persists, no cleanup needed.
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
  v_zone_id uuid;
  v_stylist_profile uuid := gen_random_uuid();
  v_stylist_membership uuid;
  v_stylist2_profile uuid := gen_random_uuid();
  v_stylist2_membership uuid;
  v_receptionist_profile uuid := gen_random_uuid();
  v_customer_profile uuid := gen_random_uuid();
  v_owner_profile uuid := gen_random_uuid();
  v_outsider_profile uuid := gen_random_uuid();
  v_appointment_1 appointments;
  v_appointment_2 appointments;
  v_appt appointments;
  v_appt_b appointments;
  -- `date + interval` yields a naive timestamp, which casts to timestamptz
  -- via the session's timezone (not necessarily the salon's) — explicit
  -- `at time zone` pins it to Bogota so local-wall-clock comparisons (the
  -- working-hours check added below) land on the intended calendar day.
  v_starts_at timestamptz := ((now() + interval '30 days')::date + interval '10 hours') at time zone 'America/Bogota';
  v_test_date date := (now() + interval '60 days')::date;
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

  insert into home_service_zones (salon_id, name, surcharge)
  values (v_salon_id, 'Test Zone', 10000)
  returning id into v_zone_id;

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) values
    (v_stylist_profile, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'stylist@__rpc_test.example', crypt(gen_random_uuid()::text, gen_salt('bf')), now(), '{}', '{"full_name":"RPC Test Stylist"}',
     now(), now(), '', '', '', ''),
    (v_stylist2_profile, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'stylist2@__rpc_test.example', crypt(gen_random_uuid()::text, gen_salt('bf')), now(), '{}', '{"full_name":"RPC Test Stylist 2"}',
     now(), now(), '', '', '', ''),
    (v_receptionist_profile, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'receptionist@__rpc_test.example', crypt(gen_random_uuid()::text, gen_salt('bf')), now(), '{}', '{"full_name":"RPC Test Receptionist"}',
     now(), now(), '', '', '', ''),
    (v_customer_profile, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'customer@__rpc_test.example', crypt(gen_random_uuid()::text, gen_salt('bf')), now(), '{}', '{"full_name":"RPC Test Customer"}',
     now(), now(), '', '', '', ''),
    (v_owner_profile, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'owner@__rpc_test.example', crypt(gen_random_uuid()::text, gen_salt('bf')), now(), '{}', '{"full_name":"RPC Test Owner"}',
     now(), now(), '', '', '', ''),
    (v_outsider_profile, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'outsider@__rpc_test.example', crypt(gen_random_uuid()::text, gen_salt('bf')), now(), '{}', '{"full_name":"RPC Test Outsider"}',
     now(), now(), '', '', '', '');

  insert into salon_memberships (salon_id, profile_id, role, status, location_id)
  values (v_salon_id, v_stylist_profile, 'stylist', 'active', v_location_id)
  returning id into v_stylist_membership;

  insert into salon_memberships (salon_id, profile_id, role, status, location_id)
  values (v_salon_id, v_stylist2_profile, 'stylist', 'active', v_location_id)
  returning id into v_stylist2_membership;

  insert into salon_memberships (salon_id, profile_id, role, status)
  values (v_salon_id, v_receptionist_profile, 'receptionist', 'active');

  -- Wide-open hours for every day, both stylists — the point of this file
  -- is RPC authorization/state-machine behavior, not re-testing the hours
  -- logic itself (that's covered directly in the migration that added it).
  insert into salon_weekly_hours (salon_id, location_id, day_of_week, open_time, close_time)
  select v_salon_id, v_location_id, d, '00:00', '23:59'
  from generate_series(0, 6) as d;

  insert into staff_weekly_hours (salon_id, salon_membership_id, day_of_week, start_time, end_time)
  select v_salon_id, m.id, d, '00:00', '23:59'
  from generate_series(0, 6) as d, (values (v_stylist_membership), (v_stylist2_membership)) as m(id);

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

  -- === book_appointment: home service + payment method (the stale-signature gap) ===
  -- Old version of this test called book_appointment with the pre-home-service
  -- 7-arg signature; it still compiled after the function grew 5 new
  -- trailing params (all defaulted), so the surcharge lookup and the
  -- appointment_payment_selections insert never ran under test. Exercise
  -- both here.
  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_customer_profile::text);

  select * into v_appt from book_appointment(
    v_salon_id, v_location_id, v_service_id, null, 'specific', v_stylist_membership, (v_test_date + interval '1 hours') at time zone 'America/Bogota',
    true, '123 Test St', v_zone_id, 'efectivo', 'pago_exacto'
  );
  if v_appt.price <> 50 + 10000 then
    raise exception 'HOME-SERVICE SURCHARGE FAILED: expected price 10050, got %', v_appt.price;
  end if;
  -- appointment_payment_selections is staff/platform-admin-readable only
  -- (appointment_payment_selections_select) — the booking customer can't
  -- see their own row, so this existence check needs the connection's own
  -- privileges, not the customer's RLS-scoped view.
  reset role;
  if not exists (
    select 1 from appointment_payment_selections
    where appointment_id = v_appt.id and method = 'efectivo' and detail = 'pago_exacto'
  ) then
    raise exception 'PAYMENT SELECTION FAILED: no appointment_payment_selections row was written for method=efectivo';
  end if;
  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_customer_profile::text);

  -- === reschedule_appointment: happy path ===
  select * into v_appt from book_appointment(
    v_salon_id, v_location_id, v_service_id, null, 'specific', v_stylist_membership, (v_test_date + interval '2 hours') at time zone 'America/Bogota'
  );
  select * into v_appt from reschedule_appointment(v_appt.id, (v_test_date + interval '3 hours') at time zone 'America/Bogota', null);
  if v_appt.starts_at <> (v_test_date + interval '3 hours') at time zone 'America/Bogota' then
    raise exception 'RESCHEDULE FAILED: expected starts_at %, got %', (v_test_date + interval '3 hours') at time zone 'America/Bogota', v_appt.starts_at;
  end if;

  -- === reschedule_appointment: cutoff blocks a customer inside the window ===
  reset role;
  update appointments set starts_at = now() + interval '2 hours', ends_at = now() + interval '3 hours'
  where id = v_appt.id;
  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_customer_profile::text);

  v_caught := false;
  begin
    perform reschedule_appointment(v_appt.id, (v_test_date + interval '4 hours') at time zone 'America/Bogota', null);
  exception when others then
    v_caught := true;
  end;
  if not v_caught then
    raise exception 'RESCHEDULE CUTOFF GUARD FAILED: customer rescheduled inside the cutoff window without error';
  end if;

  -- === reschedule_appointment: staff override succeeds even inside cutoff ===
  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_owner_profile::text);
  select * into v_appt from reschedule_appointment(v_appt.id, (v_test_date + interval '4 hours') at time zone 'America/Bogota', null);
  if v_appt.starts_at <> (v_test_date + interval '4 hours') at time zone 'America/Bogota' then
    raise exception 'RESCHEDULE STAFF OVERRIDE FAILED: expected starts_at %, got %', (v_test_date + interval '4 hours') at time zone 'America/Bogota', v_appt.starts_at;
  end if;

  -- === reschedule_appointment: an unrelated profile is rejected ===
  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_outsider_profile::text);
  v_caught := false;
  begin
    perform reschedule_appointment(v_appt.id, (v_test_date + interval '5 hours') at time zone 'America/Bogota', null);
  exception when others then
    v_caught := true;
  end;
  if not v_caught then
    raise exception 'RESCHEDULE AUTH GUARD FAILED: an unrelated profile rescheduled someone else''s appointment without error';
  end if;

  -- === reschedule_appointment: rescheduling into a conflicting slot hits the exclude constraint ===
  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_customer_profile::text);
  select * into v_appt_b from book_appointment(
    v_salon_id, v_location_id, v_service_id, null, 'specific', v_stylist_membership, (v_test_date + interval '6 hours') at time zone 'America/Bogota'
  );

  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_owner_profile::text);
  v_caught := false;
  begin
    perform reschedule_appointment(v_appt.id, (v_test_date + interval '6 hours') at time zone 'America/Bogota', null);
  exception when exclusion_violation then
    v_caught := true;
  end;
  if not v_caught then
    raise exception 'RESCHEDULE EXCLUDE GUARD FAILED: rescheduled into an overlapping slot for the same stylist without error';
  end if;

  -- === accept_open_appointment: stylist self-claims their own open appointment ===
  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_customer_profile::text);
  select * into v_appt from book_appointment(
    v_salon_id, v_location_id, v_service_id, null, 'any', null, (v_test_date + interval '7 hours') at time zone 'America/Bogota'
  );
  if v_appt.status <> 'open' then
    raise exception 'ANY-PREFERENCE BOOKING FAILED: expected status open, got %', v_appt.status;
  end if;

  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_stylist_profile::text);
  select * into v_appt from accept_open_appointment(v_appt.id, null);
  if v_appt.status <> 'confirmed' or v_appt.salon_membership_id <> v_stylist_membership then
    raise exception 'ACCEPT_OPEN SELF-CLAIM FAILED: expected confirmed+stylist1, got status=% membership=%', v_appt.status, v_appt.salon_membership_id;
  end if;

  -- === accept_open_appointment: a stylist cannot assign it to someone else ===
  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_customer_profile::text);
  select * into v_appt from book_appointment(
    v_salon_id, v_location_id, v_service_id, null, 'any', null, (v_test_date + interval '8 hours') at time zone 'America/Bogota'
  );
  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_stylist_profile::text);
  v_caught := false;
  begin
    perform accept_open_appointment(v_appt.id, v_stylist2_membership);
  exception when others then
    v_caught := true;
  end;
  if not v_caught then
    raise exception 'ACCEPT_OPEN STYLIST-ASSIGN-OTHER GUARD FAILED: a stylist assigned an open appointment to someone else without error';
  end if;

  -- === accept_open_appointment: a receptionist can assign it to a named stylist ===
  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_receptionist_profile::text);
  select * into v_appt from accept_open_appointment(v_appt.id, v_stylist2_membership);
  if v_appt.status <> 'confirmed' or v_appt.salon_membership_id <> v_stylist2_membership then
    raise exception 'ACCEPT_OPEN RECEPTIONIST-ASSIGN FAILED: expected confirmed+stylist2, got status=% membership=%', v_appt.status, v_appt.salon_membership_id;
  end if;

  -- === accept_open_appointment: an unrelated customer is rejected ===
  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_customer_profile::text);
  select * into v_appt from book_appointment(
    v_salon_id, v_location_id, v_service_id, null, 'any', null, (v_test_date + interval '9 hours') at time zone 'America/Bogota'
  );
  v_caught := false;
  begin
    perform accept_open_appointment(v_appt.id, v_stylist_membership);
  exception when others then
    v_caught := true;
  end;
  if not v_caught then
    raise exception 'ACCEPT_OPEN AUTH GUARD FAILED: a customer took an open appointment without error';
  end if;

  -- === accept_pending_appointment: the assigned stylist accepts ===
  select * into v_appt from book_appointment(
    v_salon_id, v_location_id, v_service_id, null, 'specific', v_stylist_membership, (v_test_date + interval '11 hours') at time zone 'America/Bogota'
  );
  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_stylist_profile::text);
  select * into v_appt from accept_pending_appointment(v_appt.id);
  if v_appt.status <> 'confirmed' then
    raise exception 'ACCEPT_PENDING (assigned stylist) FAILED: expected confirmed, got %', v_appt.status;
  end if;

  -- === accept_pending_appointment: a receptionist can also accept it ===
  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_customer_profile::text);
  select * into v_appt from book_appointment(
    v_salon_id, v_location_id, v_service_id, null, 'specific', v_stylist_membership, (v_test_date + interval '12 hours') at time zone 'America/Bogota'
  );
  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_receptionist_profile::text);
  select * into v_appt from accept_pending_appointment(v_appt.id);
  if v_appt.status <> 'confirmed' then
    raise exception 'ACCEPT_PENDING (receptionist) FAILED: expected confirmed, got %', v_appt.status;
  end if;

  -- === accept_pending_appointment: an unrelated stylist is rejected ===
  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_customer_profile::text);
  select * into v_appt from book_appointment(
    v_salon_id, v_location_id, v_service_id, null, 'specific', v_stylist_membership, (v_test_date + interval '13 hours') at time zone 'America/Bogota'
  );
  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_stylist2_profile::text);
  v_caught := false;
  begin
    perform accept_pending_appointment(v_appt.id);
  exception when others then
    v_caught := true;
  end;
  if not v_caught then
    raise exception 'ACCEPT_PENDING AUTH GUARD FAILED: an unrelated stylist accepted someone else''s pending appointment without error';
  end if;

  -- === decline_pending_appointment: the assigned stylist declines ===
  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_customer_profile::text);
  select * into v_appt from book_appointment(
    v_salon_id, v_location_id, v_service_id, null, 'specific', v_stylist_membership, (v_test_date + interval '14 hours') at time zone 'America/Bogota'
  );
  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_stylist_profile::text);
  select * into v_appt from decline_pending_appointment(v_appt.id);
  if v_appt.status <> 'cancelled' or v_appt.cancellation_reason <> 'declined_by_artist' then
    raise exception 'DECLINE_PENDING FAILED: expected cancelled/declined_by_artist, got status=% reason=%', v_appt.status, v_appt.cancellation_reason;
  end if;

  -- === decline_pending_appointment: an unrelated stylist is rejected ===
  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_customer_profile::text);
  select * into v_appt from book_appointment(
    v_salon_id, v_location_id, v_service_id, null, 'specific', v_stylist_membership, (v_test_date + interval '15 hours') at time zone 'America/Bogota'
  );
  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_stylist2_profile::text);
  v_caught := false;
  begin
    perform decline_pending_appointment(v_appt.id);
  exception when others then
    v_caught := true;
  end;
  if not v_caught then
    raise exception 'DECLINE_PENDING AUTH GUARD FAILED: an unrelated stylist declined someone else''s pending appointment without error';
  end if;

  -- === release_appointment: a "specific" confirmed appointment becomes cancelled ===
  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_customer_profile::text);
  select * into v_appt from book_appointment(
    v_salon_id, v_location_id, v_service_id, null, 'specific', v_stylist_membership, (v_test_date + interval '16 hours') at time zone 'America/Bogota'
  );
  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_stylist_profile::text);
  select * into v_appt from accept_pending_appointment(v_appt.id);

  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_owner_profile::text);
  select * into v_appt from release_appointment(v_appt.id, 'test release');
  if v_appt.status <> 'cancelled' then
    raise exception 'RELEASE (specific) FAILED: expected cancelled, got %', v_appt.status;
  end if;

  -- === release_appointment: an "any"-origin confirmed appointment goes back to open ===
  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_customer_profile::text);
  select * into v_appt from book_appointment(
    v_salon_id, v_location_id, v_service_id, null, 'any', null, (v_test_date + interval '17 hours') at time zone 'America/Bogota'
  );
  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_stylist_profile::text);
  select * into v_appt from accept_open_appointment(v_appt.id, null);

  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_receptionist_profile::text);
  select * into v_appt from release_appointment(v_appt.id, null);
  if v_appt.status <> 'open' or v_appt.salon_membership_id is not null then
    raise exception 'RELEASE (any) FAILED: expected open/unassigned, got status=% membership=%', v_appt.status, v_appt.salon_membership_id;
  end if;

  -- === complete_appointment: the assigned stylist completes a confirmed appointment ===
  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_customer_profile::text);
  select * into v_appt from book_appointment(
    v_salon_id, v_location_id, v_service_id, null, 'specific', v_stylist_membership, (v_test_date + interval '18 hours') at time zone 'America/Bogota'
  );
  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_stylist_profile::text);
  select * into v_appt from accept_pending_appointment(v_appt.id);
  select * into v_appt from complete_appointment(v_appt.id, 50);
  if v_appt.status <> 'completed' or v_appt.amount_paid <> 50 or v_appt.payment_status <> 'paid' then
    raise exception 'COMPLETE_APPOINTMENT FAILED: expected completed/50/paid, got status=% amount=% payment=%', v_appt.status, v_appt.amount_paid, v_appt.payment_status;
  end if;

  -- === complete_appointment: an unrelated stylist is rejected ===
  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_customer_profile::text);
  select * into v_appt from book_appointment(
    v_salon_id, v_location_id, v_service_id, null, 'specific', v_stylist_membership, (v_test_date + interval '19 hours') at time zone 'America/Bogota'
  );
  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_stylist_profile::text);
  select * into v_appt from accept_pending_appointment(v_appt.id);

  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_stylist2_profile::text);
  v_caught := false;
  begin
    perform complete_appointment(v_appt.id, 50);
  exception when others then
    v_caught := true;
  end;
  if not v_caught then
    raise exception 'COMPLETE_APPOINTMENT AUTH GUARD FAILED: an unrelated stylist completed someone else''s appointment without error';
  end if;

  -- === complete_appointment: a still-pending (not confirmed) appointment is rejected ===
  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_customer_profile::text);
  select * into v_appt from book_appointment(
    v_salon_id, v_location_id, v_service_id, null, 'specific', v_stylist_membership, (v_test_date + interval '20 hours') at time zone 'America/Bogota'
  );
  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_owner_profile::text);
  v_caught := false;
  begin
    perform complete_appointment(v_appt.id, 50);
  exception when others then
    v_caught := true;
  end;
  if not v_caught then
    raise exception 'COMPLETE_APPOINTMENT STATE GUARD FAILED: completed a still-pending (not confirmed) appointment without error';
  end if;

  -- === mark_no_show: the assigned stylist marks a confirmed appointment ===
  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_customer_profile::text);
  select * into v_appt from book_appointment(
    v_salon_id, v_location_id, v_service_id, null, 'specific', v_stylist_membership, (v_test_date + interval '21 hours') at time zone 'America/Bogota'
  );
  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_stylist_profile::text);
  select * into v_appt from accept_pending_appointment(v_appt.id);
  select * into v_appt from mark_no_show(v_appt.id);
  if v_appt.status <> 'no_show' then
    raise exception 'MARK_NO_SHOW FAILED: expected no_show, got %', v_appt.status;
  end if;

  -- === mark_no_show: an unrelated stylist is rejected ===
  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_customer_profile::text);
  select * into v_appt from book_appointment(
    v_salon_id, v_location_id, v_service_id, null, 'specific', v_stylist_membership, (v_test_date + interval '22 hours') at time zone 'America/Bogota'
  );
  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_stylist_profile::text);
  select * into v_appt from accept_pending_appointment(v_appt.id);

  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_stylist2_profile::text);
  v_caught := false;
  begin
    perform mark_no_show(v_appt.id);
  exception when others then
    v_caught := true;
  end;
  if not v_caught then
    raise exception 'MARK_NO_SHOW AUTH GUARD FAILED: an unrelated stylist marked someone else''s appointment no-show without error';
  end if;

  reset role;

  raise notice 'booking RPC checks passed';
end $$;

rollback;
