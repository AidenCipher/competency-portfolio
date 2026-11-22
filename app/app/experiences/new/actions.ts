"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { experienceSchema, type FormState } from "@/lib/experience-schema";
import { checkUpload, isOwnEvidencePath, MAX_FILES, REJECT_MESSAGES } from "@/lib/uploads";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { issueValidation } from "@/lib/validation-request";

const BUCKET = "evidence";

const uploadsSchema = z
  .array(
    z.object({
      path: z.string().max(300),
      name: z.string().max(255),
      kind: z.enum(["report", "presentation", "feedback", "event_doc", "link", "other"]),
      declaredMime: z.string().max(200).default(""),
    }),
  )
  .max(MAX_FILES);

function safeJson(v: FormDataEntryValue | null): unknown {
  try {
    return typeof v === "string" && v ? JSON.parse(v) : [];
  } catch {
    return null;
  }
}

function fieldErrorsOf(err: import("zod").ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export async function createExperience(_prev: FormState, form: FormData): Promise<FormState> {
  const { supabase, user } = await requireUser();

  if (!(await rateLimit("upload:experience", 20, 60 * 60_000, user.id))) {
    return { status: "error", message: "You've saved a lot of experiences recently. Please try again later." };
  }

  // 1. Validate every input at the boundary, before touching the database or storage.
  const parsed = experienceSchema.safeParse({
    title: form.get("title"),
    type: form.get("type"),
    roleTitle: form.get("roleTitle"),
    durationLabel: form.get("durationLabel"),
    description: form.get("description"),
    reflection: form.get("reflection") ?? "",
    capabilityIds: form.getAll("capabilityIds").map(String),
    evidenceKinds: form.getAll("kinds").map(String),
  });
  if (!parsed.success) {
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors: fieldErrorsOf(parsed.error) };
  }
  const input = parsed.data;

  // 2. Files arrive as already-uploaded storage objects (see prepareUploads), never as bytes in this request.
  //    Re-check every object's REAL bytes here (allow-list, size, magic bytes); nothing is kept unless all pass.
  if (form.getAll("files").some((f) => f instanceof File && f.size > 0)) {
    return { status: "error", message: "Files must be uploaded with the form's upload step. Please try again." };
  }
  const experienceId = z.string().uuid().safeParse(form.get("experienceId")).data;
  const uploadsParsed = uploadsSchema.safeParse(safeJson(form.get("uploads")));
  if (!uploadsParsed.success) return { status: "error", message: "We couldn't read your uploaded files. Please try again." };
  const uploadsIn = uploadsParsed.data;
  if (uploadsIn.length > 0 && !experienceId) return { status: "error", message: "We couldn't read your uploaded files. Please try again." };

  const admin = createAdminClient();
  const claimed = uploadsIn.map((u) => u.path).filter((p) => experienceId && isOwnEvidencePath(p, user.id, experienceId));
  const discard = async () => {
    // Only paths inside THIS user's folder for THIS experience can ever be removed.
    if (claimed.length) await admin.storage.from(BUCKET).remove(claimed);
  };
  if (new Set(uploadsIn.map((u) => u.path)).size !== uploadsIn.length || claimed.length !== uploadsIn.length) {
    await discard();
    return { status: "error", message: "We couldn't verify your uploaded files. Please try again." };
  }
  const checked: { path: string; kind: string; check: Extract<ReturnType<typeof checkUpload>, { ok: true }> }[] = [];
  for (const u of uploadsIn) {
    const dl = await admin.storage.from(BUCKET).download(u.path);
    if (dl.error || !dl.data) {
      await discard();
      return { status: "error", message: `“${u.name.slice(0, 60)}” didn't finish uploading. Please try again.`, fieldErrors: { files: "A file didn't finish uploading." } };
    }
    const bytes = new Uint8Array(await dl.data.arrayBuffer());
    const check = checkUpload({ name: u.name, declaredMime: u.declaredMime, bytes });
    // The type the real bytes show must also match the extension of the path we minted.
    if (!check.ok || !u.path.endsWith(`.${check.type}`)) {
      await discard();
      const msg = REJECT_MESSAGES[check.ok ? "bad_content" : check.reason];
      return { status: "error", message: `“${u.name.slice(0, 60)}”: ${msg}`, fieldErrors: { files: msg } };
    }
    checked.push({ path: u.path, kind: u.kind, check });
  }

  // 3. Write. User-scoped client => RLS decides what is allowed.
  const { data: exp, error: expErr } = await supabase
    .from("experiences")
    .insert({
      ...(experienceId ? { id: experienceId } : {}),
      user_id: user.id,
      title: input.title,
      type: input.type,
      role_title: input.roleTitle,
      duration_label: input.durationLabel,
      description: input.description,
      reflection: input.reflection,
    })
    .select("id")
    .single();
  if (expErr || !exp) return { status: "error", message: "We couldn't save your experience. Please try again." };

  const rollback = async () => {
    await discard();
    await supabase.from("experiences").delete().eq("id", exp.id); // cascades to tags/evidence rows
  };

  const { error: tagErr } = await supabase
    .from("experience_capabilities")
    .insert(input.capabilityIds.map((capability_id) => ({ experience_id: exp.id, capability_id })));
  if (tagErr) {
    await rollback();
    return { status: "error", message: "We couldn't save your capability tags. Please try again." };
  }

  // Objects were verified above; record them. User-scoped client => RLS requires the path to sit in this user's
  // folder for this experience.
  for (const f of checked) {
    const { error: evErr } = await supabase.from("evidence").insert({
      experience_id: exp.id,
      kind: f.kind,
      storage_path: f.path,
      filename: f.check.safeName,
      mime: f.check.mime,
      size_bytes: f.check.size,
    });
    if (evErr) {
      await rollback();
      return { status: "error", message: "A file couldn't be recorded. Nothing was saved; please try again." };
    }
  }

  // 4. Optional validator.
  const vName = String(form.get("validatorName") ?? "").trim();
  const vEmail = String(form.get("validatorEmail") ?? "").trim();
  if (vName || vEmail) {
    const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).single();
    const res = await issueValidation({
      supabase,
      userId: user.id,
      experienceId: exp.id,
      experienceTitle: input.title,
      learnerName: profile?.display_name ?? "A learner",
      validator: { name: vName, email: vEmail, kind: form.get("validatorKind") },
    });
    if (!res.ok) {
      // The experience is saved; only the validation request failed. Say so plainly (no duplicate on retry).
      return { status: "done", experienceId: exp.id, validationError: res.message };
    }
    return { status: "done", experienceId: exp.id, validationLink: res.link, emailed: res.emailed, validatorEmail: vEmail };
  }

  redirect("/app/portfolio");
}
