# Iteration notes

One section per sprint, for the Agile HR course iteration reports.
Each section: goals, outcomes, challenges, adaptations.

## Sprint 1 (due 26 Nov): foundation + all Musts

**Goals.** A deployable, secure foundation and all Must-have stories: reflection prompt, Add Experience form,
capability tagging, evidence attachment, dashboard capability progress, validation by faculty/mentor, and the
Capability Portfolio view.

**Outcomes.**
- Next.js 16 / TypeScript strict / Tailwind / Motion scaffold with light and dark design tokens, Geist fonts, and
  security headers (CSP, HSTS, nosniff, Referrer-Policy, Permissions-Policy, frame-ancestors none).
- Supabase migrations for the full SPEC section 5 data model; RLS on every table; private evidence bucket with no
  client storage policies; narrow `security definer` functions for the validation lifecycle; DEMO seed ("Jo").
- Auth: magic link and Google (Google needs the team's own OAuth client), `/app/*` gated by `proxy.ts` and again by
  `requireUser()` in every page and action.
- `lib/scoring.ts`: the SPEC section 4 formulas as pure functions, 30 unit tests. The UI never recomputes scores.
- Add Experience: zod at the boundary, allow-list + size + magic-byte upload checks, live evidence-strength meter.
- Validation: tokenised one-time link, hash-only storage, 14-day expiry, single use, rate limited, generic error;
  copyable link when email is not configured.
- Dashboard (stat tiles, progress bars with target markers, dark "next capability" card) and Capability Portfolio
  (capability list, statement, evidence strength, substantiating-evidence table) with staggered reveals, count-up,
  bars that fill on view, and a layout animation when switching capability.

**Verification status (be honest in the report).**
- Passing: typecheck, lint, 90 unit/SQL tests, production build, no `SERVICE_ROLE` or secret in `.next/static`,
  security headers present, `/app` redirects when signed out, malformed/unknown tokens return identical pages.
- RLS cross-user, privilege-escalation and token-lifecycle tests run against an in-process Postgres (PGlite) with
  stand-ins for Supabase's `auth` and `storage` schemas. They exercise the real migrations, but **not** the real
  Supabase stack.
- **Not yet run:** the Playwright happy path and anything needing the real stack (GoTrue magic link, Storage upload,
  signed URLs). Docker was not installed on the dev machine. The spec is written (`tests/e2e/`) and should be run
  once `npm run db:start` works.

**Challenges.**
- The scoring spec says "capped < 100" but `round(100 * (1 - prod(1 - k)))` reaches 100 after about 30 perfect
  experiences. A unit test caught it; the score is now capped at 99.
- Next.js 16 renames `middleware` to `proxy` and enables Cache Components in the scaffold; we turned Cache
  Components off (auth-heavy, per-user pages) and use `proxy.ts`.
- A static CSP cannot carry nonces, so it allows inline scripts for hydration. Nonce-based CSP forces dynamic
  rendering of every page and is deferred to Sprint 3.
- Next.js buffers only 10 MB of a request body in `proxy.ts`, which would truncate multi-file uploads, so
  server-action POSTs (`next-action` header) bypass the proxy; each action calls `requireUser()` itself.
- Vercel caps function request bodies at about 4.5 MB, below the 10 MB upload limit. Uploads currently go through
  the server action so they can be validated before storage; Sprint 3 may need signed-upload URLs.

**Adaptations / assumptions to confirm with faculty or the team.**
- The spec lists no Problem Solving target for HRBP; 75 is a placeholder. All HRBP weights are 1.0 until Sprint 2.
- The three other role names (Talent Acquisition Partner, Learning & Development Specialist, People Analytics
  Analyst) are placeholders. They are shown as "Coming soon" and cannot be selected.
- "Actions > Certs" tile is interpreted as hands-on experiences vs certification experiences.
- Scoring constants (0.25 base, factors, level thresholds) are team assumptions, not research results.
