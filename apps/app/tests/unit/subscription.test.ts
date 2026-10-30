// Reglas de la suscripción (fase 5, ticket 01): port a Vitest de las reglas de v1 de tests/prototype/estados-casa.cjs,
// mis-casas.cjs y house-controls.cjs, con fechas de Costa Rica fijas en vez del reloj real.
// No se porta: Veriff, contacto directo, el botón «Simular fin de oferta · demo» (lo sustituye el reloj de pruebas), las
// aserciones de la vista web y la persistencia en localStorage del prototipo. El texto de la tarjeta y del 410 se prueba
// aquí; que no haya botón de contacto lo prueban las pantallas (Playwright, tickets siguientes).
import { afterEach, describe, expect, it, vi } from "vitest";
import { can } from "../../src/domain/can";
import { costaRicaToday } from "../../src/domain/inquiry";
import { launchOffer as offerLaunchOffer } from "../../src/domain/offer";
import {
  LAUNCH_TIERS,
  MONTHLY_FEE_CRC,
  REMINDER_DAYS,
  SUBSCRIPTION_MESSAGES,
  blockedReason,
  cardDate,
  daysLeft,
  launchOffer,
  nextCharge,
  nextStatus,
  parsePayHash,
  payButtonDue,
  payLink,
  promoEndsOn,
  promoRunning,
  reminderCard,
  reminderDaysLeft,
  reminderThreshold,
  reminderWhatsApp,
  subscriptionLine,
  tierForSlot,
  type HouseSubscription,
  type SubscriptionEvent,
} from "../../src/domain/subscription";

const TODAY = "2026-12-01";
const nbsp = "\u00a0";
const fee = `₡2${nbsp}900`;

const house = (over: Partial<HouseSubscription> = {}): HouseSubscription => ({
  status: "active",
  plan: "promo",
  promoEndsOn: "2027-01-10",
  paidSince: null,
  stoppedOn: null,
  monthlyPriceCrc: MONTHLY_FEE_CRC,
  hasMethod: false,
  ...over,
});

/** Aplica un evento como lo harían la RPC o el fake: estado nuevo y, al terminar la oferta con método, plan de pago. */
function apply(sub: HouseSubscription, event: SubscriptionEvent, today: string, extra: { isOwner?: boolean; accountActive?: boolean } = {}): HouseSubscription {
  const hasMethod = sub.hasMethod || event === "methodAdded";
  const r = nextStatus(sub.status, event, { promoRunning: promoRunning(sub, today), hasMethod, ...extra });
  if (!r.ok) throw new Error(r.message);
  const next = { ...sub, status: r.status, hasMethod };
  const promoOver = sub.plan === "promo" && !promoRunning(sub, today);
  if (promoOver && hasMethod && r.status === "active") {
    next.plan = "paid";
    next.paidSince = event === "methodAdded" && sub.status === "payment_due" ? today : addDay(sub.promoEndsOn!);
  }
  if (r.status === "inactive") next.stoppedOn = today;
  return next;
}
const addDay = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
const isPublic = (s: HouseSubscription) => can({ status: s.status, reviewedAt: "2026-10-01T00:00:00Z" }, "share");

describe("constantes", () => {
  it("tramos, tarifa y umbrales de aviso", () => {
    expect(LAUNCH_TIERS).toEqual([
      { size: 50, months: 12 },
      { size: 50, months: 6 },
      { size: 100, months: 3 },
    ]);
    expect(MONTHLY_FEE_CRC).toBe(2900);
    expect(REMINDER_DAYS).toEqual([90, 30, 7, 0]);
  });

  it("launchOffer es la misma de offer.ts (las pantallas no cambian) y su argumento son las plazas asignadas", () => {
    expect(launchOffer).toBe(offerLaunchOffer);
    expect(launchOffer(37)).toEqual({ months: 12, size: 50, taken: 37, remaining: 13 });
  });
});

describe("tierForSlot", () => {
  it("1–50 → 12 meses, 51–100 → 6, 101–200 → 3, después sin oferta", () => {
    expect(tierForSlot(1)).toEqual({ months: 12 });
    expect(tierForSlot(50)).toEqual({ months: 12 });
    expect(tierForSlot(51)).toEqual({ months: 6 });
    expect(tierForSlot(100)).toEqual({ months: 6 });
    expect(tierForSlot(101)).toEqual({ months: 3 });
    expect(tierForSlot(200)).toEqual({ months: 3 });
    expect(tierForSlot(201)).toBeNull();
  });

  it("plazas imposibles no dan oferta", () => {
    expect(tierForSlot(0)).toBeNull();
    expect(tierForSlot(-1)).toBeNull();
    expect(tierForSlot(1.5)).toBeNull();
  });
});

describe("promoEndsOn: el último día gratis", () => {
  it("mismo número de día N meses después", () => {
    expect(promoEndsOn("2026-10-14", 12)).toBe("2027-10-14");
    expect(promoEndsOn("2026-10-14", 6)).toBe("2027-04-14");
    expect(promoEndsOn("2026-11-30", 3)).toBe("2027-02-28");
  });

  it("ajusta al último día del mes (31 ene + 1 → 28 o 29 feb)", () => {
    expect(promoEndsOn("2027-01-31", 1)).toBe("2027-02-28");
    expect(promoEndsOn("2028-01-31", 1)).toBe("2028-02-29");
    expect(promoEndsOn("2026-08-31", 6)).toBe("2027-02-28");
    expect(promoEndsOn("2026-05-31", 6)).toBe("2026-11-30");
  });

  it("cruza el año", () => {
    expect(promoEndsOn("2026-12-15", 3)).toBe("2027-03-15");
  });
});

describe("daysLeft y reminderThreshold", () => {
  it("cuenta días de Costa Rica: 0 el último día gratis, negativo al terminar", () => {
    expect(daysLeft("2027-01-10", "2026-12-01")).toBe(40);
    expect(daysLeft("2027-01-10", "2027-01-10")).toBe(0);
    expect(daysLeft("2027-01-10", "2027-01-11")).toBe(-1);
    expect(daysLeft("2027-03-15", "2027-03-14")).toBe(1);
  });

  it("el umbral más pequeño ≥ días restantes", () => {
    expect(reminderThreshold(91)).toBeNull();
    expect(reminderThreshold(90)).toBe(90);
    expect(reminderThreshold(31)).toBe(90);
    expect(reminderThreshold(30)).toBe(30);
    expect(reminderThreshold(8)).toBe(30);
    expect(reminderThreshold(7)).toBe(7);
    expect(reminderThreshold(1)).toBe(7);
    expect(reminderThreshold(0)).toBe(0);
    expect(reminderThreshold(-1)).toBeNull();
  });

  it("no porta el fallo del prototipo (su `find(d => daysLeft <= d)` devolvía siempre 90)", () => {
    const prototype = (left: number) => [90, 30, 7, 0].find((d) => left <= d);
    expect(prototype(20)).toBe(90);
    expect(reminderThreshold(20)).toBe(30);
    expect(prototype(3)).toBe(90);
    expect(reminderThreshold(3)).toBe(7);
  });

  it("si el trabajo se saltó días, toca el umbral en el que está ahora (no los anteriores)", () => {
    // Pasó de 31 a 6 días sin correr: solo el de 7.
    expect(reminderThreshold(6)).toBe(7);
  });

  describe("con el reloj de Costa Rica", () => {
    afterEach(() => vi.useRealTimers());
    it("a las 23:30 de Costa Rica sigue siendo el último día; a las 00:05 ya terminó", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2027-01-11T05:30:00Z")); // 23:30 del 10 ene en Costa Rica (UTC−6)
      expect(daysLeft("2027-01-10", costaRicaToday(Date.now()))).toBe(0);
      vi.setSystemTime(new Date("2027-01-11T06:05:00Z"));
      expect(daysLeft("2027-01-10", costaRicaToday(Date.now()))).toBe(-1);
    });
  });
});

describe("nextStatus: la máquina de estados", () => {
  const ctx = { promoRunning: false, hasMethod: false };

  it("aprobar: activa con oferta o con método; si no, pendiente de pago", () => {
    expect(nextStatus("review", "approve", { promoRunning: true, hasMethod: false })).toEqual({ ok: true, status: "active" });
    expect(nextStatus("review", "approve", { promoRunning: false, hasMethod: true })).toEqual({ ok: true, status: "active" });
    expect(nextStatus("review", "approve", ctx)).toEqual({ ok: true, status: "payment_due" });
  });

  it("fin de la oferta: activa con método, pendiente de pago sin él", () => {
    expect(nextStatus("active", "dayPassed", { promoRunning: false, hasMethod: true })).toEqual({ ok: true, status: "active" });
    expect(nextStatus("active", "dayPassed", ctx)).toEqual({ ok: true, status: "payment_due" });
    expect(nextStatus("active", "dayPassed", { promoRunning: true, hasMethod: false })).toEqual({ ok: true, status: "active" });
  });

  it("añadir método: pendiente de pago → activa; las demás no cambian", () => {
    expect(nextStatus("payment_due", "methodAdded", { promoRunning: false, hasMethod: true })).toEqual({ ok: true, status: "active" });
    for (const s of ["active", "inactive", "review", "draft"] as const) {
      expect(nextStatus(s, "methodAdded", { promoRunning: false, hasMethod: true })).toEqual({ ok: true, status: s });
    }
  });

  it("parar: desde activa o pendiente de pago", () => {
    expect(nextStatus("active", "stop", ctx)).toEqual({ ok: true, status: "inactive" });
    expect(nextStatus("payment_due", "stop", ctx)).toEqual({ ok: true, status: "inactive" });
  });

  it("reactivar: por la regla de aprobar", () => {
    expect(nextStatus("inactive", "resume", { promoRunning: true, hasMethod: false })).toEqual({ ok: true, status: "active" });
    expect(nextStatus("inactive", "resume", { promoRunning: false, hasMethod: true })).toEqual({ ok: true, status: "active" });
    expect(nextStatus("inactive", "resume", ctx)).toEqual({ ok: true, status: "payment_due" });
  });

  it("cualquier otro par se rechaza con el mensaje en español (el mismo del SQL)", () => {
    for (const s of ["draft", "changes", "rejected", "active", "payment_due", "inactive"] as const) {
      expect(nextStatus(s, "approve", ctx)).toEqual({ ok: false, message: SUBSCRIPTION_MESSAGES.approve });
    }
    for (const s of ["draft", "review", "changes", "rejected", "inactive"] as const) {
      expect(nextStatus(s, "stop", ctx)).toEqual({ ok: false, message: SUBSCRIPTION_MESSAGES.stop });
    }
    for (const s of ["draft", "review", "changes", "rejected", "active", "payment_due"] as const) {
      expect(nextStatus(s, "resume", ctx)).toEqual({ ok: false, message: SUBSCRIPTION_MESSAGES.resume });
    }
    for (const s of ["review", "payment_due", "inactive"] as const) {
      expect(nextStatus(s, "dayPassed", ctx)).toEqual({ ok: false, message: SUBSCRIPTION_MESSAGES.dayPassed });
    }
  });

  it("los mensajes van de usted", () => {
    expect(SUBSCRIPTION_MESSAGES).toEqual({
      notFound: "No encontramos ese anuncio.",
      inactiveAccount: "Su cuenta está desactivada. Escríbanos por WhatsApp.",
      approve: "Solo se pueden aprobar casas en revisión.",
      stop: "Solo puede parar la suscripción de una casa activa o pendiente de pago.",
      resume: "Solo puede reactivar una casa con la suscripción parada.",
      dayPassed: "Solo cambia con los días una casa activa.",
      session: "Su sesión venció. Ingrese de nuevo.",
      testClockOff: "El reloj de pruebas no está habilitado.",
    });
    expect(Object.values(SUBSCRIPTION_MESSAGES).join(" ")).not.toMatch(/podés|parás|añadí|tenés|vos\b/);
  });
});

describe("prototipo · estados-casa.cjs", () => {
  const inWindow = house({ promoEndsOn: "2027-01-10" }); // CT-1042: 40 días
  const farAway = house({ promoEndsOn: "2027-10-01" }); // CT-1150: 304 días

  it("una casa dentro de su oferta está Activa y tiene aviso con ≤ 90 días; con más de 90, ninguno", () => {
    expect(inWindow.status).toBe("active");
    expect(reminderDaysLeft(inWindow, TODAY)).toBe(40);
    expect(reminderDaysLeft(inWindow, TODAY)!).toBeLessThanOrEqual(90);
    expect(reminderDaysLeft(farAway, TODAY)).toBeNull();
    expect(reminderDaysLeft(house({ promoEndsOn: "2027-03-02" }), TODAY)).toBeNull();
    expect(reminderDaysLeft(house({ promoEndsOn: "2027-03-01" }), TODAY)).toBe(90);
  });

  it("la tarjeta del aviso dice cuánto falta y «También se lo recordamos por WhatsApp», nunca el texto del WhatsApp", () => {
    const card = reminderCard(reminderDaysLeft(inWindow, TODAY)!)!;
    expect(card.title).toMatch(/^Su oferta gratuita termina en \d+ días$/);
    expect(card.body).toMatch(/También se lo recordamos por WhatsApp\.$/);
    expect(card.title + card.body).not.toMatch(/Somos bnbtico|La oferta gratuita de|#pago=/);
  });

  it("fin de la oferta sin método → Pendiente de pago, fuera del catálogo", () => {
    const ended = apply(inWindow, "dayPassed", "2027-01-11");
    expect(ended.status).toBe("payment_due");
    expect(subscriptionLine(ended, "2027-01-11")).toBe("Pendiente de pago");
    expect(isPublic(ended)).toBe(false);
  });

  it("añadir método → Activa con «Suscripción activa», pública otra vez", () => {
    const ended = apply(inWindow, "dayPassed", "2027-01-11");
    const paid = apply(ended, "methodAdded", "2027-01-12");
    expect(paid.status).toBe("active");
    expect(subscriptionLine(paid, "2027-01-12")).toBe(`Suscripción activa desde el 12 ene 2027 · ${fee} al mes`);
    expect(isPublic(paid)).toBe(true);
  });

  it("método guardado antes del fin → al terminar pasa sola al plan de pago y sigue Activa", () => {
    const saved = apply(farAway, "methodAdded", TODAY);
    expect(saved).toMatchObject({ status: "active", plan: "promo", hasMethod: true });
    const after = apply(saved, "dayPassed", "2027-10-02");
    expect(after).toMatchObject({ status: "active", plan: "paid", paidSince: "2027-10-02" });
    expect(isPublic(after)).toBe(true);
  });

  it("parar → Inactiva, fuera del catálogo y sin contacto; reactivar no pide Veriff, solo la cuenta activa", () => {
    const stopped = apply(inWindow, "stop", TODAY);
    expect(stopped.status).toBe("inactive");
    expect(isPublic(stopped)).toBe(false);
    // El contexto no tiene identidad: no hay nada que comprobar de Veriff (v1.1).
    const resumed = apply(stopped, "resume", TODAY, { isOwner: true, accountActive: true });
    expect(resumed.status).toBe("active");
    expect(isPublic(resumed)).toBe(true);
    expect(nextStatus("inactive", "resume", { promoRunning: true, hasMethod: false, accountActive: false })).toEqual({ ok: false, message: SUBSCRIPTION_MESSAGES.inactiveAccount });
  });

  it("el 410 de una casa parada dice «paró la suscripción»; el de una sin pagar, «regularice su suscripción»", () => {
    expect(blockedReason("stopped")).toMatch(/paró la suscripción/);
    expect(blockedReason("stopped")).toBe("El propietario paró la suscripción de este anuncio, así que el enlace ya no muestra la ficha ni permite contactarlo desde bnbtico.");
    expect(blockedReason("payment")).toBe("Este anuncio está fuera del catálogo hasta que el propietario regularice su suscripción.");
    expect(blockedReason("other")).toBe("Este anuncio no está disponible en este momento.");
    expect(blockedReason(null)).toBe("Este anuncio no está disponible en este momento.");
  });

  it("el WhatsApp dice que no se cobra nada hasta esa fecha, lleva #pago=CT-#### y no da instrucciones de navegación", () => {
    const wa = reminderWhatsApp({ name: "Marcela", title: "Casa Cocles", endsOn: "2027-10-01", link: payLink("https://bnbtico.com", "CT-1150"), daysBefore: 90 });
    expect(wa).toMatch(/hasta entonces no se le cobra nada/);
    expect(wa).toMatch(/#pago=CT-1150/);
    expect(wa).not.toMatch(/Cuenta → Promoción/);
  });

  it("la casa enlazada (dentro de la ventana) ofrece el botón de pago", () => {
    expect(payButtonDue(inWindow, TODAY)).toBe(true);
  });
});

describe("prototipo · mis-casas.cjs: «Añadir método de pago» solo cuando toca avisar", () => {
  it("sale en la casa dentro de la ventana y no en la de fuera; desaparece al añadir el método", () => {
    const inWindow = house({ promoEndsOn: "2027-01-10" });
    const farAway = house({ promoEndsOn: "2027-10-01" });
    expect(payButtonDue(inWindow, TODAY)).toBe(true);
    expect(payButtonDue(farAway, TODAY)).toBe(false);
    expect(payButtonDue({ ...inWindow, hasMethod: true }, TODAY)).toBe(false);
  });

  it("también con la casa pendiente de pago, y nunca parada, en revisión ni ya con plan de pago", () => {
    expect(payButtonDue(house({ status: "payment_due", promoEndsOn: "2026-10-01" }), TODAY)).toBe(true);
    expect(payButtonDue(house({ status: "payment_due", plan: "paid", promoEndsOn: null }), TODAY)).toBe(true);
    expect(payButtonDue(house({ status: "payment_due", hasMethod: true }), TODAY)).toBe(false);
    expect(payButtonDue(house({ status: "inactive" }), TODAY)).toBe(false);
    expect(payButtonDue(house({ status: "review" }), TODAY)).toBe(false);
    expect(payButtonDue(house({ plan: "paid", promoEndsOn: "2026-11-01", paidSince: "2026-11-02", hasMethod: true }), TODAY)).toBe(false);
  });

  it("el último día de la oferta todavía sale; al día siguiente la casa ya no está activa", () => {
    const h = house({ promoEndsOn: TODAY });
    expect(payButtonDue(h, TODAY)).toBe(true);
    expect(payButtonDue(h, "2026-12-02")).toBe(false);
  });
});

describe("prototipo · house-controls.cjs: parar y reactivar por casa", () => {
  it("parar una casa no toca las demás", () => {
    const mine = { a: house(), b: house({ promoEndsOn: "2027-10-01" }) };
    const after = { ...mine, a: apply(mine.a, "stop", TODAY) };
    expect(after.a.status).toBe("inactive");
    expect(after.b).toEqual(mine.b);
  });

  it("una casa ajena no se puede parar ni reactivar", () => {
    expect(nextStatus("active", "stop", { promoRunning: true, hasMethod: false, isOwner: false })).toEqual({ ok: false, message: SUBSCRIPTION_MESSAGES.notFound });
    expect(nextStatus("inactive", "resume", { promoRunning: true, hasMethod: false, isOwner: false })).toEqual({ ok: false, message: SUBSCRIPTION_MESSAGES.notFound });
  });

  it("una casa no aprobada no se puede reactivar", () => {
    expect(nextStatus("draft", "resume", { promoRunning: true, hasMethod: false })).toEqual({ ok: false, message: SUBSCRIPTION_MESSAGES.resume });
  });

  it("la oferta sigue corriendo con la casa parada: al reactivar después del fin, sin método, queda pendiente de pago", () => {
    const stopped = apply(house({ promoEndsOn: "2027-01-10" }), "stop", TODAY);
    expect(apply(stopped, "resume", "2027-01-11").status).toBe("payment_due");
    expect(apply(stopped, "resume", "2027-01-10").status).toBe("active");
  });
});

describe("subscriptionLine", () => {
  it("una línea por estado", () => {
    expect(subscriptionLine(house({ promoEndsOn: "2027-10-14" }), TODAY)).toBe("Gratis hasta el 14 oct 2027");
    expect(subscriptionLine(house({ status: "payment_due" }), TODAY)).toBe("Pendiente de pago");
    expect(subscriptionLine(house({ plan: "paid", paidSince: "2027-10-15", hasMethod: true }), TODAY)).toBe(`Suscripción activa desde el 15 oct 2027 · ${fee} al mes`);
    expect(subscriptionLine(house({ status: "inactive", stoppedOn: "2026-10-09" }), TODAY)).toBe("Parada el 9 oct · no se cobra");
    expect(subscriptionLine(house({ status: "inactive", stoppedOn: "2025-10-09" }), TODAY)).toBe("Parada el 9 oct 2025 · no se cobra");
    expect(subscriptionLine(house({ status: "review" }), TODAY)).toBe(`En revisión · ₡0`);
  });

  it("usa el precio de la suscripción de la casa", () => {
    expect(subscriptionLine(house({ plan: "paid", paidSince: "2027-10-15", hasMethod: true, monthlyPriceCrc: 9900 }), TODAY)).toBe(`Suscripción activa desde el 15 oct 2027 · ₡9${nbsp}900 al mes`);
  });

  it("con método y la oferta ya terminada (antes del trabajo diario) dice desde cuándo es de pago", () => {
    expect(subscriptionLine(house({ promoEndsOn: "2026-11-30", hasMethod: true }), TODAY)).toBe(`Suscripción activa desde el 1 dic 2026 · ${fee} al mes`);
  });

  it("sin línea en borradores, cambios pedidos y rechazadas", () => {
    for (const status of ["draft", "changes", "rejected"] as const) expect(subscriptionLine(house({ status }), TODAY)).toBeNull();
  });

  it("cardDate: «14 oct 2027»", () => {
    expect(cardDate("2027-10-14")).toBe("14 oct 2027");
    expect(cardDate("2027-01-01")).toBe("1 ene 2027");
  });
});

describe("reminderCard", () => {
  it("«termina en N días», «mañana» y «hoy»", () => {
    expect(reminderCard(30)?.title).toBe("Su oferta gratuita termina en 30 días");
    expect(reminderCard(90)?.title).toBe("Su oferta gratuita termina en 90 días");
    expect(reminderCard(1)?.title).toBe("Su oferta gratuita termina mañana");
    expect(reminderCard(0)?.title).toBe("Su oferta gratuita termina hoy");
  });

  it("el cuerpo exacto, con la tarifa vigente", () => {
    expect(reminderCard(7)?.body).toBe(
      `No se le cobrará nada hasta entonces. Añada un método de pago antes de esa fecha para que su casa siga saliendo en bnbtico; después, ${fee} al mes por casa, sin permanencia. También se lo recordamos por WhatsApp.`,
    );
  });

  it("fuera de la ventana no hay tarjeta", () => {
    expect(reminderCard(91)).toBeNull();
    expect(reminderCard(-1)).toBeNull();
  });
});

describe("reminderWhatsApp", () => {
  const base = { name: "Marcela", title: "Casa Cocles", endsOn: "2027-10-14", link: "https://bnbtico.com/propietario/suscripcion#pago=CT-1042" };

  it("90, 30 y 7 días: el texto exacto", () => {
    const expected = `Hola, Marcela. Somos bnbtico. La oferta gratuita de «Casa Cocles» termina el 14 de octubre: hasta entonces no se le cobra nada. Para que su casa siga saliendo en bnbtico después, añada un método de pago aquí: https://bnbtico.com/propietario/suscripcion#pago=CT-1042 Desde esa fecha, ${fee} al mes por casa, sin permanencia; puede pararla cuando quiera.`;
    for (const daysBefore of [90, 30, 7] as const) expect(reminderWhatsApp({ ...base, daysBefore })).toBe(expected);
  });

  it("el último día: termina hoy y desde mañana deja de mostrarse", () => {
    expect(reminderWhatsApp({ ...base, daysBefore: 0 })).toBe(
      `Hola, Marcela. Somos bnbtico. La oferta gratuita de «Casa Cocles» termina hoy. Si no añade un método de pago, desde mañana su casa deja de mostrarse en bnbtico: https://bnbtico.com/propietario/suscripcion#pago=CT-1042 Hoy todavía no se le cobra nada; después, ${fee} al mes por casa, sin permanencia; puede pararla cuando quiera.`,
    );
  });

  it("sin nombre saluda igual", () => {
    expect(reminderWhatsApp({ ...base, name: null, daysBefore: 30 })).toMatch(/^Hola\. Somos bnbtico\. La oferta/);
    expect(reminderWhatsApp({ ...base, name: "  ", daysBefore: 30 })).toMatch(/^Hola\. Somos bnbtico\./);
  });

  it("de usted, sin voseo", () => {
    expect(reminderWhatsApp({ ...base, daysBefore: 7 }) + reminderWhatsApp({ ...base, daysBefore: 0 })).not.toMatch(/añadí|podés|te cobrará|tu casa/);
  });
});

describe("payLink y parsePayHash", () => {
  it("enlace a la pantalla de suscripción con el id de la casa", () => {
    expect(payLink("https://bnbtico.com", "CT-1042")).toBe("https://bnbtico.com/propietario/suscripcion#pago=CT-1042");
    expect(payLink("https://pruebas.bnbtico.com/", "CT-1042")).toBe("https://pruebas.bnbtico.com/propietario/suscripcion#pago=CT-1042");
  });

  it("solo acepta #pago=CT- con cuatro o más cifras", () => {
    expect(parsePayHash("#pago=CT-1042")).toBe("CT-1042");
    expect(parsePayHash("#pago=CT-10420")).toBe("CT-10420");
    for (const bad of ["", "#pago=CT-104", "#pago=ct-1042", "pago=CT-1042", "#pago=CT-1042&x=1", "#pago=CT-1042 ", "#casa=CT-1042", "#pago=<script>"]) {
      expect(parsePayHash(bad)).toBeNull();
    }
  });

  it("ida y vuelta", () => {
    expect(parsePayHash(new URL(payLink("https://bnbtico.com", "CT-2001")).hash)).toBe("CT-2001");
  });
});

describe("nextCharge (informativo: en v1 no se cobra)", () => {
  // Revisión UX 2026-10-29 (C5): en plena oferta, sin método, no suena a problema: hasta cuándo no paga nada.
  it("sin método de pago, en plena oferta: «Nada hasta el …» con la oferta que termina antes", () => {
    expect(nextCharge([house(), house({ promoEndsOn: "2026-12-01" })], null, TODAY)).toBe("Nada hasta el 1 dic 2026");
  });
  it("sin método de pago y sin oferta en curso", () => {
    expect(nextCharge([house({ status: "payment_due", plan: "paid", promoEndsOn: null })], null, TODAY)).toBe("₡0 · sin método de pago");
  });

  it("con método pero ninguna casa activa", () => {
    expect(nextCharge([house({ status: "inactive" }), house({ status: "review" })], {}, TODAY)).toBe("₡0 · ninguna casa activa");
    expect(nextCharge([], {}, TODAY)).toBe("₡0 · ninguna casa activa");
  });

  it("el día siguiente al fin de la oferta que termina primero, sumando las que empiezan ese día", () => {
    const houses = [house({ promoEndsOn: "2027-10-14", hasMethod: true }), house({ promoEndsOn: "2027-10-14", hasMethod: true }), house({ promoEndsOn: "2028-04-14", hasMethod: true })];
    expect(nextCharge(houses, {}, TODAY)).toBe(`₡5${nbsp}800 · 15 oct 2027`);
    expect(nextCharge([houses[2]!], {}, TODAY)).toBe(`${fee} · 15 abr 2028`);
  });

  it("una casa ya de pago: su siguiente mensualidad desde hoy", () => {
    const paid = house({ plan: "paid", promoEndsOn: "2026-10-30", paidSince: "2026-10-31", hasMethod: true });
    expect(nextCharge([paid], {}, TODAY)).toBe(`${fee} · 31 dic 2026`);
    expect(nextCharge([paid], {}, "2026-10-31")).toBe(`${fee} · 31 oct 2026`);
    expect(nextCharge([paid], {}, "2027-02-01")).toBe(`${fee} · 28 feb 2027`);
  });
});

describe("promoRunning", () => {
  it("hasta el último día gratis incluido; nunca sin oferta", () => {
    expect(promoRunning(house({ promoEndsOn: TODAY }), TODAY)).toBe(true);
    expect(promoRunning(house({ promoEndsOn: "2026-11-30" }), TODAY)).toBe(false);
    expect(promoRunning(house({ plan: "paid", promoEndsOn: null }), TODAY)).toBe(false);
  });
});
