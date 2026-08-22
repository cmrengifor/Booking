-- Reverts 20260829000000: an UPDATE policy doesn't fix the upsert (proven
-- live — even ON CONFLICT DO NOTHING fails as anon, so the blocker is the
-- conflict-detection read, gated by the SELECT policy, not UPDATE), and
-- `using (true)` on UPDATE is a real regression on its own: it would let
-- any anonymous visitor overwrite any row in this table for any salon, not
-- just the one they're subscribing. The actual fix drops the upsert/
-- ON CONFLICT entirely in favor of a plain INSERT with a 23505 catch — see
-- app/salon/[slug]/newsletter-actions.ts.

drop policy if exists newsletter_subscribers_update on newsletter_subscribers;
