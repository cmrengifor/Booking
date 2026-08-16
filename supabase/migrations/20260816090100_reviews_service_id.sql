-- Denormalize service_id onto reviews (same pattern as salon_id already
-- does for every tenant table) so the public landing page can show "reseña
-- de servicio" per artist without a public SELECT into appointments, which
-- has no public read grant.

alter table reviews add column service_id uuid references services (id) on delete set null;

update reviews r
set service_id = a.service_id
from appointments a
where a.id = r.appointment_id and r.service_id is null;

create or replace function submit_review(p_appointment_id uuid, p_rating smallint, p_comment text)
returns reviews
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile_id uuid := auth.uid();
  v_appt appointments;
  v_review reviews;
begin
  if p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be between 1 and 5.';
  end if;

  select * into v_appt from appointments where id = p_appointment_id;
  if v_appt is null then
    raise exception 'Appointment not found.';
  end if;

  if not exists (select 1 from customers where id = v_appt.customer_id and profile_id = v_profile_id) then
    raise exception 'Not authorized to review this appointment.';
  end if;

  if v_appt.status <> 'completed' then
    raise exception 'Only completed appointments can be reviewed.';
  end if;

  if v_appt.salon_membership_id is null then
    raise exception 'Appointment has no assigned artist to review.';
  end if;

  insert into reviews (salon_id, appointment_id, customer_id, salon_membership_id, service_id, rating, comment)
  values (v_appt.salon_id, v_appt.id, v_appt.customer_id, v_appt.salon_membership_id, v_appt.service_id, p_rating, p_comment)
  returning * into v_review;

  return v_review;
exception
  when unique_violation then
    raise exception 'You have already reviewed this appointment.' using errcode = '23505';
end;
$$;
