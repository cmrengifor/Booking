-- Demo availability window: Monday–Sunday (all 7 days), 08:00–22:00, for
-- every location and every stylist. Generic over whatever locations/staff
-- already exist (seed.sql's original 2 plus demo-data.sql's 2 more) rather
-- than naming specific rows, since this only needs to touch existing data.

update salon_weekly_hours set open_time = '08:00', close_time = '22:00';
update staff_weekly_hours set start_time = '08:00', end_time = '22:00';

-- Add the two missing days (0 = Sunday, 1 = Monday — the seed data only ever
-- covered Tue–Sat) for every location/staff member that already has hours,
-- cloning the now-uniform 08:00–22:00 window.
insert into salon_weekly_hours (salon_id, location_id, day_of_week, open_time, close_time)
select distinct salon_id, location_id, d, '08:00'::time, '22:00'::time
from salon_weekly_hours, unnest(array[0, 1]) as d
on conflict (location_id, day_of_week) do nothing;

insert into staff_weekly_hours (salon_membership_id, salon_id, day_of_week, start_time, end_time, break_start, break_end)
select distinct salon_membership_id, salon_id, d, '08:00'::time, '22:00'::time, break_start, break_end
from staff_weekly_hours, unnest(array[0, 1]) as d
on conflict (salon_membership_id, day_of_week) do nothing;
