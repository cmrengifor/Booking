-- Phase 1: extensions + salons (tenant root)

create extension if not exists pgcrypto;

-- Shared updated_at trigger, reused by every table that has the column.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create type salon_status as enum ('active', 'suspended');

create table salons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  timezone text not null,
  cancellation_cutoff_hours int not null default 24,
  status salon_status not null default 'active',

  -- CMS scalar fields (fetched together with the salon row, no separate 1:1 table).
  hero_title text,
  hero_subtitle text,
  hero_image_url text,
  footer_text text,
  address text,
  contact_phone text,
  contact_email text,
  social_links jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table salons is 'Tenant root. Every other tenant-owned table carries its own salon_id back to this.';
comment on column salons.timezone is 'IANA timezone name, e.g. America/Bogota. Authoritative for all scheduling — never inferred from browser or DB session.';

create trigger salons_set_updated_at
  before update on salons
  for each row
  execute function set_updated_at();

create index salons_status_idx on salons (status);
