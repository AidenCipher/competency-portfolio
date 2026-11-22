"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken, isWellFormedToken } from "@/lib/tokens";
import { rateLimit } from "@/lib/rate-limit";

export type DecisionState = { status: "idle" } | { status: "error"; message: string } | { status: "done"; decision: string };

const GENERIC = "This link isn't valid. It may have expired or already been used.";

const schema = z
  .object({
    decision: z.enum(["endorsed", "changes_requested", "declined"]),
    comment: z.string().trim().max(1000),
  })
  .refine((v) => v.decision === "endorsed" || v.comment.length >= 3, {
    message: "Please add a short comment so the learner knows why.",
    path: ["comment"],
  });

export async function submitDecision(token: string, _prev: DecisionState, form: FormData): Promise<DecisionState> {
  // Same message for rate-limited, malformed, expired, used and unknown.
  if (!(await rateLimit("validate:decide", 20, 10 * 60_000))) return { status: "error", message: GENERIC };
  if (!isWellFormedToken(token)) return { status: "error", message: GENERIC };

  const parsed = schema.safeParse({ decision: form.get("decision"), comment: String(form.get("comment") ?? "") });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please choose a response." };
  }

  const { data, error } = await createAdminClient().rpc("record_validation_decision", {
    p_token_hash: hashToken(token),
    p_status: parsed.data.decision,
    p_comment: parsed.data.comment || null,
  });
  if (error || data !== true) return { status: "error", message: GENERIC };
  return { status: "done", decision: parsed.data.decision };
}
