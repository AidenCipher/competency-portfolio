import "server-only";
import { headers } from "next/headers";

/**
 * Rate limiting behind a small interface. Sprint 1 ships an in-memory fixed window,
 * which only holds within ONE server instance (weak on serverless). Sprint 3 swaps in
 * Upstash/Vercel KV behind the same `RateLimiter` interface.
 */
export interface RateLimiter {
  /** Returns true if the action is allowed, false if the limit is exceeded. */
  allow(key: string, limit: number, windowMs: number): Promise<boolean>;
}

class MemoryLimiter implements RateLimiter {
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

const g = globalThis as unknown as { __limiter?: RateLimiter };
export const limiter: RateLimiter = (g.__limiter ??= new MemoryLimiter());

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export async function rateLimit(scope: string, limit: number, windowMs: number, extra = ""): Promise<boolean> {
  const ip = await clientIp();
  return limiter.allow(`${scope}:${ip}:${extra}`, limit, windowMs);
}
