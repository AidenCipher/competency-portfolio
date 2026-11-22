# Sprint 3 (due 12 Dec): harden, deploy, present

Read SPEC.md, CLAUDE.md, `docs/iterations.md`. Plan first, wait for my OK.

1. **Security review pass**: walk SPEC section 6.6 line by line against the code and report gaps; fix them. Add rate limiting (Upstash/Vercel KV) to auth, upload and validation endpoints; test it.
2. **Supabase advisors**: run security and performance advisors; fix every warning or explain why not.
3. **Deploy**: Vercel project, env vars (server-only for service role), preview + production. Ask me before creating resources or setting env vars. Provide a checklist if I should do it by hand.
4. **Could-haves, only if the above is done and time remains, in this order**: share / employer read-only view (`/p/[slug]`, revocable, noindex, expiry), resume/PDF export, mentor reminder (one reminder after 5 days), career-goal switcher. Skip any that risk the deadline.
5. **Demo readiness**: a seeded demo account and a clean "reset demo" script; error and empty states; 404/500 pages; basic analytics-free privacy notice.
6. **Final report support**: update `docs/iterations.md` with all sprint goals, outcomes, challenges, adaptations and stakeholder feedback received, in the CIA 3 final-report structure (outcomes, stakeholder feedback and impact, lessons learned).

Acceptance:
- [ ] Production URL works end to end with a fresh account.
- [ ] Response headers and CSP verified on production; no secrets in the client bundle.
- [ ] Advisors clean or each exception documented.
- [ ] Rate limits return 429 under a scripted burst.
- [ ] Revoked share link returns 404 immediately (if built).
- [ ] Lighthouse performance >= 90 and accessibility >= 95 on landing and dashboard.
