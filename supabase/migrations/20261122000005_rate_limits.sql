-- Shared rate limiting that holds across serverless instances (the Sprint 1 limiter was per-process memory).
-- Fixed window, one row per key, atomic via INSERT ... ON CONFLICT (the row lock serialises concurrent hits).
--
-- Keys are opaque HMAC digests built by the app (scope + client IP / user id), so no raw IP address or user id is stored.
-- The table has RLS enabled and deliberately NO policies, and no grants to anon/authenticated: only the
-- service_role function below touches it. (Supabase advisors report "RLS enabled, no policy" for this table. That is intended.)
create table public.rate_limits (
  key          text primary key check (char_length(key) between 8 and 200),
  window_start timestamptz not null default now(),
  hits         int not null default 0
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- Returns true if this hit is allowed, false once `p_limit` hits have been used inside the current window.
-- `p_now` exists so tests can move time; the app never passes it.
create function public.rate_limit_hit(p_key text, p_limit int, p_window_seconds int, p_now timestamptz default now())
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_hits int;
begin
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'invalid rate limit parameters';
  end if;

  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, p_now, 1)
  on conflict (key) do update
    set hits = case when r.window_start <= p_now - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
        window_start = case when r.window_start <= p_now - make_interval(secs => p_window_seconds) then p_now else r.window_start end
  returning r.hits into v_hits;

  -- Housekeeping: now and then drop rows whose window is long over, so the table stays small.
  if random() < 0.01 then
    delete from public.rate_limits where window_start < p_now - interval '1 day';
  end if;

  return v_hits <= p_limit;
end;
$$;
revoke execute on function public.rate_limit_hit(text, int, int, timestamptz) from public, anon, authenticated;
grant  execute on function public.rate_limit_hit(text, int, int, timestamptz) to service_role;
