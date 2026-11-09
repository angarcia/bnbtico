import type { SubscriptionHarness } from "../contract/harness";
import { localSupabase, serviceClient } from "./local";
import { postgrestHarness } from "./postgrest-harness";

/** Limpia únicamente las casas creadas por esta suite; conserva los datos de prueba manuales. */
export async function icalExportHarness(): Promise<SubscriptionHarness> {
  if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(localSupabase().url).hostname)) {
    throw new Error("Esta suite requiere Supabase local.");
  }
  const base = await postgrestHarness();
  const service = serviceClient();
  const created = new Set<string>();
  return {
    ...base,
    async seed(spec) {
      const listing = await base.seed(spec);
      created.add(listing.id);
      return listing;
    },
    async reset() {
      // Las fotos sembradas son metadatos sin objetos en Storage. Las dependencias
      // de las casas, incluidas importación y exportación, se eliminan por cascada.
      if (created.size > 0) {
        const { error } = await service.from("listings").delete().in("id", [...created]);
        if (error) throw new Error("No pudimos limpiar las casas de esta prueba.");
        created.clear();
      }
      await base.setAccountActive("owner", true);
      await base.setAccountActive("other", true);
    },
  };
}
