-- appointment_events is a permanent audit log — deleting a profile should
-- never be blocked by (or silently destroy) its past events. Found while
-- cleaning up Phase 5 test data: the original FK had no ON DELETE clause,
-- which defaults to RESTRICT and made profile deletion impossible once a
-- profile had authored any event.

alter table appointment_events
  drop constraint appointment_events_actor_profile_id_fkey,
  add constraint appointment_events_actor_profile_id_fkey
    foreign key (actor_profile_id) references profiles (id) on delete set null;
