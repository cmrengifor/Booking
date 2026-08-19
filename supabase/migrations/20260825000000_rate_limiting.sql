-- Tech debt Phase 3: basic abuse protection for the public write endpoints
-- reachable with zero authentication (careers application file upload,
-- newsletter signup) — no third-party account needed (Upstash/Redis, etc.),
-- just a small fixed-window counter table + function, since Postgres is
-- already the source of truth for everything else in this app.
--
-- Fixed-window, not sliding-window: good enough for "stop obvious spam",
-- not meant to be exact. A caller passes a key (e.g. an IP address or
-- email), a max request count, and a window in seconds; the bucket key
-- embeds the current window index so old buckets naturally stop being
-- written to and get swept up by the opportunistic cleanup below.

create table rate_limits (
  bucket_key text primary key,
  count int not null default 1,
  created_at timestamptz not null default now()
);

comment on table rate_limits is 'Fixed-window rate limit counters. Rows are transient — see check_rate_limit()''s opportunistic cleanup. Not RLS''d for row access since nothing ever reads it directly; only the SECURITY DEFINER function below touches it.';

alter table rate_limits enable row level security;
-- No policies: nothing should read/write this table directly, only through
-- check_rate_limit() below (SECURITY DEFINER, bypasses RLS as its owner).

create function check_rate_limit(p_key text, p_max_requests int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bucket text := p_key || ':' || (floor(extract(epoch from now()) / p_window_seconds))::bigint;
  v_count int;
begin
  insert into rate_limits (bucket_key, count)
  values (v_bucket, 1)
  on conflict (bucket_key) do update set count = rate_limits.count + 1
  returning count into v_count;

  -- Opportunistic cleanup instead of a cron job — cheap, and this table is
  -- write-heavy/short-lived by design, so a random 1-in-200 chance per call
  -- keeps it bounded without a scheduled job to maintain.
  if random() < 0.005 then
    delete from rate_limits where created_at < now() - interval '1 hour';
  end if;

  return v_count <= p_max_requests;
end;
$$;

comment on function check_rate_limit is 'Returns true if the caller is still under the limit (and records this call), false if over. Example: select check_rate_limit(''careers:'' || p_ip, 3, 3600) for "max 3 job applications per IP per hour".';

grant execute on function check_rate_limit(text, int, int) to anon, authenticated, service_role;
