/**
 * Capability scoring. Pure functions only: no I/O, no clock, no randomness.
 * The formulas are SPEC.md section 4 verbatim. The constants are team
 * assumptions to validate with faculty, not research results. The UI must
 * never recompute scores; it calls these functions (or reads their output).
 */

export type ValidationState =
  | "validated"
  | "pending"
  | "self_declared"
  | "changes_requested"
  | "declined";

export type Level = "Strong" | "Proficient" | "Developing";

export const BASE = 0.25;
export const REFLECTION_WORDS = 40;
export const STRONG_MIN = 70;
export const PROFICIENT_MIN = 55;

export const VALIDATION_FACTOR: Readonly<Record<ValidationState, number>> = {
  validated: 1.0,
  pending: 0.6,
  self_declared: 0.4,
  changes_requested: 0.5,
  declined: 0.3,
};

/** Whitespace-delimited word count. */
export function wordCount(text: string | null | undefined): number {
  if (!text) return 0;
  const t = text.trim();
  return t === "" ? 0 : t.split(/\s+/).length;
}

/** 0.6 .. 1.0, saturating at 3 artefacts. */
export function artefactFactor(artefacts: number): number {
  const n = Math.max(0, Math.floor(artefacts));
  return 0.6 + (0.4 * Math.min(n, 3)) / 3;
}

export function reflectionFactor(reflection: string | null | undefined): number {
  return wordCount(reflection) >= REFLECTION_WORDS ? 1.0 : 0.8;
}

export function validationFactor(state: ValidationState): number {
  return VALIDATION_FACTOR[state];
}

export interface ContributionInput {
  artefacts: number;
  reflection: string | null | undefined;
  validation: ValidationState;
}

/** k(e): one experience's contribution to one tagged capability (0..0.25). */
export function contribution(e: ContributionInput): number {
  return (
    BASE *
    artefactFactor(e.artefacts) *
    reflectionFactor(e.reflection) *
    validationFactor(e.validation)
  );
}

/** Hard ceiling: SPEC says the score is "capped < 100"; plain rounding alone can hit 100. */
export const MAX_SCORE = 99;

/** score(c) = round(100 * (1 - prod(1 - k))), capped at MAX_SCORE. Diminishing returns. */
export function capabilityScore(contributions: readonly number[]): number {
  const remaining = contributions.reduce((acc, k) => acc * (1 - clamp01(k)), 1);
  return Math.min(MAX_SCORE, Math.round(100 * (1 - remaining)));
}

export function levelFor(score: number): Level {
  if (score >= STRONG_MIN) return "Strong";
  if (score >= PROFICIENT_MIN) return "Proficient";
  return "Developing";
}

/**
 * Map stored validation rows for one experience to a single state.
 * No rows = self-declared. With several rows the most favourable status wins
 * (highest factor), so one endorsement is not diluted by a pending request.
 * Stored status `endorsed` is exposed here as `validated`.
 */
export function aggregateValidation(
  statuses: readonly ("pending" | "endorsed" | "changes_requested" | "declined")[],
): ValidationState {
  if (statuses.length === 0) return "self_declared";
  const states: ValidationState[] = statuses.map((s) => (s === "endorsed" ? "validated" : s));
  return states.reduce((best, s) =>
    VALIDATION_FACTOR[s] > VALIDATION_FACTOR[best] ? s : best,
  );
}

export interface ScoredExperience extends ContributionInput {
  capabilityIds: readonly string[];
}

/** Score every capability that at least one experience is tagged with. */
export function scoreCapabilities(
  experiences: readonly ScoredExperience[],
): Record<string, number> {
  const byCap = new Map<string, number[]>();
  for (const e of experiences) {
    const k = contribution(e);
    for (const id of new Set(e.capabilityIds)) {
      const list = byCap.get(id);
      if (list) list.push(k);
      else byCap.set(id, [k]);
    }
  }
  const out: Record<string, number> = {};
  for (const [id, ks] of byCap) out[id] = capabilityScore(ks);
  return out;
}

export interface EvidenceStrengthInput {
  title: string | null | undefined;
  roleTitle: string | null | undefined;
  durationLabel: string | null | undefined;
  description: string | null | undefined;
  reflection: string | null | undefined;
  artefacts: number;
  validated: boolean;
}

export interface EvidenceStrength {
  experience: boolean;
  application: boolean;
  artefact: boolean;
  validation: boolean;
  /** Fifth dot: at least 2 artefacts AND validated. */
  strong: boolean;
  /** Number of lit dots, 0..5. */
  dots: number;
}

const present = (s: string | null | undefined) => !!s && s.trim().length > 0;

export function evidenceStrength(i: EvidenceStrengthInput): EvidenceStrength {
  const experience =
    present(i.title) && present(i.roleTitle) && present(i.durationLabel) && present(i.description);
  const application = wordCount(i.reflection) >= REFLECTION_WORDS;
  const artefact = i.artefacts >= 1;
  const validation = i.validated;
  const strong = i.artefacts >= 2 && i.validated;
  const dots = [experience, application, artefact, validation, strong].filter(Boolean).length;
  return { experience, application, artefact, validation, strong, dots };
}

/** Points still missing to reach a target (never negative). */
export function gapToTarget(score: number, target: number): number {
  return Math.max(0, target - score);
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
