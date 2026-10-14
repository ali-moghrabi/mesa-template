import type { MetadataRoute } from "next";
import { publicRoutes, seoConfig } from "@/config/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const { siteUrl, seo } = seoConfig();
  if (seo.noindex) return [];
  const now = new Date();
  return publicRoutes().map((r) => ({
    url: r.path === "/" ? siteUrl : `${siteUrl}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
