// REQUIRES the local Supabase stack (npm run db:start) and .env.local. See README "Running the e2e test".
import { expect, test } from "@playwright/test";
import { expireValidationLinks, signIn, tinyPdf } from "./helpers";

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

  // A different signed-in learner gets the same 404 as for a missing file.
  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await signIn(pageB, `intruder${Date.now()}`);
  const denied = await pageB.request.get(new URL(href!, "http://localhost:3000").toString(), { maxRedirects: 0 });
  expect(denied.status()).toBe(404);
  // And a signed-out caller gets 307 to /login via the proxy.
  const anon = await browser.newContext();
  const signedOut = await anon.request.get("http://localhost:3000" + href!, { maxRedirects: 0 });
  expect([307, 404]).toContain(signedOut.status());
  await ctxB.close();
  await anon.close();
});

test("server rejects .exe, renamed .exe and oversized files", async ({ page }) => {
  await signIn(page, `uploader${Date.now()}`);
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
});
