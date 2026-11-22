import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-redirect";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  // The one-time code is opaque and short; bound it before it reaches the auth server.
  const code = z.string().min(8).max(512).regex(/^[\w.~-]+$/).safeParse(searchParams.get("code")).data;
  const next = safeNext(searchParams.get("next"));
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=callback`);
}
