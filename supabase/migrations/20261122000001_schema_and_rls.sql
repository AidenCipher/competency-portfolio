-- Capability Portfolio: schema, RLS, grants, narrow security-definer functions.
-- Every table enables RLS in this same migration. Nothing is exposed to `anon`.

-- ---------------------------------------------------------------- enums
create type public.app_role          as enum ('learner', 'admin');
create type public.experience_type   as enum ('academic','event','internship','volunteer','certification','work','personal');
create type public.evidence_kind     as enum ('report','presentation','feedback','event_doc','link','other');
create type public.validator_kind    as enum ('faculty','mentor','supervisor');
create type public.validation_status as enum ('pending','endorsed','changes_requested','declined');

-- ---------------------------------------------------------------- reference tables
create table public.career_roles (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name        text not null,
  department  text,
  description text,
  is_mapped   boolean not null default false  -- false = name-only until targets are provided
);

create table public.capabilities (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name                 text not null,
  statement_template   text not null,
  suggested_experience text not null
);

create table public.role_capabilities (
  role_id       uuid not null references public.career_roles(id) on delete cascade,
  capability_id uuid not null references public.capabilities(id) on delete cascade,
  target        int  not null check (target between 0 and 100),
  weight        numeric not null default 1 check (weight > 0),
  primary key (role_id, capability_id)
);

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  display_name   text not null default 'Learner' check (char_length(display_name) between 1 and 80),
  programme      text check (char_length(programme) <= 120),
  institution    text check (char_length(institution) <= 120),
  role           public.app_role not null default 'learner',
  target_role_id uuid references public.career_roles(id),
  is_demo        boolean not null default false,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------- learner-owned tables
create table public.experiences (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title          text not null check (char_length(title) between 1 and 200),
  type           public.experience_type not null,
  role_title     text not null check (char_length(role_title) between 1 and 120),
  duration_label text not null check (char_length(duration_label) between 1 and 80),
  start_date     date,
  end_date       date,
  description    text not null check (char_length(description) between 1 and 5000),
  reflection     text not null default '' check (char_length(reflection) <= 5000),
  is_demo        boolean not null default false,
  created_at     timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index experiences_user_idx on public.experiences(user_id, created_at desc);

create table public.experience_capabilities (
  experience_id uuid not null references public.experiences(id) on delete cascade,
  capability_id uuid not null references public.capabilities(id) on delete cascade,
  primary key (experience_id, capability_id)
);
create index experience_capabilities_cap_idx on public.experience_capabilities(capability_id);

create table public.evidence (
  id            uuid primary key default gen_random_uuid(),
  experience_id uuid not null references public.experiences(id) on delete cascade,
  kind          public.evidence_kind not null,
  -- null only for seeded demo rows that have no real file behind them
  storage_path  text,
  filename      text not null check (char_length(filename) between 1 and 200),
  mime          text not null,
  size_bytes    int  not null check (size_bytes between 0 and 10485760),
  created_at    timestamptz not null default now()
);
create index evidence_experience_idx on public.evidence(experience_id);

create table public.capability_statements (
  user_id       uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  capability_id uuid not null references public.capabilities(id) on delete cascade,
  text          text not null check (char_length(text) between 1 and 600),
  updated_at    timestamptz not null default now(),
  primary key (user_id, capability_id)
);

create table public.validations (
  id              uuid primary key default gen_random_uuid(),
  experience_id   uuid not null references public.experiences(id) on delete cascade,
  validator_name  text not null check (char_length(validator_name) between 1 and 120),
  validator_email text not null check (char_length(validator_email) between 3 and 254),
  validator_kind  public.validator_kind not null,
  status          public.validation_status not null default 'pending',
  token_hash      text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),  -- SHA-256 hex only; raw token is never stored
  expires_at      timestamptz not null,
  used_at         timestamptz,
  comment         text check (char_length(comment) <= 1000),
  created_at      timestamptz not null default now()
);
create index validations_experience_idx on public.validations(experience_id);

create table public.share_links (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  slug       text not null unique check (slug ~ '^[A-Za-z0-9_-]{16,64}$'),
  revoked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id        bigint generated always as identity primary key,
  actor     uuid,
  action    text not null,
  entity    text not null,
  entity_id uuid,
  at        timestamptz not null default now()
);

-- ---------------------------------------------------------------- RLS on every table
alter table public.career_roles             enable row level security;
alter table public.capabilities             enable row level security;
alter table public.role_capabilities        enable row level security;
alter table public.profiles                 enable row level security;
alter table public.experiences              enable row level security;
alter table public.experience_capabilities  enable row level security;
alter table public.evidence                 enable row level security;
alter table public.capability_statements    enable row level security;
alter table public.validations              enable row level security;
alter table public.share_links              enable row level security;
alter table public.audit_log                enable row level security;

-- ---------------------------------------------------------------- helper (avoids recursive RLS)
create function public.owns_experience(p_experience_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.experiences e
    where e.id = p_experience_id and e.user_id = (select auth.uid())
  );
$$;
revoke execute on function public.owns_experience(uuid) from public, anon;
grant  execute on function public.owns_experience(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------- policies
-- Reference tables: authenticated read, nobody writes (seed/migrations only).
create policy ref_read_roles on public.career_roles      for select to authenticated using (true);
create policy ref_read_caps  on public.capabilities      for select to authenticated using (true);
create policy ref_read_rc    on public.role_capabilities for select to authenticated using (true);

-- profiles: read own; update own non-privileged columns (see column grants). Rows are created by trigger.
create policy profiles_select_own on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- experiences: full CRUD on own rows only.
create policy exp_select on public.experiences for select to authenticated using (user_id = (select auth.uid()));
create policy exp_insert on public.experiences for insert to authenticated with check (user_id = (select auth.uid()));
create policy exp_update on public.experiences for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy exp_delete on public.experiences for delete to authenticated using (user_id = (select auth.uid()));

-- children are checked through the parent experience.
create policy expcap_select on public.experience_capabilities for select to authenticated
  using ((select public.owns_experience(experience_id)));
create policy expcap_insert on public.experience_capabilities for insert to authenticated
  with check ((select public.owns_experience(experience_id)));
create policy expcap_delete on public.experience_capabilities for delete to authenticated
  using ((select public.owns_experience(experience_id)));

create policy evidence_select on public.evidence for select to authenticated
  using ((select public.owns_experience(experience_id)));
-- A row may only point at a file inside the owner's own folder for that experience.
create policy evidence_insert on public.evidence for insert to authenticated
  with check (
    (select public.owns_experience(experience_id))
    and storage_path is not null
    and storage_path like ((select auth.uid())::text || '/' || experience_id::text || '/%')
  );
create policy evidence_delete on public.evidence for delete to authenticated
  using ((select public.owns_experience(experience_id)));

create policy stmt_select on public.capability_statements for select to authenticated using (user_id = (select auth.uid()));
create policy stmt_insert on public.capability_statements for insert to authenticated with check (user_id = (select auth.uid()));
create policy stmt_update on public.capability_statements for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy stmt_delete on public.capability_statements for delete to authenticated using (user_id = (select auth.uid()));

-- validations: owner may READ (non-secret columns only). All writes go through security-definer functions.
create policy val_select on public.validations for select to authenticated
  using ((select public.owns_experience(experience_id)));

-- share_links: owner CRUD (Could-have feature; table exists so RLS is in place from day one).
create policy share_select on public.share_links for select to authenticated using (user_id = (select auth.uid()));
create policy share_insert on public.share_links for insert to authenticated with check (user_id = (select auth.uid()));
create policy share_update on public.share_links for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy share_delete on public.share_links for delete to authenticated using (user_id = (select auth.uid()));

-- audit_log: RLS on, no policies => no client can read or write it. Only definer functions and service_role.

-- ---------------------------------------------------------------- grants (least privilege)
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;

-- reference tables are read-only for clients
revoke insert, update, delete, truncate on public.career_roles, public.capabilities, public.role_capabilities from authenticated;

-- profiles: clients may only touch four columns; `role` and `is_demo` are not writable.
revoke insert, update, delete, truncate on public.profiles from authenticated;
grant  update (display_name, programme, institution, target_role_id) on public.profiles to authenticated;

-- validations: read-only, and never the token hash column.
revoke all on public.validations from authenticated;
grant  select (id, experience_id, validator_name, validator_email, validator_kind, status, expires_at, used_at, comment, created_at)
  on public.validations to authenticated;

-- evidence rows are immutable once written (delete + re-add instead of update)
revoke update on public.evidence from authenticated;
-- experience_capabilities has no update path either
revoke update on public.experience_capabilities from authenticated;

-- audit_log is invisible to clients
revoke all on public.audit_log from authenticated;

-- experiences: `is_demo` must not be settable by clients
revoke insert, update on public.experiences from authenticated;
grant  insert (id, user_id, title, type, role_title, duration_label, start_date, end_date, description, reflection)
  on public.experiences to authenticated;
grant  update (title, type, role_title, duration_label, start_date, end_date, description, reflection)
  on public.experiences to authenticated;

-- ---------------------------------------------------------------- new-user trigger
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Learner'), 80)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- validation functions
-- 1) Learner requests validation. Server generates the 32-byte token and passes ONLY its SHA-256 hex hash.
create function public.request_validation(
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
  if (select auth.uid()) is null or not public.owns_experience(p_experience_id) then
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
revoke execute on function public.request_validation(uuid, text, text, public.validator_kind, text, timestamptz) from public, anon;
grant  execute on function public.request_validation(uuid, text, text, public.validator_kind, text, timestamptz) to authenticated;

-- 2) Server-only: what the validator page may show. Returns NULL for unknown, used, expired or non-pending tokens.
create function public.validation_context(p_token_hash text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return null;
  end if;
  select jsonb_build_object(
    'validation_id',  v.id,
    'token_hash',     v.token_hash,
    'validator_name', v.validator_name,
    'validator_kind', v.validator_kind,
    'learner_name',   p.display_name,
    'is_demo',        e.is_demo,
    'experience', jsonb_build_object(
      'title', e.title, 'type', e.type, 'role_title', e.role_title,
      'duration_label', e.duration_label, 'description', e.description, 'reflection', e.reflection),
    'capabilities', (
      select coalesce(jsonb_agg(c.name order by c.name), '[]'::jsonb)
      from public.experience_capabilities ec join public.capabilities c on c.id = ec.capability_id
      where ec.experience_id = e.id),
    'evidence', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', ev.id, 'kind', ev.kind, 'filename', ev.filename, 'storage_path', ev.storage_path) order by ev.created_at), '[]'::jsonb)
      from public.evidence ev where ev.experience_id = e.id)
  ) into r
  from public.validations v
  join public.experiences e on e.id = v.experience_id
  join public.profiles p    on p.id = e.user_id
  where v.token_hash = p_token_hash
    and v.status = 'pending' and v.used_at is null and v.expires_at > now();
  return r;
end;
$$;
revoke execute on function public.validation_context(text) from public, anon, authenticated;
grant  execute on function public.validation_context(text) to service_role;

-- 3) Server-only: record the single allowed decision atomically. Returns false if the token is not usable.
create function public.record_validation_decision(
  p_token_hash text,
  p_status     public.validation_status,
  p_comment    text
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then return false; end if;
  if p_status not in ('endorsed', 'changes_requested', 'declined') then return false; end if;
  if p_comment is not null and char_length(p_comment) > 1000 then return false; end if;

  update public.validations
     set status = p_status, comment = nullif(trim(coalesce(p_comment, '')), ''), used_at = now()
   where token_hash = p_token_hash
     and status = 'pending' and used_at is null and expires_at > now()
  returning id into v_id;

  if v_id is null then return false; end if;

  insert into public.audit_log (actor, action, entity, entity_id)
  values (null, 'validation.' || p_status::text, 'validation', v_id);
  return true;
end;
$$;
revoke execute on function public.record_validation_decision(text, public.validation_status, text) from public, anon, authenticated;
grant  execute on function public.record_validation_decision(text, public.validation_status, text) to service_role;
