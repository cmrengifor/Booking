-- Phase 3: salon_weekly_hours, staff_weekly_hours, staff_time_off, artist_profiles

create table salon_weekly_hours (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  open_time time not null,
  close_time time not null,

  unique (salon_id, day_of_week),
  constraint salon_weekly_hours_valid_range check (close_time > open_time)
);

comment on table salon_weekly_hours is 'Outer bound on artist availability. No row for a day means the salon is closed that day.';
comment on column salon_weekly_hours.day_of_week is '0 = Sunday .. 6 = Saturday.';

create table staff_weekly_hours (
  id uuid primary key default gen_random_uuid(),
  salon_membership_id uuid not null references salon_memberships (id) on delete cascade,
  salon_id uuid not null references salons (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  break_start time,
  break_end time,

  unique (salon_membership_id, day_of_week),
  constraint staff_weekly_hours_valid_range check (end_time > start_time),
  constraint staff_weekly_hours_break_pair check (
    (break_start is null and break_end is null)
    or (break_start is not null and break_end is not null
        and break_start >= start_time and break_end <= end_time and break_end > break_start)
  )
);

comment on table staff_weekly_hours is 'Per-artist recurring hours. No row for a day means that artist is off that day. One optional break per day for MVP.';

create index staff_weekly_hours_salon_idx on staff_weekly_hours (salon_id);

create table staff_time_off (
  id uuid primary key default gen_random_uuid(),
  salon_membership_id uuid not null references salon_memberships (id) on delete cascade,
  salon_id uuid not null references salons (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text,
  created_at timestamptz not null default now(),

  constraint staff_time_off_valid_range check (end_date >= start_date)
);

comment on table staff_time_off is 'All-day granularity vacations/absences. Partial-day time off is a V1 enhancement, not MVP.';

create index staff_time_off_membership_idx on staff_time_off (salon_membership_id, start_date, end_date);

create table artist_profiles (
  id uuid primary key default gen_random_uuid(),
  salon_membership_id uuid not null unique references salon_memberships (id) on delete cascade,
  salon_id uuid not null references salons (id) on delete cascade,
  display_name text not null,
  bio text,
  headshot_url text,
  specialties text[] not null default '{}',
  published boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table artist_profiles is 'Public-facing artist page content. Separate from salon_memberships (auth/role) by design — not every staff member needs a public profile.';

create trigger artist_profiles_set_updated_at
  before update on artist_profiles
  for each row execute function set_updated_at();

create index artist_profiles_salon_idx on artist_profiles (salon_id, published);
