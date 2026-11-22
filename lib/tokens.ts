import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** 32 random bytes, base64url (43 chars). The raw token only ever exists in the emailed/copied link. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export function isWellFormedToken(raw: string): boolean {
  return TOKEN_RE.test(raw);
}

/** SHA-256 hex. Only this is stored. */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

/** Constant-time comparison of two hex hashes. */
export function hashesEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export const VALIDATION_TTL_DAYS = 14;
export function validationExpiry(now = new Date()): Date {
  return new Date(now.getTime() + VALIDATION_TTL_DAYS * 24 * 60 * 60 * 1000);
}
