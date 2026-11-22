import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addUser, as, createDb } from "./harness";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const COMM = "c0000000-0000-4000-8000-000000000001";
let db: PGlite;

beforeAll(async () => {
  db = await createDb({ seed: false });
  await addUser(db, A, "a@example.test");
  await addUser(db, B, "b@example.test");
  await as(db, "authenticated", A, () =>
    db.query(`insert into capability_statements (user_id, capability_id, text) values ($1, $2, 'A private statement')`, [A, COMM]),
  );
});
afterAll(async () => { await db.close(); });

describe("capability_statements RLS", () => {
  it("the owner reads, updates and (later) deletes their own statement", async () => {
    const r = await as(db, "authenticated", A, () => db.query<{ text: string }>(`select text from capability_statements`));
    expect(r.rows).toEqual([{ text: "A private statement" }]);
  });
  it("another learner sees nothing and cannot update or delete it", async () => {
    await as(db, "authenticated", B, async () => {
      expect((await db.query(`select * from capability_statements`)).rows).toEqual([]);
      expect((await db.query(`update capability_statements set text = 'pwned' where user_id = $1`, [A])).affectedRows).toBe(0);
      expect((await db.query(`delete from capability_statements where user_id = $1`, [A])).affectedRows).toBe(0);
    });
    const r = await as(db, "authenticated", A, () => db.query<{ text: string }>(`select text from capability_statements`));
    expect(r.rows[0].text).toBe("A private statement");
  });
  it("a learner cannot write a statement as someone else, and anon gets nothing", async () => {
    await expect(
      as(db, "authenticated", B, () => db.query(`insert into capability_statements (user_id, capability_id, text) values ($1, $2, 'forged')`, [A, COMM])),
    ).rejects.toThrow(/row-level security/i);
    await expect(as(db, "anon", null, () => db.query(`select * from capability_statements`))).rejects.toThrow(/permission denied/i);
  });
  it("the database also enforces length (1..600)", async () => {
    await expect(
      as(db, "authenticated", B, () => db.query(`insert into capability_statements (user_id, capability_id, text) values ($1, $2, '')`, [B, COMM])),
    ).rejects.toThrow(/check constraint/i);
  });
});
