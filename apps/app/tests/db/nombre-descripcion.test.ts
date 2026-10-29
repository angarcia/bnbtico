// Migración nombre_y_descripcion (ticket 19): submit_listing exige un nombre de 5 a 60 caracteres y una descripción de 80
// a 2000. Sin `check` en la tabla: una casa publicada antes de la regla se sigue leyendo y editando, y solo al enviar una
// edición a revisión tiene que cumplirla (listing_edit_check).
import { beforeAll, describe, expect, it } from "vitest";
import type { ListingsHarness, Seeded } from "../contract/harness";
import { postgrestHarness } from "./postgrest-harness";
import { sql } from "./local";

describe("migración nombre_y_descripcion", () => {
  let h: ListingsHarness;
  let old: Seeded;

  beforeAll(async () => {
    h = await postgrestHarness();
    await h.reset();
    old = await h.seed({ status: "active" });
    // Como si se hubiera publicado antes de la regla (por la base, saltándose el asistente).
    sql(`begin; set local app.allow_status = 'on'; update listings set title = 'Ola', description = 'Frente al mar.' where id = '${old.id}'; commit;`);
  }, 60_000);

  it("una casa activa que no cumple se sigue viendo en público y la lee su dueño", async () => {
    expect(await h.anon.getPublic(old.publicId)).toMatchObject({ title: "Ola", description: "Frente al mar." });
    expect(await h.owner("owner").getOwn(old.id)).toMatchObject({ title: "Ola", status: "active" });
  });

  it("al editarla cambian al momento otros datos; enviar la edición exige la regla y, corregida, pasa", async () => {
    // Desde editar-casa una casa publicada no vuelve a borrador: se edita con datos al momento y una edición revisada.
    const me = h.owner("owner");
    await me.updateLive(old.id, { features: ["wifi", "pool"] });
    expect((await me.getOwn(old.id))?.features).toEqual(["wifi", "pool"]);
    await me.saveEdit(old.id, { kind: "habitacion", bathroomShared: false });
    await expect(me.submitEdit(old.id)).rejects.toThrow("El nombre de la casa debe tener entre 5 y 60 caracteres.");
    await me.saveEdit(old.id, { title: "Ola Cahuita" });
    await expect(me.submitEdit(old.id)).rejects.toThrow("La descripción debe tener entre 80 y 2000 caracteres.");
    await expect(me.saveEdit(old.id, { description: "a".repeat(2001) })).rejects.toThrow("La descripción debe tener entre 80 y 2000 caracteres.");
    await me.saveEdit(old.id, { description: `  ${"a".repeat(80)}  ` });
    expect(await me.submitEdit(old.id)).toBeUndefined();
    expect(await me.getOwn(old.id)).toMatchObject({ status: "active", title: "Ola", edit: { status: "review", title: "Ola Cahuita" } });
  });
});
