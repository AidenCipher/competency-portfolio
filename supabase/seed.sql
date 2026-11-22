-- =====================================================================================
-- SEED DATA. Everything below the "DEMO" banner is invented demonstration data.
-- "Jo" is a fictional learner. No figure here is a real result or a real person.
-- Runs on `supabase db reset` (local only). Never run against a real learner database.
-- =====================================================================================

-- ------------------------------------------------------------ reference data (real configuration)
insert into public.career_roles (id, slug, name, department, description, is_mapped) values
  ('a0000000-0000-4000-8000-000000000001', 'hr-business-partner', 'HR Business Partner', 'Human Resources',
   'Partners with business leaders to align people strategy with business goals.', true),
  -- PLACEHOLDER names (confirm with the team). Name-only: no capability targets until Sprint 3.
  ('a0000000-0000-4000-8000-000000000002', 'talent-acquisition-partner', 'Talent Acquisition Partner', 'Human Resources', null, false),
  ('a0000000-0000-4000-8000-000000000003', 'learning-development-specialist', 'Learning & Development Specialist', 'Human Resources', null, false),
  ('a0000000-0000-4000-8000-000000000004', 'people-analytics-analyst', 'People Analytics Analyst', 'Human Resources', null, false);

insert into public.capabilities (id, slug, name, statement_template, suggested_experience) values
  ('c0000000-0000-4000-8000-000000000001', 'communication', 'Communication',
   'I can communicate complex ideas clearly to different audiences, in writing and in person.',
   'Present findings or a recommendation to a group and collect feedback on how clear it was.'),
  ('c0000000-0000-4000-8000-000000000002', 'team-leadership', 'Team Leadership',
   'I can organise a team, share out work fairly and keep everyone moving toward a shared goal.',
   'Lead a small project team end to end, and ask a supervisor to comment on how you led.'),
  ('c0000000-0000-4000-8000-000000000003', 'data-analysis', 'Data Analysis',
   'I can turn people data into findings and recommendations that others can act on.',
   'Analyse a real or case data set (e.g. attrition or engagement) and present what it means.'),
  ('c0000000-0000-4000-8000-000000000004', 'stakeholder-management', 'Stakeholder Management',
   'I can understand what different stakeholders need and build working relationships with them.',
   'Run interviews or a consultation with at least two stakeholder groups and report back to them.'),
  ('c0000000-0000-4000-8000-000000000005', 'conflict-management', 'Conflict Management',
   'I can help people with opposing views reach a workable outcome.',
   'Facilitate or mediate a disagreement in a team project and reflect on the approach you used.'),
  ('c0000000-0000-4000-8000-000000000006', 'problem-solving', 'Problem Solving',
   'I can break an ambiguous problem into parts, test ideas and land on a practical solution.',
   'Take a messy case, define the problem, evaluate options and document your reasoning.');

-- HRBP targets: Communication 90, Team Leadership 80, Data Analysis 75, Stakeholder Mgmt 85, Conflict Mgmt 70
-- (SPEC section 5). ASSUMPTION: the spec lists no Problem Solving target; 75 is a placeholder to confirm with faculty.
-- Weights are all 1.0 for Sprint 1; Sprint 2 sets real weights.
insert into public.role_capabilities (role_id, capability_id, target, weight) values
  ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 90, 1),
  ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 80, 1),
  ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', 75, 1),
  ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000004', 85, 1),
  ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000005', 70, 1),
  ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000006', 75, 1);

-- =====================================================================================
-- DEMO: fictional learner "Jo" (sign in via magic link to jo.demo@example.test; local Inbucket on :54324)
-- =====================================================================================
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
