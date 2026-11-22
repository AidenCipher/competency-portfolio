import type { Page } from "@playwright/test";

// Local mail catcher (supabase `[local_smtp]`, port 54324). Current CLIs ship Mailpit; older ones shipped
// Inbucket. Both are supported below. UNVERIFIED against a running stack (Docker was unavailable).
const MAIL = process.env.MAIL_URL ?? "http://127.0.0.1:54324";

/** Minimal but real PDF (starts with %PDF-). */
export function tinyPdf(extraBytes = 0): Buffer {
  const body = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n";
  return Buffer.concat([Buffer.from(body), Buffer.alloc(extraBytes, 0x20)]);
}

function extractLink(raw: string): string | null {
  const text = raw.replace(/&amp;/g, "&");
  return text.match(/https?:\/\/[^\s"'<>]+\/auth\/v1\/verify[^\s"'<>]+/)?.[0] ?? null;
}

async function viaMailpit(address: string): Promise<string | null> {
  const res = await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`);
  if (!res.ok) return null;
  const list = (await res.json()) as { messages?: { ID: string }[] };
  const id = list.messages?.[0]?.ID;
  if (!id) return null;
  const msg = (await (await fetch(`${MAIL}/api/v1/message/${id}`)).json()) as { Text?: string; HTML?: string };
  return extractLink(`${msg.Text ?? ""} ${msg.HTML ?? ""}`);
}

async function viaInbucket(name: string): Promise<string | null> {
  const res = await fetch(`${MAIL}/api/v1/mailbox/${name}`);
  if (!res.ok) return null;
  const list = (await res.json()) as { id: string }[];
  if (!list.length) return null;
  const msg = (await (await fetch(`${MAIL}/api/v1/mailbox/${name}/${list[list.length - 1].id}`)).json()) as {
    body?: { text?: string; html?: string };
  };
  return extractLink(`${msg.body?.text ?? ""} ${msg.body?.html ?? ""}`);
}

export async function latestMagicLink(name: string): Promise<string> {
  const address = `${name}@example.test`;
  for (let i = 0; i < 20; i++) {
    const link = (await viaMailpit(address).catch(() => null)) ?? (await viaInbucket(name).catch(() => null));
    if (link) return link;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("No magic-link email arrived in the local mail catcher");
}

export async function signIn(page: Page, name: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(`${name}@example.test`);
  await page.getByRole("button", { name: /email me a sign-in link/i }).click();
  await page.getByText(/check your email/i).waitFor();
  await page.goto(await latestMagicLink(name));
  await page.waitForURL(/\/app/);
}
