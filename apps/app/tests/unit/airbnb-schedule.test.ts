// Intervalo de Airbnb (2026-11-17): minutos de la lista → cron del worker, ciclos válidos y qué tarea va con cada aviso.
// La traducción de scripts/deploy-target.mjs (que escribe el cron al desplegar) tiene que dar lo mismo que la del worker.
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { AIRBNB_SYNC_MINUTES, HOURLY_CRON, airbnbCron, cronTasks, isAirbnbSlot, syncMinutesOf } from "../../src/domain/airbnb-schedule";

const script = new URL("../../scripts/deploy-target.mjs", import.meta.url).pathname;
const at = (iso: string) => new Date(iso);

describe("intervalo de Airbnb", () => {
  it.each([
    [5, "*/5 * * * *"], [10, "*/10 * * * *"], [15, "*/15 * * * *"], [30, "*/30 * * * *"],
    [60, HOURLY_CRON], [120, "17 */2 * * *"], [180, "17 */3 * * *"], [240, "17 */4 * * *"],
    [360, "17 */6 * * *"], [720, "17 */12 * * *"], [1440, "17 0 * * *"],
  ] as const)("%i minutos → %s", (minutes, cron) => {
    expect(airbnbCron(minutes)).toBe(cron);
  });

  it("el despliegue traduce igual que el worker cada valor de la lista", () => {
    for (const minutes of AIRBNB_SYNC_MINUTES) {
      const out = spawnSync(process.execPath, [script, "cron", String(minutes)], { encoding: "utf8" });
      expect(out.status, out.stderr).toBe(0);
      expect(out.stdout.trim()).toBe(airbnbCron(minutes));
    }
  });

  it("sin variable o con un valor raro, cada 3 horas", () => {
    for (const raw of [undefined, "", "7", "abc", "180 ", "-5"]) expect(syncMinutesOf(raw)).toBe(180);
    expect(syncMinutesOf("5")).toBe(5);
    expect(syncMinutesOf("1440")).toBe(1440);
  });

  it("solo valen los minutos del intervalo, en punto", () => {
    expect(isAirbnbSlot(5, at("2026-11-17T10:05:00Z"))).toBe(true);
    expect(isAirbnbSlot(5, at("2026-11-17T10:07:00Z"))).toBe(false);
    expect(isAirbnbSlot(5, at("2026-11-17T10:05:01Z"))).toBe(false);
    expect(isAirbnbSlot(180, at("2026-11-17T09:17:00Z"))).toBe(true);
    expect(isAirbnbSlot(180, at("2026-11-17T10:17:00Z"))).toBe(false);
    expect(isAirbnbSlot(60, at("2026-11-17T10:17:00Z"))).toBe(true);
    expect(isAirbnbSlot(1440, at("2026-11-17T00:17:00Z"))).toBe(true);
    expect(isAirbnbSlot(1440, at("2026-11-17T12:17:00Z"))).toBe(false);
  });

  it("con 60 minutos el aviso horario hace las dos tareas; con otro intervalo, cada una la suya", () => {
    expect(cronTasks(HOURLY_CRON, 60)).toEqual({ airbnb: true, hourly: true });
    expect(cronTasks(HOURLY_CRON, 180)).toEqual({ airbnb: false, hourly: true });
    expect(cronTasks("17 */3 * * *", 180)).toEqual({ airbnb: true, hourly: false });
    expect(cronTasks("*/5 * * * *", 5)).toEqual({ airbnb: true, hourly: false });
    expect(cronTasks("*/5 * * * *", 180)).toEqual({ airbnb: false, hourly: false });
  });
});
