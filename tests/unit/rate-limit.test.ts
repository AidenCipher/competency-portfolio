import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: async () => ({ data: null, error: { message: "db down" } }) }) }));

import { ipFromHeaders, limiterKey, MemoryLimiter, PostgresLimiter } from "@/lib/rate-limit";

describe("rate-limit helpers", () => {
  it("takes the first x-forwarded-for entry, then x-real-ip, then 'unknown'", () => {
    expect(ipFromHeaders(new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }))).toBe("203.0.113.9");
    expect(ipFromHeaders(new Headers({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
    expect(ipFromHeaders(new Headers())).toBe("unknown");
  });

  it("keys are stable, scoped and reveal neither the IP nor the user id", () => {
    const a = limiterKey("login", "203.0.113.9|", "secret");
    expect(a).toBe(limiterKey("login", "203.0.113.9|", "secret"));
    expect(a).not.toBe(limiterKey("upload", "203.0.113.9|", "secret"));
    expect(a).not.toBe(limiterKey("login", "203.0.113.9|", "other-secret"));
    expect(a).not.toContain("203.0.113.9");
    expect(a.startsWith("login:")).toBe(true);
  });

  it("the memory limiter enforces a window", async () => {
    const m = new MemoryLimiter();
    const r = [await m.allow("k", 2, 1000), await m.allow("k", 2, 1000), await m.allow("k", 2, 1000)];
    expect(r).toEqual([true, true, false]);
  });

  it("falls back to the memory limiter (not open) when the database errors", async () => {
    const l = new PostgresLimiter();
    const r = [await l.allow("fb", 2, 60_000), await l.allow("fb", 2, 60_000), await l.allow("fb", 2, 60_000)];
    expect(r).toEqual([true, true, false]);
  });
});
