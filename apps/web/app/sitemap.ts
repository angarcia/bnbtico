import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// Hasta el lanzamiento solo existe la portada. Las fichas `casa/CT-####` se añaden en la fase 2.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${SITE_URL}/`, lastModified: new Date("2026-10-16"), changeFrequency: "weekly", priority: 1 }];
}
