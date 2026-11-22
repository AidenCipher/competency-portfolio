import { describe, expect, it } from "vitest";
import { buildPortfolio, type PortfolioRows } from "@/lib/portfolio";

const cap = (id: string, name: string) => ({ id, slug: id, name, statement_template: `template ${name}`, suggested_experience: `do ${name}` });
const base = (over: Partial<PortfolioRows> = {}): PortfolioRows => ({
  profile: { display_name: "Pat", is_demo: false, target_role_id: "r1" },
  roles: [{ id: "r1", name: "Mapped", is_mapped: true }, { id: "r2", name: "Unmapped", is_mapped: false }],
  roleCaps: [
    { role_id: "r1", target: 80, weight: "1.2", capabilities: cap("c1", "Alpha") },
    { role_id: "r1", target: 60, weight: 1, capabilities: cap("c2", "Beta") },
  ],
  experiences: [],
  statements: [],
  ...over,
});

describe("buildPortfolio", () => {
  it("scores nothing itself: no experiences means score 0 and a recommendation from lib/scoring", () => {
    const d = buildPortfolio(base());
    expect(d.capabilities.map((c) => [c.name, c.score])).toEqual([["Alpha", 0], ["Beta", 0]]);
    expect(d.recommendation.status).toBe("recommend");
    expect(d.next?.name).toBe("Alpha"); // 80 * 1.2 = 96 beats 60
    expect(d.capabilities[0].weight).toBe(1.2); // numeric strings from Postgres are coerced
  });

  it("treats an unmapped chosen role as no goal, never as 'all targets met'", () => {
    const d = buildPortfolio(base({ profile: { display_name: "Pat", is_demo: false, target_role_id: "r2" } }));
    expect(d.roleId).toBeNull();
    expect(d.capabilities).toEqual([]);
    expect(d.next).toBeNull();
  });

  it("a role with no map reports no_map, distinct from all_met", () => {
    const d = buildPortfolio(base({ roleCaps: [] }));
    expect(d.recommendation).toEqual({ status: "no_map" });
  });

  it("uses the learner's own statement when present and keeps the template for reset", () => {
    const d = buildPortfolio(base({ statements: [{ capability_id: "c1", text: "My words" }] }));
    const alpha = d.capabilities.find((c) => c.id === "c1")!;
    expect(alpha).toMatchObject({ statement: "My words", statementIsCustom: true, statementTemplate: "template Alpha" });
    expect(d.capabilities.find((c) => c.id === "c2")).toMatchObject({ statement: "template Beta", statementIsCustom: false });
  });
});
