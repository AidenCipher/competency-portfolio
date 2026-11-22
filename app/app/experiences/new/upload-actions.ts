"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { MAX_FILES, precheckUpload, REJECT_MESSAGES, storagePath, USER_STORAGE_BUDGET_BYTES } from "@/lib/uploads";

const BUCKET = "evidence";

const inputSchema = z.object({
  files: z
    .array(z.object({ name: z.string().max(255), size: z.number().int().min(0).max(1_000_000_000) }))
    .min(1)
    .max(MAX_FILES),
});

export type PrepareState =
  | { ok: true; experienceId: string; uploads: { path: string; token: string }[] }
  | { ok: false; message: string };

/**
 * Step 1 of an upload. The file bytes never pass through a server action (Vercel caps those at ~4.5 MB): this action
 * only checks the declared names and sizes, then mints one single-use signed upload URL per file, into this user's own
 * folder. The browser uploads straight to Storage; createExperience() re-checks the real bytes before anything is kept.
 */
export async function prepareUploads(raw: unknown): Promise<PrepareState> {
  const { supabase, user } = await requireUser();
  if (!(await rateLimit("upload:prepare", 15, 60 * 60_000, user.id))) {
    return { ok: false, message: "You've uploaded a lot recently. Please try again later." };
  }
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: `You can attach up to ${MAX_FILES} files.` };

  const typed: { type: ReturnType<typeof precheckUpload> & { ok: true } }[] = [];
  let declaredTotal = 0;
  for (const f of parsed.data.files) {
    const pre = precheckUpload(f);
    if (!pre.ok) return { ok: false, message: `“${f.name.slice(0, 60)}”: ${REJECT_MESSAGES[pre.reason]}` };
    typed.push({ type: pre });
    declaredTotal += f.size;
  }

  // Per-user budget: bounds how much one account can keep in the bucket.
  const { data: existing } = await supabase.from("evidence").select("size_bytes");
  const used = (existing ?? []).reduce((n, r) => n + Number(r.size_bytes ?? 0), 0);
  if (used + declaredTotal > USER_STORAGE_BUDGET_BYTES) {
    return { ok: false, message: "You've reached your file storage limit. Remove some evidence before adding more." };
  }

  const experienceId = randomUUID();
  const admin = createAdminClient();
  const uploads: { path: string; token: string }[] = [];
  for (const t of typed) {
    const path = storagePath(user.id, experienceId, randomUUID(), t.type.type);
    // upsert:false (explicit): once a file exists at this path the token cannot overwrite it, so nothing can be
    // swapped in after verification.
    const signed = await admin.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: false });
    if (signed.error || !signed.data) return { ok: false, message: "We couldn't start the upload. Please try again." };
    uploads.push({ path, token: signed.data.token });
  }
  return { ok: true, experienceId, uploads };
}
