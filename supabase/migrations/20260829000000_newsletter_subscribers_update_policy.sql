-- subscribeToNewsletter() upserts on (salon_id, email) — Postgres plans an
-- INSERT ... ON CONFLICT DO UPDATE as needing UPDATE privilege on the table
-- to take that branch, even for a brand-new email that never hits the
-- conflict path. newsletter_subscribers only ever got an INSERT policy, so
-- every public signup failed with "new row violates row-level security
-- policy", 42501 — confirmed live against the anon role. Mirrors the
-- existing insert policy's openness (with check (true)); the newsletter
-- action already rate-limits (5/hour) at the app layer.

create policy newsletter_subscribers_update on newsletter_subscribers
  for update
  to anon, authenticated
  using (true)
  with check (true);
