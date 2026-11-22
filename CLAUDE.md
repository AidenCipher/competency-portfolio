# CLAUDE.md — Capability Portfolio

Read `SPEC.md` first; it is the source of truth for scope, scoring, data model and security.

## Stack
Next.js App Router, TypeScript (strict), Tailwind, Motion (framer-motion), Supabase (Auth, Postgres, private Storage), zod, Vitest, Playwright. Deployed on Vercel. No separate backend service.

## Commands
- `npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`
- Supabase migrations live in `supabase/migrations/`; never edit the DB by hand without a migration.

## Rules
1. Work only on the current sprint file in `prompts/`. Do not start later sprints' features.
2. Scoring logic lives only in `lib/scoring.ts` as pure functions with unit tests. UI never recomputes scores.
3. Every table has RLS enabled in the same migration that creates it. Write RLS tests (two users, cross-read must fail).
4. All input crosses a zod schema at the server boundary. No `any`.
5. Service-role key is server-only. Never import the admin client in a client component or prefix it `NEXT_PUBLIC_`.
6. Never log tokens, emails, or file paths with PII. Validation tokens are stored hashed.
7. Seed data is demo data: label "Demo" in UI and seed file; do not present invented numbers as real.
8. Motion: transform/opacity only, respect `prefers-reduced-motion`, no layout-thrash animations.
9. Before saying a task is done: `typecheck`, `lint`, `test` pass, then check the sprint's acceptance list and report each item pass/fail honestly.
10. Ask before creating or modifying Supabase/Vercel resources (projects, env vars, domains).

## Style
Small components, server components by default, client components only for interaction/motion. Design tokens in `tailwind.config` and CSS variables (light and dark). Keep the prototype's look: white cards, electric-blue accent, green/amber/blue status chips, dark "next capability" card, mono micro-labels.

## Definition of done (every sprint)
Acceptance checks pass · no secrets in repo · `.env.example` updated · README section updated · short sprint note appended to `docs/iterations.md` (goals, outcomes, challenges, adaptations) for the course iteration report.
