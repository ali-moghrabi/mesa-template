import type { MetadataRoute } from "next";
import { PRIVATE_PATHS, seoConfig } from "@/config/seo";

export default function robots(): MetadataRoute.Robots {
  const { seo, siteUrl } = seoConfig();
  if (seo.noindex) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: PRIVATE_PATHS }],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
