import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST only (sign-out must not be triggerable by a GET image/link). Route handlers do not get the built-in Origin check
// that server actions have, so enforce same-origin explicitly: a cross-site POST cannot sign someone out.
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return new NextResponse("Forbidden", { status: 403 });
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.nextUrl.origin), { status: 303 });
}
