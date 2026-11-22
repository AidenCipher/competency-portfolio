import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/safe-redirect";

describe("safeNext (open-redirect guard)", () => {
  it("allows same-site paths", () => {
    expect(safeNext("/app")).toBe("/app");
    expect(safeNext("/app/experiences/new?x=1")).toBe("/app/experiences/new?x=1");
  });
  it.each(["https://evil.test", "//evil.test", "/\\evil.test", "javascript:alert(1)", "evil", "/a\nb", ""])(
    "rejects %j",
    (v) => {
      expect(safeNext(v)).toBe("/app");
    },
  );
  it("falls back for null/undefined", () => {
    expect(safeNext(null)).toBe("/app");
    expect(safeNext(undefined, "/x")).toBe("/x");
  });
});
