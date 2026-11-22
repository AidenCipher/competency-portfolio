import { describe, expect, it } from "vitest";
import { rankCapabilities, recommendNext, scoreCapabilities, type RankableCapability } from "@/lib/scoring";

type Cap = RankableCapability & { name: string };
const cap = (id: string, name: string, score: number, target: number, weight = 1): Cap => ({ id, name, score, target, weight });

// The real HRBP map from supabase/migrations/20261122000003_reference_data.sql.
const HRBP = [
  { id: "communication", name: "Communication", target: 90, weight: 1.1 },
  { id: "team-leadership", name: "Team Leadership", target: 80, weight: 1.0 },
  { id: "data-analysis", name: "Data Analysis", target: 75, weight: 0.9 },
  { id: "stakeholder-management", name: "Stakeholder Management", target: 85, weight: 1.2 },
  { id: "conflict-management", name: "Conflict Management", target: 70, weight: 1.0 },
  { id: "problem-solving", name: "Problem Solving", target: 75, weight: 1.0 },
];
const withScores = (experiences: Parameters<typeof scoreCapabilities>[0], weights = HRBP): Cap[] => {
  const scores = scoreCapabilities(experiences);
  return weights.map((c) => ({ ...c, score: scores[c.id] ?? 0 }));
};
const exp = (capabilityIds: string[], validation: "validated" | "self_declared" = "validated") => ({
  capabilityIds, artefacts: 1, reflection: Array.from({ length: 45 }, () => "w").join(" "), validation,
});

describe("rankCapabilities", () => {
  it("sorts by weighted gap and drops met targets", () => {
    const r = rankCapabilities([cap("a", "A", 50, 90), cap("b", "B", 10, 40), cap("c", "C", 90, 90), cap("d", "D", 95, 90)]);
    expect(r.map((x) => x.item.id)).toEqual(["a", "b"]);
    expect(r[0]).toMatchObject({ gap: 40, weightedGap: 40 });
  });

  it("weights can overturn the raw-gap order", () => {
    const r = rankCapabilities([cap("a", "A", 50, 90, 1), cap("b", "B", 60, 90, 2)]);
    expect(r[0].item.id).toBe("b");
  });

  it("ties break on the larger raw gap, then on id", () => {
    expect(rankCapabilities([cap("a", "A", 50, 90, 1), cap("b", "B", 70, 90, 2)])[0].item.id).toBe("a"); // 40 vs 40 weighted
    expect(rankCapabilities([cap("b", "B", 0, 50), cap("a", "A", 0, 50)]).map((x) => x.item.id)).toEqual(["a", "b"]);
  });

  it("does not mutate its input", () => {
    const input = [cap("a", "A", 0, 50), cap("b", "B", 0, 60)];
    rankCapabilities(input);
    expect(input.map((c) => c.id)).toEqual(["a", "b"]);
  });
});

describe("recommendNext", () => {
  it("distinguishes no map from all targets met", () => {
    expect(recommendNext([], "Someone")).toEqual({ status: "no_map" });
    expect(recommendNext([cap("a", "A", 80, 70), cap("b", "B", 90, 90)], "HRBP")).toEqual({ status: "all_met", met: 2 });
  });

  it("recommends the top ranked capability with a reason and the runners-up", () => {
    const r = recommendNext([cap("a", "Alpha", 20, 90), cap("b", "Beta", 10, 40)], "HRBP");
    expect(r.status).toBe("recommend");
    if (r.status !== "recommend") return;
    expect(r.top.item.id).toBe("a");
    expect(r.others.map((o) => o.item.id)).toEqual(["b"]);
    expect(r.why[0]).toContain("Alpha");
    expect(r.why[0]).toContain("70");
    expect(r.why.some((w) => w.includes("Beta"))).toBe(true);
  });

  it("explains when role weight outweighs a larger raw gap", () => {
    const r = recommendNext([cap("a", "Alpha", 0, 90, 1), cap("b", "Beta", 20, 90, 1.5)], "HRBP");
    if (r.status !== "recommend") throw new Error("expected recommend");
    expect(r.top.item.id).toBe("b"); // 70*1.5 = 105 > 90
    expect(r.why.join(" ")).toMatch(/larger raw gap/);
  });

  it("says so when there is no evidence at all for the top capability", () => {
    const r = recommendNext([cap("a", "Alpha", 0, 90)], "HRBP");
    if (r.status !== "recommend") throw new Error("expected recommend");
    expect(r.why[0]).toMatch(/no evidence for Alpha/);
  });
});

describe("Sprint 2 acceptance: the HRBP recommendation follows the evidence", () => {
  it("a learner with no experiences is recommended Stakeholder Management", () => {
    const r = recommendNext(withScores([]), "HR Business Partner");
    if (r.status !== "recommend") throw new Error("expected recommend");
    expect(r.top.item.id).toBe("stakeholder-management");
    // 85 * 1.2 = 102 beats the best any other capability can score (Communication 90 * 1.1 = 99).
    expect(r.top.weightedGap).toBeCloseTo(102);
  });

  it("a learner with evidence everywhere except Stakeholder Management is still recommended it", () => {
    const others = HRBP.filter((c) => c.id !== "stakeholder-management").map((c) => exp([c.id]));
    const r = recommendNext(withScores(others), "HR Business Partner");
    if (r.status !== "recommend") throw new Error("expected recommend");
    expect(r.top.item.id).toBe("stakeholder-management");
  });

  it("after validated Stakeholder evidence is added, the recommendation changes", () => {
    const before = recommendNext(withScores([]), "HR Business Partner");
    const after = recommendNext(withScores([exp(["stakeholder-management"])]), "HR Business Partner");
    if (before.status !== "recommend" || after.status !== "recommend") throw new Error("expected recommend");
    expect(before.top.item.id).toBe("stakeholder-management");
    expect(after.top.item.id).not.toBe("stakeholder-management");
    expect(after.top.item.id).toBe("communication");
  });

  it("depends on the weights: with equal weights an empty learner gets Communication", () => {
    const equal = HRBP.map((c) => ({ ...c, weight: 1 }));
    const r = recommendNext(withScores([], equal), "HR Business Partner");
    if (r.status !== "recommend") throw new Error("expected recommend");
    expect(r.top.item.id).toBe("communication");
  });
});
