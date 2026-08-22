-- Regression: newsletter signup silently failed for every anon visitor.
-- Found by /qa on 2026-08-22.
-- Report: .gstack/qa-reports/qa-report-nail-salon-booking-2026-08-22.md
--
-- newsletter-actions.ts used to `.upsert(..., {onConflict: "salon_id,email"})`.
-- Postgres plans an INSERT ... ON CONFLICT statement (DO UPDATE *or* DO
-- NOTHING) as needing to detect a pre-existing conflicting row, which is
-- gated by the table's SELECT RLS policy — here staff-only — regardless of
-- what the INSERT/UPDATE policies allow. Result: anon could never signup
-- via upsert, confirmed live against the linked project's anon role
-- (42501, "new row violates row-level security policy"), even for a
-- brand-new email that never actually conflicts.
--
-- The fix (app/salon/[slug]/newsletter-actions.ts) dropped the upsert for a
-- plain INSERT, treating a 23505 (unique_violation) on (salon_id, email) as
-- an already-subscribed success rather than an error. This test locks in
-- the DB-level contract that fix depends on: anon can INSERT, a duplicate
-- raises exactly 23505 (not an RLS 42501), and anon still cannot SELECT
-- other people's subscriptions — the fix must never widen that privacy
-- boundary to work.
--
-- Run with:
--   npx supabase db query --linked -f supabase/tests/newsletter-subscribers-anon-insert.sql
-- A clean run ends with "newsletter_subscribers anon-insert checks passed"
-- and no exception. Everything happens inside one rolled-back transaction —
-- nothing persists, no cleanup needed.

begin;

do $$
declare
  v_salon uuid;
  v_email text := 'qa-regression-' || gen_random_uuid()::text || '@example.com';
  v_leak_count int;
  v_sqlstate text;
begin
  insert into salons (slug, name, timezone)
  values ('__newsletter_test', 'Newsletter Test Salon', 'America/Bogota')
  returning id into v_salon;

  -- === anon can insert a brand-new subscriber (the actual code path) ===
  set local role anon;

  insert into newsletter_subscribers (salon_id, email) values (v_salon, v_email);

  -- === a duplicate raises 23505, never the RLS 42501 the old upsert hit ===
  begin
    insert into newsletter_subscribers (salon_id, email) values (v_salon, v_email);
    raise exception 'Expected duplicate insert to raise unique_violation, but it succeeded silently.';
  exception
    when unique_violation then
      null; -- expected — this is the branch newsletter-actions.ts now catches
    when others then
      get stacked diagnostics v_sqlstate = returned_sqlstate;
      raise exception 'Expected unique_violation (23505) on duplicate insert, got SQLSTATE %', v_sqlstate;
  end;

  reset role;

  -- === the fix must not widen read access: anon still can't see subscribers ===
  set local role anon;

  select count(*) into v_leak_count from newsletter_subscribers where salon_id = v_salon;
  if v_leak_count > 0 then
    raise exception 'RLS LEAK: anon can read % row(s) of newsletter_subscribers', v_leak_count;
  end if;

  reset role;

  raise notice 'newsletter_subscribers anon-insert checks passed';
end $$;

rollback;
