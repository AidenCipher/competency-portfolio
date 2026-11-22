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
- Review of the finished work found the statement editor lost its "saved" announcement and keyboard focus after saving
  (a key that changed with the saved text remounted it). axe cannot detect that; the e2e now asserts the status message and
  that focus returns to the Edit button. Two landing-page claims nobody on the team had approved ("Free to try", "set a
  goal in a minute") were removed.
- One unexplained flake: once, right after the statement feature was added, the dashboard showed the template while the
  database already held the saved text. It did not reproduce in more than five later runs (three in a row, then full suites), so it is
  recorded here rather than explained.
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


## Sprint 3 (due 12 Dec): harden, deploy, present  (IN PROGRESS)

**Where it stands (honest).** The code-side hardening is done and verified on the real local stack. The owner created the hosted
Supabase project (`aoidydcdvwrquhslvwll`, Singapore); migrations 1-7 and the demo seed are applied, advisors are run and
documented, and the live API posture is verified from outside with only the public key. **Not done:** the Vercel project and
deployment, Resend, real Google sign-in, and the live end-to-end run. Vercel access is authorised but no project exists, and
there is no git remote. See [deploy.md](deploy.md) for the runbook and `npm run smoke:live` for the post-deploy checks.

| Sprint 3 acceptance | Status |
|---|---|
| Production URL works end to end with a fresh account | **Not yet.** Deployed and reachable at https://competency-portfolio.vercel.app (Vercel project `competency-portfolio`, functions in `sin1`), but the server-only Supabase key is not set on Vercel yet, and sign-up email needs custom SMTP or Google sign-in. |
| Headers and CSP verified on production; no secrets in the client bundle | **Pass on the live URL for headers/CSP** (`npm run smoke:live`: CSP incl. Supabase connect-src, HSTS, nosniff, Referrer/Permissions-Policy, X-Frame-Options, no X-Powered-By). Bundle scan clean on the local build of the same commit. |
| Advisors clean or each exception documented | **Pass (hosted).** Security: one finding fixed (`owns_experience` moved to a non-exposed schema, migration 7); the other 4 are intentional or Supabase-owned and each is explained in deploy.md. Performance: INFO only, explained. |
| Rate limits return 429 under a scripted burst | **Pass, locally and on the live URL.** Live: a burst of 70 requests to `/validate/*` got 429 from request 59 (earlier checks use some of the 60 allowed); the hosted `rate_limits` table shows the shared counters (keys are HMAC digests, no IPs). Locally also: 20 then 429 on login POSTs; atomic under concurrency (test). |
| Revoked share link returns 404 immediately | **Not built** (Could-have, skipped; core work took priority). |
| Lighthouse >= 90 / >= 95 on landing and dashboard | **Landing: pass on the live URL** (mobile, 3 runs): performance 96, 99, 98; accessibility, best-practices, SEO 100. **Dashboard: pass on a LOCAL production build** signed in as the demo learner (mobile, 3 runs): performance 99, 98, 98; accessibility 100; best-practices 100. **Not yet measured on the live URL** (needs a real signed-in session). |

**Done in this round.**
- Shared Postgres-backed rate limiter; real HTTP 429s from `proxy.ts`.
- Direct signed uploads with server-side re-verification, per-user storage budget, orphan sweep and a 2 MB action body limit.
  Verified against **real Storage**: an 11 MB upload is refused by the bucket, a second upload with the same token is
  refused (so nothing can be swapped in after verification), a token only works for its own path, disallowed content types
  are refused, a 9 MB file (above Vercel's cap) uploads and downloads.
- 404, error and privacy pages; idempotent "reset demo" (local script, hosted via the same SQL file).
- SPEC 6.6 review, line by line. Gaps found and fixed: auth cookies were readable by page JavaScript (now HttpOnly,
  SameSite=Lax, Secure in production); sign-out had no same-origin check; the auth callback `code` was not schema-bounded.
  Already satisfied: zod on every action and route input, rate limits on auth/upload/validation, CSP/HSTS/nosniff/Referrer/
  Permissions/frame-ancestors, no secrets in the bundle, `npm audit` 0 vulnerabilities, audit log for validation decisions,
  privacy notice, no `console.*` logging. Share-link audit/revocation: n/a (not built). Supabase advisors: pending the hosted project.
- Google sign-in: the button was clicked on a **production build under the production CSP** with a temporary local provider
  and fake credentials; the browser reached accounts.google.com with no CSP violation. This proves the redirect mechanics,
  **not** the real round trip, which needs your OAuth client.

**What the review and tests caught.**
- My first bundle scan "found" `sb_secret_` in a client chunk. It was supabase-js's own key-format check
  (`startsWith("sb_secret_")`), not a key; the real key value appeared in zero files. A bare-prefix grep was the wrong tool, so
  `scripts/scan-bundle.mjs` now checks real secret values, key-shaped strings and decoded `service_role` JWTs, and was
  proven against a planted key.
- Supabase's built-in email sender delivers **only to the organisation's team members** and is capped, so magic links to
  fresh accounts on production need custom SMTP; Resend only sends to arbitrary addresses from a verified domain. That is the
  gating decision for both "Resend delivery" and "production works with a fresh account". Google sign-in is the fallback.
- A DB test that boots its own in-process Postgres timed out under parallel load; it now boots in `beforeAll`.

**Needs the owner.** A private GitHub repo (and a corrected git author before the first push) or a `npx vercel` run from the
project folder; the Supabase secret key pasted into Vercel as Sensitive; a sending domain for Resend (or accept test-only
email); a Google OAuth client; and the Supabase Auth URL settings once the Vercel URL is known.

**Hosted verification (2026-11-22/23).** With only the public key: every table and server-only function denied to `anon`
(`42501`); `owns_experience` not exposed (404); `demo_portfolio()` public and leak-free; no buckets listable; evidence not
publicly readable; anonymous uploads refused. The Supabase advisor flagged `rls_auto_enable()`: Supabase's own function, left alone.


**Live deployment (first run, 2026-11-22).** `npm run smoke:live -- https://competency-portfolio.vercel.app` passed 17 of 19
checks (all headers/CSP, `/demo`, `/privacy`, 404, login redirect, cross-site sign-out refusal, sweep route closed). The two
failures were confirmed from the Vercel runtime logs to be the missing `SUPABASE_SERVICE_ROLE_KEY` (a ZodError at the first
server-only call): `/validate` returned 500 and the shared limiter fell back to per-instance memory, so no 429 appeared.
Both are expected to clear once the key is set and the app redeployed; to be re-run and reported then. Functions run in `sin1`
(`x-vercel-id: bom1::sin1`: bom1 is only the edge that received the request). Vercel Authentication did not block the
production alias (HTTP 200 anonymously).

**Live deployment (second run, after the server key was set).** `SUPABASE_SERVICE_ROLE_KEY` turned out not to be on the Vercel
project when first checked (the variable list showed only the public ones and `CRON_SECRET`), so it was set as a Sensitive
variable for Production and Preview and the app redeployed. `npm run smoke:live -- https://competency-portfolio.vercel.app` then
passed **19 of 19**, and the live landing Lighthouse numbers above were measured. Still open: a real fresh-account sign-up on
the live URL (Google sign-in or the owner's own email link), the dashboard Lighthouse run, Resend, and rotating the Supabase secret
key (it was pasted into a chat session, so it should be treated as exposed).

**Google sign-in (verified up to the consent screen).** After the owner enabled the Google provider in Supabase, the project's
public settings list `google` as enabled; Supabase's authorize URL redirects to `accounts.google.com` with the correct client ID,
callback `https://aoidydcdvwrquhslvwll.supabase.co/auth/v1/callback` and scope `email profile`; and a real browser click on
"Continue with Google" on the live site reached Google's genuine sign-in page ("Sign in to continue to
aoidydcdvwrquhslvwll.supabase.co") with no error page and no CSP violation. **Not verified:** a completed sign-in (needs the
owner's Google account) and the app's session after the callback. The OAuth client secret was pasted into a chat session and
should be rotated.


---

# CIA 3 final report support

Structure: (1) outcomes, (2) stakeholder feedback and impact, (3) lessons learned, (4) limitations and next steps, (5) how to
reproduce each claim. Everything in sections 1, 3 and 5 comes from this repository's history and test runs. **Section 2 is a
template: no stakeholder feedback has been recorded in this repository, and none is invented here.**

## 1. Outcomes

### Scope delivered against the team's MoSCoW backlog
| Sprint | Planned (SPEC section 1) | Delivered |
|---|---|---|
| 1 (26 Nov) | Foundation + all Musts: reflection prompt, Add Experience, capability tagging, evidence attachment, dashboard progress, validation by faculty/mentor, Capability Portfolio view | All seven, on the real local Supabase stack. Sign-up, evidence upload, validator link, endorsement and score change verified end to end. |
| 2 (10 Dec) | Shoulds: capability statements, evidence-strength meter, HRBP capability map, "What should I build next?", landing page, motion | All, plus a public read-only demo portfolio and an experience detail page. Other roles are name-only ("Coming soon"), as planned. |
| 3 (12 Dec) | Harden, deploy, present. Coulds only if time remains | Hardening, hosted Supabase, Vercel deployment, 404/500/privacy pages, demo reset script. **No Could-have was built** (share link, PDF export, mentor reminder, goal switcher): core hardening and deployment took the time. |

Team decisions kept as **Won't**: employer login/search, LinkedIn/university integrations, AI auto-tagging, blockchain
credentials, native mobile app.

### Product outcomes (what exists and works)
- A learner can sign up, choose HR Business Partner, log an experience with a file and a reflection, request validation, and see
  scores and the evidence meter update. A validator needs no account: a single-use link that expires after 14 days, with only a
  hash stored.
- Scores follow SPEC section 4 exactly (`lib/scoring.ts`, pure functions, unit-tested). The ranking behind "what next" is a
  rule, not a model, and says why.
- Learners cannot read each other's rows or files. This is enforced in the database (row-level security) and tested against the
  real stack, not only in the app.

### Engineering outcomes (measured)
| Measure | Result |
|---|---|
| Automated tests | 136 unit/database tests, 19 real-stack tests (real GoTrue, PostgREST, Storage), 19 browser tests (Playwright, including axe, keyboard-only and reduced-motion). All passing on the final code. |
| Accessibility | axe (WCAG 2.0/2.1 A and AA): zero serious or critical violations on 14 screens/states, light and dark. Keyboard-only Add Experience works. |
| Performance | Live landing page, mobile Lighthouse: 96, 99, 98 (performance); 100 accessibility, best-practices and SEO. Dashboard (local production build, signed in): 99, 98, 98 / 100. |
| Security | `npm audit` 0 vulnerabilities; no secrets in the client bundle (scanner with a planted-key negative control); security headers and CSP verified on the live URL; Supabase advisors run and each remaining finding explained (docs/deploy.md); live burst test returns HTTP 429. |
| Live checks | `npm run smoke:live`: 19 of 19 passing against https://competency-portfolio.vercel.app. |

### Not verified (state this in the report)
Resend email delivery; a completed Google sign-in (verified only up to Google's own sign-in page); a full fresh-account
end-to-end run on production including a file upload and an endorsement; the dashboard Lighthouse run on the live URL. The
weights, the Problem Solving target (75), the three other role names and the scoring constants are team assumptions, not
research results.

## 2. Stakeholder feedback and impact (TEMPLATE, to be completed by the team)

Record real feedback only, with who gave it and when. One row per piece of feedback.

| Stakeholder (role, not a name if they prefer) | Date | What they said or did | Product change made (or why not) | Evidence (commit, doc or screenshot) |
|---|---|---|---|---|
| _faculty / programme lead_ | | | | |
| _mentor or industry contact_ | | | | |
| _peer / learner who tried the demo_ | | | | |

Prompts that fit this product: Do the weights and the Strong/Proficient/Developing thresholds feel right to faculty? Did a
validator find the single-use link easy? Did learners understand "what should I build next"? What would an employer want to
see that the portfolio does not show? Items the SPEC already flags for faculty input: target values for roles other than
HRBP, the Problem Solving target, and which email sender/domain to use.

## 3. Lessons learned (each one happened in this build)
1. **Test the real thing, and say what you did not.** Early RLS tests ran on an in-process Postgres with stand-in `auth` and
   `storage` schemas. They were useful but could not prove isolation of real files. Running the same claims against the real
   stack later caught a test that passed for the wrong reason (a wrong parameter name produced "function not found", not
   "access denied"). Reports now separate "verified on the real stack" from "verified on a stand-in".
2. **Specs hide edge cases.** The scoring formula reaches 100 after about 30 perfect experiences although the spec says
   "capped below 100". A unit test caught it; the cap is 99.
3. **Accessibility tests find real bugs, not only paperwork.** An axe run with reduced motion enabled exposed a hydration
   mismatch that affected only reduced-motion users (a Sprint 1 bug). A later review found the statement editor lost keyboard
   focus after saving, which axe cannot detect, so the browser test now asserts focus.
4. **Design for the platform you deploy to.** Vercel caps request bodies at about 4.5 MB while the spec allows 10 MB files.
   Uploads moved to single-use signed URLs straight to Storage, with the server re-checking the real bytes afterwards.
5. **Security controls need adversarial tests.** The upload guards (an 11 MB file, a reused upload token, a token for another
   path, a disallowed content type) are tested against real Storage. A bare `grep` for `sb_secret_` produced a false alarm from a
   library; a scanner that checks real secret values and decoded JWT roles replaced it and was proven against a planted key.
6. **Defaults and silent gaps bite at deploy time.** The server-side Supabase key was missing from the hosted project, and
   the first live smoke test exposed it through a 500 and a missing 429. A scripted post-deploy check turned that into a
   five-minute fix.
7. **Secrets do not belong in chat or commit history.** Keys pasted into a conversation are treated as exposed and rotated;
   server-only keys live only in the host's Sensitive settings.
8. **Hosted free tiers have hidden limits.** Supabase's built-in email only reaches the organisation's own members, Resend
   needs a verified domain, and free projects pause when idle. These shaped the sign-in design (Google plus a copyable link).
9. **Tool limits are information.** Creating a billable cloud resource was blocked until the owner did it personally; the plan
   adapted instead of working around the control.

## 4. Limitations and next steps
- No Could-haves: share link (table and RLS exist), PDF export, mentor reminder, role switcher.
- In-app deletion of an account or data is not self-service (the privacy page says to ask the programme team).
- The CSP allows inline scripts (a nonce-based CSP would make every page dynamic and cost landing-page performance); accepted
  and documented.
- Production email for validators and magic links needs a verified sending domain.
- Rotate the Supabase secret key and the Google client secret that were shared in a chat session.

## 5. How to reproduce each claim
```bash
npm run typecheck && npm run lint && npm test          # 136 unit and database tests
npm run db:start && npm run test:stack                  # 19 real-stack tests (needs Docker)
npm run test:e2e                                        # 19 browser tests incl. axe, keyboard, reduced motion
npm run build && npm run scan:bundle                    # no secrets in the client bundle
npm run smoke:live -- https://competency-portfolio.vercel.app   # 19 live checks
```
Lighthouse: see the README. Hosted Supabase advisors and the exception list: docs/deploy.md.
