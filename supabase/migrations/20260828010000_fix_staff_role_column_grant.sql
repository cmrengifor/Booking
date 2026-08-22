-- The previous migration's `revoke update (role) on salon_memberships from
-- authenticated` had no effect: authenticated already holds a table-level
-- UPDATE grant (from the initial schema setup, `grant all on all tables in
-- schema public`), and table-level privileges aren't narrowed by revoking a
-- same-named column-level privilege that was never separately granted.
-- Verified directly: a raw client update of `role` still succeeded despite
-- the revoke. Fixed by revoking the table-level UPDATE grant entirely and
-- re-granting it only on the columns raw clients still update directly
-- (status, location_id) — role stays reachable only through
-- update_staff_role().

revoke update on salon_memberships from authenticated;
grant update (status, location_id) on salon_memberships to authenticated;
