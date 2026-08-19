-- Automated version of the manual RLS playbook documented in
-- docs/HANDOVER.md section 4 (the "set local role authenticated" trick,
-- previously re-run by hand after every phase that touched RLS).
--
-- Seeds two throwaway tenants, simulates each one's owner querying the
-- tables their own RLS policies are supposed to scope (salon_memberships,
-- customers, profiles), and RAISEs if either can see so much as one row
-- belonging to the other tenant. Everything happens inside one transaction
-- that's rolled back at the end — nothing persists, no cleanup needed.
--
-- Run with:
--   npx supabase db query --linked -f supabase/tests/rls-cross-tenant.sql
-- A clean run ends with "RLS cross-tenant checks passed" and no exception.
-- Any leak raises an exception with a description of exactly what leaked,
-- and the query command exits non-zero.

begin;

do $$
declare
  v_salon_a uuid;
  v_salon_b uuid;
  v_owner_a uuid := gen_random_uuid();
  v_owner_b uuid := gen_random_uuid();
  v_customer_profile_a uuid := gen_random_uuid();
  v_customer_profile_b uuid := gen_random_uuid();
  v_leak_count int;
begin
  insert into salons (slug, name, timezone)
  values ('__rls_test_a', 'RLS Test Salon A', 'America/Bogota')
  returning id into v_salon_a;

  insert into salons (slug, name, timezone)
  values ('__rls_test_b', 'RLS Test Salon B', 'America/Bogota')
  returning id into v_salon_b;

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) values
    (v_owner_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'owner-a@__rls_test.example', crypt(gen_random_uuid()::text, gen_salt('bf')), now(), '{}', '{"full_name":"RLS Test Owner A"}',
     now(), now(), '', '', '', ''),
    (v_owner_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'owner-b@__rls_test.example', crypt(gen_random_uuid()::text, gen_salt('bf')), now(), '{}', '{"full_name":"RLS Test Owner B"}',
     now(), now(), '', '', '', ''),
    (v_customer_profile_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'customer-a@__rls_test.example', crypt(gen_random_uuid()::text, gen_salt('bf')), now(), '{}', '{"full_name":"RLS Test Customer A"}',
     now(), now(), '', '', '', ''),
    (v_customer_profile_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'customer-b@__rls_test.example', crypt(gen_random_uuid()::text, gen_salt('bf')), now(), '{}', '{"full_name":"RLS Test Customer B"}',
     now(), now(), '', '', '', '');

  insert into salon_memberships (salon_id, profile_id, role, status)
  values
    (v_salon_a, v_owner_a, 'owner', 'active'),
    (v_salon_b, v_owner_b, 'owner', 'active');

  insert into customers (salon_id, profile_id)
  values
    (v_salon_a, v_customer_profile_a),
    (v_salon_b, v_customer_profile_b);

  -- === Simulate owner A's authenticated session ===
  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_owner_a::text);

  select count(*) into v_leak_count from salon_memberships where salon_id = v_salon_b;
  if v_leak_count > 0 then
    raise exception 'RLS LEAK: owner A can see % row(s) of salon_memberships belonging to salon B', v_leak_count;
  end if;

  select count(*) into v_leak_count from customers where salon_id = v_salon_b;
  if v_leak_count > 0 then
    raise exception 'RLS LEAK: owner A can see % row(s) of customers belonging to salon B', v_leak_count;
  end if;

  select count(*) into v_leak_count from profiles where id = v_owner_b;
  if v_leak_count > 0 then
    raise exception 'RLS LEAK: owner A can see owner B''s profile row';
  end if;

  select count(*) into v_leak_count from profiles where id = v_customer_profile_b;
  if v_leak_count > 0 then
    raise exception 'RLS LEAK: owner A can see customer B''s profile row';
  end if;

  reset role;

  -- === Simulate owner B's authenticated session (same checks, reversed) ===
  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_owner_b::text);

  select count(*) into v_leak_count from salon_memberships where salon_id = v_salon_a;
  if v_leak_count > 0 then
    raise exception 'RLS LEAK: owner B can see % row(s) of salon_memberships belonging to salon A', v_leak_count;
  end if;

  select count(*) into v_leak_count from customers where salon_id = v_salon_a;
  if v_leak_count > 0 then
    raise exception 'RLS LEAK: owner B can see % row(s) of customers belonging to salon A', v_leak_count;
  end if;

  select count(*) into v_leak_count from profiles where id = v_owner_a;
  if v_leak_count > 0 then
    raise exception 'RLS LEAK: owner B can see owner A''s profile row';
  end if;

  select count(*) into v_leak_count from profiles where id = v_customer_profile_a;
  if v_leak_count > 0 then
    raise exception 'RLS LEAK: owner B can see customer A''s profile row';
  end if;

  reset role;

  -- === anon can see the salons themselves (public/active by default) but
  -- nothing tenant-scoped — no membership, customer, or profile rows ===
  set local role anon;
  reset request.jwt.claim.sub;

  select count(*) into v_leak_count
  from salon_memberships where salon_id in (v_salon_a, v_salon_b);
  if v_leak_count > 0 then
    raise exception 'RLS LEAK: anon can see % row(s) of salon_memberships for the test salons', v_leak_count;
  end if;

  select count(*) into v_leak_count
  from customers where salon_id in (v_salon_a, v_salon_b);
  if v_leak_count > 0 then
    raise exception 'RLS LEAK: anon can see % row(s) of customers for the test salons', v_leak_count;
  end if;

  select count(*) into v_leak_count
  from profiles where id in (v_owner_a, v_owner_b, v_customer_profile_a, v_customer_profile_b);
  if v_leak_count > 0 then
    raise exception 'RLS LEAK: anon can see % profile row(s) it should not', v_leak_count;
  end if;

  reset role;

  raise notice 'RLS cross-tenant checks passed';
end $$;

rollback;
