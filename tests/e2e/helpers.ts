import type { Page } from "@playwright/test";

const INBUCKET = process.env.INBUCKET_URL ?? "http://127.0.0.1:54324";

/** Minimal but real PDF (starts with %PDF-). */
export function tinyPdf(extraBytes = 0): Buffer {
  const body = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n";
  return Buffer.concat([Buffer.from(body), Buffer.alloc(extraBytes, 0x20)]);
}

/** Reads the newest magic-link email for `name@example.test` from the local Inbucket and returns the link. */
export async function latestMagicLink(name: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const list = (await (await fetch(`${INBUCKET}/api/v1/mailbox/${name}`)).json()) as { id: string }[];
    if (list.length) {
      const msg = (await (await fetch(`${INBUCKET}/api/v1/mailbox/${name}/${list[list.length - 1].id}`)).json()) as {
        body: { text?: string; html?: string };
      };
      const text = `${msg.body.text ?? ""} ${msg.body.html ?? ""}`.replace(/&amp;/g, "&");
      const m = text.match(/https?:\/\/[^\s"'<>]+\/auth\/v1\/verify[^\s"'<>]+/);
      if (m) return m[0];
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("No magic-link email arrived in Inbucket");
}

export async function signIn(page: Page, name: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(`${name}@example.test`);
  await page.getByRole("button", { name: /email me a sign-in link/i }).click();
  await page.getByText(/check your email/i).waitFor();
  await page.goto(await latestMagicLink(name));
  await page.waitForURL(/\/app/);
}
