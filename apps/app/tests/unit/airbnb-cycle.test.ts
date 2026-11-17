import { describe, expect, it, vi } from "vitest";
import { runAirbnbCycle, AIRBNB_CRON } from "../../src/server/airbnb-cycle";
import { TEST_AIRBNB_URL, calendarFile } from "../fixtures/airbnb-ical";

const slot = Date.parse("2026-11-12T09:17:00Z");

function fixture() {
  const service = {
    due: vi.fn(async () => ["a", "b"]),
    claimCycle: vi.fn(async () => ({ run: true })),
    context: vi.fn(async () => ({ url: TEST_AIRBNB_URL })),
    finish: vi.fn(async () => {}),
  };
  const deps = {
    fetch: vi.fn<typeof fetch>().mockRejectedValueOnce(new Error(TEST_AIRBNB_URL))
      .mockResolvedValueOnce(new Response(calendarFile())),
    now: () => slot + 1000,
    log: vi.fn(),
  };
  return { service, deps };
}

describe("ciclo de Airbnb", () => {
  it("se guía por la hora programada, registra un fallo sin secretos y continúa", async () => {
    const { service, deps } = fixture();
    await runAirbnbCycle(service, deps, AIRBNB_CRON, slot);
    expect(service.due).toHaveBeenCalledWith(new Date(slot).toISOString());
    expect(service.finish).toHaveBeenCalledWith("a", expect.any(String), null, "download");
    expect(service.finish).toHaveBeenCalledWith("b", expect.any(String), [], null);
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining('"readError":1'));
    expect(JSON.stringify(deps.log.mock.calls)).not.toContain(TEST_AIRBNB_URL);
  });

  it("acepta la hora programada con segundos de desfase, como la manda Cloudflare", async () => {
    // Medido en 3bstays-pruebas el 2026-11-14: el cron de Airbnb llegó con scheduledTime 06:17:54.627.
    const { service, deps } = fixture();
    await runAirbnbCycle(service, { ...deps, now: () => slot + 56_000 }, AIRBNB_CRON, slot + 54_627);
    expect(service.due).toHaveBeenCalledWith(new Date(slot).toISOString());
    expect(service.claimCycle).toHaveBeenCalledWith("a", expect.any(String), new Date(slot).toISOString());
  });

  it("con 5 minutos lee en cada múltiplo de 5, no en otro minuto, y no espera más que el intervalo", async () => {
    const five = Date.parse("2026-11-12T09:05:00Z");
    const { service, deps } = fixture();
    await runAirbnbCycle(service, { ...deps, now: () => five + 1000 }, "*/5 * * * *", five, 5);
    expect(service.due).toHaveBeenCalledWith(new Date(five).toISOString());
    service.due.mockClear();
    await runAirbnbCycle(service, { ...deps, now: () => five + 1000 }, AIRBNB_CRON, five, 5); // cron de otro intervalo
    await runAirbnbCycle(service, { ...deps, now: () => slot + 1000 }, "*/5 * * * *", slot, 5); // 09:17 no es múltiplo de 5
    await runAirbnbCycle(service, { ...deps, now: () => five + 5 * 60_000 }, "*/5 * * * *", five, 5); // llega con el siguiente
    expect(service.due).not.toHaveBeenCalled();
  });

  it("con 60 minutos usa el cron horario y vale cualquier hora en el minuto 17", async () => {
    const tenSeventeen = Date.parse("2026-11-12T10:17:00Z");
    const { service, deps } = fixture();
    await runAirbnbCycle(service, { ...deps, now: () => tenSeventeen + 1000 }, "17 * * * *", tenSeventeen, 60);
    expect(service.due).toHaveBeenCalledWith(new Date(tenSeventeen).toISOString());
  });

  it("omite cron ajeno, retraso de una hora y reservas rechazadas", async () => {
    const { service, deps } = fixture();
    await runAirbnbCycle(service, deps, "17 * * * *", slot);
    await runAirbnbCycle(service, { ...deps, now: () => slot + 3_600_000 }, AIRBNB_CRON, slot);
    expect(service.due).not.toHaveBeenCalled();
    service.claimCycle.mockResolvedValue({ run: false });
    await runAirbnbCycle(service, deps, AIRBNB_CRON, slot);
    expect(deps.fetch).not.toHaveBeenCalled();
  });
});
