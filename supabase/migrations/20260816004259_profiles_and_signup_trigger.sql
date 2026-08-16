-- Phase 1: profiles (platform-wide identity, 1:1 with auth.users)

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table profiles is 'Platform-wide login identity. Salon-scoped business records (customers, salon_memberships) reference this, they do not duplicate it.';

create trigger profiles_set_updated_at
  before update on profiles
  for each row
  execute function set_updated_at();

-- Populates profiles automatically on signup (Google OAuth or email/password).
-- Google's metadata keys vary by flow, so read both common variants.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function handle_new_user();
