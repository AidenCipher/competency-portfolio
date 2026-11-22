// REQUIRES the local Supabase stack (npm run db:start) and .env.local. See README "Running the e2e test".
import { expect, test } from "@playwright/test";
import { evidenceObjectCount, expireValidationLinks, signIn, tinyPdf, withAllTargetsMet } from "./helpers";

const REFLECTION = Array.from({ length: 45 }, (_, i) => `word${i}`).join(" ");

test("signup, log experience with PDF + reflection, request validation, endorse via link, dashboard updates", async ({ page, browser }) => {
  const user = `learner${Date.now()}`;
  await signIn(page, user);

  // Choose HRBP as the career goal.
  await page.getByRole("button", { name: /set goal/i }).click();
  await expect(page.getByText(/what .* can do/i)).toBeVisible();

  await page.goto("/app/experiences/new");
  await page.getByLabel("Title").fill("E2E capstone");
  await page.getByLabel("Your role").fill("Lead");
  await page.getByLabel("Duration").fill("4 weeks");
  await page.getByLabel("What I did").fill("Led the team through the project.");
  await page.getByText("Team Leadership").click();
  await page.getByLabel(/what did you actually learn or do/i).fill(REFLECTION);
  await page.locator('input[type="file"]').first().setInputFiles({ name: "report.pdf", mimeType: "application/pdf", buffer: tinyPdf() });
  await page.getByLabel("Their name").fill("Dr Validator");
  await page.getByLabel("Their email").fill("validator@example.test");
  await page.getByRole("button", { name: /save experience/i }).click();

  // Email is not configured locally, so the copyable link is shown.
  const link = await page.getByLabel("Validation link").inputValue();
  expect(link).toMatch(/\/validate\/[A-Za-z0-9_-]{43}$/);

  // Pending validation counts at 0.6: 0.25 * (0.6 + 0.4/3) * 1 * 0.6 -> 11.
  await page.goto("/app");
  await expect(page.getByRole("img", { name: "Team Leadership: 11 of target 80" })).toBeVisible();

  // Validator (no account) opens the link in a clean context and endorses.
  const ctx = await browser.newContext();
  const vp = await ctx.newPage();
  await vp.goto(link);
  await expect(vp.getByRole("heading", { name: "E2E capstone" })).toBeVisible();
  await vp.getByLabel("Short comment (required unless endorsing)").fill("Solid work.");
  await vp.getByRole("button", { name: /submit response/i }).click();
  await expect(vp.getByText(/your response was recorded/i)).toBeVisible();

  // The link is now single-use: same generic page as any bad link.
  await vp.goto(link);
  await expect(vp.getByRole("heading", { name: /this link isn.t valid/i })).toBeVisible();
  await ctx.close();

  // Dashboard reflects the validated experience.
  await page.goto("/app");
  await expect(page.getByText("Third-party validated")).toBeVisible();
  await expect(page.getByText("/1")).toBeVisible();
  // Validated counts at 1.0: 0.25 * (0.6 + 0.4/3) -> 18. The score moved from 11 to 18.
  await expect(page.getByRole("img", { name: "Team Leadership: 18 of target 80" })).toBeVisible();
  await page.goto("/app/portfolio");
  await page.getByRole("button", { name: /^Team Leadership/ }).click();
  await expect(page.getByRole("cell", { name: /Validated/ }).first()).toBeVisible();
  await expect(page.getByText("E2E capstone")).toBeVisible();

  // Owner download: route 302s to a short-lived signed URL that serves the real file.
  const href = await page.locator('a[href^="/app/evidence/"]').first().getAttribute("href");
  expect(href).toMatch(/^\/app\/evidence\/[0-9a-f-]{36}$/);
  const hop = await page.request.get(href!, { maxRedirects: 0 });
  expect(hop.status()).toBe(302);
  expect(hop.headers()["cache-control"]).toContain("no-store");
  expect(hop.headers()["location"]).toMatch(/\/object\/sign\/evidence\/.+token=/);
  const file = await page.request.get(href!);
  expect(file.status()).toBe(200);
  expect((await file.body()).subarray(0, 5).toString()).toBe("%PDF-");

  // The title links to a detail page showing the same experience, evidence and validation.
  await page.evaluate(() => {
    const w = window as unknown as { __vt: number };
    w.__vt = 0;
    const original = document.startViewTransition?.bind(document);
    if (original) document.startViewTransition = ((...args: Parameters<typeof original>) => { w.__vt += 1; return original(...args); }) as typeof document.startViewTransition;
  });
  await page.getByRole("link", { name: "E2E capstone" }).click();
  await expect(page).toHaveURL(/\/app\/experiences\/[0-9a-f-]{36}$/);
  const detailUrl = page.url();
  // The navigation ran as a browser view transition (shared title morph), not just a plain swap.
  expect(await page.evaluate(() => (window as unknown as { __vt: number }).__vt)).toBeGreaterThanOrEqual(1);
  await expect(page.getByRole("heading", { name: "E2E capstone", level: 1 })).toBeVisible();
  await expect(page.getByText("report.pdf")).toBeVisible();
  await expect(page.getByText("Validated").first()).toBeVisible();
  await expect(page.getByText(/Led the team through the project/)).toBeVisible();

  // A different signed-in learner gets the same 404 as for a missing file.
  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await signIn(pageB, `intruder${Date.now()}`);
  const denied = await pageB.request.get(new URL(href!, "http://localhost:3000").toString(), { maxRedirects: 0 });
  expect(denied.status()).toBe(404);
  expect((await pageB.request.get(detailUrl, { maxRedirects: 0 })).status()).toBe(404); // not their experience
  expect((await pageB.request.get("/app/experiences/not-a-uuid", { maxRedirects: 0 })).status()).toBe(404);
  // And a signed-out caller gets 307 to /login via the proxy.
  const anon = await browser.newContext();
  const signedOut = await anon.request.get("http://localhost:3000" + href!, { maxRedirects: 0 });
  expect([307, 404]).toContain(signedOut.status());
  await ctxB.close();
  await anon.close();
});

test("server rejects .exe, renamed .exe and oversized files", async ({ page }) => {
  const uploader = `uploader${Date.now()}`;
  await signIn(page, uploader);
  await page.getByRole("button", { name: /set goal/i }).click();
  await page.goto("/app/experiences/new");

  const fill = async () => {
    await page.getByLabel("Title").fill("Upload test");
    await page.getByLabel("Your role").fill("Tester");
    await page.getByLabel("Duration").fill("1 day");
    await page.getByLabel("What I did").fill("Tested uploads.");
    await page.getByText("Communication", { exact: true }).click();
  };
  const cases = [
    { name: "setup.exe", mimeType: "application/octet-stream", buffer: Buffer.from("MZ" + "x".repeat(100)), msg: /only pdf, pptx, docx, png and jpg/i },
    { name: "report.pdf", mimeType: "application/pdf", buffer: Buffer.from("MZ" + "x".repeat(100)), msg: /contents don.t match/i },
    { name: "big.pdf", mimeType: "application/pdf", buffer: tinyPdf(11 * 1024 * 1024), msg: /10 mb or smaller/i },
  ];
  for (const c of cases) {
    await page.goto("/app/experiences/new");
    await fill();
    await page.locator('input[type="file"]').first().setInputFiles({ name: c.name, mimeType: c.mimeType, buffer: c.buffer });
    await page.getByRole("button", { name: /save experience/i }).click();
    await expect(page.getByRole("alert").first()).toContainText(c.msg);
  }
  // The renamed .exe was uploaded to Storage, then rejected after its real bytes were checked: nothing may remain.
  expect(await evidenceObjectCount(`${uploader}@example.test`)).toBe(0);
});

test("a file larger than Vercel's 4.5 MB request cap uploads directly to Storage, is verified, saved and downloadable", async ({ page }) => {
  await signIn(page, `bigfile${Date.now()}`);
  await page.getByRole("button", { name: /set goal/i }).click();
  await page.goto("/app/experiences/new");
  await page.getByLabel("Title").fill("Big evidence");
  await page.getByLabel("Your role").fill("Author");
  await page.getByLabel("Duration").fill("1 week");
  await page.getByLabel("What I did").fill("Wrote a long report.");
  await page.getByText("Communication", { exact: true }).click();
  const size = 8 * 1024 * 1024;
  await page.locator('input[type="file"]').first().setInputFiles({ name: "long-report.pdf", mimeType: "application/pdf", buffer: tinyPdf(size) });
  await page.getByRole("button", { name: /save experience/i }).click();
  await expect(page).toHaveURL(/\/app\/portfolio/, { timeout: 30_000 });
  await page.getByRole("link", { name: "long-report.pdf" }).click({ trial: true });
  const href = await page.getByRole("link", { name: "long-report.pdf" }).getAttribute("href");
  const file = await page.request.get(href!);
  expect(file.status()).toBe(200);
  expect((await file.body()).length).toBeGreaterThan(size);
});

test("the sweep job route is closed without its secret and runs with it", async ({ request }) => {
  expect((await request.get("/api/cron/sweep-evidence")).status()).toBe(404);
  expect((await request.get("/api/cron/sweep-evidence", { headers: { authorization: "Bearer wrong-secret-value-123" } })).status()).toBe(404);
  process.loadEnvFile(".env.local");
  const ok = await request.get("/api/cron/sweep-evidence", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  expect(ok.status()).toBe(200);
  expect(await ok.json()).toMatchObject({ ok: true });
});

test("expired, used and malformed links all show the same generic page", async ({ page, browser }) => {
  await signIn(page, `expiry${Date.now()}`);
  await page.getByRole("button", { name: /set goal/i }).click();
  await page.goto("/app/experiences/new");
  await page.getByLabel("Title").fill("Expiry test");
  await page.getByLabel("Your role").fill("Tester");
  await page.getByLabel("Duration").fill("1 day");
  await page.getByLabel("What I did").fill("Tested expiry.");
  await page.getByText("Communication", { exact: true }).click();
  await page.getByLabel("Their name").fill("Dr Validator");
  await page.getByLabel("Their email").fill("expiry-validator@example.test");
  await page.getByRole("button", { name: /save experience/i }).click();
  const link = await page.getByLabel("Validation link").inputValue();

  const ctx = await browser.newContext();
  const vp = await ctx.newPage();
  const generic = async (url: string) => {
    const res = await vp.goto(url);
    await expect(vp.getByRole("heading", { name: /this link isn.t valid/i })).toBeVisible();
    return { status: res?.status(), body: await vp.locator("main").innerText() };
  };

  const valid = await vp.goto(link);
  expect(valid?.status()).toBe(200);
  await expect(vp.getByRole("heading", { name: "Expiry test" })).toBeVisible();

  await expireValidationLinks(`expiry-validator@example.test`);
  const expired = await generic(link);
  const malformed = await generic(link.replace(/[^/]+$/, "not-a-token"));
  const unknown = await generic(link.replace(/[^/]+$/, "A".repeat(43)));
  expect(expired).toEqual(malformed);
  expect(unknown).toEqual(malformed);
  await ctx.close();
});

test("a learner can write, save and reset a capability statement", async ({ page }) => {
  await signIn(page, `statement${Date.now()}`);
  await page.getByRole("button", { name: /set goal/i }).click();
  await page.goto("/app/portfolio");
  await page.getByRole("button", { name: /^Communication/ }).click();
  await page.getByRole("button", { name: /write it in your own words/i }).click();
  const box = page.getByLabel("Your statement, in your own voice");
  await box.fill("I can explain a hard idea to a sceptical room.");
  await page.getByRole("button", { name: /save statement/i }).click();
  await expect(page.getByText("I can explain a hard idea to a sceptical room.")).toBeVisible();
  // The confirmation is announced and keyboard focus lands back on the Edit button (not dropped to <body>).
  await expect(page.getByRole("status").filter({ hasText: "Statement saved." })).toBeVisible();
  await expect(page.getByRole("button", { name: /edit statement/i })).toBeFocused();

  // Shown on the dashboard too.
  await page.goto("/app");
  await expect(page.getByText("I can explain a hard idea to a sceptical room.")).toBeVisible();

  // Over-long text is refused by the server, not just the counter.
  await page.goto("/app/portfolio");
  await page.getByRole("button", { name: /^Communication/ }).click();
  await page.getByRole("button", { name: /edit statement/i }).click();
  await page.getByLabel("Your statement, in your own voice").fill("x".repeat(340));
  await page.getByRole("button", { name: /save statement/i }).click();
  await expect(page.getByRole("alert").filter({ hasText: /characters/ })).toBeVisible();

  await page.getByRole("button", { name: /use suggested wording/i }).click();
  await expect(page.getByText(/I can communicate complex ideas clearly/)).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Back to the suggested wording." })).toBeVisible();
  await expect(page.getByRole("button", { name: /write it in your own words/i })).toBeFocused();
});

test("what-next recommends Stakeholder Management, prefills the form, and changes after validated evidence", async ({ page, browser }) => {
  await signIn(page, `next${Date.now()}`);
  await page.getByRole("button", { name: /set goal/i }).click();

  await page.goto("/app/next");
  await expect(page.getByRole("heading", { name: "Stakeholder Management", level: 2 })).toBeVisible();
  await expect(page.getByText(/no evidence for Stakeholder Management yet/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: /continuous capability loop/i })).toBeVisible();

  // "Log this experience" prefills the capability tag.
  await page.getByRole("link", { name: "Log this experience" }).click();
  await expect(page.getByRole("checkbox", { name: "Stakeholder Management" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Communication" })).not.toBeChecked();
  await page.getByLabel("Title").fill("Stakeholder interviews");
  await page.getByLabel("Your role").fill("Interviewer");
  await page.getByLabel("Duration").fill("3 weeks");
  await page.getByLabel("What I did").fill("Interviewed two stakeholder groups.");
  await page.getByLabel(/what did you actually learn or do/i).fill(REFLECTION);
  await page.locator('input[type="file"]').first().setInputFiles({ name: "report.pdf", mimeType: "application/pdf", buffer: tinyPdf() });
  await page.getByLabel("Their name").fill("Dr Validator");
  await page.getByLabel("Their email").fill("next-validator@example.test");
  await page.getByRole("button", { name: /save experience/i }).click();
  const link = await page.getByLabel("Validation link").inputValue();

  const ctx = await browser.newContext();
  const vp = await ctx.newPage();
  await vp.goto(link);
  await vp.getByRole("button", { name: /submit response/i }).click();
  await expect(vp.getByText(/your response was recorded/i)).toBeVisible();
  await ctx.close();

  await page.goto("/app/next");
  await expect(page.getByRole("heading", { name: "Communication", level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Stakeholder Management", level: 2 })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /log an experience for stakeholder management/i })).toBeVisible();
});

test("when every target is met the next screen and dashboard show a calm all-met state", async ({ page }) => {
  await signIn(page, `allmet${Date.now()}`);
  await page.getByRole("button", { name: /set goal/i }).click();
  await withAllTargetsMet(async () => {
    await page.goto("/app/next");
    await expect(page.getByRole("heading", { name: /every target for hr business partner is met/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Log this experience" })).toHaveCount(0);
    await page.goto("/app");
    await expect(page.getByRole("heading", { name: "All targets met" })).toBeVisible();
  });
});

test("the public demo portfolio needs no login, is clearly demo data, read-only and noindex", async ({ browser }) => {
  const ctx = await browser.newContext(); // no session at all
  const page = await ctx.newPage();
  const res = await page.goto("/demo");
  expect(res?.status()).toBe(200);
  expect(res?.headers()["x-robots-tag"]).toContain("noindex");
  await expect(page.getByRole("note")).toContainText(/demo data/i);
  await expect(page.getByRole("heading", { name: /what jo \(demo\) can do/i })).toBeVisible();
  await expect(page.getByText("[DEMO] Capstone: staff engagement redesign")).toBeVisible();

  // Read-only: nothing to edit, request or download.
  await expect(page.getByRole("button", { name: /edit statement|write it in your own words|request validation/i })).toHaveCount(0);
  await expect(page.locator('a[href^="/app/"]')).toHaveCount(0);
  const body = await page.content();
  expect(body).not.toMatch(/validator_email|storage_path|token_hash|@example\.test/);

  // The landing page links to it and to sign-up; the demo can switch capability.
  await page.getByRole("button", { name: /^Team Leadership/ }).click();
  await expect(page.getByRole("heading", { name: "Team Leadership", level: 2 }).first()).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("link", { name: "View demo portfolio" }).first()).toHaveAttribute("href", "/demo");
  await ctx.close();
});

test("login is rate limited per client IP: the sixth magic-link request in a row is refused", async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `198.51.100.${(Date.now() % 250) + 1}` }); // one address for the whole burst, new each run
  const attempt = async (i: number) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(`burst${Date.now()}${i}@example.test`);
    await page.getByRole("button", { name: /email me a sign-in link/i }).click();
  };
  for (let i = 0; i < 5; i++) {
    await attempt(i);
    await expect(page.getByText(/check your email/i)).toBeVisible();
  }
  await attempt(5);
  await expect(page.getByText(/too many attempts/i)).toBeVisible();
  await expect(page.getByText(/check your email/i)).toHaveCount(0);
});

test("scripted bursts get real HTTP 429s from the shared limiter (validator links and login posts)", async ({ playwright, baseURL }) => {
  const octet = (Date.now() % 250) + 1;
  // Validator links: 60 per 10 minutes per IP. Fire 75 guesses from one address.
  const ctx = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": `192.0.2.${octet}` } });
  const statuses: number[] = [];
  for (let i = 0; i < 75; i++) statuses.push((await ctx.get(`/validate/${"A".repeat(43)}`)).status());
  expect(statuses.slice(0, 60).every((s) => s === 200)).toBe(true);
  expect(statuses.slice(60).every((s) => s === 429)).toBe(true);
  const refused = await ctx.get(`/validate/${"B".repeat(43)}`);
  expect(refused.status()).toBe(429);
  expect(refused.headers()["retry-after"]).toBe("600");
  await ctx.dispose();

  // A different client address is unaffected (the limit is per client, not global).
  const other = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": `192.0.2.${(octet % 250) + 1}` } });
  expect((await other.get(`/validate/${"A".repeat(43)}`)).status()).toBe(200);
  await other.dispose();

  // Login form posts: 20 per 10 minutes per IP at the HTTP level (the action itself refuses sooner, with a message).
  const loginCtx = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": `192.0.2.${((octet + 1) % 250) + 1}` } });
  const loginStatuses: number[] = [];
  for (let i = 0; i < 25; i++) loginStatuses.push((await loginCtx.post("/login", { headers: { "next-action": "not-a-real-action" }, data: "[]" })).status());
  expect(loginStatuses.slice(0, 20).includes(429)).toBe(false);
  expect(loginStatuses.slice(20).every((s) => s === 429)).toBe(true);
  await loginCtx.dispose();
});

test("unknown pages show a helpful 404, and the privacy notice is public and analytics-free", async ({ page }) => {
  const res = await page.goto("/definitely-not-a-page");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: /couldn.t find that page/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /go to the home page/i })).toBeVisible();

  const priv = await page.goto("/privacy");
  expect(priv?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: /your evidence stays yours/i })).toBeVisible();
  await expect(page.getByText(/no analytics, no advertising trackers/i)).toBeVisible();
  await expect(page.getByText(/stored only a one-way hash|only a one-way hash of the link/i)).toBeVisible();
  // No third-party scripts or trackers are loaded on any page we serve.
  const external = new Set<string>();
  page.on("request", (r) => { const u = new URL(r.url()); if (u.origin !== new URL(page.url()).origin) external.add(u.origin); });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  expect([...external]).toEqual([]);
});

test("auth cookies are HttpOnly and SameSite=Lax, and sign-out only accepts same-origin posts", async ({ page, context }) => {
  await signIn(page, `cookie${Date.now()}`);
  const auth = (await context.cookies()).filter((c) => c.name.startsWith("sb-"));
  expect(auth.length).toBeGreaterThan(0);
  for (const c of auth) {
    expect(c.httpOnly, `${c.name} httpOnly`).toBe(true);
    expect(c.sameSite, `${c.name} sameSite`).toBe("Lax");
  }
  expect(await page.evaluate(() => document.cookie)).not.toMatch(/sb-/); // not readable from page JavaScript

  // A cross-site post cannot sign the user out; the same-origin button still works.
  const evil = await page.request.post("/auth/signout", { headers: { origin: "https://evil.example" }, maxRedirects: 0 });
  expect(evil.status()).toBe(403);
  await page.goto("/app");
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login/);
});
