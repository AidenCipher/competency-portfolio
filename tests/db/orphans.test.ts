import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addUser, as, createDb } from "./harness";

const U = "55555555-5555-4555-8555-555555555555";
let db: PGlite;
let claimed = "";
let orphan = "";
const orphans = (role: "service_role" | "authenticated" | "anon" = "service_role") =>
  as(db, role, role === "authenticated" ? U : null, () => db.query<{ name: string }>(`select name from public.orphaned_evidence_objects()`));

beforeAll(async () => {
  db = await createDb({ seed: false });
  await addUser(db, U, "orphans@example.test");
  const expId = await as(db, "authenticated", U, async () => {
    const e = await db.query<{ id: string }>(`insert into experiences (user_id, title, type, role_title, duration_label, description, reflection) values ($1,'t','work','r','d','x','y') returning id`, [U]);
    return e.rows[0].id;
  });
  claimed = `${U}/${expId}/11111111-1111-4111-8111-111111111111.pdf`;
  orphan = `${U}/${expId}/22222222-2222-4222-8222-222222222222.pdf`;
  await as(db, "authenticated", U, () =>
    db.query(`insert into evidence (experience_id, kind, storage_path, filename, mime, size_bytes) values ($1,'report',$2,'a.pdf','application/pdf',1)`, [expId, claimed]));
  await db.query(
    `insert into storage.objects (bucket_id, name, created_at) values
      ('evidence', $1, now() - interval '3 days'),
      ('evidence', $2, now() - interval '3 days'),
      ('evidence', 'recent/fresh.pdf', now() - interval '1 hour'),
      ('other',    'other/bucket.pdf', now() - interval '3 days')`, [claimed, orphan]);
});
afterAll(async () => { await db.close(); });

describe("orphaned_evidence_objects()", () => {
  it("lists only old, unclaimed objects in the evidence bucket", async () => {
    expect((await orphans()).rows.map((r) => r.name)).toEqual([orphan]);
  });
  it("is not callable by clients", async () => {
    await expect(orphans("authenticated")).rejects.toThrow(/permission denied/i);
    await expect(orphans("anon")).rejects.toThrow(/permission denied/i);
  });
});
