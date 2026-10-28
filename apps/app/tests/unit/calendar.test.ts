// Reglas del calendario del propietario (fase 4, ticket 01): el port a Vitest de las reglas de v1 de
// tests/prototype/calendar.cjs. Cada `describe` cita la aserción del prototipo que porta.
// No se portan las de temporadas (alta/baja), precio de fin de semana, «Restaurar tarifa» con tarifas configuradas ni
// «Configurar tarifas» (calendarConfigure): quedan fuera de v1 (spec de la fase 4, § Out of Scope).
import { describe, expect, it } from "vitest";
import {
  CALENDAR_MESSAGES as M,
  applyChange,
  availabilityUpdate,
  calendarWindow,
  changeFromSelection,
  clearSelection,
  compactPrice,
  effectiveDay,
  emptySelection,
  monthGrid,
  monthTitle,
  occupiedNightsIn,
  occupiedNightsLabel,
  openingMonth,
  reopenIfDue,
  selectDay,
  selectionLabel,
  setAvailability,
  setPrice,
  validateChange,
  validateReopenDate,
  type CalendarChange,
  type CalendarDay,
  type CalendarListing,
  type Selection,
  type SelectionContext,
} from "../../src/domain/calendar";
import { can } from "../../src/domain/can";
import { costaRicaToday } from "../../src/domain/inquiry";

const TODAY = "2026-12-01";
const BASE = 95_000;
const open: CalendarListing = { status: "active", available: true, nightlyPriceCrc: BASE };
const ok = (change: CalendarChange, listing: CalendarListing | null = open) => validateChange(change, { today: TODAY, listing });
const day = (d: number) => `2026-12-${String(d).padStart(2, "0")}`;
const occupied = (d: string, specialPriceCrc: number | null = null): CalendarDay => ({ day: d, available: false, specialPriceCrc });
const special = (d: string, specialPriceCrc: number): CalendarDay => ({ day: d, available: true, specialPriceCrc });

/** Valida y aplica, como harán la RPC y el fake: si no es válido, los días no cambian. */
function save(days: CalendarDay[], change: CalendarChange, listing: CalendarListing = open): { days: CalendarDay[]; error: string | null } {
  const error = ok(change, listing);
  return { days: error ? days : applyChange(days, listing.nightlyPriceCrc, change), error };
}

describe("días efectivos (calendarDay)", () => {
  it("un día sin fila es disponible al precio base y sin ★", () => {
    expect(effectiveDay([], BASE, day(3))).toEqual({ day: day(3), available: true, priceCrc: BASE, special: false });
  });
  it("una fila con precio especial lleva ★; una ocupada sin precio conserva el base", () => {
    const days = [special(day(3), 120_000), occupied(day(4))];
    expect(effectiveDay(days, BASE, day(3))).toEqual({ day: day(3), available: true, priceCrc: 120_000, special: true });
    expect(effectiveDay(days, BASE, day(4))).toEqual({ day: day(4), available: false, priceCrc: BASE, special: false });
  });
  it("acepta un Map ya indexado (la rejilla consulta 42 días)", () => {
    const map = new Map([[day(3), special(day(3), 120_000)]]);
    expect(effectiveDay(map, BASE, day(3)).priceCrc).toBe(120_000);
  });
  it("casa solo mensual: sin precio por noche", () => {
    expect(effectiveDay([occupied(day(3))], null, day(3))).toEqual({ day: day(3), available: false, priceCrc: null, special: false });
  });
});

describe("disponibilidad y precio independientes («season must not free an occupied date», «freeing a date must retain price»)", () => {
  it("ocupar conserva el precio de cada día", () => {
    const start = [special(day(1), 140_000)];
    const { days } = save(start, { days: [day(1), day(2)], available: false });
    expect(effectiveDay(days, BASE, day(1))).toMatchObject({ available: false, priceCrc: 140_000, special: true });
    expect(effectiveDay(days, BASE, day(2))).toMatchObject({ available: false, priceCrc: BASE });
  });
  it("liberar conserva el precio; cambiar el precio no libera un día ocupado", () => {
    let { days } = save([occupied(day(1))], { days: [day(1)], priceCrc: 140_000 });
    expect(effectiveDay(days, BASE, day(1))).toMatchObject({ available: false, priceCrc: 140_000 });
    ({ days } = save(days, { days: [day(1)], available: true }));
    expect(effectiveDay(days, BASE, day(1))).toMatchObject({ available: true, priceCrc: 140_000, special: true });
    ({ days } = save(days, { days: [day(1)], priceCrc: 75_000 }));
    expect(effectiveDay(days, BASE, day(1)).priceCrc).toBe(75_000);
  });
  it("solo se guardan diferencias: liberar un día sin precio especial borra su fila", () => {
    const { days } = save([occupied(day(1)), occupied(day(2), 120_000)], { days: [day(1), day(2)], available: true });
    expect(days).toEqual([special(day(2), 120_000)]);
  });
  it("devuelve una lista nueva, ordenada, sin tocar la de entrada", () => {
    const start = [occupied(day(9))];
    const next = applyChange(start, BASE, { days: [day(5), day(5), day(2)], available: false });
    expect(next.map((d) => d.day)).toEqual([day(2), day(5), day(9)]);
    expect(start).toEqual([occupied(day(9))]);
  });
});

describe("precio igual al base no es especial («price equal to base is not special», «matching configured … price is not special»)", () => {
  it("escribir el precio base quita la ★ y borra la fila si el día está libre", () => {
    const { days } = save([special(day(18), 120_000)], { days: [day(18)], priceCrc: BASE });
    expect(days).toEqual([]);
    expect(effectiveDay(days, BASE, day(18))).toMatchObject({ priceCrc: BASE, special: false });
  });
  it("en un día ocupado quita el precio especial y conserva la ocupación", () => {
    const { days } = save([occupied(day(18), 120_000)], { days: [day(18)], priceCrc: BASE });
    expect(days).toEqual([occupied(day(18))]);
  });
});

describe("mismo precio en bloque, independiente después («bulk specials independent»)", () => {
  it("cambiar luego un día no arrastra a los demás", () => {
    let { days } = save([], { days: [day(4), day(5)], priceCrc: 77_000 });
    ({ days } = save(days, { days: [day(4)], priceCrc: 88_000 }));
    expect(effectiveDay(days, BASE, day(5)).priceCrc).toBe(77_000);
    expect(effectiveDay(days, BASE, day(4)).priceCrc).toBe(88_000);
  });
});

describe("aislamiento por casa («another house stays unchanged», «house isolation»)", () => {
  it("los días de una casa no cambian los de otra", () => {
    const calendars = new Map<string, CalendarDay[]>([
      ["casa-a", []],
      ["casa-b", [special(day(1), 150_000)]],
    ]);
    calendars.set("casa-a", save(calendars.get("casa-a")!, { days: [day(1)], available: false, priceCrc: 140_000 }).days);
    expect(effectiveDay(calendars.get("casa-b")!, BASE, day(1))).toMatchObject({ available: true, priceCrc: 150_000 });
    expect(effectiveDay(calendars.get("casa-a")!, BASE, day(1))).toMatchObject({ available: false, priceCrc: 140_000 });
  });
});

describe("edición en bloque inválida es atómica («invalid bulk edit must be atomic»)", () => {
  const start = [occupied(day(2), 120_000)];
  const tomorrowYear = "2027-12-02"; // TODAY + 366
  const cases: [string, CalendarChange, string][] = [
    ["selección vacía", { days: [], available: false }, M.range],
    ["un día fuera de rango (ayer)", { days: [day(1), "2026-11-30"], available: false }, M.range],
    ["un día fuera de rango (+366)", { days: [day(1), tomorrowYear], available: false }, M.range],
    ["un día que no existe", { days: [day(1), "2026-12-32"], priceCrc: 80_000 }, M.range],
    ["más de 366 días", { days: Array.from({ length: 367 }, (_, i) => `d${i}`), available: false }, M.range],
    ["precio 0", { days: [day(1)], priceCrc: 0 }, M.price],
    ["precio negativo", { days: [day(1)], priceCrc: -1 }, M.price],
    ["precio sobre 100 000 000", { days: [day(1)], priceCrc: 100_000_001 }, M.price],
    ["precio con decimales", { days: [day(1)], priceCrc: 95_000.5 }, M.price],
    ["precio no numérico o vacío", { days: [day(1)], priceCrc: Number.NaN }, M.price],
    ["nada que guardar", { days: [day(1)] }, M.nothing],
  ];
  for (const [name, change, message] of cases) {
    it(`${name} → «${message}» y nada cambia`, () => {
      const result = save(start, change);
      expect(result.error).toBe(message);
      expect(result.days).toBe(start);
    });
  }
  it("los límites del rango sí valen: hoy y hoy + 365", () => {
    expect(ok({ days: [TODAY, "2027-12-01"], available: false })).toBeNull();
    expect(ok({ days: [day(1)], priceCrc: 1 })).toBeNull();
    expect(ok({ days: [day(1)], priceCrc: 100_000_000 })).toBeNull();
  });
  it("un borrador sin precio por noche todavía no acepta precio de un día, pero sí ocupar días", () => {
    const unpriced: CalendarListing = { ...open, nightlyPriceCrc: null };
    expect(ok({ days: [day(1)], priceCrc: 80_000 }, unpriced)).toBe(M.noNightlyPrice);
    expect(M.noNightlyPrice).toBe("Ponga primero el precio por noche de la casa para cambiar el de un día.");
    expect(ok({ days: [day(1)], available: false }, unpriced)).toBeNull();
  });
});

describe("solo el propietario edita («guest cannot edit»); estados que permiten editar", () => {
  it("sin casa propia (invitado, otra persona o inexistente) → «No encontramos ese anuncio.»", () => {
    expect(ok({ days: [day(1)], available: false }, null)).toBe(M.notFound);
  });
  it("una casa rechazada no se edita", () => {
    expect(ok({ days: [day(1)], available: false }, { ...open, status: "rejected" })).toBe(M.rejected);
  });
  it("borrador, en revisión, con cambios pedidos, pendiente de pago e inactiva sí se editan", () => {
    for (const status of ["draft", "review", "changes", "payment_due", "inactive"] as const) {
      expect(ok({ days: [day(1)], available: false }, { ...open, status })).toBeNull();
    }
  });
});

describe("calendario cerrado («closed calendar cannot be edited», «closing must preserve per-day availability», «reopening restores the exact previous state»)", () => {
  const days = [occupied(day(2), 140_000), special(day(5), 120_000)];
  it("con la casa cerrada a consultas no se guarda nada", () => {
    const result = save(days, { days: [day(1)], available: false }, { ...open, available: false });
    expect(result.error).toBe(M.closed);
    expect(result.days).toBe(days);
  });
  it("cerrar y volver a abrir no toca los días ni los precios", () => {
    const listing = { status: "active" as const, available: true, reopenAt: null };
    const closed = availabilityUpdate(listing, false, null, TODAY);
    expect(closed).toEqual({ available: false, reopenAt: null });
    const reopened = availabilityUpdate({ ...listing, ...closed }, true, null, TODAY);
    expect(reopened).toEqual({ available: true, reopenAt: null });
    expect(effectiveDay(days, BASE, day(2))).toMatchObject({ available: false, priceCrc: 140_000, special: true });
    expect(effectiveDay(days, BASE, day(5))).toMatchObject({ available: true, priceCrc: 120_000, special: true });
  });
});

describe("cerrada sigue visible y sin contacto («unavailable listing stays visible», «reactivation must not silently mark available»)", () => {
  it("cerrar no cambia el estado: la casa sigue activa (Explorar, enlace) y solo deja de aceptar consultas", () => {
    const listing = { status: "active" as const, available: true, reopenAt: null, reviewedAt: null };
    const next = { ...listing, ...availabilityUpdate(listing, false, null, TODAY) };
    expect(next.status).toBe("active");
    expect(can(next, "share")).toBe(true);
    expect(next.available).toBe(false); // create_inquiry lo rechaza: tests/contract/inquiries.contract.ts (M.unavailable)
  });
  it("solo una casa activa cambia de disponibilidad (una oculta no se abre por sí sola)", () => {
    for (const status of ["inactive", "draft", "review"] as const) {
      expect(availabilityUpdate({ status }, true, null, TODAY)).toEqual({ error: M.notActive });
    }
  });
});

describe("fecha de reapertura («past reopening dates are invalid», «nonexistent dates are invalid»)", () => {
  it("vale desde mañana hasta hoy + 365; sin fecha también vale", () => {
    expect(validateReopenDate("2026-12-02", TODAY)).toBeNull();
    expect(validateReopenDate("2027-12-01", TODAY)).toBeNull();
    expect(validateReopenDate(null, TODAY)).toBeNull();
    expect(validateReopenDate("", TODAY)).toBeNull();
  });
  it("pasada, hoy, más allá de un año o inexistente → el mensaje de la RPC", () => {
    for (const date of ["2020-01-01", TODAY, "2027-12-02", "2030-02-30", "mañana"]) {
      expect(validateReopenDate(date, TODAY)).toBe(M.reopenDate);
    }
  });
  it("cerrar con una fecha inválida no cambia nada; abrir con fecha se rechaza", () => {
    const listing = { status: "active" as const, available: true, reopenAt: null };
    expect(availabilityUpdate(listing, false, "2020-01-01", TODAY)).toEqual({ error: M.reopenDate });
    expect(availabilityUpdate(listing, false, "2026-12-15", TODAY)).toEqual({ available: false, reopenAt: "2026-12-15" });
    expect(availabilityUpdate(listing, true, "2026-12-15", TODAY)).toEqual({ error: M.reopenWhileOpen });
  });
  it("abrir a mano cancela la fecha", () => {
    const closedUntil15 = { status: "active" as const, available: false, reopenAt: "2026-12-15" };
    expect(availabilityUpdate(closedUntil15, true, null, TODAY)).toEqual({ available: true, reopenAt: null });
  });
});

describe("reapertura automática («due date reopens automatically», «automatic reopening preserves prices», «no date stays closed», «scheduled reopening must never reactivate a hidden listing»)", () => {
  const closed = { status: "active" as const, available: false, reopenAt: "2026-12-05" };
  it("antes de la fecha sigue cerrada; el día de la fecha (o después) se abre y pierde la fecha", () => {
    expect(reopenIfDue(closed, "2026-12-04")).toBe(closed);
    expect(reopenIfDue(closed, "2026-12-05")).toEqual({ ...closed, available: true, reopenAt: null });
    expect(reopenIfDue(closed, "2026-12-09")).toEqual({ ...closed, available: true, reopenAt: null });
  });
  it("los días y precios no se tocan al reabrir (la función no los recibe)", () => {
    const days = [occupied(day(2), 140_000)];
    reopenIfDue(closed, "2026-12-05");
    expect(effectiveDay(days, BASE, day(2))).toMatchObject({ available: false, priceCrc: 140_000 });
  });
  it("sin fecha queda cerrada", () => {
    const noDate = { ...closed, reopenAt: null };
    expect(reopenIfDue(noDate, "2027-06-01")).toBe(noDate);
  });
  it("nunca cambia el estado: una casa oculta o en revisión se abre a consultas pero sigue oculta", () => {
    for (const status of ["inactive", "review", "draft"] as const) {
      const next = reopenIfDue({ ...closed, status }, "2026-12-05");
      expect(next).toMatchObject({ status, available: true, reopenAt: null });
    }
  });
});

describe("selección primero («Seleccioná los días», «no panel before selecting days», «prefill actual … price without edit intent»)", () => {
  const ctx: SelectionContext = { today: TODAY, base: BASE, days: [special(day(18), 120_000), occupied(day(19)), occupied(day(21), 120_000)] };
  it("sin días seleccionados no hay borrador ni cambio (la pantalla no muestra el panel)", () => {
    expect(emptySelection.days).toEqual([]);
    expect(changeFromSelection(emptySelection)).toBeNull();
    expect(setAvailability(emptySelection, false)).toBe(emptySelection);
    expect(setPrice(emptySelection, "80000")).toBe(emptySelection);
  });
  it("al seleccionar se precarga la disponibilidad y el precio comunes, sin intención de editar", () => {
    const s = selectDay(emptySelection, day(18), ctx);
    expect(s).toMatchObject({ days: [day(18)], available: true, price: "120000", mixedPrice: false, priceEdited: false, availabilityChosen: false });
  });
  it("nada elegido = ninguna mutación («nothing chosen means no mutation»)", () => {
    expect(changeFromSelection(selectDay(emptySelection, day(18), ctx))).toBeNull();
  });
  it("días pasados o fuera de la ventana no se seleccionan", () => {
    expect(selectDay(emptySelection, "2026-11-30", ctx)).toBe(emptySelection);
    expect(selectDay(emptySelection, "2027-12-02", ctx)).toBe(emptySelection);
    expect(selectDay(emptySelection, "2026-12-32", ctx)).toBe(emptySelection);
  });
  it("los días quedan ordenados", () => {
    const s = [day(20), day(18), day(19)].reduce((acc, d) => selectDay(acc, d, ctx), emptySelection);
    expect(s.days).toEqual([day(18), day(19), day(20)]);
  });
});

describe("precios mezclados («mixed untouched prices allow availability-only changes», «restoration previews each selected date»)", () => {
  const ctx: SelectionContext = { today: TODAY, base: BASE, days: [special(day(18), 120_000)] };
  const mixed = selectDay(selectDay(emptySelection, day(18), ctx), day(20), ctx);
  it("con precios distintos el campo queda vacío («Varios precios») y la disponibilidad común se precarga", () => {
    expect(mixed).toMatchObject({ price: "", mixedPrice: true, available: true });
  });
  it("cambiar solo la disponibilidad no toca los precios de cada día", () => {
    const change = changeFromSelection(setAvailability(mixed, false));
    expect(change).toEqual({ days: [day(18), day(20)], available: false });
    const { days } = save(ctx.days as CalendarDay[], change!);
    expect(effectiveDay(days, BASE, day(18))).toMatchObject({ available: false, priceCrc: 120_000, special: true });
    expect(effectiveDay(days, BASE, day(20))).toMatchObject({ available: false, priceCrc: BASE, special: false });
  });
  it("con disponibilidad mezclada no hay ninguna precargada", () => {
    const c: SelectionContext = { ...ctx, days: [occupied(day(18))] };
    expect(selectDay(selectDay(emptySelection, day(18), c), day(20), c).available).toBeNull();
  });
  it("seleccionar más días recalcula la precarga mientras no se haya escrito un precio", () => {
    const one = selectDay(emptySelection, day(20), ctx);
    expect(one.price).toBe("95000");
    expect(selectDay(one, day(18), ctx)).toMatchObject({ mixedPrice: true, price: "" });
  });
  it("un precio escrito se conserva al añadir días", () => {
    const typed = setPrice(selectDay(emptySelection, day(4), ctx), "77000");
    expect(selectDay(typed, day(5), ctx)).toMatchObject({ price: "77000", priceEdited: true, days: [day(4), day(5)] });
  });
});

describe("guardado combinado atómico («combined save must be atomic»)", () => {
  const ctx: SelectionContext = { today: TODAY, base: BASE, days: [] };
  const both = setAvailability(selectDay(selectDay(emptySelection, day(18), ctx), day(20), ctx), true);
  it("un precio inválido rechaza también la disponibilidad", () => {
    for (const text of ["0", "", "abc", "95000,5"]) {
      const result = save(ctx.days as CalendarDay[], changeFromSelection(setPrice(both, text))!);
      expect(result.error).toBe(M.price);
      expect(result.days).toEqual([]);
    }
  });
  it("disponibilidad y precio juntos se aplican a todos los días", () => {
    const change = changeFromSelection(setPrice(both, "85 000"));
    expect(change).toEqual({ days: [day(18), day(20)], available: true, priceCrc: 85_000 });
    const { days } = save([], change!);
    for (const d of [day(18), day(20)]) expect(effectiveDay(days, BASE, d)).toMatchObject({ available: true, priceCrc: 85_000, special: true });
  });
  it("acepta el formato con punto de miles («95.000») como el asistente de publicar", () => {
    expect(changeFromSelection(setPrice(both, "₡95.000"))?.priceCrc).toBe(95_000);
  });
});

describe("deseleccionar el último día limpia el borrador («last deselection clears draft»)", () => {
  const ctx: SelectionContext = { today: TODAY, base: BASE, days: [] };
  it("vuelve a la selección vacía, sin intención de editar", () => {
    const draft = setAvailability(setPrice(selectDay(emptySelection, day(18), ctx), "99000"), false);
    expect(selectDay(draft, day(18), ctx)).toEqual(emptySelection);
    expect(clearSelection()).toEqual(emptySelection);
  });
  it("deseleccionar uno de varios conserva lo elegido", () => {
    const draft: Selection = setPrice(selectDay(selectDay(emptySelection, day(18), ctx), day(19), ctx), "99000");
    expect(selectDay(draft, day(19), ctx)).toMatchObject({ days: [day(18)], price: "99000", priceEdited: true });
  });
});

describe("rejilla del mes (lunes primero, días pasados) y ventana de 12 meses", () => {
  it("diciembre de 2026 empieza en martes: un hueco al inicio, semanas de 7", () => {
    const grid = monthGrid("2026-12", "2026-12-10");
    expect(grid.title).toBe("Diciembre 2026");
    expect(grid.weeks[0]![0]).toBeNull();
    expect(grid.weeks[0]![1]).toMatchObject({ day: "2026-12-01", date: 1, past: true, beyond: false });
    expect(grid.weeks.every((w) => w.length === 7)).toBe(true);
    const cells = grid.weeks.flat().filter((c) => c !== null);
    expect(cells).toHaveLength(31);
    expect(cells.find((c) => c.date === 9)!.past).toBe(true);
    expect(cells.find((c) => c.date === 10)!.past).toBe(false);
    expect(grid.weeks.at(-1)!.at(-1)).toBeNull(); // el 31 es jueves: relleno al final
  });
  it("febrero de 2027 empieza en lunes (sin hueco) y tiene 28 días; agosto de 2026 llega a la sexta fila", () => {
    const feb = monthGrid("2027-02", TODAY);
    expect(feb.weeks[0]![0]).toMatchObject({ day: "2027-02-01" });
    expect(feb.weeks.flat().filter(Boolean)).toHaveLength(28);
    expect(feb.weeks).toHaveLength(4);
    expect(monthGrid("2026-08", "2026-08-01").weeks).toHaveLength(6);
  });
  it("los días más allá de hoy + 365 quedan marcados fuera de la ventana", () => {
    const last = monthGrid("2027-12", TODAY).weeks.flat().filter((c) => c !== null);
    expect(last.find((c) => c.date === 1)!.beyond).toBe(false);
    expect(last.find((c) => c.date === 2)!.beyond).toBe(true);
  });
  it("ventana: de hoy (Costa Rica) a hoy + 365, con su primer y último mes", () => {
    expect(calendarWindow(TODAY)).toEqual({ first: TODAY, last: "2027-12-01", firstMonth: "2026-12", lastMonth: "2027-12" });
    expect(calendarWindow("2028-03-01").last).toBe("2029-03-01"); // 2028 es bisiesto: 365 días después
    // 00:30 del 1 de diciembre en Costa Rica = 06:30 UTC; a las 05:59 UTC todavía es 30 de noviembre.
    expect(calendarWindow(costaRicaToday(Date.UTC(2026, 11, 1, 6, 30))).first).toBe("2026-12-01");
    expect(calendarWindow(costaRicaToday(Date.UTC(2026, 11, 1, 5, 59))).first).toBe("2026-11-30");
  });
  // Revisión UX A4: a fin de mes el calendario abre en el siguiente para no enseñar casi solo días pasados.
  it("mes con que abre el calendario: el actual si quedan 10 días o más; si no, el siguiente", () => {
    expect(openingMonth("2026-10-21")).toBe("2026-10"); // quedan 11 días (21–31)
    expect(openingMonth("2026-10-22")).toBe("2026-10"); // quedan 10
    expect(openingMonth("2026-10-23")).toBe("2026-11"); // quedan 9
    expect(openingMonth("2026-10-31")).toBe("2026-11");
    expect(openingMonth("2026-12-26")).toBe("2027-01"); // cambio de año
    expect(openingMonth("2028-02-20")).toBe("2028-02"); // febrero bisiesto: 20–29 son 10
    expect(openingMonth("2027-02-20")).toBe("2027-03"); // 20–28 son 9
  });
  it("títulos de mes", () => {
    expect(monthTitle("2027-01")).toBe("Enero 2027");
  });
});

describe("precio compacto de la rejilla", () => {
  it("«95k», «180k», «1,2M», «1M»", () => {
    expect(compactPrice(95_000, "CRC", 510)).toBe("95k");
    expect(compactPrice(180_000, "CRC", 510)).toBe("180k");
    expect(compactPrice(1_200_000, "CRC", 510)).toBe("1,2M");
    expect(compactPrice(1_000_000, "CRC", 510)).toBe("1M");
    expect(compactPrice(999_600, "CRC", 510)).toBe("1M");
    expect(compactPrice(95_400, "CRC", 510)).toBe("95k");
    expect(compactPrice(500, "CRC", 510)).toBe("500");
  });
  it("en dólares (solo visualización, ficha pública): el redondeo de money.ts", () => {
    expect(compactPrice(95_000, "USD", 510)).toBe("$186");
  });
});

describe("rótulo de la selección", () => {
  it("una noche, contiguas, entre meses y no contiguas", () => {
    expect(selectionLabel([day(20)])).toBe("1 noche · 20 dic");
    expect(selectionLabel([day(22), day(20), day(21)])).toBe("3 noches · 20–22 dic");
    expect(selectionLabel(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"])).toBe("4 noches · 30 dic – 2 ene");
    expect(selectionLabel([day(20), day(22), day(24)])).toBe("3 noches · 20, 22 y 24 dic");
    expect(selectionLabel([day(20), day(22)])).toBe("2 noches · 20 y 22 dic");
    expect(selectionLabel(["2026-12-30", "2027-01-02", "2027-01-05"])).toBe("3 noches · 30 dic, 2 y 5 ene");
    expect(selectionLabel([])).toBe("");
  });
});

describe("noches ocupadas del mes (fila «Calendario y precios» del detalle)", () => {
  const days = [occupied(day(2)), occupied(day(3), 120_000), special(day(4), 120_000), occupied("2027-01-02")];
  it("cuenta solo las ocupadas del mes pedido", () => {
    expect(occupiedNightsIn(days, "2026-12")).toBe(2);
    expect(occupiedNightsIn(days, "2027-01")).toBe(1);
    expect(occupiedNightsIn(days, "2027-02")).toBe(0);
  });
  it("«Diciembre: 2 noches ocupadas», singular y cero", () => {
    expect(occupiedNightsLabel(days, "2026-12")).toBe("Diciembre: 2 noches ocupadas");
    expect(occupiedNightsLabel(days, "2027-01")).toBe("Enero: 1 noche ocupada");
    expect(occupiedNightsLabel(days, "2027-02")).toBe("Sin noches ocupadas este mes");
  });
});

describe("mensajes (los copian la migración fase4_calendario y el fake)", () => {
  it("son exactamente los del spec", () => {
    expect(M).toMatchObject({
      notFound: "No encontramos ese anuncio.",
      rejected: "Este anuncio fue rechazado; publique uno nuevo.",
      closed: "La casa está cerrada a consultas. Ábrala para cambiar el calendario.",
      range: "Elija días entre hoy y dentro de un año.",
      nothing: "No hay cambios que guardar.",
      price: "Escriba un precio por noche en colones, mayor que cero y sin decimales.",
      reopenDate: "La fecha de reapertura debe ser a partir de mañana y dentro de un año.",
      notActive: "Solo puede cambiar la disponibilidad de una casa activa.",
    });
  });
});
