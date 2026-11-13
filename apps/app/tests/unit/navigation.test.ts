import { describe, expect, it } from "vitest";
import {
  MAX_TABS,
  cardLabel,
  casasView,
  noticeFor,
  ownerZoneRedirect,
  tabsFor,
  byPendingAction,
  type Tab,
} from "../../src/domain/navigation";
import type { Listing } from "../../src/domain/listing";
import { MONTHLY_FEE_CRC, type HouseSubscription } from "../../src/domain/subscription";

const TODAY = "2026-12-01";
const labels = (t: Tab[]) => t.map((x) => x.label);
const sub = (over: Partial<HouseSubscription> = {}): HouseSubscription => ({
  status: "active",
  plan: "promo",
  promoEndsOn: "2027-01-10",
  paidSince: null,
  stoppedOn: null,
  monthlyPriceCrc: MONTHLY_FEE_CRC,
  hasMethod: false,
  ...over,
});

describe("byPendingAction (revisión UX 2026-10-29, A3)", () => {
  it("lo que pide algo primero, luego las activas y al final las de revisión; dentro, el orden de la lista", () => {
    const l = (id: string, status: Listing["status"]) => ({ id, status });
    const out = byPendingAction([l("r", "review"), l("d1", "draft"), l("a1", "active"), l("c", "changes"), l("p", "payment_due"), l("a2", "active"), l("d2", "draft")]);
    expect(out.map((x) => x.id)).toEqual(["c", "p", "d1", "d2", "a1", "a2", "r"]);
  });
});

describe("tabsFor", () => {
  // Revisión UX 2026-10-29 (C4): la cuenta pasa a la barra de abajo; el propietario deja Favoritos dentro de Cuenta.
  it("sin sesión: 3Btico, Explorar, Favoritos e Ingresar", () =>
    expect(labels(tabsFor({ session: false, isAdmin: false, listingsCount: undefined }))).toEqual(["3Btico", "Explorar", "Favoritos", "Ingresar"]));
  it("cliente (cero casas) y lista aún sin leer: Explorar, Favoritos y Cuenta", () => {
    expect(labels(tabsFor({ session: true, isAdmin: false, listingsCount: 0 }))).toEqual(["3Btico", "Explorar", "Favoritos", "Cuenta"]);
    expect(labels(tabsFor({ session: true, isAdmin: false, listingsCount: undefined }))).toEqual(["Explorar", "Favoritos", "Cuenta"]);
  });
  it("propietario con un borrador: cinco, sin Favoritos, Consultas con el contador y Cuenta al final", () => {
    const t = tabsFor({ session: true, isAdmin: false, listingsCount: 1 });
    expect(labels(t)).toEqual(["Explorar", "Mi casa", "Calendario", "Consultas", "Cuenta"]);
    expect(t.find((x) => x.badge === "inquiries")?.to).toBe("/propietario/actividad");
    expect(t.at(-1)?.to).toBe("/cuenta");
  });
  it("«Mi casa» con una, «Mis casas» con dos o más", () => {
    for (const [n, label] of [
      [1, "Mi casa"],
      [2, "Mis casas"],
    ] as const) {
      const tab = tabsFor({ session: true, isAdmin: false, listingsCount: n }).find((x) => x.icon === "house");
      expect(tab).toMatchObject({ to: "/propietario/casas", label });
    }
  });
  it("admin: su barra", () => {
    for (const n of [0, 3]) expect(labels(tabsFor({ session: true, isAdmin: true, listingsCount: n }))).toEqual(["Anuncios", "Casas", "Usuarios", "Cuenta"]);
  });
  it("nunca más de cinco", () => {
    for (const session of [true, false])
      for (const isAdmin of [true, false])
        for (const n of [undefined, 0, 1, 9]) expect(tabsFor({ session, isAdmin, listingsCount: n }).length).toBeLessThanOrEqual(MAX_TABS);
  });
});

describe("casasView", () =>
  it("0 → none; una o más → list", () => expect([0, 1, 2, 7].map(casasView)).toEqual(["none", "list", "list", "list"])));

describe("noticeFor", () => {
  it("pago antes que seguir publicando; la pendiente de pago antes que la de la ventana de 90 días", () => {
    const listings = [
      { id: "d", status: "draft" as const },
      { id: "a", status: "active" as const },
      { id: "p", status: "payment_due" as const },
    ];
    const houses = [
      { listingId: "a", sub: sub() },
      { listingId: "p", sub: sub({ status: "payment_due", promoEndsOn: null }) },
    ];
    expect(noticeFor(listings, { today: TODAY, houses })).toEqual({ kind: "payment", listingId: "p" });
    expect(noticeFor(listings, { today: TODAY, houses: [houses[0]!] })).toEqual({ kind: "payment", listingId: "a" });
  });
  it("sin aviso de pago: el borrador y la casa con cambios no dan aviso", () =>
    expect(noticeFor([{ id: "a", status: "active" }, { id: "c", status: "changes" }, { id: "d", status: "draft" }], null)).toBeNull());
  it("un borrador solo no da aviso", () => expect(noticeFor([{ id: "d", status: "draft" }], null)).toBeNull());
  it("con método de pago o sin nada pendiente: null", () => {
    const houses = [{ listingId: "a", sub: sub({ hasMethod: true }) }];
    expect(noticeFor([{ id: "a", status: "active" }], { today: TODAY, houses })).toBeNull();
    expect(noticeFor([{ id: "a", status: "review" }], null)).toBeNull();
  });
  it("ignora suscripciones de casas que no están en la lista", () =>
    expect(noticeFor([{ id: "a", status: "active" }], { today: TODAY, houses: [{ listingId: "zzz", sub: sub({ status: "payment_due" }) }] })).toBeNull());
});

describe("cardLabel", () => {
  const l = (status: Listing["status"], available = true, reopenAt: string | null = null) => ({ status, available, reopenAt });
  it("pendiente de pago", () => expect(cardLabel(l("payment_due"))).toEqual({ text: "Pendiente de pago", cls: "state-pay" }));
  it("inactiva", () => expect(cardLabel(l("inactive"))).toEqual({ text: "Inactiva", cls: "state-off" }));
  // Revisión por dato (A5): sin «Edición sin enviar»; lo pendiente está en revisión o con cambios pedidos.
  it("cambios en revisión", () => expect(cardLabel(l("active"), { status: "review" })).toEqual({ text: "Cambios en revisión", cls: "state-review" }));
  it("cambios pedidos en una casa publicada", () => expect(cardLabel(l("active"), { status: "changes" })).toEqual({ text: "Cambios pedidos", cls: "state-review" }));
  // «Pausar la casa» del Calendario (ticket 04 de la ronda del 2 nov; antes «Cerrada hasta el …»).
  it("pausada con fecha", () => expect(cardLabel(l("active", false, "2026-12-03"))).toEqual({ text: "Pausada hasta el 3 dic", cls: "state-off" }));
  it("pausada sin fecha", () => expect(cardLabel(l("active", false, null))).toEqual({ text: "Pausada", cls: "state-off" }));
  it("pausada por el anfitrión no se confunde con «Pausada por 3bstays» (texto y color)", () => {
    const mine = cardLabel(l("active", false, null));
    const admin = cardLabel({ ...l("active"), adminHold: { kind: "paused", reason: "" } });
    expect(admin.text).toBe("Pausada por 3bstays");
    expect(admin.cls).not.toBe(mine.cls);
  });
  it("activa", () => expect(cardLabel(l("active"))).toEqual({ text: "Activa", cls: "state-ok" }));
  it("en revisión", () => expect(cardLabel(l("review"))).toEqual({ text: "En revisión", cls: "state-review" }));
  it("borrador", () => expect(cardLabel(l("draft"))).toEqual({ text: "Borrador", cls: "state-draft" }));
  it("cambios pedidos", () => expect(cardLabel(l("changes"))).toEqual({ text: "Cambios pedidos", cls: "state-review" }));
  it("rechazada", () => expect(cardLabel(l("rejected"))).toEqual({ text: "Rechazada", cls: "state-bad" }));
  it("prioridad: pago > edición > cerrada > estado", () => {
    expect(cardLabel({ status: "payment_due", available: false, reopenAt: "2026-12-03" }, { status: "review" }).text).toBe("Pendiente de pago");
    expect(cardLabel({ status: "active", available: false, reopenAt: null }, { status: "review" }).text).toBe("Cambios en revisión");
    expect(cardLabel({ status: "inactive", available: true, reopenAt: null }, { status: "review" }).text).toBe("Inactiva");
  });
});

describe("ownerZoneRedirect", () =>
  it("solo con la lista leída, vacía y sin lectura en curso", () => {
    expect(ownerZoneRedirect(0, false)).toBe(true);
    expect(ownerZoneRedirect(0, true)).toBe(false);
    expect(ownerZoneRedirect(undefined, false)).toBe(false);
    expect(ownerZoneRedirect(1, false)).toBe(false);
  }));

