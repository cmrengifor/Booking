-- Phase 9: reviews

create type review_status as enum ('pending', 'published', 'rejected');

create table reviews (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons (id) on delete cascade,
  appointment_id uuid not null unique references appointments (id) on delete cascade,
  customer_id uuid not null references customers (id) on delete cascade,
  salon_membership_id uuid not null references salon_memberships (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  status review_status not null default 'pending',
  moderated_by uuid references profiles (id),
  moderated_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table reviews is 'One per completed appointment (unique(appointment_id) is the hard backstop). INSERT only via submit_review().';

create index reviews_salon_status_idx on reviews (salon_id, status);
create index reviews_membership_idx on reviews (salon_membership_id, status);

alter table reviews enable row level security;

create policy reviews_select on reviews
  for select
  using (
    status = 'published'
    or staff_role_for_salon(salon_id) is not null
    or exists (select 1 from customers c where c.id = customer_id and c.profile_id = auth.uid())
    or is_platform_admin()
  );

-- No direct insert/update/delete grant — submit_review() and
-- moderate_review() below are the only write path, same "one door in"
-- pattern as appointments (they set moderated_by/moderated_at together
-- with status, which a raw client UPDATE could get wrong or skip).
revoke insert, update, delete on reviews from authenticated;

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

  insert into reviews (salon_id, appointment_id, customer_id, salon_membership_id, rating, comment)
  values (v_appt.salon_id, v_appt.id, v_appt.customer_id, v_appt.salon_membership_id, p_rating, p_comment)
  returning * into v_review;

  return v_review;
exception
  when unique_violation then
    raise exception 'You have already reviewed this appointment.' using errcode = '23505';
end;
$$;

grant execute on function submit_review(uuid, smallint, text) to authenticated;

create or replace function moderate_review(p_review_id uuid, p_status review_status)
returns reviews
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile_id uuid := auth.uid();
  v_review reviews;
begin
  if p_status not in ('published', 'rejected') then
    raise exception 'Invalid moderation status.';
  end if;

  update reviews
  set status = p_status, moderated_by = v_profile_id, moderated_at = now()
  where id = p_review_id
    and (staff_role_for_salon(salon_id) in ('owner', 'manager') or is_platform_admin())
  returning * into v_review;

  if v_review is null then
    raise exception 'Not authorized or review not found.';
  end if;

  return v_review;
end;
$$;

grant execute on function moderate_review(uuid, review_status) to authenticated;
