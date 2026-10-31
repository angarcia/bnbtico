// Pausar, bloquear y eliminar (spec .scratch/admin-casas-acciones): las reglas puras del navegador y cómo se cuenta una casa
// retenida al propietario (etiqueta, orden de Mis casas, acciones y suscripción).
import { describe, expect, it } from "vitest";
import { ADMIN_HOLD_MESSAGES as H, HOLD_REASON_MAX, deleteConfirmMatches, holdReasonRefusal } from "../../src/domain/admin-actions";
import { holdFromRow } from "../../src/domain/admin-hold";
import { can, isBlocked } from "../../src/domain/can";
import { cardLabel } from "../../src/domain/navigation";
import { BLOCKED_LINE, houseSubscription, nextCharge, payButtonDue, subscriptionLine, type BillingHouse, type HouseSubscription } from "../../src/domain/subscription";
import { activeListing } from "./fixtures";

const paused = { kind: "paused", reason: "Fotos engañosas" } as const;
const blocked = { kind: "blocked", reason: "Incumplimiento" } as const;
const TODAY = "2026-10-30";
const sub = (patch: Partial<HouseSubscription> = {}): HouseSubscription => ({
  status: "active",
  plan: "promo",
  promoEndsOn: "2026-11-10",
  paidSince: null,
  stoppedOn: null,
  monthlyPriceCrc: 2900,
  hasMethod: false,
  ...patch,
});

describe("motivo y confirmación", () => {
  it("el motivo es obligatorio y llega hasta 2000 caracteres", () => {
    expect(holdReasonRefusal("")).toBe(H.reasonRequired);
    expect(holdReasonRefusal("   ")).toBe(H.reasonRequired);
    expect(holdReasonRefusal("a")).toBeNull();
    expect(holdReasonRefusal("a".repeat(HOLD_REASON_MAX))).toBeNull();
    expect(holdReasonRefusal("a".repeat(HOLD_REASON_MAX + 1))).toBe(H.reasonTooLong);
  });

  it("eliminar pide escribir el código CT-#### de la casa, sin mayúsculas ni espacios de más", () => {
    expect(deleteConfirmMatches("CT-1042", "CT-1042")).toBe(true);
    expect(deleteConfirmMatches("CT-1042", "  ct-1042 ")).toBe(true);
    expect(deleteConfirmMatches("CT-1042", "1042")).toBe(false);
    expect(deleteConfirmMatches("CT-1042", "")).toBe(false);
  });

  it("la retención sale de las dos columnas de la fila", () => {
    expect(holdFromRow(null, null)).toBeNull();
    expect(holdFromRow("paused", "x")).toEqual({ kind: "paused", reason: "x" });
    expect(holdFromRow("blocked", null)).toEqual({ kind: "blocked", reason: "" });
    expect(holdFromRow("otra", "x")).toBeNull();
    expect(isBlocked({ adminHold: blocked })).toBe(true);
    expect(isBlocked({ adminHold: paused })).toBe(false);
  });
});

describe("lo que ve el propietario", () => {
  it("la etiqueta sobre la foto manda sobre las demás", () => {
    expect(cardLabel({ ...activeListing, adminHold: paused })).toEqual({ text: "Pausada por bnbtico", cls: "state-review" });
    expect(cardLabel({ ...activeListing, adminHold: blocked })).toEqual({ text: "Bloqueada por bnbtico", cls: "state-bad" });
    expect(cardLabel({ ...activeListing, status: "payment_due", adminHold: blocked }).text).toBe("Bloqueada por bnbtico");
    expect(cardLabel(activeListing).text).toBe("Activa");
  });

  it("el enlace de una pausada o bloqueada no se comparte; el calendario solo se cierra en una pausada", () => {
    expect(can(activeListing, "share")).toBe(true);
    expect(can({ ...activeListing, adminHold: paused }, "share")).toBe(false);
    expect(can({ ...activeListing, adminHold: blocked }, "share")).toBe(false);
    expect(can({ ...activeListing, adminHold: paused }, "available")).toBe(true);
    expect(can({ ...activeListing, adminHold: blocked }, "available")).toBe(false);
  });
});

describe("suscripción de una casa bloqueada", () => {
  it("no hay aviso de pago ni próximo cobro, y la línea dice que está parada", () => {
    expect(payButtonDue(sub(), TODAY)).toBe(true);
    expect(payButtonDue(sub({ hold: "paused" }), TODAY)).toBe(true);
    expect(payButtonDue(sub({ hold: "blocked" }), TODAY)).toBe(false);
    expect(payButtonDue(sub({ status: "payment_due", hold: "blocked" }), TODAY)).toBe(false);
    expect(subscriptionLine(sub({ hold: "blocked" }), TODAY)).toBe(BLOCKED_LINE);
    expect(subscriptionLine(sub({ hold: "paused" }), TODAY)).toBe("Gratis hasta el 10 nov 2026");
    expect(nextCharge([sub({ hold: "blocked" })], null, TODAY)).toBe("₡0 · sin método de pago");
    expect(nextCharge([sub({ hold: "blocked", plan: "paid", paidSince: "2026-09-01" })], { brand: "visa" }, TODAY)).toBe("₡0 · ninguna casa activa");
  });

  it("la retención viaja de la fila de owner_billing a las reglas", () => {
    const house: BillingHouse = { listingId: "l", publicId: "CT-1", title: "Casa", status: "active", plan: "promo", promoSlot: 1, promoMonths: 12, promoEndsOn: "2026-11-10", paidSince: null, stoppedOn: null, monthlyPriceCrc: 2900, hold: "blocked", reminders: [] };
    expect(houseSubscription(house, null).hold).toBe("blocked");
    expect(houseSubscription({ ...house, hold: undefined }, null).hold).toBeNull();
  });
});
