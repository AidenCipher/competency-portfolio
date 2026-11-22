import type { MetadataRoute } from "next";

// Only the landing and privacy pages are meant to be found. Signed-in pages, validator links, auth and API routes, and the
// demo are kept out (the validator and demo pages also send `X-Robots-Tag: noindex`).
export default function robots(): MetadataRoute.Robots {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return {
    rules: [{ userAgent: "*", allow: ["/", "/privacy"], disallow: ["/app/", "/api/", "/auth/", "/validate/", "/login", "/demo"] }],
    ...(site ? { sitemap: `${site}/sitemap.xml` } : {}),
  };
}
