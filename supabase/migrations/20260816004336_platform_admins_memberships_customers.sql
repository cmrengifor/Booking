-- Phase 1: platform_admins, salon_memberships, customers

create table platform_admins (
  profile_id uuid primary key references profiles (id) on delete cascade,
  granted_by uuid references profiles (id),
  granted_at timestamptz not null default now()
);

comment on table platform_admins is 'Platform-wide operators, orthogonal to any salon role. Small audit table instead of a bare boolean flag.';

create type salon_role as enum ('owner', 'manager', 'receptionist', 'stylist');
create type membership_status as enum ('invited', 'active', 'disabled');

create table salon_memberships (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons (id) on delete cascade,
  -- Nullable: an invite can exist before the invited person has signed up at all.
  -- It is filled in the moment that email's profile signs in and the invite activates.
  profile_id uuid references profiles (id) on delete cascade,
  invited_email text,
  role salon_role not null,
  status membership_status not null default 'invited',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint salon_memberships_identity_check
    check (profile_id is not null or invited_email is not null)
);

comment on table salon_memberships is 'Staff-to-salon link + per-salon role. Role is per-salon, not global — the same profile can hold different roles at different salons.';

create trigger salon_memberships_set_updated_at
  before update on salon_memberships
  for each row
  execute function set_updated_at();

-- One active/invited membership per (salon, person) once a profile is attached.
create unique index salon_memberships_salon_profile_key
  on salon_memberships (salon_id, profile_id)
  where profile_id is not null;

-- One outstanding invite per (salon, email) before signup.
create unique index salon_memberships_salon_invited_email_key
  on salon_memberships (salon_id, invited_email)
  where profile_id is null and invited_email is not null;

create index salon_memberships_salon_role_idx on salon_memberships (salon_id, role);
create index salon_memberships_profile_idx on salon_memberships (profile_id);

create table customers (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (salon_id, profile_id)
);

comment on table customers is 'Salon-scoped business record for a client. Created lazily on first booking/registration at that salon, never at platform signup — satisfies "no shared customer identity across salons" at the business-data level even though profiles/auth are platform-wide.';

create trigger customers_set_updated_at
  before update on customers
  for each row
  execute function set_updated_at();

create index customers_profile_idx on customers (profile_id);
