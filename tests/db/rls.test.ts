import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { addUser, as, createDb, sha256hex } from "./harness";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const EXP_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const HRBP = "a0000000-0000-4000-8000-000000000001";
const COMM = "c0000000-0000-4000-8000-000000000001";

let db: PGlite;

const q = (sql: string, params: unknown[] = []) => db.query(sql, params);
const rejects = async (p: Promise<unknown>, re: RegExp) => {
  await expect(p).rejects.toThrow(re);
};

beforeAll(async () => {
  db = await createDb({ seed: true });
  await addUser(db, A, "a@example.test");
  await addUser(db, B, "b@example.test");
  await as(db, "authenticated", A, async () => {
    await q(
      `insert into experiences (id, title, type, role_title, duration_label, description, reflection)
       values ($1, 'A project', 'academic', 'Lead', '4 weeks', 'Did things', 'my reflection')`,
      [EXP_A],
    );
    await q(`insert into experience_capabilities (experience_id, capability_id) values ($1, $2)`, [EXP_A, COMM]);
    await q(
      `insert into evidence (experience_id, kind, storage_path, filename, mime, size_bytes)
       values ($1, 'report', $2, 'r.pdf', 'application/pdf', 1000)`,
      [EXP_A, `${A}/${EXP_A}/0001.pdf`],
    );
  });
});
afterAll(async () => {
  await db.close();
});

describe("seed and migrations", () => {
  it("loads the seed: trigger made a profile for Jo, HRBP has 6 targets, data is flagged DEMO", async () => {
    const p = await q(`select display_name, is_demo, target_role_id from profiles where id = 'd0000000-0000-4000-8000-000000000001'`);
    expect(p.rows[0]).toMatchObject({ display_name: "Jo (DEMO)", is_demo: true, target_role_id: HRBP });
    const rc = await q(`select count(*)::int as n from role_capabilities where role_id = $1`, [HRBP]);
    expect(rc.rows[0]).toMatchObject({ n: 6 });
    const demo = await q(`select count(*)::int as n from experiences where user_id = 'd0000000-0000-4000-8000-000000000001' and is_demo and title like '[DEMO]%'`);
    expect(demo.rows[0]).toMatchObject({ n: 5 });
  });

  it("every public table has RLS enabled", async () => {
    const r = await q(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    );
    expect(r.rows).toEqual([]);
  });
});

describe("cross-user isolation (user B vs user A's data)", () => {
  it("B cannot read A's experiences, tags, evidence or validations", async () => {
    await as(db, "authenticated", B, async () => {
      for (const t of ["experiences", "experience_capabilities", "evidence", "validations"]) {
        const r = await q(`select count(*)::int as n from ${t}`);
        expect(r.rows[0], t).toMatchObject({ n: 0 });
      }
    });
  });

  it("A can read their own rows", async () => {
    await as(db, "authenticated", A, async () => {
      expect((await q(`select count(*)::int as n from experiences`)).rows[0]).toMatchObject({ n: 1 });
      expect((await q(`select count(*)::int as n from evidence`)).rows[0]).toMatchObject({ n: 1 });
    });
  });

  it("B cannot update or delete A's experience (0 rows affected)", async () => {
    await as(db, "authenticated", B, async () => {
      const u = await q(`update experiences set title = 'hacked' where id = $1`, [EXP_A]);
      expect(u.affectedRows).toBe(0);
      const d = await q(`delete from experiences where id = $1`, [EXP_A]);
      expect(d.affectedRows).toBe(0);
    });
    const still = await q(`select title from experiences where id = $1`, [EXP_A]);
    expect(still.rows[0]).toMatchObject({ title: "A project" });
  });

  it("B cannot insert an experience owned by A, nor attach rows to A's experience", async () => {
    await as(db, "authenticated", B, async () => {
      await rejects(
        q(
          `insert into experiences (user_id, title, type, role_title, duration_label, description)
           values ($1, 't', 'academic', 'r', 'd', 'x')`,
          [A],
        ),
        /row-level security/i,
      );
      await rejects(
        q(`insert into experience_capabilities (experience_id, capability_id) values ($1, $2)`, [EXP_A, COMM]),
        /row-level security/i,
      );
      await rejects(
        q(
          `insert into evidence (experience_id, kind, storage_path, filename, mime, size_bytes)
           values ($1, 'report', $2, 'x.pdf', 'application/pdf', 1)`,
          [EXP_A, `${B}/${EXP_A}/x.pdf`],
        ),
        /row-level security/i,
      );
    });
  });

  it("evidence rows must point inside the owner's own folder for that experience", async () => {
    await as(db, "authenticated", A, async () => {
      for (const bad of [`${B}/${EXP_A}/x.pdf`, `${A}/other-experience/x.pdf`, `../${A}/${EXP_A}/x.pdf`]) {
        await rejects(
          q(
            `insert into evidence (experience_id, kind, storage_path, filename, mime, size_bytes)
             values ($1, 'report', $2, 'x.pdf', 'application/pdf', 1)`,
            [EXP_A, bad],
          ),
          /row-level security/i,
        );
      }
    });
  });

  it("B cannot read A's profile; each user sees only their own", async () => {
    await as(db, "authenticated", B, async () => {
      const r = await q(`select id from profiles`);
      expect(r.rows).toEqual([{ id: B }]);
    });
  });
});

describe("privilege escalation attempts", () => {
  it("a learner cannot make themselves admin or demo", async () => {
    await as(db, "authenticated", A, async () => {
      await rejects(q(`update profiles set role = 'admin' where id = $1`, [A]), /permission denied/i);
      await rejects(q(`update profiles set is_demo = true where id = $1`, [A]), /permission denied/i);
      await rejects(q(`insert into profiles (id) values (gen_random_uuid())`), /permission denied/i);
    });
  });

  it("a learner can update allowed profile columns", async () => {
    await as(db, "authenticated", A, async () => {
      const r = await q(`update profiles set display_name = 'Ada', target_role_id = $2 where id = $1`, [A, HRBP]);
      expect(r.affectedRows).toBe(1);
    });
  });

  it("a learner cannot set is_demo on an experience", async () => {
    await as(db, "authenticated", A, async () => {
      await rejects(q(`update experiences set is_demo = true where id = $1`, [EXP_A]), /permission denied/i);
    });
  });

  it("reference tables are read-only for learners and invisible to anon", async () => {
    await as(db, "authenticated", A, async () => {
      expect((await q(`select count(*)::int as n from capabilities`)).rows[0]).toMatchObject({ n: 6 });
      await rejects(q(`update role_capabilities set target = 100`), /permission denied/i);
      await rejects(q(`insert into capabilities (slug, name, statement_template, suggested_experience) values ('zz','Z','t','s')`), /permission denied/i);
      await rejects(q(`delete from career_roles`), /permission denied/i);
    });
    await as(db, "anon", null, async () => {
      for (const t of ["capabilities", "career_roles", "experiences", "profiles", "evidence", "validations"]) {
        await rejects(q(`select 1 from ${t}`), /permission denied/i);
      }
    });
  });

  it("audit_log is invisible and unwritable to clients", async () => {
    await as(db, "authenticated", A, async () => {
      await rejects(q(`select * from audit_log`), /permission denied/i);
      await rejects(q(`insert into audit_log (action, entity) values ('x','y')`), /permission denied/i);
    });
  });
});

describe("validations table is write-protected", () => {
  it("a learner cannot insert, update or delete validations directly, nor read token_hash", async () => {
    await as(db, "authenticated", A, async () => {
      await rejects(
        q(
          `insert into validations (experience_id, validator_name, validator_email, validator_kind, status, token_hash, expires_at)
           values ($1, 'Me', 'me@example.test', 'faculty', 'endorsed', repeat('a', 64), now() + interval '1 day')`,
          [EXP_A],
        ),
        /permission denied/i,
      );
      await rejects(q(`update validations set status = 'endorsed'`), /permission denied/i);
      await rejects(q(`delete from validations`), /permission denied/i);
      await rejects(q(`select token_hash from validations`), /permission denied/i);
      await rejects(q(`select * from validations`), /permission denied/i);
    });
  });
});

describe("validation request + token lifecycle", () => {
  const raw = "raw-token-1";
  let hash: string;

  it("only the owner may request validation; hash must be 64 hex chars", async () => {
    hash = await sha256hex(raw);
    await as(db, "authenticated", B, async () => {
      await rejects(
        q(`select request_validation($1, 'V', 'v@example.test', 'faculty', $2, now() + interval '14 days')`, [EXP_A, hash]),
        /not allowed/i,
      );
    });
    await as(db, "authenticated", A, async () => {
      await rejects(
        q(`select request_validation($1, 'V', 'v@example.test', 'faculty', 'short', now() + interval '14 days')`, [EXP_A]),
        /invalid token hash/i,
      );
      await rejects(
        q(`select request_validation($1, 'V', 'not-an-email', 'faculty', $2, now() + interval '14 days')`, [EXP_A, hash]),
        /invalid validator/i,
      );
      await rejects(
        q(`select request_validation($1, 'V', 'v@example.test', 'faculty', $2, now() + interval '90 days')`, [EXP_A, hash]),
        /invalid expiry/i,
      );
      const ok = await q(`select request_validation($1, 'V', 'v@example.test', 'faculty', $2, now() + interval '14 days') as id`, [EXP_A, hash]);
      expect(ok.rows[0]).toHaveProperty("id");
    });
  });

  it("owner sees the request (without the hash); another learner does not", async () => {
    await as(db, "authenticated", A, async () => {
      const r = await q(`select status, validator_kind from validations`);
      expect(r.rows).toEqual([{ status: "pending", validator_kind: "faculty" }]);
    });
    await as(db, "authenticated", B, async () => {
      expect((await q(`select count(*)::int as n from validations`)).rows[0]).toMatchObject({ n: 0 });
    });
  });

  it("clients cannot call the token functions; only service_role can", async () => {
    for (const role of ["anon", "authenticated"] as const) {
      await as(db, role, A, async () => {
        await rejects(q(`select validation_context($1)`, [hash]), /permission denied/i);
        await rejects(q(`select record_validation_decision($1, 'endorsed', 'x')`, [hash]), /permission denied/i);
      });
    }
    await as(db, "anon", null, async () => {
      await rejects(
        q(`select request_validation($1, 'V', 'v@example.test', 'faculty', $2, now() + interval '1 day')`, [EXP_A, hash]),
        /permission denied/i,
      );
    });
  });

  it("a valid token shows the experience, evidence and reflection", async () => {
    await as(db, "service_role", null, async () => {
      const r = await q(`select validation_context($1) as ctx`, [hash]);
      const { ctx } = r.rows[0] as {
        ctx: { experience: { title: string; reflection: string }; evidence: unknown[]; capabilities: string[] };
      };
      expect(ctx.experience.title).toBe("A project");
      expect(ctx.experience.reflection).toBe("my reflection");
      expect(ctx.evidence).toHaveLength(1);
      expect(ctx.capabilities).toEqual(["Communication"]);
    });
  });

  it("unknown, malformed and null tokens all return null", async () => {
    await as(db, "service_role", null, async () => {
      for (const h of [await sha256hex("nope"), "xyz", "", "A".repeat(64), null]) {
        const r = await q(`select validation_context($1) as ctx`, [h]);
        expect(r.rows[0]).toMatchObject({ ctx: null });
      }
    });
  });

  it("an expired token is unusable", async () => {
    const eh = await sha256hex("expired-token");
    await db.query(
      `insert into validations (experience_id, validator_name, validator_email, validator_kind, token_hash, expires_at)
       values ($1, 'V', 'v@example.test', 'mentor', $2, now() - interval '1 minute')`,
      [EXP_A, eh],
    );
    await as(db, "service_role", null, async () => {
      expect((await q(`select validation_context($1) as ctx`, [eh])).rows[0]).toMatchObject({ ctx: null });
      expect((await q(`select record_validation_decision($1, 'endorsed', null) as ok`, [eh])).rows[0]).toMatchObject({ ok: false });
    });
  });

  it("the decision is recorded once; reuse fails; context then returns null", async () => {
    await as(db, "service_role", null, async () => {
      expect((await q(`select record_validation_decision($1, 'pending', null) as ok`, [hash])).rows[0]).toMatchObject({ ok: false });
      expect((await q(`select record_validation_decision($1, 'endorsed', 'Great work') as ok`, [hash])).rows[0]).toMatchObject({ ok: true });
      expect((await q(`select record_validation_decision($1, 'declined', 'changed my mind') as ok`, [hash])).rows[0]).toMatchObject({ ok: false });
      expect((await q(`select validation_context($1) as ctx`, [hash])).rows[0]).toMatchObject({ ctx: null });
    });
    const v = await q(`select status, comment, used_at is not null as used from validations where experience_id = $1 and status = 'endorsed'`, [EXP_A]);
    expect(v.rows[0]).toMatchObject({ status: "endorsed", comment: "Great work", used: true });
    const log = await q(`select action from audit_log order by id`);
    expect((log.rows as { action: string }[]).map((r) => r.action)).toEqual(["validation.requested", "validation.endorsed"]);
  });

  it("caps open requests per experience at 5", async () => {
    await as(db, "authenticated", A, async () => {
      for (let i = 0; i < 5; i++) {
        await q(`select request_validation($1, 'V', 'v@example.test', 'mentor', $2, now() + interval '14 days')`, [EXP_A, await sha256hex(`bulk-${i}`)]);
      }
      await rejects(
        q(`select request_validation($1, 'V', 'v@example.test', 'mentor', $2, now() + interval '14 days')`, [EXP_A, await sha256hex("bulk-x")]),
        /too many open requests/i,
      );
    });
  });
});
