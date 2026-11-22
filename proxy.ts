import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Gate for /app/*. Pages also call requireUser() (defence in depth); this is not the only check.
export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/app") && !user) {
    const to = request.nextUrl.clone();
    to.pathname = "/login";
    to.search = `?next=${encodeURIComponent(pathname + search)}`;
    const redirect = NextResponse.redirect(to);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }
  if (pathname === "/login" && user) {
    const to = request.nextUrl.clone();
    to.pathname = "/app";
    to.search = "";
    return NextResponse.redirect(to);
  }
  return response;
}

// Server-action POSTs (header `next-action`) skip the proxy: it buffers request bodies (10 MB by default),
// which would truncate multi-file uploads. Actions authenticate themselves via requireUser().
export const config = {
  matcher: [
    { source: "/app/:path*", missing: [{ type: "header", key: "next-action" }] },
    { source: "/app", missing: [{ type: "header", key: "next-action" }] },
    "/login",
  ],
};
