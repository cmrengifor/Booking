-- Automated regression coverage for the staff-role/invite/platform-admin
-- safeguards added across migrations 20260828000000, 20260828010000, and
-- 20260828020000. Same convention as rls-cross-tenant.sql: everything runs
-- inside one transaction that's rolled back at the end, so nothing
-- persists and no cleanup is needed. This file specifically targets
-- behavior that is NOT backed by a plain RLS select/write check alone --
-- the last-owner trigger, the update_staff_role RPC's owner-only gate, the
-- role column's table-vs-column grant fix, and the last-platform-admin
-- floor -- each of which was only caught by manual verification the first
-- time it was built.
--
-- Run with:
--   npx supabase db query --linked -f supabase/tests/staff-role-safeguards.sql
-- A clean run ends with "staff-role safeguard checks passed" and no
-- exception. Any violation raises an exception describing what failed,
-- and the query command exits non-zero.

begin;

do $$
declare
  v_salon uuid;
  v_owner1 uuid := gen_random_uuid();
  v_owner2 uuid := gen_random_uuid();
  v_manager uuid := gen_random_uuid();
  v_stylist uuid := gen_random_uuid();
  v_invitee uuid := gen_random_uuid();
  v_owner1_membership uuid;
  v_owner2_membership uuid;
  v_manager_membership uuid;
  v_stylist_membership uuid;
  v_invite_id uuid;
  v_redundant_invite_id uuid;
  v_count int;
  v_caught boolean;
begin
  insert into salons (slug, name, timezone)
  values ('__staff_test', 'Staff Safeguards Test Salon', 'America/Bogota')
  returning id into v_salon;

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) values
    (v_owner1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'owner1@__staff_test.example', crypt(gen_random_uuid()::text, gen_salt('bf')), now(), '{}', '{"full_name":"Staff Test Owner1"}',
     now(), now(), '', '', '', ''),
    (v_owner2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'owner2@__staff_test.example', crypt(gen_random_uuid()::text, gen_salt('bf')), now(), '{}', '{"full_name":"Staff Test Owner2"}',
     now(), now(), '', '', '', ''),
    (v_manager, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'manager@__staff_test.example', crypt(gen_random_uuid()::text, gen_salt('bf')), now(), '{}', '{"full_name":"Staff Test Manager"}',
     now(), now(), '', '', '', ''),
    (v_stylist, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'stylist@__staff_test.example', crypt(gen_random_uuid()::text, gen_salt('bf')), now(), '{}', '{"full_name":"Staff Test Stylist"}',
     now(), now(), '', '', '', ''),
    (v_invitee, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'invitee@__staff_test.example', crypt(gen_random_uuid()::text, gen_salt('bf')), now(), '{}', '{"full_name":"Staff Test Invitee"}',
     now(), now(), '', '', '', '');

  insert into salon_memberships (salon_id, profile_id, role, status)
  values (v_salon, v_owner1, 'owner', 'active') returning id into v_owner1_membership;
  insert into salon_memberships (salon_id, profile_id, role, status)
  values (v_salon, v_owner2, 'owner', 'active') returning id into v_owner2_membership;
  insert into salon_memberships (salon_id, profile_id, role, status)
  values (v_salon, v_manager, 'manager', 'active') returning id into v_manager_membership;
  insert into salon_memberships (salon_id, profile_id, role, status)
  values (v_salon, v_stylist, 'stylist', 'active') returning id into v_stylist_membership;

  -- === update_staff_role(): manager blocked from touching owner role ======
  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_manager::text);

  v_caught := false;
  begin
    perform update_staff_role(v_owner1_membership, 'manager');
  exception when others then
    v_caught := true;
  end;
  if not v_caught then
    raise exception 'OWNER-ROLE GUARD FAILED: manager was able to demote an owner via update_staff_role';
  end if;

  v_caught := false;
  begin
    perform update_staff_role(v_stylist_membership, 'owner');
  exception when others then
    v_caught := true;
  end;
  if not v_caught then
    raise exception 'OWNER-ROLE GUARD FAILED: manager was able to promote a stylist to owner via update_staff_role';
  end if;

  -- Manager CAN change a non-owner's role.
  perform update_staff_role(v_stylist_membership, 'receptionist');
  if (select role from salon_memberships where id = v_stylist_membership) <> 'receptionist' then
    raise exception 'update_staff_role did not apply a manager-permitted non-owner role change';
  end if;

  reset role;

  -- === update_staff_role(): owner CAN promote to/demote from owner =======
  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_owner1::text);

  perform update_staff_role(v_stylist_membership, 'owner');
  if (select role from salon_memberships where id = v_stylist_membership) <> 'owner' then
    raise exception 'owner could not promote a non-owner to owner via update_staff_role';
  end if;

  -- Demoting owner2 while two other owners (owner1, the promoted stylist)
  -- remain must succeed -- this is NOT the last-owner case.
  perform update_staff_role(v_owner2_membership, 'manager');
  if (select role from salon_memberships where id = v_owner2_membership) <> 'manager' then
    raise exception 'demoting a non-last owner unexpectedly failed';
  end if;

  reset role;

  -- === enforce_min_one_owner(): demote/delete/disable the last owner =====
  -- Only owner1 and the promoted ex-stylist are owners now. Demote the
  -- ex-stylist back down first so owner1 becomes the salon's LAST owner.
  update salon_memberships set role = 'stylist' where id = v_stylist_membership;

  v_caught := false;
  begin
    update salon_memberships set status = 'disabled' where id = v_owner1_membership;
  exception when others then
    v_caught := true;
  end;
  if not v_caught then
    raise exception 'MIN-OWNER GUARD FAILED: disabling the last active owner did not raise';
  end if;

  v_caught := false;
  begin
    delete from salon_memberships where id = v_owner1_membership;
  exception when others then
    v_caught := true;
  end;
  if not v_caught then
    raise exception 'MIN-OWNER GUARD FAILED: deleting the last active owner did not raise';
  end if;

  -- === Column grant fix: role is RPC-only, status/location_id still raw ==
  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_owner1::text);

  v_caught := false;
  begin
    update salon_memberships set role = 'manager' where id = v_manager_membership;
  exception when others then
    v_caught := true;
  end;
  if not v_caught then
    raise exception 'COLUMN GRANT REGRESSION: a raw client UPDATE of salon_memberships.role succeeded -- role must only be changeable via update_staff_role()';
  end if;

  update salon_memberships set status = 'disabled' where id = v_manager_membership;
  if (select status from salon_memberships where id = v_manager_membership) <> 'disabled' then
    raise exception 'a raw client UPDATE of salon_memberships.status unexpectedly failed';
  end if;
  update salon_memberships set status = 'active' where id = v_manager_membership;

  reset role;

  -- === RLS owner-row protection: manager blocked from touching an owner
  -- row at all, even a field unrelated to role (location_id) ==============
  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_manager::text);

  update salon_memberships set location_id = null where id = v_owner1_membership;
  get diagnostics v_count = row_count;
  if v_count > 0 then
    raise exception 'RLS REGRESSION: a manager was able to update an owner-role salon_memberships row (location_id)';
  end if;

  -- === Invite RLS: manager can't invite as owner, can invite non-owner ===
  v_caught := false;
  begin
    insert into salon_memberships (salon_id, invited_email, role, status)
    values (v_salon, 'owner-invite-attempt@__staff_test.example', 'owner', 'invited');
  exception when others then
    v_caught := true;
  end;
  if not v_caught then
    raise exception 'INVITE GUARD FAILED: manager was able to create an owner-role invite';
  end if;

  insert into salon_memberships (salon_id, invited_email, role, status)
  values (v_salon, 'invitee@__staff_test.example', 'stylist', 'invited')
  returning id into v_invite_id;

  v_caught := false;
  begin
    insert into salon_memberships (salon_id, invited_email, role, status)
    values (v_salon, 'invitee@__staff_test.example', 'receptionist', 'invited');
  exception when others then
    v_caught := true;
  end;
  if not v_caught then
    raise exception 'a duplicate pending invite for the same (salon, email) did not raise a unique violation';
  end if;

  reset role;

  -- === activate_pending_invites(): links a pending invite by email =======
  -- Needs BOTH claims set: the RPC matches invited_email against
  -- auth.email(), not auth.uid() -- rls-cross-tenant.sql never needed the
  -- email claim since none of its checks depend on it.
  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_invitee::text);
  execute format('set local request.jwt.claim.email = %L', 'invitee@__staff_test.example');

  perform activate_pending_invites();

  reset role;

  if (select profile_id from salon_memberships where id = v_invite_id) is distinct from v_invitee then
    raise exception 'activate_pending_invites() did not link the pending invite to the matching profile';
  end if;
  if (select status from salon_memberships where id = v_invite_id) <> 'active' then
    raise exception 'activate_pending_invites() did not flip the linked invite to active';
  end if;

  -- Guard: a second, redundant invite to someone who already has a
  -- membership at this salon must be left alone, not collide with the
  -- salon_memberships_salon_profile_key unique index.
  insert into salon_memberships (salon_id, invited_email, role, status)
  values (v_salon, 'invitee@__staff_test.example', 'receptionist', 'invited')
  returning id into v_redundant_invite_id;

  set local role authenticated;
  execute format('set local request.jwt.claim.sub = %L', v_invitee::text);
  execute format('set local request.jwt.claim.email = %L', 'invitee@__staff_test.example');
  perform activate_pending_invites();
  reset role;

  if (select profile_id from salon_memberships where id = v_redundant_invite_id) is not null then
    raise exception 'activate_pending_invites() linked a redundant invite instead of skipping it, risking a unique-constraint collision';
  end if;

  raise notice 'staff-role safeguard checks passed';
end $$;

-- === enforce_min_one_platform_admin(): tested in its own do block so the
-- temporary removal of real platform_admins rows is easy to see is scoped
-- to this one block and undone by the outer rollback either way. ==========
do $$
declare
  v_admin1 uuid := gen_random_uuid();
  v_admin2 uuid := gen_random_uuid();
  v_caught boolean;
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) values
    (v_admin1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'admin1@__staff_test.example', crypt(gen_random_uuid()::text, gen_salt('bf')), now(), '{}', '{"full_name":"Staff Test Admin1"}',
     now(), now(), '', '', '', ''),
    (v_admin2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'admin2@__staff_test.example', crypt(gen_random_uuid()::text, gen_salt('bf')), now(), '{}', '{"full_name":"Staff Test Admin2"}',
     now(), now(), '', '', '', '');

  -- Insert the test admins FIRST, then clear every real admin row --
  -- enforce_min_one_platform_admin() would itself block a bare `delete
  -- from platform_admins` from ever reaching zero, so real rows can only
  -- be removed while at least the two test rows already exist alongside
  -- them. Safe only because this whole file always ends in `rollback;`,
  -- which restores every real admin regardless of how this block ends.
  insert into platform_admins (profile_id) values (v_admin1), (v_admin2);
  delete from platform_admins where profile_id not in (v_admin1, v_admin2);

  delete from platform_admins where profile_id = v_admin2;
  if exists (select 1 from platform_admins where profile_id = v_admin2) then
    raise exception 'deleting one of two platform admins did not remove the row';
  end if;

  v_caught := false;
  begin
    delete from platform_admins where profile_id = v_admin1;
  exception when others then
    v_caught := true;
  end;
  if not v_caught then
    raise exception 'MIN-ADMIN GUARD FAILED: deleting the last platform admin did not raise';
  end if;

  raise notice 'platform-admin floor checks passed';
end $$;

rollback;
