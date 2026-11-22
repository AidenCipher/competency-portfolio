import { describe, expect, it } from "vitest";
import { STATEMENT_MAX, statementSchema } from "@/lib/statement-schema";

const id = "c0000000-0000-4000-8000-000000000001";

describe("statementSchema", () => {
  it("trims and collapses whitespace into one paragraph", () => {
    const r = statementSchema.parse({ capabilityId: id, text: "  I can   lead\n\na team.  " });
    expect(r.text).toBe("I can lead a team.");
  });
  it("rejects empty, whitespace-only and over-long statements", () => {
    expect(statementSchema.safeParse({ capabilityId: id, text: "   " }).success).toBe(false);
    expect(statementSchema.safeParse({ capabilityId: id, text: "x".repeat(STATEMENT_MAX + 1) }).success).toBe(false);
    expect(statementSchema.safeParse({ capabilityId: id, text: "x".repeat(STATEMENT_MAX) }).success).toBe(true);
  });
  it("rejects a malformed capability id", () => {
    expect(statementSchema.safeParse({ capabilityId: "nope", text: "I can." }).success).toBe(false);
  });
  it("keeps markup as inert text (React escapes it on render)", () => {
    expect(statementSchema.parse({ capabilityId: id, text: "<img src=x onerror=alert(1)>" }).text).toContain("<img");
  });
});
