import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  aggregateValidation,
  evidenceStrength,
  levelFor,
  nextCapability,
  scoreCapabilities,
} from "@/lib/scoring";
import type { CapabilityView, ExperienceView, PortfolioData } from "@/lib/types";

interface RoleCapRow {
  role_id: string;
  target: number;
  weight: number;
  capabilities: { id: string; slug: string; name: string; statement_template: string; suggested_experience: string };
}

/**
 * Everything the Dashboard and Portfolio need, read through the signed-in user's client
 * (so RLS applies) and scored by lib/scoring.ts. No score is computed anywhere else.
 */
export async function loadPortfolio(supabase: SupabaseClient, userId: string): Promise<PortfolioData> {
  const [profileRes, rolesRes, rcRes, expRes, stmtRes] = await Promise.all([
    supabase.from("profiles").select("display_name, is_demo, target_role_id").eq("id", userId).single(),
    supabase.from("career_roles").select("id, name, is_mapped").order("name"),
    supabase
      .from("role_capabilities")
      .select("role_id, target, weight, capabilities(id, slug, name, statement_template, suggested_experience)"),
    supabase
      .from("experiences")
      .select(
        "id, title, type, role_title, duration_label, description, reflection, is_demo, created_at, " +
          "experience_capabilities(capability_id), " +
          "evidence(id, kind, filename, size_bytes, storage_path), " +
          "validations(id, validator_name, validator_kind, status, comment, expires_at)",
      )
      .order("created_at", { ascending: false }),
    supabase.from("capability_statements").select("capability_id, text"),
  ]);

  const profile = profileRes.data;
  const roles = (rolesRes.data ?? []).map((r) => ({ id: r.id as string, name: r.name as string, isMapped: !!r.is_mapped }));
  const roleId = (profile?.target_role_id as string | null) ?? null;
  const roleName = roles.find((r) => r.id === roleId)?.name ?? null;
  const rc = ((rcRes.data ?? []) as unknown as RoleCapRow[]).filter((r) => r.capabilities);
  const customStatements = new Map<string, string>(
    (stmtRes.data ?? []).map((s) => [s.capability_id as string, s.text as string]),
  );

  type ExpRow = {
    id: string; title: string; type: string; role_title: string; duration_label: string; description: string;
    reflection: string; is_demo: boolean; created_at: string;
    experience_capabilities: { capability_id: string }[];
    evidence: { id: string; kind: string; filename: string; size_bytes: number; storage_path: string | null }[];
    validations: { id: string; validator_name: string; validator_kind: string; status: "pending" | "endorsed" | "changes_requested" | "declined"; comment: string | null; expires_at: string }[];
  };

  const experiences: ExperienceView[] = ((expRes.data ?? []) as unknown as ExpRow[]).map((e) => {
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
      evidence: e.evidence.map((v) => ({ id: v.id, kind: v.kind, filename: v.filename, sizeBytes: v.size_bytes, hasFile: !!v.storage_path })),
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
  return {
    displayName: (profile?.display_name as string) ?? "Learner",
    isDemo: !!profile?.is_demo,
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
    next: nextCapability(capabilities),
  };
}
