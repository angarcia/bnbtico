// Tipo de cambio diario (ticket 21): parsers de las dos fuentes, rango plausible y elección principal → respaldo.
import { describe, expect, it, vi } from "vitest";
import {
  FX_ATTRIBUTION,
  FX_INITIAL,
  FX_SOURCES,
  fetchFxRate,
  fxDayLabel,
  fxRateLabel,
  isPlausibleRate,
  parseExchangeRateApi,
  parseFawazahmed0,
} from "../../src/domain/fx";

const fawaz = (crc: unknown, date: unknown = "2026-10-26") => ({ date, usd: { aed: 3.67, crc, eur: 0.86 } });
const openEr = (crc: unknown, unix = Date.parse("2026-10-26T00:02:31Z") / 1000, result = "success") => ({
  result,
  provider: "https://www.exchangerate-api.com",
  time_last_update_unix: unix,
  base_code: "USD",
  rates: { USD: 1, CRC: crc, EUR: 0.86 },
});

describe("parsers", () => {
  it("fawazahmed0: fecha y usd.crc", () => {
    expect(parseFawazahmed0(fawaz(455.0688355))).toEqual({ crcPerUsd: 455.0688, day: "2026-10-26" });
  });

  it("fawazahmed0: sin crc, fecha rara, cifra implausible o basura → null", () => {
    expect(parseFawazahmed0({ date: "2026-10-26", usd: {} })).toBeNull();
    expect(parseFawazahmed0(fawaz(455, "26/10/2026"))).toBeNull();
    expect(parseFawazahmed0(fawaz(4.55))).toBeNull();
    expect(parseFawazahmed0(fawaz("455"))).toBeNull();
    expect(parseFawazahmed0(null)).toBeNull();
    expect(parseFawazahmed0("<html>")).toBeNull();
  });

  it("ExchangeRate-API: result success, rates.CRC y el día UTC de la última actualización", () => {
    expect(parseExchangeRateApi(openEr(455.627131))).toEqual({ crcPerUsd: 455.6271, day: "2026-10-26" });
  });

  it("ExchangeRate-API: error, sin CRC, base que no es USD o implausible → null", () => {
    expect(parseExchangeRateApi(openEr(455, undefined, "error"))).toBeNull();
    expect(parseExchangeRateApi({ ...openEr(455), base_code: "EUR" })).toBeNull();
    expect(parseExchangeRateApi(openEr(undefined))).toBeNull();
    expect(parseExchangeRateApi(openEr(1200))).toBeNull();
    expect(parseExchangeRateApi(openEr(455, Number.NaN))).toBeNull();
  });

  it("rango plausible de 300 a 900 colones por dólar", () => {
    expect([299.99, 300, 510, 900, 900.01, Number.NaN, Infinity].map(isPlausibleRate)).toEqual([false, true, true, true, false, false, false]);
  });
});

describe("fuentes", () => {
  it("principal fawazahmed0 (jsDelivr y su dominio de respaldo) y después ExchangeRate-API", () => {
    expect(FX_SOURCES.map((s) => [s.source, s.url])).toEqual([
      ["fawazahmed0", "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json"],
      ["fawazahmed0", "https://latest.currency-api.pages.dev/v1/currencies/usd.json"],
      ["exchangerate-api", "https://open.er-api.com/v6/latest/USD"],
    ]);
  });

  it("solo ExchangeRate-API exige atribución, con su enlace", () => {
    expect(FX_ATTRIBUTION.fawazahmed0).toBeNull();
    expect(FX_ATTRIBUTION.constante).toBeNull();
    expect(FX_ATTRIBUTION["exchangerate-api"]).toEqual({ text: "Rates By Exchange Rate API", href: "https://www.exchangerate-api.com" });
  });
});

describe("elección del tipo", () => {
  const respond = (byUrl: Record<string, () => Response | Promise<Response>>) =>
    vi.fn(async (url: string, _init?: RequestInit) => {
      const r = byUrl[url];
      if (!r) throw new TypeError("fetch failed");
      return r();
    });
  const [jsdelivr, pages, er] = FX_SOURCES.map((s) => s.url) as [string, string, string];

  it("usa la principal si responde bien y no pide nada más", async () => {
    const f = respond({ [jsdelivr]: () => Response.json(fawaz(455.07)) });
    const r = await fetchFxRate(f as unknown as typeof fetch);
    expect(r.rate).toEqual({ crcPerUsd: 455.07, day: "2026-10-26", source: "fawazahmed0" });
    expect(r.failures).toEqual([]);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("si jsDelivr falla, el dominio de respaldo del mismo proyecto", async () => {
    const f = respond({ [jsdelivr]: () => new Response("caído", { status: 503 }), [pages]: () => Response.json(fawaz(456)) });
    const r = await fetchFxRate(f as unknown as typeof fetch);
    expect(r.rate).toMatchObject({ crcPerUsd: 456, source: "fawazahmed0" });
    expect(r.failures).toEqual([`${jsdelivr}: HTTP 503`]);
  });

  it("si la principal falla o da algo implausible, ExchangeRate-API", async () => {
    const f = respond({ [jsdelivr]: () => Response.json(fawaz(45.5)), [pages]: () => new Response("{", { status: 200 }), [er]: () => Response.json(openEr(455.6)) });
    const r = await fetchFxRate(f as unknown as typeof fetch);
    expect(r.rate).toEqual({ crcPerUsd: 455.6, day: "2026-10-26", source: "exchangerate-api" });
    expect(r.failures).toHaveLength(2);
    expect(r.failures[0]).toBe(`${jsdelivr}: respuesta no válida`);
  });

  it("si fallan todas, null (se conserva el último guardado)", async () => {
    const f = respond({});
    const r = await fetchFxRate(f as unknown as typeof fetch);
    expect(r.rate).toBeNull();
    expect(r.failures).toHaveLength(3);
    expect(r.failures[2]).toMatch(/^https:\/\/open\.er-api\.com\/v6\/latest\/USD: TypeError: fetch failed$/);
  });

  it("cada petición lleva un tiempo máximo", async () => {
    const f = respond({ [jsdelivr]: () => Response.json(fawaz(455)) });
    await fetchFxRate(f as unknown as typeof fetch);
    expect(f.mock.calls[0]![1]).toMatchObject({ signal: expect.any(AbortSignal) });
  });
});

describe("cómo se muestra", () => {
  it("valor inicial: 510 de la constante", () => {
    expect(FX_INITIAL).toMatchObject({ crcPerUsd: 510, source: "constante" });
  });

  it("fecha corta en español de Costa Rica, sin zona horaria", () => {
    expect(fxDayLabel("2026-10-26")).toBe("26 oct.");
    expect(fxDayLabel("2026-09-01")).toBe("1 set.");
    expect(fxDayLabel("2027-01-05")).toBe("5 ene.");
  });

  it("el tipo redondeado al colón", () => {
    expect(fxRateLabel(455.6271)).toBe("₡456");
    expect(fxRateLabel(510)).toBe("₡510");
  });
});
