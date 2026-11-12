// Casas del admin (fase 5, ticket 07, diseño 23): chip de cada estado, recuentos, buscador y línea de suscripción.
import { describe, expect, it } from "vitest";
import { HOUSE_BADGES, adminHouseLine, chipOf, countHouses, filterHouses, houseBadge, houseChip, type AdminHouse } from "../../src/domain/admin-houses";
import type { ListingStatus } from "../../src/domain/listing";
import type { HouseSubscription } from "../../src/domain/subscription";

const TODAY = "2026-10-27";
const sub = (patch: Partial<HouseSubscription> = {}): HouseSubscription => ({
  status: "active",
  plan: "promo",
  promoEndsOn: "2027-10-14",
  paidSince: null,
  stoppedOn: null,
  monthlyPriceCrc: 2900,
  hasMethod: false,
  ...patch,
});

let seq = 0;
const house = (status: ListingStatus, patch: Partial<AdminHouse> = {}): AdminHouse => ({
  listingId: `id-${++seq}`,
  publicId: `CT-${1000 + seq}`,
  title: "Casa",
  status,
  ownerName: "Ana López",
  ownerPhone: "+50688881234",
  zone: "Cocles",
  cover: null,
  subscription: sub({ status }),
  hold: null,
  ...patch,
});

describe("adminHouseLine", () => {
  it("activa con la oferta corriendo: «Gratis hasta 14 oct 2027», sin «el»", () => {
    expect(adminHouseLine(sub(), TODAY)).toBe("Gratis hasta 14 oct 2027");
  });

  it("activa en el plan de pago: desde cuándo y cuánto", () => {
    expect(adminHouseLine(sub({ plan: "paid", promoEndsOn: "2026-10-14", paidSince: "2026-10-15", hasMethod: true }), TODAY)).toBe(
      "Pagando desde el 15 oct 2026 · ₡2 900 al mes",
    );
    expect(adminHouseLine(sub({ plan: "paid", promoEndsOn: null, paidSince: "2026-09-01", hasMethod: true }), TODAY)).toBe("Pagando desde el 1 sep 2026 · ₡2 900 al mes");
  });

  it("activa con la oferta vencida y sin método, antes de que corra el trabajo diario: sigue diciendo hasta cuándo era gratis", () => {
    expect(adminHouseLine(sub({ promoEndsOn: "2026-10-26" }), TODAY)).toBe("Gratis hasta 26 oct 2026");
  });

  it("por pagar: «Oferta vencida el 14 oct · sin método de pago» (con año si no es del año en curso)", () => {
    expect(adminHouseLine(sub({ status: "payment_due", promoEndsOn: "2026-10-14" }), TODAY)).toBe("Oferta vencida el 14 oct · sin método de pago");
    expect(adminHouseLine(sub({ status: "payment_due", promoEndsOn: "2025-12-31" }), TODAY)).toBe("Oferta vencida el 31 dic 2025 · sin método de pago");
    expect(adminHouseLine(sub({ status: "payment_due", plan: "paid", promoEndsOn: null }), TODAY)).toBe("Sin oferta de lanzamiento · sin método de pago");
  });

  it("inactiva: «Parada por el propietario el 9 oct»", () => {
    expect(adminHouseLine(sub({ status: "inactive", stoppedOn: "2026-10-09" }), TODAY)).toBe("Parada por el anfitrión el 9 oct");
    expect(adminHouseLine(sub({ status: "inactive", stoppedOn: null }), TODAY)).toBe("Parada por el anfitrión");
  });

  it("publicada que se está editando o revisando: la línea de su suscripción (o parada si lo estaba)", () => {
    expect(adminHouseLine(sub({ status: "review" }), TODAY)).toBe("Gratis hasta 14 oct 2027");
    expect(adminHouseLine(sub({ status: "changes", plan: "paid", paidSince: "2026-10-15", hasMethod: true }), TODAY)).toBe("Pagando desde el 15 oct 2026 · ₡2 900 al mes");
    expect(adminHouseLine(sub({ status: "review", stoppedOn: "2026-10-09" }), TODAY)).toBe("Parada por el anfitrión el 9 oct");
  });
});

describe("chips", () => {
  it("cada estado cae en su chip; las que se editan solo en Todas", () => {
    expect(houseChip("active")).toBe("activas");
    expect(houseChip("payment_due")).toBe("por-pagar");
    expect(houseChip("inactive")).toBe("inactivas");
    for (const s of ["review", "changes", "rejected", "draft"] as const) expect(houseChip(s)).toBeNull();
  });

  it("recuentos por chip", () => {
    const list = [house("active"), house("active"), house("payment_due"), house("inactive"), house("review")];
    expect(countHouses(list)).toEqual({ todas: 5, activas: 2, "por-pagar": 1, inactivas: 1, pausadas: 0, bloqueadas: 0 });
    expect(countHouses([])).toEqual({ todas: 0, activas: 0, "por-pagar": 0, inactivas: 0, pausadas: 0, bloqueadas: 0 });
  });

  it("la retención del admin manda sobre el estado: una pausada o bloqueada no cuenta como activa", () => {
    const paused = house("active", { hold: { kind: "paused", reason: "Fotos engañosas" } });
    const blocked = house("payment_due", { hold: { kind: "blocked", reason: "Incumplimiento" } });
    expect(chipOf(paused)).toBe("pausadas");
    expect(chipOf(blocked)).toBe("bloqueadas");
    expect(chipOf(house("inactive"))).toBe("inactivas");
    expect(countHouses([house("active"), paused, blocked, house("active", { hold: { kind: "paused", reason: "x" } })])).toEqual({
      todas: 4,
      activas: 1,
      "por-pagar": 0,
      inactivas: 0,
      pausadas: 2,
      bloqueadas: 1,
    });
    expect(houseBadge(paused)).toEqual({ label: "Pausada", badge: "badge-review" });
    expect(houseBadge(blocked)).toEqual({ label: "Bloqueada", badge: "badge-bad" });
    expect(houseBadge(house("active"))).toEqual(HOUSE_BADGES.active);
    expect(filterHouses([paused, blocked, house("active")], "pausadas", "").map((x) => x.listingId)).toEqual([paused.listingId]);
    expect(filterHouses([paused, blocked, house("active")], "bloqueadas", "").map((x) => x.listingId)).toEqual([blocked.listingId]);
    expect(filterHouses([paused, blocked, house("active")], "activas", "")).toHaveLength(1);
  });

  it("la línea de una bloqueada dice que la suscripción está parada", () => {
    expect(adminHouseLine(sub({ hold: "blocked" }), TODAY)).toBe("Suscripción parada mientras esté bloqueada");
    expect(adminHouseLine(sub({ hold: "paused" }), TODAY)).toBe("Gratis hasta 14 oct 2027");
  });

  it("insignias del diseño: Activa salvia, Por pagar ocre, Inactiva arena", () => {
    expect(HOUSE_BADGES.active).toEqual({ label: "Activa", badge: "badge-ok" });
    expect(HOUSE_BADGES.payment_due).toEqual({ label: "Por pagar", badge: "badge-sun" });
    expect(HOUSE_BADGES.inactive).toEqual({ label: "Inactiva", badge: "badge-mute" });
    expect(HOUSE_BADGES.review.label).toBe("En revisión");
  });
});

describe("filterHouses", () => {
  const a = house("active", { title: "Crystal Jungle Villa", publicId: "CT-1203", ownerName: "Daniel Aguado" });
  const b = house("payment_due", { title: "Rancho Manzanillo", publicId: "CT-1187", ownerName: "Inmobiliaria Caribe Sur" });
  const c = house("inactive", { title: "Apartamento Playa Chiquita", publicId: "CT-1176", ownerName: "Ana López" });
  const d = house("review", { title: "Cabina Ñandú", publicId: "CT-1100", ownerName: "José Pérez" });
  const all = [a, b, c, d];
  const ids = (l: AdminHouse[]) => l.map((h) => h.publicId);

  it("por chip", () => {
    expect(ids(filterHouses(all, "todas", ""))).toEqual(ids(all));
    expect(ids(filterHouses(all, "activas", ""))).toEqual(["CT-1203"]);
    expect(ids(filterHouses(all, "por-pagar", ""))).toEqual(["CT-1187"]);
    expect(ids(filterHouses(all, "inactivas", ""))).toEqual(["CT-1176"]);
  });

  it("por nombre, CT-#### o propietario, sin tildes ni mayúsculas", () => {
    expect(ids(filterHouses(all, "todas", "  crystal "))).toEqual(["CT-1203"]);
    expect(ids(filterHouses(all, "todas", "ct-1187"))).toEqual(["CT-1187"]);
    expect(ids(filterHouses(all, "todas", "1176"))).toEqual(["CT-1176"]);
    expect(ids(filterHouses(all, "todas", "jose perez"))).toEqual(["CT-1100"]);
    expect(ids(filterHouses(all, "todas", "nandu"))).toEqual(["CT-1100"]);
    expect(ids(filterHouses(all, "todas", "caribe"))).toEqual(["CT-1187"]);
    expect(ids(filterHouses(all, "activas", "caribe"))).toEqual([]);
    expect(ids(filterHouses(all, "todas", "no existe"))).toEqual([]);
  });
});
