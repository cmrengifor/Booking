-- Enables Postgres Changes broadcast for notifications so the admin panel
-- can show a live toast + bell badge without polling. Realtime still
-- enforces the table's existing RLS (notifications_select: recipient_profile_id
-- = auth.uid()), so a client only ever receives rows addressed to them.
alter publication supabase_realtime add table notifications;
