-- Post-appointment customer follow-ups: a reschedule nudge for cancelled
-- appointments (24h link), and an NPS + review survey for completed ones.
-- Both are delivered by email (still stubbed pending a real provider — see
-- lib/email/send-email.ts) and both need a token so the customer can act
-- without necessarily being logged in when they click the link days later.
-- Accessed only through server-side code using the service-role client — no
-- client grant needed, same "one door in" pattern as job_applications.

create type appointment_token_purpose as enum ('reschedule_followup', 'nps_survey');

create table appointment_action_tokens (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments (id) on delete cascade,
  salon_id uuid not null references salons (id) on delete cascade,
  purpose appointment_token_purpose not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table appointment_action_tokens is 'Single-use, expiring links sent by email for post-appointment follow-ups. Read/written only via service-role server code, never a direct client grant.';

create index appointment_action_tokens_appointment_idx on appointment_action_tokens (appointment_id, purpose);

alter table appointment_action_tokens enable row level security;
-- No policies at all: RLS enabled with zero grants blocks anon/authenticated
-- entirely, matching the service-role-only access pattern.

create table nps_responses (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons (id) on delete cascade,
  appointment_id uuid not null unique references appointments (id) on delete cascade,
  customer_id uuid not null references customers (id) on delete cascade,
  score smallint not null check (score between 0 and 10),
  created_at timestamptz not null default now()
);

comment on table nps_responses is 'One per completed appointment. Submitted via the token-gated survey page (service-role write), not a direct client grant — the customer may not be logged in when they respond.';

create index nps_responses_salon_idx on nps_responses (salon_id, created_at desc);

alter table nps_responses enable row level security;

create policy nps_responses_select on nps_responses
  for select
  using (staff_role_for_salon(salon_id) is not null or is_platform_admin());
-- No insert/update/delete grant — service-role only, via the survey action.
