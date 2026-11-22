# Capability Portfolio

> Don't just show what the learner completed. Show what the learner can do.

Career goal → Capability → Experience → Evidence → Reflection → Validation → Progression.
Scope, scoring rules, data model and security checklist: [SPEC.md](SPEC.md). Working rules: [CLAUDE.md](CLAUDE.md).
Sprint notes for the course reports: [docs/iterations.md](docs/iterations.md).

Stack: Next.js 16 (App Router) · TypeScript strict · Tailwind 4 · Motion · Supabase (Auth, Postgres, private Storage) · zod · Vitest · Playwright.

## Quick start (local)

Requirements: Node 22+, **Docker Desktop** (the local Supabase stack runs in containers).

```bash
npm install
npm run db:start          # starts local Supabase; applies supabase/migrations, then supabase/seed.sql (demo learner only)
npx supabase status -o env  # prints the local URL and keys
cp .env.example .env.local  # then paste the values below
```

Fill `.env.local` from the status output:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `API_URL` (http://127.0.0.1:54321) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the publishable / anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | the secret / service-role key. **Server only; never prefix with `NEXT_PUBLIC_`** |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` |

```bash
npm run dev     # http://localhost:3000
```

Sign-in emails are caught by the local mail catcher at http://127.0.0.1:54324. The seeded **DEMO** learner is `jo.demo@example.test`
(all demo data is fictional and labelled).

Google sign-in needs your own OAuth client: set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` and set
`enabled = true` under `[auth.external.google]` in `supabase/config.toml`.

Validation emails use Resend if `RESEND_API_KEY` and `RESEND_FROM` are set. Otherwise the app shows a **copyable
one-time link** for the learner to send themselves.

## Commands

| | |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` / `lint` | static checks |
| `npm test` | unit tests + SQL/RLS tests (PGlite, no Docker needed) |
| `npm run test:stack` | RLS/Storage/token tests against the **running local stack** (`npm run db:start`, `.env.local`) |
| `npm run test:e2e` | Playwright, one worker (needs `npm run db:start`, `.env.local` and `npx playwright install chromium`). Includes axe, keyboard-only and reduced-motion checks. Each test signs in from its own test IP so the real login rate limiter stays on |
| `npm run scan:bundle` | after `npm run build`: fails if any secret value, secret-key-shaped string or `service_role` JWT is in `.next/static` |
| `npm run demo:reset` | reset the fictional demo learner on the local stack (hosted: run `supabase/seed.sql` in the SQL editor) |
| `npm run db:reset` | rebuild the local DB from migrations + seed |

## Screens (Sprint 2)

| Route | What it is |
|---|---|
| `/` | Landing page: static, CSS-only animated capability graph and loop diagram, no analytics |
| `/demo` | Public, read-only portfolio of the fictional **DEMO** learner Jo (noindex). Served by one narrow database function, `demo_portfolio()`, that can only return the profile flagged `is_demo` |
| `/app` | Dashboard: stat tiles, capability bars with target markers, next-capability card |
| `/app/portfolio` | Capability portfolio with editable capability statements and a per-experience evidence meter |
| `/app/next` | "What should I build next?": ranked gaps, why-text, suggested experience, loop explainer |
| `/app/experiences/new` | Add experience and evidence (accepts `?capability=<id>` to prefill the tag) |
| `/app/experiences/[id]` | Experience detail (shared-element transition from the list) |
| `/validate/[token]` | Validator page, single-use link |

**Reference data is a migration.** Roles, capabilities and the HR Business Partner targets and weights live in
`supabase/migrations/20261122000003_reference_data.sql` (idempotent upsert), so they reach every environment. `seed.sql`
holds only the demo learner. The weights are working assumptions (Stakeholder Management 1.2, Communication 1.1,
Data Analysis 0.9, others 1.0) that only affect the "what next" ranking, never a score. Only HR Business Partner has a map;
other roles are name-only ("Coming soon") and cannot be selected.

## Security notes (Sprint 1)

- RLS is enabled on every table in the migration that creates it; clients cannot write `validations`, `audit_log` or
  reference tables, cannot read `validations.token_hash`, and cannot set `profiles.role`.
- Validation tokens: 32 random bytes, only the SHA-256 hash is stored, 14-day expiry, single use, generic error for
  every failure mode.
- Uploads: allow-list (pdf, pptx, docx, png, jpg), 10 MB, extension + magic-byte check, private bucket with **no**
  client storage policies, downloads only via 5-minute signed URLs minted after an authorisation check.
- Service-role key is imported only from `lib/supabase/admin.ts` (`server-only`).
- Rate limiting is **in-memory per server instance** for now; Sprint 3 swaps in Upstash/Vercel KV behind the same interface.
- CSP is static (`next.config.ts`) and allows inline scripts for Next.js hydration; a nonce-based CSP is a Sprint 3 item.

## Sprint 3 changes

- **Rate limiting is shared across instances**: a Postgres atomic counter (`rate_limit_hit`, migration 5) replaces the in-memory
  limiter, with a memory fallback if the database errors. Keys are HMAC digests (no raw IPs stored). `proxy.ts` returns real
  HTTP 429s for `/validate/*` (60 per 10 min per IP) and login POSTs (20 per 10 min); the login action itself refuses at 5.
- **Uploads no longer pass through server actions**: `prepareUploads` mints single-use signed upload URLs, the browser uploads
  straight to Storage (so Vercel's ~4.5 MB body cap does not apply; the 10 MB limit is kept), and `createExperience` re-checks
  every object's real bytes (magic bytes, size, type) before saving anything. A rejected file is deleted. A daily job
  (`/api/cron/sweep-evidence`, `CRON_SECRET`) removes uploaded files nobody claimed.
- Auth cookies are HttpOnly + SameSite=Lax (+ Secure in production). Sign-out accepts only same-origin posts.
- 404, error and privacy pages. Deployment runbook: [docs/deploy.md](docs/deploy.md).

## Known limitations

- Uploads pass through the server action (so they can be validated before storage). Vercel functions cap request
  bodies at about 4.5 MB, so files larger than that will fail when deployed there. Sprint 3 must move to
  signed-upload-URL + post-upload verification if that bites.
- Other career roles are name-only placeholders (names to be confirmed).

## Lighthouse

Not part of the repo's dependencies (it would pull many transitive packages into `npm audit`). Run it against a production
build, not the dev server:

```bash
npm run build && npx next start -p 3100 &
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  npx -y lighthouse@13.6.0 http://localhost:3100/ --chrome-flags="--headless=new" \
  --only-categories=performance,accessibility --output=json --output-path=lh.json
```

Scores vary with machine load (Docker and builds running at the same time lowered one run to 89), so run it a few times.
