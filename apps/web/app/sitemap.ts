import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// Portada más las fichas activas `casa/CT-####`. Sin Supabase (demo), solo la portada.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const home: MetadataRoute.Sitemap = [{ url: `${SITE_URL}/`, lastModified: new Date("2026-10-16"), changeFrequency: "weekly", priority: 1 }];
  try {
    // Importación diferida: `supabase/server` es solo de servidor y las pruebas unitarias importan este archivo.
    const [{ supabaseServer }, { listActivePublicIds }] = await Promise.all([import("@/lib/supabase/server"), import("@/lib/listings/repo")]);
    const db = await supabaseServer();
    if (!db) return home;
    const listings = await listActivePublicIds(db);
    return [...home, ...listings.map((l) => ({ url: `${SITE_URL}/casa/${l.publicId}`, lastModified: new Date(l.updatedAt), changeFrequency: "weekly" as const, priority: 0.8 }))];
  } catch {
    return home; // un sitemap nunca debe fallar: sin base, solo la portada
  }
}
