import fs from "node:fs";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "./harness";

const HRBP = "a0000000-0000-4000-8000-000000000001";

let db: PGlite;
beforeAll(async () => { db = await createDb({ seed: false }); });
afterAll(async () => { await db.close(); });

describe("reference-data migration", () => {
  it("provides the HRBP map without the demo seed, and is idempotent", async () => {
    const file = path.resolve(__dirname, "../../supabase/migrations/20261122000003_reference_data.sql");
    await db.exec(fs.readFileSync(file, "utf8")); // second application must not fail or duplicate

    const roles = await db.query<{ name: string; is_mapped: boolean }>(`select name, is_mapped from career_roles order by name`);
    expect(roles.rows).toHaveLength(4);
    expect(roles.rows.filter((r) => r.is_mapped).map((r) => r.name)).toEqual(["HR Business Partner"]);

    const map = await db.query<{ slug: string; target: number; weight: string }>(
      `select c.slug, rc.target, rc.weight::text from role_capabilities rc join capabilities c on c.id = rc.capability_id
        where rc.role_id = $1 order by c.slug`, [HRBP]);
    expect(map.rows).toHaveLength(6);
    const bySlug = Object.fromEntries(map.rows.map((r) => [r.slug, r]));
    expect(bySlug["communication"].target).toBe(90);
    expect(bySlug["stakeholder-management"].target).toBe(85);
    expect(Number(bySlug["stakeholder-management"].weight)).toBe(1.2);

    // Only HRBP has a map; the other roles are name-only.
    const others = await db.query<{ n: number }>(`select count(*)::int as n from role_capabilities where role_id <> $1`, [HRBP]);
    expect(others.rows[0].n).toBe(0);
    // No demo data without the seed.
    expect((await db.query<{ n: number }>(`select count(*)::int as n from profiles`)).rows[0].n).toBe(0);
  });
});
