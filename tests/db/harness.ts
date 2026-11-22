import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");

export type Role = "anon" | "authenticated" | "service_role";

export async function createDb(opts: { seed?: boolean } = {}): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(fs.readFileSync(path.join(__dirname, "supabase-stub.sql"), "utf8"));
  const dir = path.join(root, "supabase/migrations");
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(fs.readFileSync(path.join(dir, f), "utf8"));
  }
  if (opts.seed) await db.exec(fs.readFileSync(path.join(root, "supabase/seed.sql"), "utf8"));
  return db;
}

/** Create an auth user (the trigger creates the profile). Returns the id. */
export async function addUser(db: PGlite, id: string, email: string): Promise<string> {
  await db.query(
    `insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, '{}'::jsonb)`,
    [id, email],
  );
  return id;
}

/** Run fn as the given Postgres role and JWT subject, then restore superuser. */
export async function as<T>(db: PGlite, role: Role, uid: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role ${role}`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid ?? ""]);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}

export const sha256hex = async (s: string) => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
};
