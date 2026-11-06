// Guardar un cambio de una casa publicada es un solo viaje a la base (auditoría de viajes a Supabase, punto 8): saveEdit
// llama a save_edit_full, que devuelve la edición entera, sin volver a leer listing_edits.
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { createPostgrestOwnerListings } from "../../src/data/postgrest/owner";
import type { Database } from "../../src/domain/database.types";
import { localSupabase, signIn } from "./local";
import { postgrestHarness } from "./postgrest-harness";

describe("saveEdit en un viaje", () => {
  let h: Awaited<ReturnType<typeof postgrestHarness>>;
  beforeAll(async () => {
    h = await postgrestHarness();
    await h.reset();
  }, 90_000);

  it("una sola petición a PostgREST, y devuelve lo mismo que se lee después", async () => {
    const s = await h.seed({ status: "active" });
    const { data } = await (await signIn("owner")).auth.getSession();
    const requests: string[] = [];
    const { url, anonKey } = localSupabase();
    const db = createClient<Database>(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const u = String(input instanceof Request ? input.url : input);
          if (u.includes("/rest/v1/")) requests.push(`${init?.method ?? "GET"} ${new URL(u).pathname}`);
          return fetch(input, init);
        },
      },
    });
    await db.auth.setSession({ access_token: data.session!.access_token, refresh_token: data.session!.refresh_token });
    const owner = createPostgrestOwnerListings(db, { supabaseUrl: url });
    const saved = await owner.saveEdit(s.id, { title: "Casa Coco frente al mar" });
    expect(requests).toEqual(["POST /rest/v1/rpc/save_edit_full"]);
    expect(saved).toMatchObject({ status: "review", title: "Casa Coco frente al mar" });
    expect((await owner.getOwn(s.id))?.edit).toEqual(saved);
    // Si la edición se queda vacía (el mismo nombre de la casa), null, también en un viaje.
    requests.length = 0;
    expect(await owner.saveEdit(s.id, { title: "Cabina Cahuita" })).toBeNull();
    expect(requests).toEqual(["POST /rest/v1/rpc/save_edit_full"]);
  });
});
