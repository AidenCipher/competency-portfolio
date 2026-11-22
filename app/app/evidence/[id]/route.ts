import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

// Owner download: RLS decides whether this evidence row is visible to the caller; only then is a
// 5-minute signed URL minted with the service role. Non-owners get the same 404 as missing files.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return new NextResponse("Not found", { status: 404 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Not found", { status: 404 });
  if (!(await rateLimit("evidence:download", 60, 10 * 60_000, user.id))) return new NextResponse("Too many requests", { status: 429 });

  const { data: ev } = await supabase.from("evidence").select("storage_path, filename").eq("id", id).single();
  if (!ev?.storage_path) return new NextResponse("Not found", { status: 404 });

  const signed = await createAdminClient().storage.from("evidence").createSignedUrl(ev.storage_path, 300, { download: ev.filename });
  if (!signed.data?.signedUrl) return new NextResponse("Not found", { status: 404 });
  const res = NextResponse.redirect(signed.data.signedUrl, 302);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
