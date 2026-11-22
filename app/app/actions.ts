"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { issueValidation } from "@/lib/validation-request";

export type GoalState = { status: "idle" | "error"; message?: string };

const goalSchema = z.object({ roleId: z.string().uuid() });

export async function setCareerGoal(_prev: GoalState, form: FormData): Promise<GoalState> {
  const { supabase, user } = await requireUser();
  const parsed = goalSchema.safeParse({ roleId: form.get("roleId") });
  if (!parsed.success) return { status: "error", message: "Choose a career goal." };

  // Only roles that have a capability map can be chosen.
  const { data: role } = await supabase.from("career_roles").select("id, is_mapped").eq("id", parsed.data.roleId).single();
  if (!role?.is_mapped) return { status: "error", message: "That role isn't available yet." };

  const { error } = await supabase.from("profiles").update({ target_role_id: role.id }).eq("id", user.id);
  if (error) return { status: "error", message: "We couldn't save your goal." };
  revalidatePath("/app", "layout");
  return { status: "idle" };
}

export type RequestState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "done"; link?: string; emailed: boolean };

export async function requestValidationAction(experienceId: string, _prev: RequestState, form: FormData): Promise<RequestState> {
  const { supabase, user } = await requireUser();
  if (!z.string().uuid().safeParse(experienceId).success) return { status: "error", message: "Unknown experience." };

  // Ownership is re-checked by RLS on this read; a non-owner gets no row.
  const { data: exp } = await supabase.from("experiences").select("id, title").eq("id", experienceId).single();
  if (!exp) return { status: "error", message: "Unknown experience." };
  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).single();

  const res = await issueValidation({
    supabase,
    userId: user.id,
    experienceId: exp.id,
    experienceTitle: exp.title,
    learnerName: profile?.display_name ?? "A learner",
    validator: { name: form.get("validatorName"), email: form.get("validatorEmail"), kind: form.get("validatorKind") },
  });
  if (!res.ok) return { status: "error", message: res.message };
  revalidatePath("/app", "layout");
  return { status: "done", link: res.link, emailed: res.emailed };
}
