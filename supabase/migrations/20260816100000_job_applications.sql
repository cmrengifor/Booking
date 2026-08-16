-- "Trabaja con nosotros" footer section — application capture only, no
-- email delivery yet (Resend isn't configured). Everything routes through
-- a server action using the service-role client (see lib/supabase/admin.ts),
-- same "one door in" pattern as appointments/reviews, so no public RLS
-- grant is needed here at all — service role bypasses RLS by design.

create table job_applications (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons (id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  message text,
  resume_path text not null,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

comment on table job_applications is 'Careers form submissions. Written only via the applyForJob server action (service-role client) — no direct client insert grant. resume_path is a private Storage object path, not a public URL.';

create index job_applications_salon_idx on job_applications (salon_id, created_at desc);

alter table job_applications enable row level security;

create policy job_applications_select on job_applications
  for select
  using (staff_role_for_salon(salon_id) in ('owner', 'manager') or is_platform_admin());

-- No insert/update/delete grant to authenticated/anon — service role only.

insert into storage.buckets (id, name, public)
values ('job-applications', 'job-applications', false)
on conflict (id) do nothing;

-- Private bucket, no anon/authenticated policies at all: uploads and any
-- future reads both go through the service-role client server-side.
