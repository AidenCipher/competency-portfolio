import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildPortfolio, type PortfolioRows } from "@/lib/portfolio";
import type { PortfolioData } from "@/lib/types";

/**
 * Everything the signed-in learner's screens need. Reads go through the user's own client, so RLS applies, and
 * every owned table is also filtered by `user_id` explicitly (defence in depth: this must never return another
 * user's rows even if it were ever handed a more privileged client).
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
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase.from("capability_statements").select("capability_id, text").eq("user_id", userId),
  ]);

  type RawExp = Omit<PortfolioRows["experiences"][number], "evidence"> & {
    evidence: { id: string; kind: string; filename: string; size_bytes: number; storage_path: string | null }[];
  };
  const experiences = ((expRes.data ?? []) as unknown as RawExp[]).map((e) => ({
    ...e,
    evidence: e.evidence.map(({ storage_path, ...rest }) => ({ ...rest, has_file: !!storage_path })),
  }));

  return buildPortfolio({
    profile: (profileRes.data as PortfolioRows["profile"]) ?? null,
    roles: (rolesRes.data ?? []) as PortfolioRows["roles"],
    roleCaps: (rcRes.data ?? []) as unknown as PortfolioRows["roleCaps"],
    experiences,
    statements: (stmtRes.data ?? []) as PortfolioRows["statements"],
  });
}
