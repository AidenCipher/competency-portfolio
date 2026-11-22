-- =====================================================================================
-- SEED DATA. Everything below the "DEMO" banner is invented demonstration data.
-- "Jo" is a fictional learner. No figure here is a real result or a real person.
-- IDEMPOTENT: running this file again resets the demo learner to a clean state ("reset demo"). It only ever deletes the
-- one fixed demo account (and only if that profile is flagged is_demo), so real learners are never touched.
--   Local:  npm run demo:reset          Hosted: run this file in the Supabase SQL editor (or via the SQL API).
-- Requires the reference-data migration (roles, capabilities, HRBP targets).
-- =====================================================================================

-- Reference data (roles, capabilities, HRBP targets and weights) lives in
-- supabase/migrations/20261122000003_reference_data.sql so it reaches every environment, not only local resets.

-- =====================================================================================
-- DEMO: fictional learner "Jo" (sign in via magic link to jo.demo@example.test; local mail catcher on :54324)
-- =====================================================================================
-- Reset: removing the demo auth user cascades to its identity, profile, experiences, evidence, validations and statements.
delete from auth.users u
 using public.profiles p
 where p.id = u.id and p.is_demo and u.id = 'd0000000-0000-4000-8000-000000000001';

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'jo.demo@example.test', '', now(),
  '{"provider":"email","providers":["email"]}', '{"full_name":"Jo (DEMO)"}', now(), now(),
  '', '', '', ''
);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at) values (
  gen_random_uuid(), 'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
  '{"sub":"d0000000-0000-4000-8000-000000000001","email":"jo.demo@example.test","email_verified":true}',
  'email', now(), now(), now()
);

-- the on_auth_user_created trigger has already made the profile row
update public.profiles
   set display_name = 'Jo (DEMO)', programme = 'DEMO programme', institution = 'DEMO institution',
       target_role_id = 'a0000000-0000-4000-8000-000000000001', is_demo = true
 where id = 'd0000000-0000-4000-8000-000000000001';

insert into public.experiences (id, user_id, title, type, role_title, duration_label, description, reflection, is_demo) values
  ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
   '[DEMO] Capstone: staff engagement redesign', 'academic', 'Project lead', '8 weeks',
   'DEMO DATA. Led a four-person team to redesign a fictional company''s staff engagement survey and present the findings.',
   'I learned that running a team meeting well matters more than the plan itself. I rotated who chaired the weekly check-in, wrote a one-page brief for each decision, and checked each person had work that fitted their strengths. When two teammates disagreed about the survey scale, I asked each to state what they were worried about before proposing a compromise, which settled it quickly.',
   true),
  ('e0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001',
   '[DEMO] Conference panel: future of hybrid work', 'event', 'Panel moderator', '1 day',
   'DEMO DATA. Moderated a student panel and wrote up the discussion for the programme newsletter.',
   'I prepared questions in advance but learned to follow the conversation. I summarised each speaker''s point before moving on so the audience could keep up, and I kept time without cutting people off. The write-up forced me to turn an hour of talk into three clear takeaways for readers who had not attended.',
   true),
  ('e0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001',
   '[DEMO] Attrition analysis case', 'academic', 'Analyst', '3 weeks',
   'DEMO DATA. Analysed a fictional dataset on staff turnover and recommended three retention actions.',
   'I cleaned the data first, then compared turnover by tenure band, which showed the problem sat in the first year. I presented a recommendation, not a table, and explained which numbers I did not trust and why.',
   true),
  ('e0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000001',
   '[DEMO] Volunteer coordinator, community food bank', 'volunteer', 'Volunteer coordinator', '6 months',
   'DEMO DATA. Scheduled volunteers and acted as the link between the food bank manager and the volunteers.',
   'Short note only.',
   true),
  ('e0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000001',
   '[DEMO] HR Fundamentals certificate', 'certification', 'Learner', '4 weeks',
   'DEMO DATA. Completed an online HR fundamentals certificate.',
   '',
   true);

insert into public.experience_capabilities (experience_id, capability_id) values
  ('e0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002'),
  ('e0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000005'),
  ('e0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001'),
  ('e0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001'),
  ('e0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000003'),
  ('e0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000006'),
  ('e0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000004'),
  ('e0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000006');

-- Demo evidence rows have no real file behind them (storage_path is null); the UI says so.
insert into public.evidence (experience_id, kind, storage_path, filename, mime, size_bytes) values
  ('e0000000-0000-4000-8000-000000000001', 'report',       null, 'DEMO-engagement-report.pdf',  'application/pdf', 120000),
  ('e0000000-0000-4000-8000-000000000001', 'presentation', null, 'DEMO-findings-deck.pdf',      'application/pdf', 340000),
  ('e0000000-0000-4000-8000-000000000001', 'feedback',     null, 'DEMO-faculty-feedback.pdf',   'application/pdf', 40000),
  ('e0000000-0000-4000-8000-000000000002', 'event_doc',    null, 'DEMO-panel-writeup.pdf',      'application/pdf', 90000),
  ('e0000000-0000-4000-8000-000000000003', 'report',       null, 'DEMO-attrition-analysis.pdf', 'application/pdf', 150000);

-- Validation states: 1,2,3 endorsed; 4 pending; 5 none (self-declared). Hashes are random, never guessable.
insert into public.validations (experience_id, validator_name, validator_email, validator_kind, status, token_hash, expires_at, used_at, comment) values
  ('e0000000-0000-4000-8000-000000000001', 'DEMO Faculty Member', 'faculty.demo@example.test', 'faculty', 'endorsed',
   encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text, 'utf8')), 'hex'), now() + interval '14 days', now(),
   'DEMO comment: led the team well and the final presentation was clear.'),
  ('e0000000-0000-4000-8000-000000000002', 'DEMO Mentor', 'mentor.demo@example.test', 'mentor', 'endorsed',
   encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text, 'utf8')), 'hex'), now() + interval '14 days', now(),
   'DEMO comment: moderated confidently.'),
  ('e0000000-0000-4000-8000-000000000003', 'DEMO Faculty Member', 'faculty.demo@example.test', 'faculty', 'endorsed',
   encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text, 'utf8')), 'hex'), now() + interval '14 days', now(),
   'DEMO comment: sound analysis.'),
  ('e0000000-0000-4000-8000-000000000004', 'DEMO Supervisor', 'supervisor.demo@example.test', 'supervisor', 'pending',
   encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text, 'utf8')), 'hex'), now() + interval '14 days', null, null);
