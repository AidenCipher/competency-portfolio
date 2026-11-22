import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Origin of the Supabase API (local CLI in dev, hosted project in prod).
// Only the public URL is read here; no secret ever enters this file.
function supabaseOrigins(): { http: string; ws: string } | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return { http: u.origin, ws: u.origin.replace(/^http/, "ws") };
  } catch {
    return null;
  }
}

function contentSecurityPolicy(): string {
  const sb = supabaseOrigins();
  // NOTE: a static CSP cannot carry per-request nonces, so inline scripts that
  // Next.js emits for hydration need 'unsafe-inline'. Sprint 3 hardening
  // revisits a nonce-based CSP via proxy.ts (requires dynamic rendering).
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...(sb ? [sb.http] : [])],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...(sb ? [sb.http, sb.ws] : [])],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  const parts = Object.entries(directives).map(([k, v]) => `${k} ${v.join(" ")}`);
  if (!isDev) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy() },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isDev
    ? []
    : [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  outputFileTracingRoot: process.cwd(),
  experimental: {
    // 3 files x 10 MB + form fields. Per-file size is enforced in lib/uploads.ts.
    // NOTE: Vercel serverless functions cap request bodies at ~4.5 MB; see docs/iterations.md.
    serverActions: { bodySizeLimit: "32mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Validator and (future) share pages must never be indexed or cached.
      {
        source: "/validate/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
      {
        source: "/demo",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/p/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
