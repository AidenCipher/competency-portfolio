import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addUser, as, createDb } from "./harness";

const REAL = "33333333-3333-4333-8333-333333333333";
const COMM = "c0000000-0000-4000-8000-000000000001";
let db: PGlite;

const demoAsAnon = async () =>
  as(db, "anon", null, async () => (await db.query<{ d: Record<string, unknown> | null }>(`select public.demo_portfolio() as d`)).rows[0].d);

beforeAll(async () => {
  db = await createDb({ seed: true });
  await addUser(db, REAL, "real.learner@example.test");
  await as(db, "authenticated", REAL, async () => {
    const e = await db.query<{ id: string }>(
      `insert into experiences (user_id, title, type, role_title, duration_label, description, reflection)
       values ($1, 'REAL LEARNER SECRET TITLE', 'work', 'r', 'd', 'x', 'y') returning id`, [REAL]);
    await db.query(`insert into experience_capabilities (experience_id, capability_id) values ($1, $2)`, [e.rows[0].id, COMM]);
    await db.query(`insert into capability_statements (user_id, capability_id, text) values ($1, $2, 'REAL LEARNER STATEMENT')`, [REAL, COMM]);
  });
});
afterAll(async () => { await db.close(); });

describe("demo_portfolio()", () => {
  it("is callable by anon and returns Jo's demo data only", async () => {
    const d = await demoAsAnon();
    expect(d).not.toBeNull();
    const json = JSON.stringify(d);
    expect((d as { profile: { display_name: string; is_demo: boolean } }).profile).toMatchObject({ display_name: "Jo (DEMO)", is_demo: true });
    expect((d as { experiences: unknown[] }).experiences).toHaveLength(5);
    expect(json).toContain("[DEMO]");
    expect(json).not.toContain("REAL LEARNER");
    expect(json).not.toContain("real.learner");
  });

  it("never exposes emails, token hashes, storage paths or user ids", async () => {
    const json = JSON.stringify(await demoAsAnon());
    for (const forbidden of ["validator_email", "token_hash", "storage_path", "user_id", "@example.test"]) {
      expect(json, forbidden).not.toContain(forbidden);
    }
    expect(json).not.toContain('"has_file":true');
  });

  it("returns nothing when no learner is flagged demo", async () => {
    const empty = await createDb({ seed: false });
    const d = await as(empty, "anon", null, async () => (await empty.query<{ d: unknown }>(`select public.demo_portfolio() as d`)).rows[0].d);
    expect(d).toBeNull();
    await empty.close();
  });

  it("a learner cannot flag themselves or their rows as demo", async () => {
    await expect(as(db, "authenticated", REAL, () => db.query(`update profiles set is_demo = true where id = $1`, [REAL]))).rejects.toThrow(/permission denied/i);
    await expect(
      as(db, "authenticated", REAL, () => db.query(`insert into experiences (user_id, title, type, role_title, duration_label, description, reflection, is_demo) values ($1,'x','work','r','d','x','y', true)`, [REAL])),
    ).rejects.toThrow(/permission denied/i);
  });
});
