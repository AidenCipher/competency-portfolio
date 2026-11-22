import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashesEqual, hashToken, isWellFormedToken } from "@/lib/tokens";

export interface ValidationView {
  validationId: string;
  validatorName: string;
  validatorKind: string;
  learnerName: string;
  isDemo: boolean;
  experience: {
    title: string;
    type: string;
    role_title: string;
    duration_label: string;
    description: string;
    reflection: string;
  };
  capabilities: string[];
  evidence: { id: string; kind: string; filename: string; url: string | null }[];
}

interface RawContext {
  validation_id: string;
  token_hash: string;
  validator_name: string;
  validator_kind: string;
  learner_name: string;
  is_demo: boolean;
  experience: ValidationView["experience"];
  capabilities: string[];
  evidence: { id: string; kind: string; filename: string; storage_path: string | null }[];
}

export const SIGNED_URL_SECONDS = 300; // 5 minutes

/**
 * Resolve a raw token to what the validator may see, or null.
 * `null` is deliberately the ONLY failure signal: malformed, unknown, used, expired and
 * database errors are indistinguishable to the caller (and so to the visitor).
 */
export async function loadValidation(rawToken: string): Promise<ValidationView | null> {
  if (!isWellFormedToken(rawToken)) return null;
  const hash = hashToken(rawToken);
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("validation_context", { p_token_hash: hash });
  if (error || !data) return null;
  const ctx = data as RawContext;
  // Belt and braces: confirm the returned hash matches in constant time.
  if (!hashesEqual(ctx.token_hash, hash)) return null;

  const evidence = await Promise.all(
    ctx.evidence.map(async (e) => {
      let url: string | null = null;
      if (e.storage_path) {
        const signed = await admin.storage
          .from("evidence")
          .createSignedUrl(e.storage_path, SIGNED_URL_SECONDS, { download: e.filename });
        url = signed.data?.signedUrl ?? null;
      }
      return { id: e.id, kind: e.kind, filename: e.filename, url };
    }),
  );

  return {
    validationId: ctx.validation_id,
    validatorName: ctx.validator_name,
    validatorKind: ctx.validator_kind,
    learnerName: ctx.learner_name,
    isDemo: ctx.is_demo,
    experience: ctx.experience,
    capabilities: ctx.capabilities,
    evidence,
  };
}
