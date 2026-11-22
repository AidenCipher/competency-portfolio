import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { sendValidationEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { generateToken, hashToken, validationExpiry } from "@/lib/tokens";
import { validatorSchema } from "@/lib/experience-schema";

export type IssueResult =
  | { ok: true; link?: string; emailed: boolean }
  | { ok: false; message: string };

/**
 * Create a validation request for an experience the signed-in user owns.
 * Ownership, validity and the open-request cap are enforced inside the
 * `request_validation` SQL function (RLS-aware); this code only mints the token.
 * Only the SHA-256 hash is sent to the database. The raw token appears only in the
 * emailed link, or is returned to the owner as a copyable link when email is unconfigured.
 */
export async function issueValidation(args: {
  supabase: SupabaseClient;
  userId: string;
  experienceId: string;
  experienceTitle: string;
  learnerName: string;
  validator: unknown;
}): Promise<IssueResult> {
  const parsed = validatorSchema.safeParse(args.validator);
  if (!parsed.success) return { ok: false, message: "Check the validator's name and email." };

  if (!(await rateLimit("validation:request", 10, 60 * 60_000, args.userId))) {
    return { ok: false, message: "You've requested a lot of validations. Please try again later." };
  }

  const raw = generateToken();
  const { error } = await args.supabase.rpc("request_validation", {
    p_experience_id: args.experienceId,
    p_name: parsed.data.name,
    p_email: parsed.data.email,
    p_kind: parsed.data.kind,
    p_token_hash: hashToken(raw),
    p_expires_at: validationExpiry().toISOString(),
  });
  if (error) return { ok: false, message: "We couldn't create the validation request." };

  const link = `${publicEnv().NEXT_PUBLIC_SITE_URL}/validate/${raw}`;
  const emailed = await sendValidationEmail({
    to: parsed.data.email,
    validatorName: parsed.data.name,
    learnerName: args.learnerName,
    experienceTitle: args.experienceTitle,
    link,
  });
  // If the email went out, the learner does not need (and does not get) the link.
  return emailed ? { ok: true, emailed: true } : { ok: true, emailed: false, link };
}
