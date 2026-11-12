import { describe, expect, it } from "vitest";
import { PUBLISH_STEP1_TTL_MS, readStep1, shouldAskEmail, storeStep1 } from "../../src/domain/publish-return";
import { isPublishNext } from "../../src/domain/contact-return";

const NOW = 1_730_000_000_000;

describe("vuelta a publicar", () => {
  it("lee la respuesta del paso 1 guardada, dentro de su plazo", () => {
    expect(readStep1(storeStep1("habitacion", NOW), NOW + 1000)).toEqual({ kind: "habitacion" });
    expect(readStep1(storeStep1("completo", NOW), NOW + PUBLISH_STEP1_TTL_MS)).toEqual({ kind: "completo" });
  });

  it("descarta lo caducado, mal formado, de otro tipo, sin fecha, del futuro o ausente", () => {
    expect(readStep1(JSON.stringify({ kind: "habitacion", savedAt: NOW }), NOW + PUBLISH_STEP1_TTL_MS + 1)).toBeNull();
    expect(readStep1("{no es json", NOW)).toBeNull();
    expect(readStep1(JSON.stringify({ kind: "casa", savedAt: NOW }), NOW)).toBeNull();
    expect(readStep1(JSON.stringify({ kind: "completo" }), NOW)).toBeNull();
    expect(readStep1(JSON.stringify({ kind: "completo", savedAt: NOW + 5 }), NOW)).toBeNull();
    expect(readStep1(null, NOW)).toBeNull();
    // Sin zod: lo que antes rechazaba el esquema, a mano.
    expect(readStep1(JSON.stringify({ kind: "completo", savedAt: String(NOW) }), NOW)).toBeNull();
    expect(readStep1(JSON.stringify(["completo", NOW]), NOW)).toBeNull();
    expect(readStep1("null", NOW)).toBeNull();
    expect(readStep1("42", NOW)).toBeNull();
    expect(readStep1(JSON.stringify({ kind: null, savedAt: NOW }), NOW)).toBeNull();
    for (const savedAt of [true, null, {}, [NOW], "1e3"]) expect(readStep1(JSON.stringify({ kind: "completo", savedAt }), NOW)).toBeNull();
    expect(readStep1(JSON.stringify({ kind: "habitacion", savedAt: NOW, extra: 1 }), NOW)).toEqual({ kind: "habitacion" });
    expect(readStep1(JSON.stringify({ savedAt: NOW, kind: "completo", step: 3, title: "Casa Coco" }), NOW)).toEqual({ kind: "completo" });
  });

  it("reconoce la vuelta a publicar; nada más", () => {
    expect(isPublishNext("/publicar/continuar")).toBe(true);
    expect(isPublishNext("/publicar/continuar?x=1")).toBe(false);
    expect(isPublishNext("//evil.com/publicar/continuar")).toBe(false);
    expect(isPublishNext("/casa/CT-0001?contacto=1")).toBe(false);
    expect(isPublishNext(null)).toBe(false);
    for (const near of ["/publicar/continuar/", "/publicar/continuar#paso", "/publicar/continuar?", "/publicar%2Fcontinuar", "/publicar\\continuar", "/\\publicar/continuar", "/publicar/continuar\t"]) {
      expect(isPublishNext(near)).toBe(false);
    }
  });

  it("pregunta por el correo solo a una cuenta sin correo que no lo omitió", () => {
    expect(shouldAskEmail({ email: null }, null)).toBe(true);
    expect(shouldAskEmail({ email: "a@b.cr" }, null)).toBe(false);
    expect(shouldAskEmail({ email: null }, "1")).toBe(false);
    expect(shouldAskEmail(undefined, null)).toBe(false);
  });
});
