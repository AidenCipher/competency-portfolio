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
- Passing: typecheck, lint, 90 unit/SQL tests, production build, no `SERVICE_ROLE` or secret in `.next/static`
  (re-checked with the real local service-role key loaded), security headers present, `/app` redirects when signed out.
- Verified on the **real local Supabase stack** (Docker; migrations and seed apply cleanly on Postgres 17):
  - `npm run test:e2e` (Playwright, 3 tests): magic-link sign-in via Mailpit, goal selection, experience with a PDF and
    a 45-word reflection, copyable validation link, endorsement by a signed-out validator, dashboard score moving
    11 (pending) -> 18 (validated) and "validated 1/1", portfolio row, owner download via a 302 to a signed URL that
    serves the real PDF, a second learner getting 404 on that URL, `.exe` / renamed `.exe` / 11 MB uploads rejected
    server-side, and expired / malformed / unknown links returning byte-identical generic pages.
  - `npm run test:stack` (9 tests, real GoTrue + PostgREST + Storage): learner B cannot read, edit, delete or attach
    to A's rows, cannot download, sign, list or overwrite A's files; even the owner has no direct Storage access;
    clients get `permission denied` on `validations.token_hash` and the validator functions; token lifecycle
    (valid, used, expired, unknown).
- The PGlite SQL tests (stand-in `auth`/`storage`) remain as a fast, Docker-free check of the same migrations.
- Not covered: Google sign-in (needs an OAuth client), Resend email delivery, a deployed Vercel environment.
- A test bug found on first real run: the e2e asserted on the wrong capability tab. The app was right.

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


## Sprint 2 (due 10 Dec): Shoulds + landing page

**Goals.** Capability statements, evidence-meter polish, the HR Business Partner capability map, a rule-based "What
should I build next?" screen, a landing page with an animated hero, motion polish, and tests (ranking, Playwright, axe).

**Outcomes.**
- Reference data (roles, capabilities, HRBP targets and weights) moved into an idempotent migration, so it reaches
  production, not only local resets. `seed.sql` now holds only the DEMO learner.
- `lib/scoring.ts` gained `rankCapabilities` and `recommendNext`, returning one of three outcomes (recommend, all
  targets met, no capability map) with the why-text. The UI renders it and computes nothing.
- Editable capability statements (zod, RLS-backed upsert, reset to the suggested wording), shown on Portfolio and Dashboard.
- Evidence meter polish: staggered reveal, ring pulse when a dot lights, `n/5` label, polite live region; also on each
  Portfolio evidence row.
- `/app/next`: recommendation, why-text, current vs target bars, suggested experience, "Log this experience"
  (prefills the capability tag), the rest of the ranking, the loop explainer and an all-targets-met state.
- Landing page: static, CSS-only animated capability graph and loop diagram, demo CTA, privacy footer. Public read-only
  `/demo` for the fictional learner, served by one narrow `security definer` function granted to `anon`.
- Experience detail page, a shared-element title morph from the list (React `<ViewTransition>`), and a short page crossfade.

**Verification (real local Supabase stack; run on the final tree).**

| Sprint 2 acceptance | Result |
|---|---|
| No Stakeholder evidence recommends Stakeholder Management; the recommendation changes after validated evidence | **Pass.** Unit tests with the real HRBP map and weights, and an e2e on the real page. |
| Every target met shows a sensible state, no crash | **Pass.** Unit test plus an e2e that temporarily sets all targets to 0 (restored afterwards). |
| Other roles cannot be selected, nothing implies they are mapped | **Pass.** Radio inputs disabled and labelled "Coming soon"; the server action rejects unmapped roles; an unmapped chosen role is treated as no goal (unit test). |
| axe: zero serious/critical; keyboard-only Add Experience works | **Pass.** axe (WCAG 2.0/2.1 A and AA) on 14 screens and states, each in light and dark; a real Tab/Space/Enter flow. |
| `prefers-reduced-motion` disables non-essential animation | **Pass.** Computed-style checks (hero graph static and lit, loop highlight off), plus no hydration or console errors in either mode. |
| Lighthouse mobile, landing: performance >= 90, accessibility >= 95 | **Pass.** Performance 100, 100, 99; accessibility 100 on every run. One earlier run scored 89 while the machine was under heavy load (builds and Docker), so it is reported rather than hidden. |

Other checks: typecheck, lint, 119 unit/SQL tests, 11 real-stack tests, 13 Playwright tests, production build, no secret
in `.next/static`, `npm audit` 0 vulnerabilities. Not covered: Google sign-in, Resend delivery, a Vercel deployment.

**Challenges and what the tests caught.**
- **Hydration mismatch for reduced-motion users (a Sprint 1 bug).** Motion's `useReducedMotion` returns the real value during
  hydration, but the server cannot know it, so the first client render differed from the server HTML. It only affects
  users with the preference on, so nothing had flagged it; the axe run with reduced motion on surfaced it. Fixed with an
  SSR-safe hook (`false` on the server and during hydration, real value after) and keyed remounts into the instant state.
- Light-mode contrast: the green "Validated" chip was 3.85:1 and tertiary text 4.35:1 on one surface. Both darkened to pass AA.
  Dark mode passed first time.
- A security review before building `/demo` (a public route) led to a narrow `demo_portfolio()` function instead of the
  service role, `user_id` filters added to the learner loader as defence in depth, and tests that a real learner's rows never appear.
- The recommendation function returned `null` for both "no capability map" and "all targets met", which would have told
  a learner without a map that they had met every target. It is now a three-way result.
- My first "clients cannot call the validator functions" test passed for the wrong reason (a wrong parameter name gave
  "function not found"). It now asserts `permission denied`.
- The e2e suite hit the app's own login rate limit after five sign-ins; each test now signs in from its own test IP so
  the limiter stays on, and a test proves the sixth request from one IP is refused. Playwright is pinned to one worker
  because one test temporarily edits shared reference data.
- Lighthouse results depend on machine load; see the README note.

**Adaptations / assumptions to confirm with faculty or the team.**
- HRBP weights are working values, not research: Stakeholder Management 1.2, Communication 1.1, Data Analysis 0.9, others 1.0.
  With these, a learner with no evidence is recommended Stakeholder Management (unit test). With equal weights they would be
  recommended Communication (also a unit test), so the answer depends on this assumption.
- The Problem Solving target (75), the three other role names and the scoring constants remain unconfirmed assumptions.
- Statement length is capped at 300 characters (the database allows 600).

**Carried to Sprint 3.** Upstash/KV rate limiting (the in-memory limiter is per instance; also review trusting the first
`x-forwarded-for` entry outside Vercel), nonce CSP, the 4.5 MB Vercel body cap against 10 MB uploads, seeding Jo and
reference data on the hosted project, Supabase advisors, and a hosted Lighthouse run on landing and dashboard.
