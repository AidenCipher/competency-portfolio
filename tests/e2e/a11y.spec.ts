// Accessibility: axe (WCAG 2.0/2.1 A + AA) on every screen, light and dark, plus a keyboard-only Add Experience flow.
// Runs with reduced motion on so staggered reveals are not caught mid-animation at opacity 0.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { logExperience, signIn } from "./helpers";

async function scan(page: Page, name: string) {
  await page.waitForLoadState("networkidle");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const summary = serious.map((v) => `${v.id} [${v.impact}] x${v.nodes.length}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(summary, `axe on ${name}`).toEqual([]);
}

async function checkAllScreens(browser: Browser, scheme: "light" | "dark") {
  const ctx = await browser.newContext({ colorScheme: scheme, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const tag = `${scheme}-${Date.now()}`;

  // Public screens.
  for (const path of ["/", "/login", "/demo", "/validate/not-a-real-token"]) {
    await page.goto(path);
    await scan(page, `${path} (${scheme})`);
  }

  // Signed-in screens, starting with the goal picker.
  await signIn(page, `a11y${tag}`);
  await scan(page, `/app goal picker (${scheme})`);
  await page.getByRole("button", { name: /set goal/i }).click();
  await expect(page.getByText(/what .* can do/i)).toBeVisible();
  await scan(page, `/app empty (${scheme})`);
  await page.goto("/app/next");
  await scan(page, `/app/next recommend (${scheme})`);
  await page.goto("/app/experiences/new");
  await scan(page, `/app/experiences/new (${scheme})`);

  // With data: a logged experience, a valid validator page, the detail page and the portfolio (editor open too).
  const link = await logExperience(page, { title: "A11y experience", capability: "Team Leadership", validatorEmail: `a11y-${tag}@example.test` });
  await scan(page, `experience-saved panel with copyable link (${scheme})`);
  await page.goto(link);
  await expect(page.getByRole("heading", { name: "A11y experience" })).toBeVisible();
  await scan(page, `/validate/<valid token> (${scheme})`);
  await page.getByRole("button", { name: /submit response/i }).click();
  await expect(page.getByText(/your response was recorded/i)).toBeVisible();
  await scan(page, `/validate/<token> after a decision (${scheme})`);

  await page.goto("/app");
  await scan(page, `/app with data (${scheme})`);
  await page.getByRole("link", { name: "A11y experience" }).first().click();
  await expect(page.getByRole("heading", { name: "A11y experience", level: 1 })).toBeVisible();
  await scan(page, `/app/experiences/[id] (${scheme})`);
  await page.goto("/app/portfolio");
  await page.getByRole("button", { name: /^Team Leadership/ }).click();
  await scan(page, `/app/portfolio (${scheme})`);
  await page.getByRole("button", { name: /write it in your own words/i }).click();
  await scan(page, `/app/portfolio statement editor (${scheme})`);
  await page.goto("/app/next");
  await scan(page, `/app/next with data (${scheme})`);
  await ctx.close();
}

test("axe: no serious or critical violations on any screen (light)", async ({ browser }) => {
  test.setTimeout(180_000);
  await checkAllScreens(browser, "light");
});

test("axe: no serious or critical violations on any screen (dark)", async ({ browser }) => {
  test.setTimeout(180_000);
  await checkAllScreens(browser, "dark");
});

test("keyboard only: Add Experience can be completed without a mouse", async ({ page }) => {
  await signIn(page, `kbd${Date.now()}`);
  await page.getByRole("button", { name: /set goal/i }).click();
  await page.goto("/app/experiences/new");

  const tabTo = async (target: ReturnType<Page["locator"]>, maxTabs = 25) => {
    for (let i = 0; i < maxTabs; i++) {
      await page.keyboard.press("Tab");
      if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) return;
    }
    throw new Error("could not reach the field by keyboard");
  };
  const next = async (target: ReturnType<Page["locator"]>) => {
    await page.keyboard.press("Tab");
    await expect(target).toBeFocused();
  };

  await tabTo(page.getByLabel("Title"));
  await page.keyboard.type("Keyboard-only capstone");
  await next(page.getByLabel("Type"));
  await page.keyboard.type("Event"); // type-ahead selects "Event"
  await next(page.getByLabel("Your role"));
  await page.keyboard.type("Facilitator");
  await next(page.getByLabel("Duration"));
  await page.keyboard.type("2 days");
  await next(page.getByLabel("What I did"));
  await page.keyboard.type("Facilitated a workshop for thirty people.");

  // Capabilities are keyboard-reachable checkboxes: Space toggles the first (Communication).
  await next(page.getByRole("checkbox", { name: "Communication" }));
  await page.keyboard.press("Space");
  await expect(page.getByRole("checkbox", { name: "Communication" })).toBeChecked();
  for (const name of ["Conflict Management", "Data Analysis", "Problem Solving", "Stakeholder Management", "Team Leadership"]) {
    await next(page.getByRole("checkbox", { name })); // visible focus moves through every option
  }
  await next(page.getByLabel(/what did you actually learn or do/i));
  await page.keyboard.type(Array.from({ length: 45 }, (_, i) => `thought${i}`).join(" "));
  await expect(page.getByText(/45 \/ 40 words/)).toBeVisible();

  // Skip the optional file and validator fields, then submit with Enter on the focused button.
  await tabTo(page.getByRole("button", { name: /save experience/i }));
  await expect(page.getByRole("button", { name: /save experience/i })).toBeFocused();
  await page.keyboard.press("Enter");
  // With no validator the app redirects to the portfolio, where the new experience is listed.
  await expect(page).toHaveURL(/\/app\/portfolio/);
  await expect(page.getByRole("link", { name: "Keyboard-only capstone" })).toBeVisible();
});
