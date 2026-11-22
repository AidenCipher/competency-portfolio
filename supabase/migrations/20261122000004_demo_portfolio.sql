-- Public, read-only demo portfolio for the landing page ("View demo portfolio").
--
-- Why a function and not a table grant or the service role: the demo page is public, so it must be impossible for it
-- to return anything but the one fictional learner flagged `profiles.is_demo`. `is_demo` is not writable by clients
-- (column grants in migration 1), so no real learner can become, or inject rows into, the demo.
--
-- What it never returns: validator emails, token hashes, storage paths, user ids, or any non-demo row.
create function public.demo_portfolio()
returns jsonb language sql stable security definer set search_path = '' as $$
  with demo as (
    select p.id, p.display_name, p.target_role_id
      from public.profiles p
     where p.is_demo
     order by p.created_at, p.id
     limit 1
  )
  select jsonb_build_object(
    'profile', jsonb_build_object('display_name', d.display_name, 'is_demo', true, 'target_role_id', d.target_role_id),
    'roles', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'is_mapped', r.is_mapped) order by r.name), '[]'::jsonb)
                from public.career_roles r),
    'roleCaps', (select coalesce(jsonb_agg(jsonb_build_object(
                    'role_id', rc.role_id, 'target', rc.target, 'weight', rc.weight,
                    'capabilities', jsonb_build_object('id', c.id, 'slug', c.slug, 'name', c.name,
                                                       'statement_template', c.statement_template,
                                                       'suggested_experience', c.suggested_experience))), '[]'::jsonb)
                   from public.role_capabilities rc join public.capabilities c on c.id = rc.capability_id),
    'experiences', (select coalesce(jsonb_agg(jsonb_build_object(
                      'id', e.id, 'title', e.title, 'type', e.type, 'role_title', e.role_title,
                      'duration_label', e.duration_label, 'description', e.description, 'reflection', e.reflection,
                      'is_demo', e.is_demo, 'created_at', e.created_at,
                      'experience_capabilities', (select coalesce(jsonb_agg(jsonb_build_object('capability_id', ec.capability_id)), '[]'::jsonb)
                                                    from public.experience_capabilities ec where ec.experience_id = e.id),
                      'evidence', (select coalesce(jsonb_agg(jsonb_build_object(
                                     'id', ev.id, 'kind', ev.kind, 'filename', ev.filename, 'size_bytes', ev.size_bytes,
                                     'has_file', false)), '[]'::jsonb)   -- demo files are never downloadable
                                     from public.evidence ev where ev.experience_id = e.id),
                      'validations', (select coalesce(jsonb_agg(jsonb_build_object(
                                        'id', v.id, 'validator_name', v.validator_name, 'validator_kind', v.validator_kind,
                                        'status', v.status, 'comment', v.comment, 'expires_at', v.expires_at)), '[]'::jsonb)
                                        from public.validations v where v.experience_id = e.id)
                    ) order by e.created_at desc), '[]'::jsonb)
                    from public.experiences e where e.user_id = d.id and e.is_demo),
    'statements', (select coalesce(jsonb_agg(jsonb_build_object('capability_id', s.capability_id, 'text', s.text)), '[]'::jsonb)
                     from public.capability_statements s where s.user_id = d.id)
  )
  from demo d;
$$;

revoke execute on function public.demo_portfolio() from public;
grant  execute on function public.demo_portfolio() to anon, authenticated, service_role;
