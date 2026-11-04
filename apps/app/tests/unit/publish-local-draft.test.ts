// Publicar sin cuenta hasta las fotos (Ana, 2026-11-04): los pasos 1–6 se guardan en el teléfono y el código se pide antes de
// las fotos. Leer y escribir ese borrador.
import { describe, expect, it } from "vitest";
import { emptyDraft } from "../../src/domain/listing";
import { PUBLISH_STEP1_TTL_MS, readLocalDraft, readPublishDraft, storeLocalDraft, storeStep1 } from "../../src/domain/publish-return";

const NOW = 1_730_000_000_000;
const filled = {
  ...emptyDraft(),
  kind: "completo" as const,
  province: "Limón",
  canton: "Talamanca",
  district: "Cahuita",
  zone: "Cocles",
  zoneId: "4f1c2b3a-0000-4000-8000-000000000001",
  zoneSource: "list" as const,
  lat: 9.65,
  lng: -82.75,
  capacity: 4,
  bedrooms: 2,
  bathrooms: 1,
  title: "Casa Cocles",
  description: "Una casa de madera a 200 m de la playa, con jardín y hamacas.",
  features: ["wifi" as const, "pets" as const],
};

describe("borrador de publicar en el teléfono", () => {
  it("guarda y lee el borrador entero, dentro de su plazo de 7 días", () => {
    expect(readLocalDraft(storeLocalDraft(filled, NOW), NOW + 1000)).toEqual(filled);
    expect(readLocalDraft(storeLocalDraft(filled, NOW), NOW + PUBLISH_STEP1_TTL_MS)).toEqual(filled);
    expect(readLocalDraft(storeLocalDraft(filled, NOW), NOW + PUBLISH_STEP1_TTL_MS + 1)).toBeNull();
  });

  it("no guarda el número de fotos: no hay fotos sin cuenta", () => {
    expect(readLocalDraft(storeLocalDraft({ ...filled, photoCount: 3 }, NOW), NOW)?.photoCount).toBe(0);
  });

  it("descarta lo mal formado, del futuro, sin tipo válido o sin fecha", () => {
    expect(readLocalDraft(null, NOW)).toBeNull();
    expect(readLocalDraft("{no es json", NOW)).toBeNull();
    expect(readLocalDraft("[]", NOW)).toBeNull();
    expect(readLocalDraft(JSON.stringify({ draft: filled }), NOW)).toBeNull();
    expect(readLocalDraft(JSON.stringify({ draft: filled, savedAt: NOW + 5 }), NOW)).toBeNull();
    expect(readLocalDraft(JSON.stringify({ draft: { ...filled, kind: "castillo" }, savedAt: NOW }), NOW)).toBeNull();
    expect(readLocalDraft(JSON.stringify({ draft: "casa", savedAt: NOW }), NOW)).toBeNull();
  });

  it("un dato con un tipo que no toca se queda vacío; lo demás se conserva", () => {
    const raw = JSON.stringify({ draft: { ...filled, capacity: "cuatro", features: ["wifi", "jacuzzi", 3], title: 7, lat: "9.6" }, savedAt: NOW });
    const d = readLocalDraft(raw, NOW)!;
    expect(d.capacity).toBeNull();
    expect(d.features).toEqual(["wifi"]);
    expect(d.title).toBe("");
    expect(d.lat).toBeNull();
    expect(d.zone).toBe("Cocles");
    expect(d.kind).toBe("completo");
  });

  it("normaliza al leer: una Habitación es 1 habitación y 1 baño; sin zona de la lista no hay zoneId", () => {
    const raw = storeLocalDraft({ ...filled, kind: "habitacion", bedrooms: 3, zoneSource: "other" }, NOW);
    const d = readLocalDraft(raw, NOW)!;
    expect(d.bedrooms).toBe(1);
    expect(d.bathrooms).toBe(1);
    expect(d.zoneId).toBeNull();
  });

  it("sin borrador entero, vale la respuesta del paso 1 de antes (visitas a medias del flujo anterior)", () => {
    expect(readPublishDraft(null, storeStep1("habitacion", NOW), NOW)).toEqual({ ...emptyDraft(), kind: "habitacion", bedrooms: 1, bathrooms: 1 });
    expect(readPublishDraft(storeLocalDraft(filled, NOW), storeStep1("habitacion", NOW), NOW)).toEqual(filled);
    expect(readPublishDraft(null, null, NOW)).toBeNull();
  });
});
