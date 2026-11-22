import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, createDb } from "./harness";

let db: PGlite;
beforeAll(async () => { db = await createDb({ seed: false }); });
afterAll(async () => { await db.close(); });

const hit = async (key: string, limit: number, windowSeconds: number, at?: string) =>
  (await db.query<{ ok: boolean }>(`select public.rate_limit_hit($1, $2, $3, coalesce($4::timestamptz, now())) as ok`, [key, limit, windowSeconds, at ?? null])).rows[0].ok;

describe("rate_limit_hit()", () => {
  it("allows up to the limit, then refuses", async () => {
    const results: boolean[] = [];
    for (let i = 0; i < 7; i++) results.push(await hit("login:aaaaaaaa", 5, 600));
    expect(results).toEqual([true, true, true, true, true, false, false]);
  });

  it("keys are independent", async () => {
    for (let i = 0; i < 3; i++) await hit("scope-a:bbbbbbbb", 3, 600);
    expect(await hit("scope-a:bbbbbbbb", 3, 600)).toBe(false);
    expect(await hit("scope-a:cccccccc", 3, 600)).toBe(true);
    expect(await hit("scope-b:bbbbbbbb", 3, 600)).toBe(true);
  });

  it("the window resets after it elapses, and keeps counting inside it", async () => {
    const t0 = "2026-01-01T00:00:00Z";
    expect(await hit("window:dddddddd", 2, 60, t0)).toBe(true);
    expect(await hit("window:dddddddd", 2, 60, "2026-01-01T00:00:30Z")).toBe(true);
    expect(await hit("window:dddddddd", 2, 60, "2026-01-01T00:00:45Z")).toBe(false); // still the first window
    expect(await hit("window:dddddddd", 2, 60, "2026-01-01T00:01:01Z")).toBe(true);  // new window
    expect(await hit("window:dddddddd", 2, 60, "2026-01-01T00:01:02Z")).toBe(true);
    expect(await hit("window:dddddddd", 2, 60, "2026-01-01T00:01:03Z")).toBe(false);
  });

  it("is atomic under concurrency: exactly `limit` of N parallel hits succeed", async () => {
    const key = "burst:eeeeeeee";
    const results = await Promise.all(Array.from({ length: 12 }, () => hit(key, 5, 600)));
    expect(results.filter(Boolean)).toHaveLength(5);
  });

  it("rejects nonsense parameters", async () => {
    await expect(hit("bad:ffffffff", 0, 60)).rejects.toThrow(/invalid rate limit/i);
    await expect(hit("bad:ffffffff", 5, 0)).rejects.toThrow(/invalid rate limit/i);
  });

  it("only the service role can call it or read the table; clients cannot reset their own counter", async () => {
    for (const role of ["anon", "authenticated"] as const) {
      await expect(as(db, role, null, () => db.query(`select public.rate_limit_hit('x:12345678', 5, 60)`))).rejects.toThrow(/permission denied/i);
      await expect(as(db, role, null, () => db.query(`select * from public.rate_limits`))).rejects.toThrow(/permission denied/i);
      await expect(as(db, role, null, () => db.query(`delete from public.rate_limits`))).rejects.toThrow(/permission denied/i);
    }
    const ok = await as(db, "service_role", null, () => db.query<{ ok: boolean }>(`select public.rate_limit_hit('svc:12345678', 5, 60) as ok`));
    expect(ok.rows[0].ok).toBe(true);
  });
});
