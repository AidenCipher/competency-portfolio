# Capability Portfolio — Product & Technical Spec

Source: Team 4 CIA 1 report (Stackable Credentials Studio) and the AI Studio prototype screens in it.
Scope is anchored to the team's own MoSCoW backlog (78 pts) and the Agile HR course calendar.

> **Product principle:** Don't just show what the learner completed. Show what the learner can do.
> **Flow:** Career Goal → Capability → Experience → Evidence → Reflection → Validation → Progression

## 1. Scope and calendar

| Sprint | Due (course plan) | Scope | Points |
|---|---|---|---|
| 1 | Iteration 4 report, 26 Nov | Foundation + all **Musts** | 33 |
| 2 | Iteration 5 report, 10 Dec | **Shoulds** (role map reduced to HR Business Partner only) | 21 |
| 3 | Final report and presentation, 12 Dec | Polish, security pass, deploy. **Coulds** only if time remains | 3-13 |

Sprint 1 is tight (4 days). Fallback if behind: replace emailed validation with a copyable validation link (see 6.4). Everything else stays.

**Won't have (team decision, keep it):** employer login/search, LinkedIn/university integrations, AI auto-tagging, blockchain credentials, native mobile app. The "employer view" is a read-only share link, not an account.

## 2. Users and roles

- **learner**: signs up, owns a portfolio.
- **validator** (faculty / mentor / supervisor): no account needed. Acts through a single-use emailed or copied link.
- **employer viewer**: no account. Opens a revocable read-only share link (Could-have).
- **admin**: seeds career roles and capabilities. Done via SQL/migrations, no admin UI.

## 3. Screens (from the prototype)

1. **Landing page** (new): hero with animated capability graph, the Learn → Apply → Evidence → Validate loop, CTA to sign up and "view demo portfolio".
2. **Dashboard**: career-goal selector, 4 stat tiles (Experiences logged, Evidence artefacts, Third-party validated n/N, "Actions > Certs"), capability progress bars with "target" marker and learner-voice statement, dark "Next capability to build" card, Recent Experiences list, "Capability engine" explainer.
3. **Add Experience & Evidence**: title, type, role, duration, what I did, capability tags, evidence attachments (report, presentation, feedback, other), reflection prompt ("What did you actually learn or do?"), validator selection (faculty / mentor / supervisor), live **evidence-strength meter**.
4. **Capability Portfolio** (hero): capability list with level badge, capability statement in learner's voice, evidence-strength panel (Experience, Application, Artefact, Validation), career relevance chips, "Substantiating Evidence" table (experience / what I did / evidence files / validated-by / view).
5. **What Should I Build Next?**: role switcher (Could), recommended capability, "why", current vs target bars, suggested next experience, "Log this experience", Continuous Capability Loop explainer.
6. **Validator page** `/validate/[token]`: shows the experience, evidence and reflection; Endorse / Request changes / Decline with a short comment.
7. **Public share page** `/p/[slug]` (Could): read-only employer view.

## 4. Scoring rules (write these down; do not improvise)

Levels (derived from prototype): **Strong ≥ 70**, **Proficient 55-69**, **Developing < 55**.

Per experience *e* tagged with capability *c*, contribution `k(e)`:

```
base        = 0.25
artefactF   = 0.6 + 0.4 * min(artefacts, 3) / 3          # 0.6 .. 1.0
reflectionF = reflection >= 40 words ? 1.0 : 0.8
validationF = validated 1.0 | pending 0.6 | self_declared 0.4 | changes_requested 0.5 | declined 0.3
k(e)        = base * artefactF * reflectionF * validationF
score(c)    = round(100 * (1 - Π(1 - k(e))))              # diminishing returns, capped < 100
```

Dashboard bar = `score(c)` against `target(role, c)`. **Evidence-strength meter** (5 dots): one dot each for Experience (title, role, duration, description present), Application (reflection >= 40 words), Artefact (>= 1 file), Validation (validator endorsed); fifth dot = >= 2 artefacts AND validated. Pure functions in `lib/scoring.ts` with unit tests. The values above are team assumptions to validate with faculty, not research results.

**What to build next** (rule-based, no LLM): for the selected role, rank capabilities by `(target - score) * role_weight`; top result is the recommendation. Suggested experience text comes from `capabilities.suggested_experience`. An LLM layer is optional and out of scope for now.

## 5. Data model (Postgres / Supabase)

- `profiles` (id = auth.users.id, display_name, programme, institution, role enum `learner|admin`, target_role_id)
- `career_roles` (id, slug, name, department, description)
- `capabilities` (id, slug, name, statement_template, suggested_experience)
- `role_capabilities` (role_id, capability_id, target int, weight numeric)
- `experiences` (id, user_id, title, type enum `academic|event|internship|volunteer|certification|work|personal`, role_title, duration_label, start/end, description, reflection, created_at)
- `experience_capabilities` (experience_id, capability_id)
- `evidence` (id, experience_id, kind enum `report|presentation|feedback|event_doc|link|other`, storage_path, filename, mime, size_bytes)
- `capability_statements` (user_id, capability_id, text)
- `validations` (id, experience_id, validator_name, validator_email, validator_kind enum `faculty|mentor|supervisor`, status enum `pending|endorsed|changes_requested|declined`, token_hash, expires_at, used_at, comment)
- `share_links` (id, user_id, slug, revoked_at, expires_at)
- `audit_log` (id, actor, action, entity, entity_id, at)

Seed data: HR Business Partner (full target map: Communication 90, Team Leadership 80, Data Analysis 75, Stakeholder Management 85, Conflict Management 70, Problem Solving) plus the 3 other roles as names only until Sprint 3. **Demo user "Jo" is clearly flagged DEMO DATA; figures like "420 tech workers" are invented.**

## 6. Backend and security

### 6.1 Stack
Next.js (App Router) + TypeScript + Tailwind + Motion (framer-motion) · Supabase Auth, Postgres, private Storage · server actions and route handlers as the API (no separate service) · zod · Vercel hosting · Vitest + Playwright.

### 6.2 Auth
Supabase Auth with email magic link and Google. Server-side session via `@supabase/ssr`. Middleware protects `/app/*`.

### 6.3 Row Level Security (every table, no exceptions)
- Learners: CRUD only where `user_id = auth.uid()`; child tables (`evidence`, `experience_capabilities`) checked through the parent experience.
- Reference tables (`career_roles`, `capabilities`, `role_capabilities`): read for authenticated, write for no one.
- `validations`, `share_links`: owner reads own; token lookups happen only in server code using a narrow `security definer` function, never by exposing the table.
- Service-role key lives in server env only. Never prefixed `NEXT_PUBLIC_`.

### 6.4 Validator flow
Learner picks validator (name, email, kind) → server generates a 32-byte random token, stores **only its SHA-256 hash**, expiry 14 days → emails link `/validate/<token>` (Resend; fallback: show a copyable link) → validator page fetches via server function, shows content with signed URLs, accepts one decision → token marked used. Constant-time hash compare, rate limited, generic error on any failure.

### 6.5 Uploads
Private bucket `evidence`. Path `${user_id}/${experience_id}/${uuid}.${ext}`. Allow-list: pdf, pptx, docx, png, jpg (max 10 MB). Validate MIME **and** magic bytes server-side. Signed URLs, 5-minute expiry. Never render user HTML. Sanitize filenames.

### 6.6 Hardening checklist
zod on every server action and route input · rate limiting on auth, upload, validation endpoints (Upstash or Vercel KV) · CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, frame-ancestors none in `next.config` · CSRF safe by using server actions and same-site cookies · no secrets in client bundle · `npm audit` clean · Supabase advisors run before deploy · audit log for validation decisions and share-link changes · share pages `noindex` and revocable · privacy notice stating files are private and visible only to the owner, chosen validators and share-link holders.

## 7. Visual and motion direction

Keep the prototype's DNA: clean white cards, one electric-blue accent, green/amber/blue status colours, dark "next capability" card, mono micro-labels. Push it to a contemporary level:
- Type: Geist (or Inter Tight) plus Geist Mono for labels; large tight-tracked headings.
- Bento-grid dashboard, soft glass surfaces, subtle grain/gradient mesh on the landing hero, dark mode.
- Motion (Motion library): staggered reveals, count-up stats, bars that fill on view, layout animations when switching capability or role, shared-element transition from Recent Experiences row to its detail, animated evidence-strength dots, magnetic/spring CTAs, animated loop diagram on landing.
- Hero visual: SVG capability graph where nodes light up as evidence gets validated (no heavy WebGL; keep Lighthouse performance > 90).
- Rules: honour `prefers-reduced-motion`, animate transform/opacity only, 60fps on mid-range laptops, WCAG AA contrast, keyboard navigable, focus rings.

## 8. Acceptance criteria (whole product)
1. A new learner can sign up, pick HRBP, log an experience with a file and reflection, request validation, and see scores update.
2. A second learner can never read the first learner's rows or files (tested).
3. A used, expired or wrong validation token yields the same generic error.
4. Upload of `.exe` or oversized file is rejected server-side.
5. Production build has zero secrets in client bundle; headers present; Supabase advisors clean.
6. Lighthouse: performance >= 90, accessibility >= 95 on landing and dashboard.

## 9. Open questions
- Is the AI Studio code exportable (download / GitHub)? If yes, port its components instead of rebuilding.
- Target capability values for roles other than HRBP: need faculty or employer input (the team's own flagged risk).
- Which email sender / domain for validation emails.
