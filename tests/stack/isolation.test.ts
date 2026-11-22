// Runs against the REAL local Supabase stack (GoTrue, PostgREST, Storage), not PGlite stand-ins.
// Requires `npm run db:start` and .env.local. Run with `npm run test:stack`.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

process.loadEnvFile(".env.local");
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const PASSWORD = "Test-password-1!";
const tag = `${Date.now()}`;

async function makeUser(label: string): Promise<{ id: string; client: SupabaseClient }> {
  const email = `${label}${tag}@example.test`;
  const created = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (created.error || !created.data.user) throw new Error("createUser failed");
  const client = createClient(URL, ANON, { auth: { persistSession: false } });
  const s = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (s.error) throw new Error("sign-in failed");
  return { id: created.data.user.id, client };
}

const PDF = new Blob(["%PDF-1.4\n%%EOF\n"], { type: "application/pdf" });
let a: { id: string; client: SupabaseClient };
let b: { id: string; client: SupabaseClient };
let expId: string;
let evId: string;
let path: string;

beforeAll(async () => {
  a = await makeUser("a");
  b = await makeUser("b");
  const exp = await a.client
    .from("experiences")
    .insert({ user_id: a.id, title: "A private", type: "academic", role_title: "r", duration_label: "d", description: "x", reflection: "y" })
    .select("id")
    .single();
  expect(exp.error).toBeNull();
  expId = exp.data!.id;
  path = `${a.id}/${expId}/${crypto.randomUUID()}.pdf`;
  // The app uploads server-side with the service role, after its own checks.
  const up = await admin.storage.from("evidence").upload(path, PDF, { contentType: "application/pdf" });
  expect(up.error).toBeNull();
  const ev = await a.client
    .from("evidence")
    .insert({ experience_id: expId, kind: "report", storage_path: path, filename: "a.pdf", mime: "application/pdf", size_bytes: 14 })
    .select("id")
    .single();
  expect(ev.error).toBeNull();
  evId = ev.data!.id;
}, 60_000);

describe("real stack: cross-user isolation", () => {
  it("owner can read own rows", async () => {
    expect((await a.client.from("experiences").select("id").eq("id", expId)).data).toHaveLength(1);
    expect((await a.client.from("evidence").select("id").eq("id", evId)).data).toHaveLength(1);
  });

  it("user B cannot read A's experiences or evidence rows", async () => {
    expect((await b.client.from("experiences").select("id").eq("id", expId)).data).toEqual([]);
    expect((await b.client.from("evidence").select("id").eq("id", evId)).data).toEqual([]);
    expect((await b.client.from("experiences").select("id")).data).toEqual([]);
  });

  it("user B cannot attach evidence to, edit or delete A's experience", async () => {
    const ins = await b.client
      .from("evidence")
      .insert({ experience_id: expId, kind: "report", storage_path: `${b.id}/${expId}/x.pdf`, filename: "x.pdf", mime: "application/pdf", size_bytes: 1 });
    expect(ins.error).not.toBeNull();
    await b.client.from("experiences").update({ title: "pwned" }).eq("id", expId);
    await b.client.from("experiences").delete().eq("id", expId);
    expect((await a.client.from("experiences").select("title").eq("id", expId).single()).data?.title).toBe("A private");
  });

  it("user B cannot download, sign, list or overwrite A's file via Storage", async () => {
    expect((await b.client.storage.from("evidence").download(path)).error).not.toBeNull();
    expect((await b.client.storage.from("evidence").createSignedUrl(path, 60)).error).not.toBeNull();
    expect((await b.client.storage.from("evidence").list(a.id)).data ?? []).toEqual([]);
    expect((await b.client.storage.from("evidence").upload(`${a.id}/${expId}/evil.pdf`, PDF, { contentType: "application/pdf" })).error).not.toBeNull();
  });

  it("even the owner has no direct Storage access (downloads go through the server)", async () => {
    expect((await a.client.storage.from("evidence").download(path)).error).not.toBeNull();
  });

  it("anonymous callers get nothing, and the bucket is not public", async () => {
    const anon = createClient(URL, ANON, { auth: { persistSession: false } });
    expect((await anon.from("experiences").select("id")).data ?? []).toEqual([]);
    expect((await anon.storage.from("evidence").download(path)).error).not.toBeNull();
    const pub = await fetch(`${URL}/storage/v1/object/public/evidence/${path}`);
    expect(pub.ok).toBe(false);
  });

  it("clients cannot read validation token hashes or call the validator functions", async () => {
    const r = await a.client.from("validations").select("token_hash");
    expect(r.error?.message).toMatch(/permission denied/i);
    const ctx = await a.client.rpc("validation_context", { p_token_hash: "0".repeat(64) });
    expect(ctx.error?.message).toMatch(/permission denied/i);
    const dec = await a.client.rpc("record_validation_decision", { p_token_hash: "0".repeat(64), p_status: "endorsed", p_comment: "" });
    expect(dec.error?.message).toMatch(/permission denied/i);
  });

  it("clients cannot promote themselves to admin", async () => {
    await a.client.from("profiles").update({ role: "admin" }).eq("id", a.id);
    expect((await admin.from("profiles").select("role").eq("id", a.id).single()).data?.role).toBe("learner");
  });
});

describe("real stack: token lifecycle", () => {
  async function newToken() {
    const raw = randomBytes(32).toString("base64url");
    const hash = createHash("sha256").update(raw).digest("hex");
    const expires = new Date(Date.now() + 14 * 864e5).toISOString();
    const r = await a.client.rpc("request_validation", { p_experience_id: expId, p_name: "V", p_email: "v@example.test", p_kind: "mentor", p_token_hash: hash, p_expires_at: expires });
    expect(r.error).toBeNull();
    return { raw, hash };
  }

  it("valid → context; used → null; expired → null; unknown → null", async () => {
    const t = await newToken();
    expect((await admin.rpc("validation_context", { p_token_hash: t.hash })).data).not.toBeNull();

    const exp = await newToken();
    await admin.from("validations").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("token_hash", exp.hash);
    expect((await admin.rpc("validation_context", { p_token_hash: exp.hash })).data ?? null).toBeNull();

    const dec = await admin.rpc("record_validation_decision", { p_token_hash: t.hash, p_status: "endorsed", p_comment: "ok" });
    expect(dec.error).toBeNull();
    expect(dec.data).toBe(true);
    expect((await admin.rpc("validation_context", { p_token_hash: t.hash })).data ?? null).toBeNull();
    const again = await admin.rpc("record_validation_decision", { p_token_hash: t.hash, p_status: "endorsed", p_comment: "ok" });
    expect(again.error).toBeNull();
    expect(again.data).toBe(false);

    expect((await admin.rpc("validation_context", { p_token_hash: "f".repeat(64) })).data ?? null).toBeNull();
  });
});
