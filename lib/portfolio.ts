import {
  aggregateValidation,
  evidenceStrength,
  levelFor,
  recommendNext,
  scoreCapabilities,
} from "@/lib/scoring";
import type { CapabilityView, ExperienceView, PortfolioData } from "@/lib/types";

/** Plain rows as read from the database (by the signed-in user's client, or by the demo function). */
export interface PortfolioRows {
  profile: { display_name: string; is_demo: boolean; target_role_id: string | null } | null;
  roles: { id: string; name: string; is_mapped: boolean }[];
  roleCaps: {
    role_id: string;
    target: number;
    weight: number | string;
    capabilities: { id: string; slug: string; name: string; statement_template: string; suggested_experience: string };
  }[];
  experiences: {
    id: string; title: string; type: string; role_title: string; duration_label: string; description: string;
    reflection: string; is_demo: boolean; created_at: string;
    experience_capabilities: { capability_id: string }[];
    /** `has_file` rather than the storage path, so callers never need to hand paths to this layer. */
    evidence: { id: string; kind: string; filename: string; size_bytes: number; has_file: boolean }[];
    validations: {
      id: string; validator_name: string; validator_kind: string;
      status: "pending" | "endorsed" | "changes_requested" | "declined"; comment: string | null; expires_at: string;
    }[];
  }[];
  statements: { capability_id: string; text: string }[];
}

/**
 * Pure: turns rows into everything the Dashboard, Portfolio and Next screens show. All scoring and ranking is
 * delegated to lib/scoring.ts; nothing here computes a score. A role without a capability map counts as "no goal".
 */
export function buildPortfolio(rows: PortfolioRows): PortfolioData {
  const roles = rows.roles.map((r) => ({ id: r.id, name: r.name, isMapped: !!r.is_mapped }));
  const chosen = roles.find((r) => r.id === rows.profile?.target_role_id);
  const role = chosen?.isMapped ? chosen : undefined;
  const roleId = role?.id ?? null;
  const roleName = role?.name ?? null;
  const rc = rows.roleCaps.filter((r) => r.capabilities);
  const customStatements = new Map(rows.statements.map((s) => [s.capability_id, s.text]));

  const experiences: ExperienceView[] = rows.experiences.map((e) => {
    const validation = aggregateValidation(e.validations.map((v) => v.status));
    return {
      id: e.id,
      title: e.title,
      type: e.type,
      roleTitle: e.role_title,
      durationLabel: e.duration_label,
      description: e.description,
      reflection: e.reflection,
      isDemo: e.is_demo,
      createdAt: e.created_at,
      capabilityIds: e.experience_capabilities.map((c) => c.capability_id),
      evidence: e.evidence.map((v) => ({ id: v.id, kind: v.kind, filename: v.filename, sizeBytes: v.size_bytes, hasFile: v.has_file })),
      validations: e.validations.map((v) => ({
        id: v.id, validatorName: v.validator_name, validatorKind: v.validator_kind,
        status: v.status, comment: v.comment, expiresAt: v.expires_at,
      })),
      validation,
      strength: evidenceStrength({
        title: e.title,
        roleTitle: e.role_title,
        durationLabel: e.duration_label,
        description: e.description,
        reflection: e.reflection,
        artefacts: e.evidence.length,
        validated: validation === "validated",
      }),
    };
  });

  const scores = scoreCapabilities(
    experiences.map((e) => ({
      capabilityIds: e.capabilityIds,
      artefacts: e.evidence.length,
      reflection: e.reflection,
      validation: e.validation,
    })),
  );

  const relevanceByCap = new Map<string, { roleName: string; target: number }[]>();
  for (const r of rc) {
    const name = roles.find((x) => x.id === r.role_id)?.name;
    if (!name) continue;
    const list = relevanceByCap.get(r.capabilities.id) ?? [];
    list.push({ roleName: name, target: r.target });
    relevanceByCap.set(r.capabilities.id, list);
  }

  const capabilities: CapabilityView[] = rc
    .filter((r) => r.role_id === roleId)
    .map((r) => {
      const c = r.capabilities;
      const score = scores[c.id] ?? 0;
      const tagged = experiences.filter((e) => e.capabilityIds.includes(c.id));
      const custom = customStatements.get(c.id);
      return {
        id: c.id,
        slug: c.slug,
        name: c.name,
        statement: custom ?? c.statement_template,
        statementTemplate: c.statement_template,
        statementIsCustom: !!custom,
        suggestedExperience: c.suggested_experience,
        target: r.target,
        weight: Number(r.weight),
        score,
        level: levelFor(score),
        strength: {
          experience: tagged.some((e) => e.strength.experience),
          application: tagged.some((e) => e.strength.application),
          artefact: tagged.some((e) => e.strength.artefact),
          validation: tagged.some((e) => e.strength.validation),
        },
        experienceIds: tagged.map((e) => e.id),
        relevance: relevanceByCap.get(c.id) ?? [],
      };
    })
    .sort((a, b) => b.target - a.target);

  const certs = experiences.filter((e) => e.type === "certification").length;
  const recommendation = recommendNext(capabilities, roleName);
  return {
    displayName: rows.profile?.display_name ?? "Learner",
    isDemo: !!rows.profile?.is_demo,
    roleId,
    roleName,
    roles,
    capabilities,
    experiences,
    stats: {
      experiences: experiences.length,
      artefacts: experiences.reduce((n, e) => n + e.evidence.length, 0),
      validated: experiences.filter((e) => e.validation === "validated").length,
      actions: experiences.length - certs,
      certs,
    },
    recommendation,
    next: recommendation.status === "recommend" ? recommendation.top.item : null,
  };
}
