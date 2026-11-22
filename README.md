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
npm run db:start          # starts local Supabase; applies supabase/migrations and supabase/seed.sql
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
| `npm run test:e2e` | Playwright (needs `npm run db:start` and `npx playwright install chromium`) |
| `npm run db:reset` | rebuild the local DB from migrations + seed |

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

## Known limitations

- Uploads pass through the server action (so they can be validated before storage). Vercel functions cap request
  bodies at about 4.5 MB, so files larger than that will fail when deployed there. Sprint 3 must move to
  signed-upload-URL + post-upload verification if that bites.
- Other career roles are name-only placeholders (names to be confirmed).
