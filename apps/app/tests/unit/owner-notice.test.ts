import { describe, expect, it } from "vitest";
import { decidedNoticeKind, firstName, ownerNotice, ownerNoticeUrl, type OwnerNoticeInput } from "../../src/domain/owner-notice";

const base: OwnerNoticeInput = { kind: "approve", ownerName: "Yorleny Prueba Soto", title: "Cabina Cahuita", publicId: "CT-1042", origin: "https://3bstays.com", note: "" };

describe("aviso al propietario", () => {
  it("usa el primer nombre", () => {
    expect(firstName("  Yorleny   Prueba ")).toBe("Yorleny");
  });

  it("aprobada: con el enlace para compartir", () => {
    expect(ownerNotice(base)).toBe(
      "Hola, Yorleny. Le escribimos de 3bstays: su casa «Cabina Cahuita» ya está aprobada y publicada. Este es su enlace para compartir con sus clientes: https://3bstays.com/casa/CT-1042. Gracias por publicar con nosotros.",
    );
    expect(ownerNotice({ ...base, origin: "https://pruebas.3bstays.com/" })).toContain("https://pruebas.3bstays.com/casa/CT-1042.");
  });

  it("cambios pedidos y rechazada: con la nota del admin, sin doble punto", () => {
    expect(ownerNotice({ ...base, kind: "changes", note: " Suba una foto del baño. " })).toBe(
      "Hola, Yorleny. Le escribimos de 3bstays: revisamos su casa «Cabina Cahuita» y necesitamos un cambio antes de publicarla: Suba una foto del baño. Puede corregirla desde Mis casas → «Corregir y reenviar».",
    );
    expect(ownerNotice({ ...base, kind: "reject", note: "Es un duplicado" })).toBe(
      "Hola, Yorleny. Le escribimos de 3bstays: revisamos su casa «Cabina Cahuita» y no podemos publicarla: Es un duplicado. Si tiene dudas, respóndanos a este mensaje.",
    );
  });

  it("pausada y bloqueada: con el motivo", () => {
    expect(ownerNotice({ ...base, kind: "paused", note: "Fotos por confirmar." })).toBe(
      "Hola, Yorleny. Le escribimos de 3bstays: su casa «Cabina Cahuita» está pausada en 3bstays: Fotos por confirmar. Puede seguir editándola desde Mis casas; cuando todo esté en orden, la reanudamos.",
    );
    expect(ownerNotice({ ...base, kind: "blocked", note: "Datos falsos" })).toContain("está bloqueada en 3bstays: Datos falsos. Si tiene dudas");
  });

  it("el enlace es wa.me con solo los dígitos del número y el texto codificado", () => {
    const url = ownerNoticeUrl("+50687770001", base);
    expect(url.startsWith("https://wa.me/50687770001?text=")).toBe(true);
    expect(decodeURIComponent(url.split("text=")[1]!)).toBe(ownerNotice(base));
  });

  it("qué aviso corresponde a una casa ya decidida", () => {
    expect(decidedNoticeKind("active")).toBe("approve");
    expect(decidedNoticeKind("inactive")).toBe("approve");
    expect(decidedNoticeKind("changes")).toBe("changes");
    expect(decidedNoticeKind("rejected")).toBe("reject");
    expect(decidedNoticeKind("review")).toBeNull();
    expect(decidedNoticeKind("draft")).toBeNull();
  });
});
