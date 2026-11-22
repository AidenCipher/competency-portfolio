# Sprint 2 (due 10 Dec): Shoulds + landing page

Read SPEC.md, CLAUDE.md and `docs/iterations.md`. Plan first, wait for my OK.

Build:
1. **Capability statement** (learner's voice): editable per capability, suggested template from `capabilities.statement_template`, shown on Portfolio and Dashboard.
2. **Evidence-strength meter** polish: 5 animated dots per SPEC section 4, shown live in the form and on each Portfolio evidence row.
3. **Career-role capability map, HRBP only** (13 pts reduced to ~5): complete targets and weights for HR Business Partner, plus an admin SQL seed. Other roles remain name-only and are shown disabled with "Coming soon".
4. **"What should I build next?"** screen: rule-based ranking from SPEC section 4, why-text, current vs target bars, suggested next experience, "Log this experience" prefilling the form with the capability tag, Continuous Capability Loop explainer.
5. **Landing page**: animated hero (SVG capability graph whose nodes light up in sequence), loop diagram, demo-portfolio CTA, footer privacy notice. Lighthouse performance >= 90.
6. Motion polish: shared-element transition from experience row to detail, page transitions, reduced-motion fallbacks, dark mode.
7. Tests: ranking function unit tests (tie-breaks, all targets met, no experiences), Playwright flow, axe accessibility check on all screens. Append Sprint 2 note to `docs/iterations.md`.

Acceptance:
- [ ] A learner with no Stakeholder evidence is recommended Stakeholder Management; after validated evidence is added, the recommendation changes (test).
- [ ] If every target is met, the screen shows a sensible "all targets met" state, no crash.
- [ ] Other roles cannot be selected and nothing implies they are mapped.
- [ ] axe: zero serious/critical violations; keyboard-only completion of Add Experience works.
- [ ] `prefers-reduced-motion` disables non-essential animation.
- [ ] Lighthouse mobile: performance >= 90, accessibility >= 95 on landing.
