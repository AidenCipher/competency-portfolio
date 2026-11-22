import { describe, expect, it } from "vitest";
import { generateToken, hashesEqual, hashToken, isWellFormedToken, validationExpiry } from "@/lib/tokens";

describe("tokens", () => {
  it("generates unique, well-formed 43-char base64url tokens", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(a).toHaveLength(43);
    expect(isWellFormedToken(a)).toBe(true);
  });
  it("rejects malformed tokens", () => {
    for (const t of ["", "short", "a".repeat(42), "a".repeat(44), "a".repeat(42) + "!", "../" + "a".repeat(40)]) {
      expect(isWellFormedToken(t)).toBe(false);
    }
  });
  it("hashes to 64 hex chars, deterministically, and the hash is not the token", () => {
    const t = generateToken();
    const h = hashToken(t);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(t)).toBe(h);
    expect(h).not.toContain(t);
  });
  it("matches the SHA-256 test vector", () => {
    expect(hashToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
  it("compares hashes in constant time and handles length mismatch", () => {
    const h = hashToken("x");
    expect(hashesEqual(h, h)).toBe(true);
    expect(hashesEqual(h, hashToken("y"))).toBe(false);
    expect(hashesEqual(h, "short")).toBe(false);
  });
  it("expires in 14 days", () => {
    const now = new Date("2026-11-22T00:00:00Z");
    expect(validationExpiry(now).toISOString()).toBe("2026-12-06T00:00:00.000Z");
  });
});
