-- Private evidence bucket. Deliberately NO storage.objects policies for anon/authenticated:
-- uploads happen only in server code (service role) after allow-list, size and magic-byte checks,
-- and downloads only through short-lived signed URLs minted server-side after an authorisation check.
-- RLS on storage.objects is on by default in Supabase, so no policy = no direct client access.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evidence', 'evidence', false, 10485760,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
