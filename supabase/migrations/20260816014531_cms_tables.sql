-- Phase 10: portfolio_items, brands, faqs, newsletter_subscribers
-- (the salon CMS scalar fields — hero_title etc. — already live on `salons`
-- since Phase 1). Same RLS shape as services: public reads active/published
-- rows, owner/manager writes.

create table portfolio_items (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons (id) on delete cascade,
  salon_membership_id uuid references salon_memberships (id) on delete set null,
  image_url text not null,
  title text,
  description text,
  published boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger portfolio_items_set_updated_at
  before update on portfolio_items
  for each row execute function set_updated_at();

create index portfolio_items_salon_idx on portfolio_items (salon_id, published, sort_order);

alter table portfolio_items enable row level security;

create policy portfolio_items_select on portfolio_items
  for select
  using (published or staff_role_for_salon(salon_id) is not null or is_platform_admin());

create policy portfolio_items_write on portfolio_items
  for all
  using (staff_role_for_salon(salon_id) in ('owner', 'manager') or is_platform_admin())
  with check (staff_role_for_salon(salon_id) in ('owner', 'manager') or is_platform_admin());

create table brands (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons (id) on delete cascade,
  name text not null,
  logo_url text,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index brands_salon_idx on brands (salon_id, active, sort_order);

alter table brands enable row level security;

create policy brands_select on brands
  for select
  using (active or staff_role_for_salon(salon_id) is not null or is_platform_admin());

create policy brands_write on brands
  for all
  using (staff_role_for_salon(salon_id) in ('owner', 'manager') or is_platform_admin())
  with check (staff_role_for_salon(salon_id) in ('owner', 'manager') or is_platform_admin());

create table faqs (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons (id) on delete cascade,
  question text not null,
  answer text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index faqs_salon_idx on faqs (salon_id, active, sort_order);

alter table faqs enable row level security;

create policy faqs_select on faqs
  for select
  using (active or staff_role_for_salon(salon_id) is not null or is_platform_admin());

create policy faqs_write on faqs
  for all
  using (staff_role_for_salon(salon_id) in ('owner', 'manager') or is_platform_admin())
  with check (staff_role_for_salon(salon_id) in ('owner', 'manager') or is_platform_admin());

-- Subscriber capture only for MVP — campaigns/templates are V1, per
-- docs/ARCHITECTURE.md decision H.9.
create table newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons (id) on delete cascade,
  email text not null,
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz,

  unique (salon_id, email)
);

alter table newsletter_subscribers enable row level security;

-- Public signup form, no auth required.
create policy newsletter_subscribers_insert on newsletter_subscribers
  for insert
  to anon, authenticated
  with check (true);

create policy newsletter_subscribers_select on newsletter_subscribers
  for select
  using (staff_role_for_salon(salon_id) in ('owner', 'manager') or is_platform_admin());

create policy newsletter_subscribers_delete on newsletter_subscribers
  for delete
  using (staff_role_for_salon(salon_id) in ('owner', 'manager') or is_platform_admin());

-- === Storage ==================================================================
-- One public bucket, {salon_id}/{category}/{filename} path convention, per
-- docs/ARCHITECTURE.md section G.

insert into storage.buckets (id, name, public)
values ('salon-public-assets', 'salon-public-assets', true)
on conflict (id) do nothing;

create policy salon_public_assets_read on storage.objects
  for select
  using (bucket_id = 'salon-public-assets');

create policy salon_public_assets_write on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'salon-public-assets'
    and staff_role_for_salon(((storage.foldername(name))[1])::uuid) in ('owner', 'manager')
  );

create policy salon_public_assets_update on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'salon-public-assets'
    and staff_role_for_salon(((storage.foldername(name))[1])::uuid) in ('owner', 'manager')
  );

create policy salon_public_assets_delete on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'salon-public-assets'
    and staff_role_for_salon(((storage.foldername(name))[1])::uuid) in ('owner', 'manager')
  );
