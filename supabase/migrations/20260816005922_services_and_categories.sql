-- Phase 3: service_categories, services, service_variants

create table service_categories (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger service_categories_set_updated_at
  before update on service_categories
  for each row execute function set_updated_at();

create index service_categories_salon_idx on service_categories (salon_id, sort_order);

create table services (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons (id) on delete cascade,
  category_id uuid not null references service_categories (id) on delete restrict,
  name text not null,
  description text,
  image_url text,
  base_price numeric(10, 2),
  base_duration_minutes int,
  buffer_minutes int not null default 0,
  has_variants boolean not null default false,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A service without variants must carry its own bookable price/duration.
  constraint services_base_price_required_without_variants
    check (has_variants or (base_price is not null and base_duration_minutes is not null))
);

comment on column services.has_variants is 'If false, this service is directly bookable at base_price/base_duration_minutes. If true, price/duration come from service_variants instead.';

create trigger services_set_updated_at
  before update on services
  for each row execute function set_updated_at();

create index services_salon_category_idx on services (salon_id, category_id, active);

create table service_variants (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references services (id) on delete cascade,
  salon_id uuid not null references salons (id) on delete cascade,
  name text not null,
  price numeric(10, 2) not null,
  duration_minutes int not null,
  buffer_minutes int not null default 0,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (service_id, name)
);

create trigger service_variants_set_updated_at
  before update on service_variants
  for each row execute function set_updated_at();

create index service_variants_service_idx on service_variants (service_id, active);
create index service_variants_salon_idx on service_variants (salon_id);
