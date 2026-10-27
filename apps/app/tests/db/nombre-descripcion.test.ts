// Migración nombre_y_descripcion (ticket 19): submit_listing exige un nombre de 5 a 60 caracteres y una descripción de 80
// a 2000. Sin `check` en la tabla: una casa publicada antes de la regla se sigue leyendo y editando, y solo al reenviarla
// a revisión tiene que cumplirla.
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

  it("al editarla se guardan otras pantallas; enviarla exige la regla y, corregida, pasa", async () => {
    const me = h.owner("owner");
    await me.reopenForEdit(old.id);
    expect((await me.saveStep(old.id, 5, { features: ["wifi", "pool"], parkingPaid: null })).features).toEqual(["wifi", "pool"]);
    await expect(me.submit(old.id)).rejects.toThrow("El nombre de la casa debe tener entre 5 y 60 caracteres.");
    sql(`update listings set title = 'Ola Cahuita' where id = '${old.id}';`);
    await expect(me.submit(old.id)).rejects.toThrow("La descripción debe tener entre 80 y 2000 caracteres.");
    sql(`update listings set description = repeat('a', 2001) where id = '${old.id}';`);
    await expect(me.submit(old.id)).rejects.toThrow("La descripción debe tener entre 80 y 2000 caracteres.");
    sql(`update listings set description = '  ' || repeat('a', 80) || '  ' where id = '${old.id}';`);
    expect(await me.submit(old.id)).toBeUndefined();
  });
});
