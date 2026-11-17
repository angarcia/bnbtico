// Reglas del límite manual de Airbnb (2026-11-17): las comparten el fake y la pantalla; la base aplica las mismas.
import { describe, expect, it } from "vitest";
import { AIRBNB_LIMIT_MESSAGES, airbnbManualHint, airbnbManualRefusal, airbnbManualState, isAirbnbLimitMessage, readAirbnbSummary } from "../../src/domain/airbnb";
import { costaRicaClock } from "../../src/domain/dates";

const MIN = 60_000;
const noon = Date.parse("2026-11-17T18:00:00Z"); // 12:00 en Costa Rica
const read = (ago: number, manual = true) => ({ startedMs: noon - ago, manual });

describe("límite de lecturas manuales de Airbnb", () => {
  it("la hora de Costa Rica es UTC−6, sin cambio de hora", () => {
    expect(costaRicaClock(noon)).toBe("12:00");
    expect(costaRicaClock(Date.parse("2026-11-17T05:59:00Z"))).toBe("23:59");
  });

  it("«Actualizar ahora» espera 15 minutos desde la última lectura, manual o automática; conectar o cambiar el enlace no", () => {
    expect(airbnbManualRefusal([read(5 * MIN)], noon, true)).toBe(AIRBNB_LIMIT_MESSAGES.wait("12:10"));
    expect(airbnbManualRefusal([read(5 * MIN, false)], noon, true)).toBe(AIRBNB_LIMIT_MESSAGES.wait("12:10"));
    expect(airbnbManualRefusal([read(15 * MIN)], noon, true)).toBeNull();
    expect(airbnbManualRefusal([read(1 * MIN)], noon, false)).toBeNull();
    expect(airbnbManualRefusal([], noon, true)).toBeNull();
  });

  it("10 manuales al día de Costa Rica; las automáticas y las de ayer no cuentan", () => {
    const ten = Array.from({ length: 10 }, (_, i) => read((20 + i) * MIN));
    expect(airbnbManualRefusal(ten, noon, false)).toBe(AIRBNB_LIMIT_MESSAGES.day);
    expect(airbnbManualRefusal(ten.map((r, i) => (i === 0 ? { ...r, manual: false } : r)), noon, false)).toBeNull();
    // 13 horas antes del mediodía de Costa Rica es ayer (23:00).
    expect(airbnbManualRefusal([...ten.slice(1), read(13 * 60 * MIN)], noon, false)).toBeNull();
  });

  it("el resumen y el texto bajo el botón", () => {
    const state = airbnbManualState([read(5 * MIN)], noon);
    expect(state).toEqual({ manualAvailableAt: new Date(noon + 10 * MIN).toISOString(), manualLeftToday: 9 });
    expect(airbnbManualHint(state, noon)).toBe("Podrá actualizar de nuevo a las 12:10.");
    expect(airbnbManualHint(state, noon + 10 * MIN)).toBeNull();
    expect(airbnbManualHint({ manualAvailableAt: null, manualLeftToday: 0 }, noon)).toBe(AIRBNB_LIMIT_MESSAGES.day);
    expect(airbnbManualHint({}, noon)).toBeNull(); // resumen anterior a la migración
  });

  it("solo esos dos mensajes pasan como mensajes de la base", () => {
    expect(isAirbnbLimitMessage(AIRBNB_LIMIT_MESSAGES.wait("09:05"))).toBe(true);
    expect(isAirbnbLimitMessage(AIRBNB_LIMIT_MESSAGES.day)).toBe(true);
    expect(isAirbnbLimitMessage("Podrá actualizar de nuevo a las <script>.")).toBe(false);
  });

  it("el resumen admite los campos nuevos y rechaza valores raros", () => {
    const base = { connected: true, state: "connected", lastSuccessAt: null, errorCode: null, nights: 0 };
    expect(readAirbnbSummary({ ...base, manualAvailableAt: null, manualLeftToday: 3 })).toMatchObject({ manualAvailableAt: null, manualLeftToday: 3 });
    expect(() => readAirbnbSummary({ ...base, manualLeftToday: 11 })).toThrow();
    expect(() => readAirbnbSummary({ ...base, manualAvailableAt: "mañana" })).toThrow();
  });
});
