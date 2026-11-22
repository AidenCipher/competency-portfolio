import { describe, expect, it } from "vitest";
import {
  aggregateValidation,
  artefactFactor,
  capabilityScore,
  contribution,
  evidenceStrength,
  gapToTarget,
  levelFor,
  nextCapability,
  reflectionFactor,
  scoreCapabilities,
  validationFactor,
  wordCount,
} from "@/lib/scoring";

const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");

describe("factors", () => {
  it("counts words by whitespace", () => {
    expect(wordCount("")).toBe(0);
    expect(wordCount("   ")).toBe(0);
    expect(wordCount(null)).toBe(0);
    expect(wordCount("a  b\n c\td")).toBe(4);
  });

  it("artefact factor runs 0.6..1.0 and saturates at 3", () => {
    expect(artefactFactor(0)).toBeCloseTo(0.6);
    expect(artefactFactor(1)).toBeCloseTo(0.6 + 0.4 / 3);
    expect(artefactFactor(3)).toBeCloseTo(1.0);
    expect(artefactFactor(10)).toBeCloseTo(1.0);
    expect(artefactFactor(-2)).toBeCloseTo(0.6);
  });

  it("reflection factor flips at exactly 40 words", () => {
    expect(reflectionFactor(words(39))).toBe(0.8);
    expect(reflectionFactor(words(40))).toBe(1.0);
    expect(reflectionFactor(undefined)).toBe(0.8);
  });

  it("validation factors match the spec table", () => {
    expect(validationFactor("validated")).toBe(1.0);
    expect(validationFactor("pending")).toBe(0.6);
    expect(validationFactor("self_declared")).toBe(0.4);
    expect(validationFactor("changes_requested")).toBe(0.5);
    expect(validationFactor("declined")).toBe(0.3);
  });
});

describe("contribution k(e)", () => {
  it("is 0.25 for the best possible experience", () => {
    expect(contribution({ artefacts: 3, reflection: words(40), validation: "validated" })).toBeCloseTo(0.25);
  });

  it("validated beats self-declared, all else equal", () => {
    const base = { artefacts: 1, reflection: words(50) };
    expect(contribution({ ...base, validation: "validated" })).toBeGreaterThan(
      contribution({ ...base, validation: "self_declared" }),
    );
  });

  it("multiplies the factors", () => {
    const k = contribution({ artefacts: 0, reflection: "short", validation: "self_declared" });
    expect(k).toBeCloseTo(0.25 * 0.6 * 0.8 * 0.4);
  });
});

describe("capabilityScore", () => {
  it("is 0 with no experiences", () => {
    expect(capabilityScore([])).toBe(0);
  });

  it("shows diminishing returns", () => {
    const k = 0.25;
    const one = capabilityScore([k]);
    const two = capabilityScore([k, k]);
    const three = capabilityScore([k, k, k]);
    expect(two - one).toBeGreaterThan(three - two);
    expect(one).toBe(25);
    expect(two).toBe(44);
  });

  it("never reaches 100", () => {
    expect(capabilityScore(Array(30).fill(0.25))).toBe(99);
  });

  it("is order-independent", () => {
    expect(capabilityScore([0.1, 0.2, 0.25])).toBe(capabilityScore([0.25, 0.1, 0.2]));
  });

  it("clamps out-of-range contributions", () => {
    expect(capabilityScore([5])).toBe(99);
    expect(capabilityScore([-1])).toBe(0);
  });
});

describe("levelFor thresholds 70 / 55", () => {
  it.each([
    [100, "Strong"],
    [70, "Strong"],
    [69, "Proficient"],
    [55, "Proficient"],
    [54, "Developing"],
    [0, "Developing"],
  ])("score %i is %s", (score, level) => {
    expect(levelFor(score)).toBe(level);
  });
});

describe("aggregateValidation", () => {
  it("no rows means self-declared", () => {
    expect(aggregateValidation([])).toBe("self_declared");
  });
  it("maps endorsed to validated", () => {
    expect(aggregateValidation(["endorsed"])).toBe("validated");
  });
  it("the most favourable row wins", () => {
    expect(aggregateValidation(["pending", "endorsed", "declined"])).toBe("validated");
    expect(aggregateValidation(["declined", "pending"])).toBe("pending");
    expect(aggregateValidation(["declined", "changes_requested"])).toBe("changes_requested");
  });
});

describe("scoreCapabilities", () => {
  it("combines experiences per capability and ignores duplicates in tags", () => {
    const e = { artefacts: 3, reflection: words(40), validation: "validated" as const };
    const out = scoreCapabilities([
      { ...e, capabilityIds: ["comm", "comm", "lead"] },
      { ...e, capabilityIds: ["comm"] },
    ]);
    expect(out.comm).toBe(44);
    expect(out.lead).toBe(25);
    expect(out.data).toBeUndefined();
  });

  it("a validated experience scores higher than the same one self-declared", () => {
    const base = { artefacts: 1, reflection: words(45), capabilityIds: ["c"] };
    const v = scoreCapabilities([{ ...base, validation: "validated" }]).c;
    const s = scoreCapabilities([{ ...base, validation: "self_declared" }]).c;
    expect(v).toBeGreaterThan(s);
  });
});

describe("evidenceStrength", () => {
  const full = {
    title: "Capstone",
    roleTitle: "Lead",
    durationLabel: "6 weeks",
    description: "Did things",
    reflection: words(40),
    artefacts: 2,
    validated: true,
  };

  it("lights all five dots when everything is present", () => {
    const r = evidenceStrength(full);
    expect(r).toMatchObject({ experience: true, application: true, artefact: true, validation: true, strong: true, dots: 5 });
  });

  it("is empty for an empty experience", () => {
    const r = evidenceStrength({ title: "", roleTitle: "", durationLabel: "", description: "", reflection: "", artefacts: 0, validated: false });
    expect(r.dots).toBe(0);
  });

  it("experience dot needs title, role, duration and description", () => {
    expect(evidenceStrength({ ...full, roleTitle: " " }).experience).toBe(false);
  });

  it("fifth dot needs two artefacts AND validation", () => {
    expect(evidenceStrength({ ...full, artefacts: 1 }).strong).toBe(false);
    expect(evidenceStrength({ ...full, validated: false }).strong).toBe(false);
    expect(evidenceStrength({ ...full, validated: false }).dots).toBe(3);
  });

  it("application dot flips at 40 words", () => {
    expect(evidenceStrength({ ...full, reflection: words(39) }).application).toBe(false);
  });
});

describe("gapToTarget", () => {
  it("is never negative", () => {
    expect(gapToTarget(80, 70)).toBe(0);
    expect(gapToTarget(40, 70)).toBe(30);
  });
});

describe("nextCapability", () => {
  const c = (id: string, score: number, target: number, weight = 1) => ({ id, score, target, weight });
  it("returns null when every target is met", () => {
    expect(nextCapability([c("a", 80, 70), c("b", 90, 90)])).toBeNull();
    expect(nextCapability([])).toBeNull();
  });
  it("picks the largest weighted gap", () => {
    expect(nextCapability([c("a", 50, 90), c("b", 10, 40), c("c", 70, 75)])?.id).toBe("a");
    expect(nextCapability([c("a", 50, 90, 1), c("b", 60, 90, 2)])?.id).toBe("b");
  });
  it("breaks ties on raw gap, then id", () => {
    expect(nextCapability([c("a", 50, 90, 1), c("b", 70, 90, 2)])?.id).toBe("a"); // 40 vs 40 weighted; larger raw gap wins
    expect(nextCapability([c("b", 0, 50), c("a", 0, 50)])?.id).toBe("a");
  });
});
