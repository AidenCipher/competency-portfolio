import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Rate limiting behind a small interface.
 *
 * Production uses a Postgres-backed fixed window (`rate_limit_hit`, migration 5) so limits hold across serverless
 * instances. If the database call fails we fall back to a per-process memory window rather than failing open.
 * Keys are HMAC digests, so no raw IP address or user id is stored.
 */
export interface RateLimiter {
  /** Returns true if the action is allowed, false if the limit is exceeded. */
  allow(key: string, limit: number, windowMs: number): Promise<boolean>;
}

export class MemoryLimiter implements RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();
  async allow(key: string, limit: number, windowMs: number): Promise<boolean> {
    const now = Date.now();
    if (this.hits.size > 5000) {
      for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
    }
    const cur = this.hits.get(key);
    if (!cur || cur.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    cur.count += 1;
    return cur.count <= limit;
  }
}

export class PostgresLimiter implements RateLimiter {
  constructor(private readonly fallback: RateLimiter = new MemoryLimiter()) {}
  async allow(key: string, limit: number, windowMs: number): Promise<boolean> {
    try {
      const { data, error } = await createAdminClient().rpc("rate_limit_hit", {
        p_key: key,
        p_limit: limit,
        p_window_seconds: Math.max(1, Math.ceil(windowMs / 1000)),
      });
      if (error || typeof data !== "boolean") return this.fallback.allow(key, limit, windowMs);
      return data;
    } catch {
      return this.fallback.allow(key, limit, windowMs);
    }
  }
}

const g = globalThis as unknown as { __limiter?: RateLimiter };
export const limiter: RateLimiter = (g.__limiter ??= new PostgresLimiter());

/** Best client IP available. On Vercel `x-forwarded-for` is set by the platform; the first entry is the client. */
export function ipFromHeaders(h: { get(name: string): string | null }): string {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export async function clientIp(): Promise<string> {
  return ipFromHeaders(await headers());
}

/** Opaque, stable key for a scope + subject. HMAC keyed with a server-only secret, so keys reveal no IP or user id. */
export function limiterKey(scope: string, subject: string, secret: string): string {
  return `${scope}:${createHmac("sha256", secret).update(subject).digest("hex").slice(0, 40)}`;
}

function keySecret(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "dev-only-key";
}

export async function rateLimit(scope: string, limit: number, windowMs: number, extra = ""): Promise<boolean> {
  const ip = await clientIp();
  return limiter.allow(limiterKey(scope, `${ip}|${extra}`, keySecret()), limit, windowMs);
}

/** Same as rateLimit but for callers that already have the IP (e.g. proxy.ts reads it from the request). */
export async function rateLimitIp(scope: string, ip: string, limit: number, windowMs: number): Promise<boolean> {
  return limiter.allow(limiterKey(scope, `${ip}|`, keySecret()), limit, windowMs);
}
