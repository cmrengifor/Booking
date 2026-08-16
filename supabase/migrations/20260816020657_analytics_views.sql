-- Phase 11: analytics — derived from transactional data via plain SQL views,
-- no warehouse, per docs/ARCHITECTURE.md section 11's explicit preference.
--
-- security_invoker = true on every view (PG15+): the QUERYING user's own RLS
-- applies, not the view owner's. Forgetting this is the classic Supabase
-- footgun — a view silently running with its creator's elevated permissions
-- and leaking cross-tenant data. Flagged explicitly in the architecture doc
-- for this exact phase.

create view salon_analytics_summary
with (security_invoker = true) as
select
  s.id as salon_id,
  count(a.id) filter (where a.status = 'completed') as completed_appointments,
  count(a.id) filter (where a.status = 'cancelled') as cancelled_appointments,
  count(a.id) filter (where a.status = 'no_show') as no_show_appointments,
  count(a.id) filter (where a.status in ('completed', 'cancelled', 'no_show', 'confirmed')) as total_booked_appointments,
  coalesce(sum(a.amount_paid) filter (where a.status = 'completed'), 0) as total_revenue,
  coalesce(round(avg(a.amount_paid) filter (where a.status = 'completed'), 2), 0) as avg_ticket,
  count(distinct a.customer_id) as total_customers,
  (select round(avg(r.rating)::numeric, 2) from reviews r where r.salon_id = s.id and r.status = 'published') as avg_review_rating
from salons s
left join appointments a on a.salon_id = s.id
group by s.id;

comment on view salon_analytics_summary is 'One row per salon. Rates (cancellation/no-show) are computed client-side from these counts, not stored, since the divisor choice (of total booked vs. of total including still-open) is a display decision.';

create view service_analytics
with (security_invoker = true) as
select
  sv.salon_id,
  sv.id as service_id,
  sv.name as service_name,
  count(a.id) filter (where a.status = 'completed') as completed_count,
  coalesce(sum(a.amount_paid) filter (where a.status = 'completed'), 0) as revenue
from services sv
left join appointments a on a.service_id = sv.id
group by sv.salon_id, sv.id, sv.name;

create view artist_analytics
with (security_invoker = true) as
select
  sm.salon_id,
  sm.id as salon_membership_id,
  ap.display_name,
  count(a.id) filter (where a.status = 'completed') as completed_count,
  coalesce(sum(a.amount_paid) filter (where a.status = 'completed'), 0) as revenue,
  (select round(avg(r.rating)::numeric, 2) from reviews r where r.salon_membership_id = sm.id and r.status = 'published') as avg_rating
from salon_memberships sm
join artist_profiles ap on ap.salon_membership_id = sm.id
left join appointments a on a.salon_membership_id = sm.id
where sm.role = 'stylist'
group by sm.salon_id, sm.id, ap.display_name;

-- Extracted in the salon's own timezone, never UTC or session default —
-- same standing rule as the availability engine (docs/ARCHITECTURE.md
-- section F).
create view peak_booking_hours
with (security_invoker = true) as
select
  a.salon_id,
  extract(hour from a.starts_at at time zone s.timezone)::int as hour_of_day,
  count(*) as appointment_count
from appointments a
join salons s on s.id = a.salon_id
where a.status in ('completed', 'confirmed')
group by a.salon_id, extract(hour from a.starts_at at time zone s.timezone);
