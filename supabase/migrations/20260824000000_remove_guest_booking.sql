-- Guest booking is being removed entirely — booking now requires an
-- account, no exceptions. book_appointment_as_guest was unused
-- SECURITY DEFINER attack surface with its only caller (the bookAsGuest
-- Server Action) deleted in the same change.
--
-- Historical migrations (20260822000000_guest_booking.sql,
-- 20260823000000_home_service_and_payment.sql) are left untouched rather
-- than edited/deleted, per this repo's standing convention of never
-- rewriting migrations already applied to the linked project.

drop function if exists book_appointment_as_guest(
  uuid, uuid, uuid, uuid, uuid, artist_preference, uuid, timestamptz, boolean, text, uuid, text, text
);
