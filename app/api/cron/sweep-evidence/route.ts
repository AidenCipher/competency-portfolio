import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// Daily job (see vercel.json). Removes evidence files that were uploaded but never attached to an experience.
// Authenticated by CRON_SECRET (Vercel sends `Authorization: Bearer $CRON_SECRET`). Without the secret set it does nothing.
export const dynamic = "force-dynamic";

function authorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  if (!authorised(req)) return new NextResponse("Not found", { status: 404 });
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("orphaned_evidence_objects");
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  const names = ((data ?? []) as { name: string }[]).map((r) => r.name);
  let removed = 0;
  for (let i = 0; i < names.length; i += 100) {
    const batch = names.slice(i, i + 100);
    const res = await admin.storage.from("evidence").remove(batch);
    if (!res.error) removed += res.data?.length ?? batch.length;
  }
  // Counts only: never log paths (they contain user ids).
  return NextResponse.json({ ok: true, candidates: names.length, removed });
}
