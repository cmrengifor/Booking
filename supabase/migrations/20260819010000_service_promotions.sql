-- Limited-time promotional discounts, one row per promo window. A service
-- can have several (past/future), but only rows where now() falls inside
-- [starts_at, ends_at] count as "currently active" — computed at query
-- time, not stored, so nothing needs a cron job to expire them.

create table service_promotions (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references services (id) on delete cascade,
  salon_id uuid not null references salons (id) on delete cascade,
  discount_percent smallint not null check (discount_percent between 1 and 90),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  created_at timestamptz not null default now()
);

comment on table service_promotions is 'Limited-time % discounts per service. Owner/manager-managed, mirrors the services write policy.';

create index service_promotions_service_idx on service_promotions (service_id, ends_at desc);

alter table service_promotions enable row level security;

create policy service_promotions_select on service_promotions
  for select
  using (true);

create policy service_promotions_write on service_promotions
  for all
  using (staff_role_for_salon(salon_id) in ('owner', 'manager') or is_platform_admin())
  with check (staff_role_for_salon(salon_id) in ('owner', 'manager') or is_platform_admin());
