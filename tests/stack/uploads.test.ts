// Real Storage (not a stub): the guards the direct-upload design relies on.
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

process.loadEnvFile(".env.local");
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const bucket = () => admin.storage.from("evidence");
const browser = () => createClient(URL, ANON, { auth: { persistSession: false } }).storage.from("evidence");

const uid = randomUUID();
const exp = randomUUID();
const newPath = (ext = "pdf") => `${uid}/${exp}/${randomUUID()}.${ext}`;
const pdf = (bytes: number) => new Blob([new Uint8Array(bytes).fill(0x20)], { type: "application/pdf" });
const mint = async (path: string) => {
  const r = await bucket().createSignedUploadUrl(path, { upsert: false });
  expect(r.error).toBeNull();
  return r.data!.token;
};
const exists = async (path: string) => !(await bucket().download(path)).error;

beforeAll(() => {
  expect(URL && ANON && SERVICE).toBeTruthy();
});

describe("real Storage: signed direct uploads", () => {
  it("a minted token uploads one file into its own path", async () => {
    const path = newPath();
    const token = await mint(path);
    const up = await browser().uploadToSignedUrl(path, token, pdf(2048), { contentType: "application/pdf" });
    expect(up.error).toBeNull();
    expect(await exists(path)).toBe(true);
  });

  it("the same token cannot upload again: nothing can be swapped in after verification", async () => {
    const path = newPath();
    const token = await mint(path);
    expect((await browser().uploadToSignedUrl(path, token, pdf(1000), { contentType: "application/pdf" })).error).toBeNull();
    const again = await browser().uploadToSignedUrl(path, token, pdf(1500), { contentType: "application/pdf" });
    expect(again.error).not.toBeNull();
    // Still the original bytes.
    expect((await (await bucket().download(path)).data!.arrayBuffer()).byteLength).toBe(1000);
  });

  it("a fresh token for the same path is also refused once the object exists (upsert:false)", async () => {
    const path = newPath();
    expect((await browser().uploadToSignedUrl(path, await mint(path), pdf(1000), { contentType: "application/pdf" })).error).toBeNull();
    const second = await bucket().createSignedUploadUrl(path, { upsert: false });
    if (second.data) {
      expect((await browser().uploadToSignedUrl(path, second.data.token, pdf(2000), { contentType: "application/pdf" })).error).not.toBeNull();
    } else {
      expect(second.error).not.toBeNull();
    }
    expect((await (await bucket().download(path)).data!.arrayBuffer()).byteLength).toBe(1000);
  });

  it("an 11 MB upload is refused by the bucket even though the client chose to send it", async () => {
    const path = newPath();
    const token = await mint(path);
    const up = await browser().uploadToSignedUrl(path, token, pdf(11 * 1024 * 1024), { contentType: "application/pdf" });
    expect(up.error).not.toBeNull();
    expect(await exists(path)).toBe(false);
  }, 60_000);

  it("a file just under the limit (about 9 MB, well above Vercel's 4.5 MB body cap) uploads fine", async () => {
    const path = newPath();
    const up = await browser().uploadToSignedUrl(path, await mint(path), pdf(9 * 1024 * 1024), { contentType: "application/pdf" });
    expect(up.error).toBeNull();
    expect((await (await bucket().download(path)).data!.arrayBuffer()).byteLength).toBe(9 * 1024 * 1024);
  }, 60_000);

  it("disallowed content types are refused by the bucket allow-list", async () => {
    const path = newPath("pdf");
    const token = await mint(path);
    const up = await browser().uploadToSignedUrl(path, token, new Blob(["MZ"], { type: "application/x-msdownload" }), { contentType: "application/x-msdownload" });
    expect(up.error).not.toBeNull();
    expect(await exists(path)).toBe(false);
  });

  it("a token is bound to its path: it cannot be used for a different path", async () => {
    const pathA = newPath();
    const pathB = newPath();
    const tokenA = await mint(pathA);
    const up = await browser().uploadToSignedUrl(pathB, tokenA, pdf(500), { contentType: "application/pdf" });
    expect(up.error).not.toBeNull();
    expect(await exists(pathB)).toBe(false);
  });

  it("clients cannot mint upload URLs or write to the bucket on their own", async () => {
    const anon = browser();
    expect((await anon.createSignedUploadUrl(newPath())).error).not.toBeNull();
    expect((await anon.upload(newPath(), pdf(100), { contentType: "application/pdf" })).error).not.toBeNull();
  });
});
