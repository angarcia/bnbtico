// Migración nombre_y_descripcion (ticket 19), con la regla de publicar_v2: submit_listing exige un nombre de 5 a 32
// caracteres y una descripción vacía o de 80 a 2000. Sin `check` en la tabla: una casa publicada antes de la regla se sigue leyendo y editando, y solo al enviar una
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

  it("al editarla cambian al momento otros datos; ni el nombre ni la descripción viejos bloquean otro dato; los nuevos se validan", async () => {
    // Desde editar-casa una casa publicada no vuelve a borrador: se edita con datos al momento y datos con revisión.
    // Publicar v2: del nombre solo se valida el nuevo. Revisión por dato (A5): cada dato se valida al guardarlo, solo él.
    const me = h.owner("owner");
    await me.updateLive(old.id, { features: ["wifi", "pool"] });
    expect((await me.getOwn(old.id))?.features).toEqual(["wifi", "pool"]);
    await me.saveEdit(old.id, { kind: "habitacion", bathroomShared: false });
    await expect(me.saveEdit(old.id, { title: "Ola!" })).rejects.toThrow("El nombre de la casa debe tener entre 5 y 32 caracteres.");
    await expect(me.saveEdit(old.id, { description: "a".repeat(2001) })).rejects.toThrow("La descripción debe tener entre 80 y 2000 caracteres o quedar vacía.");
    // Una descripción corta ya no bloquea (2026-11-02, editar sigue las reglas de crear): se guarda y la app avisa.
    await me.saveEdit(old.id, { description: "Muy corta." });
    await me.saveEdit(old.id, { description: `  ${"a".repeat(80)}  ` });
    expect(await me.getOwn(old.id)).toMatchObject({
      status: "active",
      title: "Ola",
      edit: { status: "review", title: null, kind: "habitacion", fields: { tipo: { status: "review" }, descripcion: { status: "review" } } },
    });
  });

  it("descripción vacía pasa", async () => {
    const me = h.owner("owner");
    const s = await h.seed({ status: "active" });
    expect(await me.saveEdit(s.id, { description: "" })).toMatchObject({ fields: { descripcion: { status: "review" } } });
    const draft = await h.seed({ status: "draft", photos: 1, draft: { description: "" } });
    expect(await me.submit(draft.id)).toBeUndefined();
  });
});
