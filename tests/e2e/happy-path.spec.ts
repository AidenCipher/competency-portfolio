// REQUIRES the local Supabase stack (npm run db:start) and `npm run dev` env vars.
// Not runnable without Docker. See README "Running the e2e test".
import { expect, test } from "@playwright/test";
import { signIn, tinyPdf } from "./helpers";

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
  await page.goto("/app/portfolio");
  await expect(page.getByText("Validated").first()).toBeVisible();
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
