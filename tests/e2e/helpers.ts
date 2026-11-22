import type { Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Local mail catcher (supabase `[local_smtp]`, port 54324). Current CLIs ship Mailpit; older ones shipped
// Inbucket. Both are supported below.  Verified against the local stack (Mailpit).
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

/** Test-only: push every open validation for this validator email past its expiry (service role, local stack). */
export async function expireValidationLinks(validatorEmail: string): Promise<void> {
  process.loadEnvFile(".env.local");
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const { error, count } = await admin
    .from("validations")
    .update({ expires_at: new Date(Date.now() - 1000).toISOString() }, { count: "exact" })
    .eq("validator_email", validatorEmail)
    .eq("status", "pending");
  if (error || !count) throw new Error("could not expire the validation link");
}

function adminClient() {
  process.loadEnvFile(".env.local");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

/**
 * Test-only: run `fn` with every HRBP target set to 0 (so any learner has "met every target"), then restore the
 * real targets from a snapshot, even if `fn` throws. Local stack only; the e2e suite runs with one worker.
 */
export async function withAllTargetsMet(fn: () => Promise<void>): Promise<void> {
  const admin = adminClient();
  const snap = await admin.from("role_capabilities").select("role_id, capability_id, target");
  if (snap.error || !snap.data?.length) throw new Error("could not snapshot targets");
  try {
    const { error } = await admin.from("role_capabilities").update({ target: 0 }).gte("target", 0);
    if (error) throw new Error("could not zero targets");
    await fn();
  } finally {
    for (const r of snap.data) {
      await admin.from("role_capabilities").update({ target: r.target }).eq("role_id", r.role_id).eq("capability_id", r.capability_id);
    }
  }
}

const WORDS45 = Array.from({ length: 45 }, (_, i) => `word${i}`).join(" ");

/** Log an experience (with a PDF) tagged with one capability and ask a validator; returns the copyable validation link. */
export async function logExperience(page: Page, opts: { title: string; capability: string; validatorEmail: string }): Promise<string> {
  await page.goto("/app/experiences/new");
  await page.getByLabel("Title").fill(opts.title);
  await page.getByLabel("Your role").fill("Lead");
  await page.getByLabel("Duration").fill("4 weeks");
  await page.getByLabel("What I did").fill("Led the team through the project.");
  await page.getByRole("checkbox", { name: opts.capability }).check({ force: true });
  await page.getByLabel(/what did you actually learn or do/i).fill(WORDS45);
  await page.locator('input[type="file"]').first().setInputFiles({ name: "report.pdf", mimeType: "application/pdf", buffer: tinyPdf() });
  await page.getByLabel("Their name").fill("Dr Validator");
  await page.getByLabel("Their email").fill(opts.validatorEmail);
  await page.getByRole("button", { name: /save experience/i }).click();
  return page.getByLabel("Validation link").inputValue();
}
