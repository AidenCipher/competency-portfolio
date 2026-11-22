import type { CookieOptions } from "@supabase/ssr";

/**
 * Auth cookies are only ever read by the server (proxy.ts and server code); this app has no browser auth client.
 * So they are HttpOnly (page JavaScript, e.g. an XSS payload, cannot read the session), SameSite=Lax, and Secure in production.
 */
export function hardenCookie(options: CookieOptions | undefined): CookieOptions {
  return { ...options, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" };
}
