-- Internal chat: one persistent thread per (salon, customer) — a shared
-- staff inbox on the other side, not a thread per appointment. Messages are
-- plain client INSERTs gated by RLS (not an RPC "one door in" like
-- appointments/reviews) — sending a chat message has no side effects to get
-- right beyond the row itself, unlike those tables' write paths.

create table conversations (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons (id) on delete cascade,
  customer_id uuid not null references customers (id) on delete cascade,
  last_message_at timestamptz not null default now(),
  customer_last_read_at timestamptz,
  staff_last_read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (salon_id, customer_id)
);

comment on table conversations is 'One persistent thread per customer per salon — a shared staff inbox, not per-appointment.';

create index conversations_salon_recent_idx on conversations (salon_id, last_message_at desc);

alter table conversations enable row level security;

create policy conversations_select on conversations
  for select
  using (
    staff_role_for_salon(salon_id) is not null
    or is_platform_admin()
    or exists (select 1 from customers c where c.id = customer_id and c.profile_id = auth.uid())
  );

-- No direct insert/update — get_or_create_conversation() and
-- mark_conversation_read() below are the only write paths.
revoke insert, update, delete on conversations from authenticated;

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations (id) on delete cascade,
  -- Denormalized from conversations so messages_select/messages_insert can
  -- check staff_role_for_salon() directly instead of a join for every row.
  salon_id uuid not null references salons (id) on delete cascade,
  sender_profile_id uuid not null references profiles (id) on delete cascade,
  sender_role text not null check (sender_role in ('customer', 'staff')),
  body text not null check (char_length(btrim(body)) > 0 and char_length(body) <= 2000),
  created_at timestamptz not null default now()
);

comment on table messages is 'Immutable once sent — no update/delete grant, matching notifications/appointment_events.';

create index messages_conversation_idx on messages (conversation_id, created_at);

alter table messages enable row level security;

create policy messages_select on messages
  for select
  using (
    staff_role_for_salon(salon_id) is not null
    or is_platform_admin()
    or exists (
      select 1 from conversations c
      join customers cu on cu.id = c.customer_id
      where c.id = conversation_id and cu.profile_id = auth.uid()
    )
  );

create policy messages_insert on messages
  for insert
  with check (
    sender_profile_id = auth.uid()
    and (
      (sender_role = 'staff' and staff_role_for_salon(salon_id) is not null)
      or (
        sender_role = 'customer'
        and exists (
          select 1 from conversations c
          join customers cu on cu.id = c.customer_id
          where c.id = conversation_id and cu.profile_id = auth.uid()
        )
      )
    )
  );

revoke update, delete on messages from authenticated;

-- Keeps the inbox sortable by recency without a second client-side query.
create or replace function bump_conversation_last_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_bump_conversation
  after insert on messages
  for each row
  execute function bump_conversation_last_message();

-- === get_or_create_conversation =================================================
-- Customer-initiated only for now — staff reply to existing threads rather
-- than starting new ones from their side.

create or replace function get_or_create_conversation(p_salon_id uuid)
returns conversations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer_id uuid;
  v_conversation conversations;
begin
  v_customer_id := get_or_create_customer(p_salon_id, auth.uid());

  select * into v_conversation from conversations
  where salon_id = p_salon_id and customer_id = v_customer_id;

  if v_conversation is null then
    insert into conversations (salon_id, customer_id)
    values (p_salon_id, v_customer_id)
    returning * into v_conversation;
  end if;

  return v_conversation;
end;
$$;

grant execute on function get_or_create_conversation(uuid) to authenticated;

-- === mark_conversation_read ======================================================

create or replace function mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile_id uuid := auth.uid();
  v_conversation conversations;
begin
  select * into v_conversation from conversations where id = p_conversation_id;
  if v_conversation is null then
    raise exception 'Conversation not found.';
  end if;

  if exists (select 1 from customers c where c.id = v_conversation.customer_id and c.profile_id = v_profile_id) then
    update conversations set customer_last_read_at = now() where id = p_conversation_id;
  elsif staff_role_for_salon(v_conversation.salon_id) is not null then
    update conversations set staff_last_read_at = now() where id = p_conversation_id;
  else
    raise exception 'Not authorized.';
  end if;
end;
$$;

grant execute on function mark_conversation_read(uuid) to authenticated;

-- Realtime — RLS still applies, same as notifications (see
-- 20260821000000_notifications_realtime.sql).
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table conversations;
