"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { statementSchema } from "@/lib/statement-schema";

export type StatementState = { status: "idle" } | { status: "saved" } | { status: "reset" } | { status: "error"; message: string };

/** Save the learner's own capability statement, or (intent=reset) delete it so the suggested template shows again. */
export async function saveStatement(capabilityId: string, _prev: StatementState, form: FormData): Promise<StatementState> {
  const { supabase, user } = await requireUser();
  if (!(await rateLimit("statement", 30, 10 * 60_000, user.id))) return { status: "error", message: "Too many changes. Try again in a few minutes." };
  if (!z.string().uuid().safeParse(capabilityId).success) return { status: "error", message: "Unknown capability." };

  if (form.get("intent") === "reset") {
    const { error } = await supabase.from("capability_statements").delete().eq("user_id", user.id).eq("capability_id", capabilityId);
    if (error) return { status: "error", message: "We couldn't reset your statement." };
    revalidatePath("/app", "layout");
    return { status: "reset" };
  }

  const parsed = statementSchema.safeParse({ capabilityId, text: form.get("text") ?? "" });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Check your statement." };

  // The capability must exist (reference table, readable by any signed-in user).
  const { data: cap } = await supabase.from("capabilities").select("id").eq("id", parsed.data.capabilityId).single();
  if (!cap) return { status: "error", message: "Unknown capability." };

  const { error } = await supabase
    .from("capability_statements")
    .upsert(
      { user_id: user.id, capability_id: parsed.data.capabilityId, text: parsed.data.text, updated_at: new Date().toISOString() },
      { onConflict: "user_id,capability_id" },
    );
  if (error) return { status: "error", message: "We couldn't save your statement." };
  revalidatePath("/app", "layout");
  return { status: "saved" };
}
