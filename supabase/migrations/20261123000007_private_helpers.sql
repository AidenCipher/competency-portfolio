-- Move the RLS helper out of the API-exposed `public` schema.
-- `owns_experience()` exists only so policies can check ownership without recursive RLS. It never needed to be callable
-- as /rest/v1/rpc/owns_experience. A `private` schema is not exposed by the API, so the helper disappears from it
-- (Supabase advisor 0029) while every policy keeps working: policies reference the function by OID, so they follow the move.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

alter function public.owns_experience(uuid) set schema private;
-- (EXECUTE for authenticated and service_role, and none for anon, carries over with the function.)

-- request_validation() called it by name inside its body, so it must be redefined. Behaviour is unchanged.
create or replace function public.request_validation(
  p_experience_id uuid,
  p_name          text,
  p_email         text,
  p_kind          public.validator_kind,
  p_token_hash    text,
  p_expires_at    timestamptz
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_open int;
begin
  if (select auth.uid()) is null or not private.owns_experience(p_experience_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if char_length(trim(p_name)) not between 1 and 120
     or char_length(trim(p_email)) not between 3 and 254
     or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid validator' using errcode = '22023';
  end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid token hash' using errcode = '22023';
  end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '30 days' then
    raise exception 'invalid expiry' using errcode = '22023';
  end if;

  select count(*) into v_open from public.validations
   where experience_id = p_experience_id and status = 'pending' and used_at is null and expires_at > now();
  if v_open >= 5 then
    raise exception 'too many open requests' using errcode = '54000';
  end if;

  insert into public.validations (experience_id, validator_name, validator_email, validator_kind, token_hash, expires_at)
  values (p_experience_id, trim(p_name), lower(trim(p_email)), p_kind, p_token_hash, p_expires_at)
  returning id into v_id;

  insert into public.audit_log (actor, action, entity, entity_id)
  values ((select auth.uid()), 'validation.requested', 'validation', v_id);

  return v_id;
end;
$$;
