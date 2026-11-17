// Límite de las lecturas manuales de Airbnb (2026-11-17), para no saturar a Airbnb: «Actualizar ahora» espera 15 minutos
// desde la última lectura de la casa y cada casa tiene 10 lecturas manuales al día (día de Costa Rica). Conectar o
// cambiar el enlace no espera, pero cuenta. Mismas reglas y mensajes en el fake y en la base (airbnb_manual_gate).
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AIRBNB_LIMIT_MESSAGES, DEFAULT_AIRBNB_MANUAL_LIMITS, type AirbnbService } from "../../src/domain/airbnb";

const AIRBNB_MANUAL_PER_DAY = DEFAULT_AIRBNB_MANUAL_LIMITS.perDay;
import { addDays } from "../../src/domain/calendar";
import { costaRicaClock } from "../../src/domain/dates";
import { costaRicaToday } from "../../src/domain/inquiry";
import { DomainError } from "../../src/domain/errors";
import { TEST_AIRBNB_URL } from "../fixtures/airbnb-ical";
import type { SubscriptionHarness } from "./harness";
import { REPLACEMENT_URL } from "./airbnb-management.contract";

async function rejection(p: Promise<unknown>): Promise<DomainError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(DomainError);
    return e as DomainError;
  }
  throw new Error("se esperaba un error");
}

const WAIT = /^Podrá actualizar de nuevo a las (\d\d:\d\d)\.$/;

export function airbnbLimiteContract(name: string, make: () => Promise<{ h: SubscriptionHarness; service: AirbnbService }>) {
  describe(`Airbnb · límite de lecturas manuales · ${name}`, () => {
    let h: SubscriptionHarness;
    let s: AirbnbService;
    const day = (n: number) => addDays(costaRicaToday(Date.now()), n);
    beforeAll(async () => { ({ h, service: s } = await make()); }, 90_000);
    beforeEach(async () => h.reset(), 60_000);

    /** Una lectura manual completa (reserva, enlace y cierre), para que la siguiente no choque con una en curso. */
    async function read(id: string, kind: "connect" | "refresh" | "replace") {
      const jwt = await h.jwt("owner");
      const request = crypto.randomUUID();
      if (kind === "connect") await s.begin(jwt, id, TEST_AIRBNB_URL, request);
      else await s.update(jwt, id, request, kind === "replace" ? REPLACEMENT_URL : undefined);
      await s.context(id, request);
      await s.finish(id, request, [{ uid: "r", start: day(10), end: day(12) }], null);
    }

    it("tras una lectura, «Actualizar ahora» espera 15 minutos y lo dice con la hora de Costa Rica", async () => {
      const l = await h.seed({ status: "active" });
      await read(l.id, "connect");
      const jwt = await h.jwt("owner");
      const e = await rejection(s.update(jwt, l.id, crypto.randomUUID()));
      const clock = WAIT.exec(e.message)?.[1];
      expect(clock, e.message).toBeDefined();
      const expected = [0, 1].map((m) => costaRicaClock(Date.now() + 15 * 60_000 - m * 60_000));
      expect(expected).toContain(clock);
      const summary = await s.overview(jwt, l.id);
      expect(summary.manualLeftToday).toBe(AIRBNB_MANUAL_PER_DAY - 1);
      expect(Date.parse(summary.manualAvailableAt!) - Date.now()).toBeGreaterThan(13 * 60_000);
      expect(Date.parse(summary.manualAvailableAt!) - Date.now()).toBeLessThanOrEqual(15 * 60_000);
    });

    it("pasados los 15 minutos se puede; cambiar el enlace nunca espera", async () => {
      const l = await h.seed({ status: "active" });
      await read(l.id, "connect");
      await read(l.id, "replace");
      await h.ageAirbnbReads(l.id, 15 * 60_000 + 1000);
      const jwt = await h.jwt("owner");
      expect((await s.overview(jwt, l.id)).manualAvailableAt).toBeNull();
      expect(await s.update(jwt, l.id, crypto.randomUUID())).toEqual({ run: true });
    });

    it("repetir la misma petición no choca con el límite", async () => {
      const l = await h.seed({ status: "active" });
      await read(l.id, "connect");
      await h.ageAirbnbReads(l.id, 15 * 60_000 + 1000);
      const jwt = await h.jwt("owner");
      const request = crypto.randomUUID();
      expect(await s.update(jwt, l.id, request)).toEqual({ run: true });
      expect(await s.update(jwt, l.id, request)).toEqual({ run: false });
    });

    it(`como mucho ${AIRBNB_MANUAL_PER_DAY} lecturas manuales al día por casa, también al cambiar el enlace`, async () => {
      const l = await h.seed({ status: "active" });
      await read(l.id, "connect");
      for (let i = 1; i < AIRBNB_MANUAL_PER_DAY; i++) await read(l.id, "replace");
      const jwt = await h.jwt("owner");
      expect((await rejection(s.update(jwt, l.id, crypto.randomUUID(), REPLACEMENT_URL))).message).toBe(AIRBNB_LIMIT_MESSAGES.day(AIRBNB_MANUAL_PER_DAY));
      expect((await s.overview(jwt, l.id)).manualLeftToday).toBe(0);
      // Otra casa no se ve afectada, y desconectar no tiene límite.
      const other = await h.seed({ status: "active" });
      await read(other.id, "connect");
      await s.disconnect(jwt, l.id, crypto.randomUUID());
    }, 60_000);
  });
}
