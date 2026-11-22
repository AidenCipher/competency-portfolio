import type { EvidenceStrength, Level, NextRecommendation, ValidationState } from "@/lib/scoring";

export interface EvidenceView {
  id: string;
  kind: string;
  filename: string;
  sizeBytes: number;
  hasFile: boolean;
}

export interface ValidationRowView {
  id: string;
  validatorName: string;
  validatorKind: string;
  status: "pending" | "endorsed" | "changes_requested" | "declined";
  comment: string | null;
  expiresAt: string;
}

export interface ExperienceView {
  id: string;
  title: string;
  type: string;
  roleTitle: string;
  durationLabel: string;
  description: string;
  reflection: string;
  isDemo: boolean;
  createdAt: string;
  capabilityIds: string[];
  evidence: EvidenceView[];
  validations: ValidationRowView[];
  validation: ValidationState;
  strength: EvidenceStrength;
}

export interface CapabilityView {
  id: string;
  slug: string;
  name: string;
  statement: string;
  statementTemplate: string;
  statementIsCustom: boolean;
  suggestedExperience: string;
  target: number;
  weight: number;
  score: number;
  level: Level;
  /** Aggregate across the experiences tagged with this capability. */
  strength: { experience: boolean; application: boolean; artefact: boolean; validation: boolean };
  experienceIds: string[];
  /** Other roles this capability matters for, e.g. "HR Business Partner · target 90". */
  relevance: { roleName: string; target: number }[];
}

export interface PortfolioData {
  displayName: string;
  isDemo: boolean;
  roleId: string | null;
  roleName: string | null;
  roles: { id: string; name: string; isMapped: boolean }[];
  capabilities: CapabilityView[];
  experiences: ExperienceView[];
  stats: {
    experiences: number;
    artefacts: number;
    validated: number;
    /** Experiences that are not certificates vs those that are ("actions > certs"). */
    actions: number;
    certs: number;
  };
  /** Decided in lib/scoring.ts: recommend / all targets met / no capability map. */
  recommendation: NextRecommendation<CapabilityView>;
  /** Convenience: the recommended capability, if any. */
  next: CapabilityView | null;
}
