import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { ipFromHeaders, rateLimitIp } from "@/lib/rate-limit";

const TEN_MIN = 10 * 60_000;

function tooMany(): NextResponse {
  return new NextResponse("Too many requests. Please wait a few minutes and try again.", {
    status: 429,
    headers: { "Retry-After": "600", "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
  });
}

// Gate for /app/*. Pages also call requireUser() (defence in depth); this is not the only check.
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const ip = ipFromHeaders(request.headers);

  // Validator links: an HTTP-level backstop for token guessing, shared across instances. (A real 429; the page's own
  // generic "this link isn't valid" handling is unchanged.)
  if (pathname.startsWith("/validate/")) {
    if (!(await rateLimitIp("http:validate", ip, 60, TEN_MIN))) return tooMany();
    return NextResponse.next();
  }
  // Login form posts (magic link / Google). The action has its own tighter per-IP limit with a friendly message;
  // this is the HTTP-level backstop that answers a scripted burst with a real 429.
  if (pathname === "/login" && request.method === "POST") {
    if (!(await rateLimitIp("http:login", ip, 20, TEN_MIN))) return tooMany();
  }

  const { response, user } = await updateSession(request);

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
    "/validate/:path*",
  ],
};
