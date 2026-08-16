-- Phase 5: appointments + appointment_events

create extension if not exists btree_gist;

create type appointment_status as enum ('open', 'pending', 'confirmed', 'cancelled', 'completed', 'no_show');
create type artist_preference as enum ('specific', 'any');
create type payment_status as enum ('unpaid', 'paid');

create table appointments (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons (id) on delete cascade,
  customer_id uuid not null references customers (id) on delete cascade,
  service_id uuid not null references services (id) on delete restrict,
  service_variant_id uuid references service_variants (id) on delete restrict,
  -- NULL while status = 'open'. Set the moment someone accepts/is booked.
  salon_membership_id uuid references salon_memberships (id) on delete restrict,

  status appointment_status not null default 'pending',
  artist_preference artist_preference not null,

  starts_at timestamptz not null,
  ends_at timestamptz not null,

  -- Price snapshot at booking time — never re-derived from services later,
  -- since prices change over time and past appointments must not.
  price numeric(10, 2) not null,
  amount_paid numeric(10, 2),
  payment_status payment_status not null default 'unpaid',

  cancellation_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint appointments_valid_range check (ends_at > starts_at),
  constraint appointments_open_has_no_artist
    check (status <> 'open' or salon_membership_id is null),
  constraint appointments_non_open_needs_artist
    check (status = 'open' or salon_membership_id is not null or status in ('cancelled')),

  -- The load-bearing constraint: no artist can hold two overlapping
  -- pending/confirmed appointments. This is what makes OPEN-appointment
  -- acceptance race-safe too, since accepting is just an UPDATE that
  -- assigns salon_membership_id — the same constraint fires either way.
  exclude using gist (
    salon_membership_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (salon_membership_id is not null and status in ('pending', 'confirmed'))
);

comment on table appointments is 'Central booking record. No direct client UPDATE grant — every transition goes through a SECURITY DEFINER RPC (see the rls_and_rpcs migration in this phase).';
comment on column appointments.status is 'No rejected value by design — a decline/release is an appointment_events entry, the row transitions straight to its next real status. See docs/ARCHITECTURE.md section C.';

create trigger appointments_set_updated_at
  before update on appointments
  for each row execute function set_updated_at();

create index appointments_salon_status_starts_idx on appointments (salon_id, status, starts_at);
create index appointments_membership_starts_idx on appointments (salon_membership_id, starts_at);
create index appointments_customer_starts_idx on appointments (customer_id, starts_at);
create index appointments_open_idx on appointments (salon_id, starts_at) where status = 'open';

create type appointment_event_type as enum (
  'created', 'assigned', 'accepted', 'released', 'declined',
  'rescheduled', 'cancelled', 'completed', 'no_show'
);

create table appointment_events (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments (id) on delete cascade,
  salon_id uuid not null references salons (id) on delete cascade,
  actor_profile_id uuid references profiles (id),
  event_type appointment_event_type not null,
  previous_status appointment_status,
  new_status appointment_status,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table appointment_events is 'Append-only audit log. No client INSERT/UPDATE/DELETE grant at all — written only by the RPC functions, in the same transaction as the status change.';

create index appointment_events_appointment_idx on appointment_events (appointment_id, created_at);
create index appointment_events_salon_idx on appointment_events (salon_id, created_at);
