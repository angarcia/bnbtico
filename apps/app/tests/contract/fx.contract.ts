// Contrato de la lectura del tipo de cambio (ticket 21): el vigente es el del día más reciente; sin tipos del cron, el
// valor inicial de la migración (510, «constante»).
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { PublicListingsApi } from "../../src/domain/api";
import { FX_INITIAL, type FxRate } from "../../src/domain/fx";

export interface FxHarness {
  anon: PublicListingsApi;
  /** Escribe un tipo como lo hace el cron (upsert por día). */
  putRate(rate: FxRate): Promise<void>;
  /** Deja solo la fila inicial. */
  resetRates(): Promise<void>;
}

export function fxContract(name: string, makeHarness: () => Promise<FxHarness>) {
  describe(`tipo de cambio · ${name}`, () => {
    let h: FxHarness;
    beforeEach(async () => {
      h ??= await makeHarness();
      await h.resetRates();
    });
    afterAll(async () => h?.resetRates());

    it("sin tipos del cron, el valor inicial", async () => {
      expect(await h.anon.fxRate()).toEqual(FX_INITIAL);
    });

    it("el del día más reciente, aunque se escriba antes uno posterior", async () => {
      await h.putRate({ crcPerUsd: 455.0688, day: "2026-10-28", source: "fawazahmed0" });
      await h.putRate({ crcPerUsd: 470, day: "2026-10-27", source: "exchangerate-api" });
      expect(await h.anon.fxRate()).toEqual({ crcPerUsd: 455.0688, day: "2026-10-28", source: "fawazahmed0" });
    });

    it("dos veces el mismo día: queda el último", async () => {
      await h.putRate({ crcPerUsd: 455, day: "2026-10-28", source: "fawazahmed0" });
      await h.putRate({ crcPerUsd: 456.5, day: "2026-10-28", source: "exchangerate-api" });
      expect(await h.anon.fxRate()).toEqual({ crcPerUsd: 456.5, day: "2026-10-28", source: "exchangerate-api" });
    });
  });
}
