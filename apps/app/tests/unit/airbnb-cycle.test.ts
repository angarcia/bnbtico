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
