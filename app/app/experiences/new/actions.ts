"use server";

import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { experienceSchema, type FormState } from "@/lib/experience-schema";
import { checkUpload, MAX_FILES, REJECT_MESSAGES, storagePath } from "@/lib/uploads";
import { rateLimit } from "@/lib/rate-limit";
import { issueValidation } from "@/lib/validation-request";

const BUCKET = "evidence";

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

  // 2. Validate every file (allow-list, size, magic bytes) before anything is stored.
  const rawFiles = form.getAll("files");
  const pairs = rawFiles
    .map((f, i) => ({ file: f, kind: input.evidenceKinds[i] ?? "other" }))
    .filter((p): p is { file: File; kind: string } => p.file instanceof File && p.file.size > 0);
  if (pairs.length > MAX_FILES) {
    return { status: "error", message: `You can attach up to ${MAX_FILES} files.` };
  }
  const checked: { bytes: Uint8Array; kind: string; check: Extract<ReturnType<typeof checkUpload>, { ok: true }> }[] = [];
  for (const { file, kind } of pairs) {
    if (file.size > 10 * 1024 * 1024) {
      return { status: "error", message: `${REJECT_MESSAGES.too_large} (“${file.name.slice(0, 60)}”)`, fieldErrors: { files: REJECT_MESSAGES.too_large } };
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const check = checkUpload({ name: file.name, declaredMime: file.type, bytes });
    if (!check.ok) {
      const msg = REJECT_MESSAGES[check.reason];
      return { status: "error", message: `“${file.name.slice(0, 60)}”: ${msg}`, fieldErrors: { files: msg } };
    }
    checked.push({ bytes, kind, check });
  }

  // 3. Write. User-scoped client => RLS decides what is allowed.
  const { data: exp, error: expErr } = await supabase
    .from("experiences")
    .insert({
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

  const uploaded: string[] = [];
  const rollback = async () => {
    if (uploaded.length) await createAdminClient().storage.from(BUCKET).remove(uploaded);
    await supabase.from("experiences").delete().eq("id", exp.id); // cascades to tags/evidence rows
  };

  const { error: tagErr } = await supabase
    .from("experience_capabilities")
    .insert(input.capabilityIds.map((capability_id) => ({ experience_id: exp.id, capability_id })));
  if (tagErr) {
    await rollback();
    return { status: "error", message: "We couldn't save your capability tags. Please try again." };
  }

  // Uploads go through the service role (no client-side storage policies exist), but only
  // into this user's own folder, and only after the checks above.
  const admin = createAdminClient();
  for (const f of checked) {
    const path = storagePath(user.id, exp.id, randomUUID(), f.check.type);
    const up = await admin.storage.from(BUCKET).upload(path, f.bytes, { contentType: f.check.mime, upsert: false });
    if (up.error) {
      await rollback();
      return { status: "error", message: "A file couldn't be uploaded. Nothing was saved; please try again." };
    }
    uploaded.push(path);
    const { error: evErr } = await supabase.from("evidence").insert({
      experience_id: exp.id,
      kind: f.kind,
      storage_path: path,
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
