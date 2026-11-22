// prefers-reduced-motion: non-essential animation is off, and there are no hydration/console errors in either mode.
import { expect, test, type Page } from "@playwright/test";

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 200)}`); });
  return errors;
}

const style = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => {
    const s = getComputedStyle(el);
    return { animationName: s.animationName, opacity: s.opacity };
  });

test("reduced motion: the loop and hero graph are static; nothing errors", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const errors = collectErrors(page);
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  expect(await style(page, ".graph-lit")).toEqual({ animationName: "none", opacity: "1" }); // finished, fully lit graph
  expect((await style(page, ".loop-glow")).animationName).toBe("none");

  await page.goto("/demo");
  await page.waitForLoadState("networkidle");
  // Bars are at their final width immediately (no fill-on-view), and the meter dots do not pulse.
  const bar = page.getByRole("img", { name: /^Communication: \d+ of target 90$/ }).first();
  await expect(bar).toBeVisible();
  const scale = await bar.locator("div").first().evaluate((el) => getComputedStyle(el).transform);
  expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(scale);
  expect(errors, "no hydration or console errors with reduced motion").toEqual([]);
  await ctx.close();
});

test("normal motion: the loop and hero graph do animate; nothing errors", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "no-preference" });
  const page = await ctx.newPage();
  const errors = collectErrors(page);
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  expect((await style(page, ".graph-lit")).animationName).toBe("graph-lit");
  expect((await style(page, ".loop-glow")).animationName).toBe("loop-glow");
  await page.goto("/demo");
  await page.waitForLoadState("networkidle");
  expect(errors, "no hydration or console errors with normal motion").toEqual([]);
  await ctx.close();
});
