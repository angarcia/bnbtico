// Migración publicar_v2 (plan E): se envía a revisión sin fotos y sin descripción; el nombre tiene de 5 a 32 caracteres;
// la descripción queda vacía o tiene de 80 a 2000; aprobar exige al menos una foto. Las ediciones de una casa publicada
// siguen la misma regla de nombre (save_edit y listing_edit_check). Y el evento publish_verify, sin casa.
import { beforeAll, describe, expect, it } from "vitest";
import type { ListingsHarness } from "../contract/harness";
import { postgrestHarness } from "./postgrest-harness";
import { sql } from "./local";

const NAME = "El nombre de la casa debe tener entre 5 y 32 caracteres.";

describe("migración publicar_v2", () => {
  let h: ListingsHarness;

  beforeAll(async () => {
    h = await postgrestHarness();
    await h.reset();
  }, 60_000);

  it("envía sin descripción; sin fotos no (publicar avanza siempre, 2026-10-30)", async () => {
    const s = await h.seed({ status: "draft", photos: 1, draft: { description: "" } });
    expect(await h.owner("owner").submit(s.id)).toBeUndefined();
    expect((await h.owner("owner").getOwn(s.id))?.status).toBe("review");
    const bare = await h.seed({ status: "draft", photos: 0 });
    await expect(h.owner("owner").submit(bare.id)).rejects.toThrow("Añada al menos una foto.");
  });

  it("rechaza nombre de 33 y nombre vacío; una descripción de 79 ya no bloquea", async () => {
    const me = h.owner("owner");
    const short = await h.seed({ status: "draft", photos: 1, draft: { description: "a".repeat(79) } });
    expect(await me.submit(short.id)).toBeUndefined();
    const long = await h.seed({ status: "draft", photos: 1, draft: { title: "a".repeat(33) } });
    await expect(me.submit(long.id)).rejects.toThrow(NAME);
    const blank = await h.seed({ status: "draft", photos: 1, draft: { title: "   " } });
    await expect(me.submit(blank.id)).rejects.toThrow("Póngale un nombre a la casa.");
    const fits = await h.seed({ status: "draft", photos: 1, draft: { title: ` ${"a".repeat(32)} `, description: "a".repeat(80) } });
    expect(await me.submit(fits.id)).toBeUndefined();
  });

  it("capacidad, habitaciones, baños, baño compartido, parqueo y precio al mes sin decir no bloquean el envío", async () => {
    const s = await h.seed({
      status: "draft",
      photos: 1,
      draft: { kind: "habitacion", capacity: null, bedrooms: null, bathrooms: null, bathroomShared: null, features: ["parking"], parkingPaid: null, acceptsMonthly: true, monthlyPriceCrc: null },
    });
    expect(await h.owner("owner").submit(s.id)).toBeUndefined();
    expect(await h.owner("owner").getOwn(s.id)).toMatchObject({ status: "review", capacity: null, bathroomShared: null, parkingPaid: null });
  });

  it("15 fotos se envían; la 16.ª no llega a guardarse", async () => {
    const s = await h.seed({ status: "draft", photos: 15 });
    await expect(h.addPhotos(s.id, 1)).rejects.toThrow("Máximo 15 fotos.");
    expect(await h.owner("owner").submit(s.id)).toBeUndefined();
  });

  it("aprobar sin fotos falla; con una, publica", async () => {
    const none = await h.seed({ status: "review", photos: 0 });
    await expect(h.admin("aal2").review(none.id, "approve", "")).rejects.toThrow("Para aprobarla hace falta al menos una foto.");
    const one = await h.seed({ status: "review", photos: 1 });
    expect(await h.admin("aal2").review(one.id, "approve", "")).toBeUndefined();
    expect((await h.anon.getPublic(one.publicId))?.photos).toHaveLength(1);
  });

  it("acepta el evento publish_verify sin casa", () => {
    try {
      expect(() =>
        sql(`insert into public.events (name, page, path, build) values ('publish_verify', 'publicar', '/publicar/verificar', 'publicar-v2-test')`),
      ).not.toThrow();
    } finally {
      sql(`delete from public.events where build = 'publicar-v2-test'`);
    }
  });

  it("save_edit rechaza un nombre de 33 caracteres", async () => {
    const s = await h.seed({ status: "active" });
    await expect(h.owner("owner").saveEdit(s.id, { title: "a".repeat(33) })).rejects.toThrow(NAME);
  });

  it("un nombre de 33 caracteres no se guarda; con descripción vacía, el cambio va a revisión", async () => {
    const me = h.owner("owner");
    const s = await h.seed({ status: "active" });
    // save_edit ya no lo deja guardar: la fila se siembra como el servicio (la tabla admite hasta 60).
    sql(`insert into public.listing_edits (listing_id, title) values ('${s.id}', '${"a".repeat(33)}')`);
    // Revisión por dato (A5): el nombre largo no impide guardar otro dato, que va a revisión; el nombre se corrige al guardarlo.
    await expect(me.saveEdit(s.id, { title: "a".repeat(33) })).rejects.toThrow(NAME);
    await me.saveEdit(s.id, { title: "Casa Cahuita", description: "" });
    expect(await me.getOwn(s.id)).toMatchObject({ status: "active", edit: { status: "review", title: "Casa Cahuita" } });
  });
});
