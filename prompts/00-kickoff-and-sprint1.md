# Sprint 1 (due 26 Nov): foundation + all Musts

Paste into Claude Code in an empty repo containing `SPEC.md` and `CLAUDE.md`.

> If you can export the AI Studio app (download or push to GitHub), put it in `./prototype/` first and add this line: "Port components and copy from ./prototype where useful; rebuild the architecture properly, do not copy its data layer."

---

Read SPEC.md and CLAUDE.md. Plan first: list files you will create and the order, then wait for my OK before coding.

Goal: a deployable, secure foundation plus all Must-have stories from SPEC.md section 1 (Reflection prompt, Add Experience form, Capability tagging, Evidence attachment, Dashboard capability progress, Validation by faculty/mentor, Capability Portfolio view).

Build in this order, committing after each step:
1. Scaffold Next.js + TS strict + Tailwind + Motion + zod + Vitest + Playwright. Design tokens (light/dark), Geist fonts, base layout, security headers and CSP in `next.config`.
2. Supabase: migrations for the data model in SPEC section 5, RLS on every table per section 6.3, storage bucket policies, seed (demo "Jo", HRBP role and targets, 5 demo experiences, flagged DEMO). Ask me before touching my live Supabase project; use the local CLI/Docker or give me the SQL to run.
3. Auth: magic link + Google via `@supabase/ssr`, middleware protecting `/app/*`.
4. `lib/scoring.ts` with the exact formulas in SPEC section 4 and tests (include: diminishing returns, validated beats self-declared, level thresholds 70/55).
5. Add Experience form: fields, capability tagging, reflection prompt, evidence upload (allow-list, 10 MB, magic-byte check, private bucket), validator selection, live evidence-strength meter, server action with zod.
6. Validation flow: tokenized link, hash-only storage, 14-day expiry, single use, `/validate/[token]` page, rate limited. If email is not configured, show a copyable link.
7. Dashboard and Capability Portfolio screens matching the prototype layout, driven by real data via `lib/scoring.ts`. Motion: staggered reveals, count-up stats, bars filling on view, layout animation when switching capability.
8. Tests and docs: RLS cross-user tests, upload rejection tests, token tests, one Playwright happy path. Append Sprint 1 note to `docs/iterations.md`.

Acceptance (report each pass/fail with evidence):
- [ ] Signup, log experience with a PDF and a 40+ word reflection, request validation, endorse via link, and the dashboard score and meter update.
- [ ] User B cannot read user A's experiences, evidence rows, or files (automated test).
- [ ] Uploading `.exe`, a renamed `.exe` as `.pdf`, and an 11 MB file are all rejected server-side.
- [ ] Reused, expired and malformed tokens return the same generic error.
- [ ] `grep -r SERVICE_ROLE .next/static` returns nothing; security headers present in response.
- [ ] typecheck, lint, unit tests pass; `npm run build` succeeds.
