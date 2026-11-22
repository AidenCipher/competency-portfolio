import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return ["", "/privacy"].map((path) => ({ url: `${site}${path}` }));
}
