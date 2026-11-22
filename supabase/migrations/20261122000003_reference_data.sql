-- Reference data: career roles, capabilities, and the HR Business Partner capability map.
-- This is the "admin SQL seed" (SPEC section 2): no admin UI, changes ship as migrations.
-- Idempotent (upsert), so re-running or correcting values is a new migration, never a hand edit.
--
-- ASSUMPTIONS to confirm with faculty (SPEC section 4: "team assumptions, not research results"):
--   * Targets for Communication 90, Team Leadership 80, Data Analysis 75, Stakeholder Management 85 and
--     Conflict Management 70 come from SPEC section 5. The Problem Solving target (75) is a placeholder.
--   * Weights express how central a capability is to the HRBP role. They are working values:
--     Stakeholder Management 1.2, Communication 1.1, Team Leadership / Conflict Management / Problem Solving 1.0,
--     Data Analysis 0.9. They only affect the "what should I build next?" ranking, never a score.
--   * The three other role names are placeholders. They are name-only (is_mapped = false) and not selectable.

insert into public.career_roles (id, slug, name, department, description, is_mapped) values
  ('a0000000-0000-4000-8000-000000000001', 'hr-business-partner', 'HR Business Partner', 'Human Resources',
   'Partners with business leaders to align people strategy with business goals.', true),
  -- PLACEHOLDER names (confirm with the team). Name-only: no capability targets until Sprint 3.
  ('a0000000-0000-4000-8000-000000000002', 'talent-acquisition-partner', 'Talent Acquisition Partner', 'Human Resources', null, false),
  ('a0000000-0000-4000-8000-000000000003', 'learning-development-specialist', 'Learning & Development Specialist', 'Human Resources', null, false),
  ('a0000000-0000-4000-8000-000000000004', 'people-analytics-analyst', 'People Analytics Analyst', 'Human Resources', null, false)
on conflict (id) do update set
  slug = excluded.slug, name = excluded.name, department = excluded.department,
  description = excluded.description, is_mapped = excluded.is_mapped;

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
   'Take a messy case, define the problem, evaluate options and document your reasoning.')
on conflict (id) do update set
  slug = excluded.slug, name = excluded.name,
  statement_template = excluded.statement_template, suggested_experience = excluded.suggested_experience;

insert into public.role_capabilities (role_id, capability_id, target, weight) values
  ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 90, 1.1),  -- Communication
  ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 80, 1.0),  -- Team Leadership
  ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', 75, 0.9),  -- Data Analysis
  ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000004', 85, 1.2),  -- Stakeholder Management
  ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000005', 70, 1.0),  -- Conflict Management
  ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000006', 75, 1.0)   -- Problem Solving (target is a placeholder)
on conflict (role_id, capability_id) do update set target = excluded.target, weight = excluded.weight;
