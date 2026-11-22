-- Files that were uploaded straight to Storage but never claimed by an `evidence` row (an abandoned form, a failed
-- verification, a closed tab). They are private and unreachable, but they use storage, so a daily job removes them.
-- This function only LISTS candidates (service_role only); deletion goes through the Storage API so blobs are removed too.
create function public.orphaned_evidence_objects(p_older_than interval default interval '24 hours')
returns table(name text)
language sql stable security definer set search_path = '' as $$
  select o.name
    from storage.objects o
   where o.bucket_id = 'evidence'
     and o.created_at < now() - p_older_than
     and not exists (select 1 from public.evidence e where e.storage_path = o.name)
   order by o.created_at
   limit 500;
$$;
revoke execute on function public.orphaned_evidence_objects(interval) from public, anon, authenticated;
grant  execute on function public.orphaned_evidence_objects(interval) to service_role;
