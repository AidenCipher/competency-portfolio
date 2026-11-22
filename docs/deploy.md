# Deploying Capability Portfolio (Supabase + Vercel + Resend + Google)

Status of each piece is tracked in `docs/iterations.md`. This file is the runbook.
**Rule:** nothing here touches a live Supabase or Vercel resource without the owner's explicit OK (CLAUDE.md rule 10).

## 0. What gates what

| You want | Needs |
|---|---|
| Anyone can sign up by email link on production | Custom SMTP on Supabase Auth. The built-in sender **only delivers to your Supabase organisation's team members** and is capped. Resend can only send to arbitrary addresses once a **domain is verified** with it. |
| Anyone can sign in with Google | A Google OAuth client with the Supabase callback URL (below). No domain needed. |
| Validators receive the emailed link | `RESEND_API_KEY` and `RESEND_FROM` on Vercel (verified domain for arbitrary recipients). Without them the app shows a copyable link instead, which is the designed fallback. |

## 1. Supabase (hosted)

1. Create the project (region `ap-south-1`, next to the other projects; Vercel functions are pinned to `bom1` in `vercel.json`).
2. Apply migrations **by one method only** (MCP `apply_migration` *or* `supabase db push`, not both), in order: `supabase/migrations/*.sql`.
3. Run the demo seed once: `supabase/seed.sql` in the SQL editor. Re-running it resets the demo learner ("reset demo").
4. Run the Security and Performance advisors. Expected, intentional findings: `rate_limits` has RLS enabled with no policies; `demo_portfolio()` is executable by `anon`; reference tables are read-only for clients. Document any other finding or fix it.
5. Auth -> URL configuration: Site URL = the production URL; add redirect URLs for production and a preview wildcard.
6. Auth -> Providers -> Google: paste the client ID and secret (step 2 below).
7. Auth -> SMTP: Resend SMTP (host `smtp.resend.com`, port 465, user `resend`, password = API key, sender on the verified domain).
8. Free projects pause after about a week of inactivity: open the project a day or two before any demo.

## 2. Google OAuth client (only you can do this)

Google Cloud Console -> APIs & Services -> Credentials -> Create OAuth client ID -> *Web application*.
- Authorised redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
- Copy the client ID and secret into Supabase (Auth -> Providers -> Google).
- Consent screen: add your own email as a test user while it is in "Testing" mode.

## 3. Resend (only you can do this)

Create an API key. For emails to arbitrary recipients, add and verify a domain (DNS records). Without a verified
domain Resend only delivers to your own address, which is fine for a private demo.
`RESEND_FROM` must be an address on the verified domain, for example `Capability Portfolio <no-reply@yourdomain>`.

## 4. Git and Vercel

1. Fix the commit author before the first push (commits are currently `dev <dev@localhost>`):
   `git config user.name "Your Name"; git config user.email you@example.com`, then rewrite the author on `sprint-1`
   (e.g. `git rebase -r --root --exec 'git commit --amend --no-edit --reset-author'`) **before** sharing the history.
2. Create a private GitHub repository and push `sprint-1` (and `main`).
3. Vercel project from that repo (or direct upload). Framework: Next.js. `vercel.json` sets region `bom1` and the daily sweep cron.
4. Environment variables (set **before the first build**: `NEXT_PUBLIC_*` and the CSP are fixed at build time):

| Variable | Production | Preview | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | hosted URL | same | public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publishable/anon key | same | public |
| `SUPABASE_SERVICE_ROLE_KEY` | secret key | same | **Sensitive, server only; never `NEXT_PUBLIC_`** |
| `NEXT_PUBLIC_SITE_URL` | production URL | preview URL or a fixed staging URL | a single value would send preview magic links to production |
| `RESEND_API_KEY`, `RESEND_FROM` | set | optional | Sensitive |
| `CRON_SECRET` | 16+ random chars | optional | Sensitive |

5. Deployment protection blocks outsiders on previews: validators must use the production URL.

## 5. Verify on the live URL

- `curl -sI https://<prod>/` shows CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, frame-ancestors none.
- `grep -rE "SERVICE_ROLE|sb_secret_|service_role" .next/static` on the same build finds nothing.
- Sign up with a fresh account, add an experience with a file, request validation, endorse it, see the score change.
- Click "Continue with Google" once in a real browser. It has been verified to reach accounts.google.com under the production CSP with fake credentials, but only a real client proves the whole round trip.
- Burst `/validate/<random>` more than 60 times from one machine: expect HTTP 429.
- Lighthouse (mobile) on landing and dashboard, via the command in the README.
