import { afterEach, describe, expect, it, vi } from "vitest";
import { IcalError } from "../../src/domain/ical";
import { readAirbnbCalendar } from "../../src/server/ical-download";
import { BROKEN_AIRBNB, EMPTY_AIRBNB, TEST_AIRBNB_URL, calendarEvent, calendarFile } from "../fixtures/airbnb-ical";

afterEach(() => vi.useRealTimers());

describe("Airbnb · descarga externa acotada", () => {
  it("descarga y devuelve solo los datos necesarios para ocupación", async () => {
    const text = calendarFile(calendarEvent("a", "20261210", "20261213", ["DESCRIPTION:privado inventado"]));
    const blocks = await readAirbnbCalendar(TEST_AIRBNB_URL, { fetch: async () => new Response(text) });
    expect(blocks).toEqual([{ uid: "a", start: "2026-12-10", end: "2026-12-13" }]);
  });

  it("rechaza el destino antes de hacer una petición externa", async () => {
    let calls = 0;
    await expect(readAirbnbCalendar("http://127.0.0.1/secreto", { fetch: async () => { calls++; return new Response(EMPTY_AIRBNB); } })).rejects.toBeInstanceOf(IcalError);
    expect(calls).toBe(0);
  });

  it("no sigue una redirección hacia recursos internos", async () => {
    let calls = 0;
    let redirectMode: RequestRedirect | undefined;
    await expect(readAirbnbCalendar(TEST_AIRBNB_URL, {
      fetch: async (_input, init) => {
        calls++;
        redirectMode = init?.redirect;
        return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/secreto" } });
      },
    })).rejects.toBeInstanceOf(IcalError);
    expect(redirectMode).toBe("manual");
    expect(calls).toBe(1);
  });

  it.each([401, 403, 404, 429, 500, 206])("HTTP %s no se interpreta como calendario vacío", async (status) => {
    await expect(readAirbnbCalendar(TEST_AIRBNB_URL, { fetch: async () => new Response(EMPTY_AIRBNB, { status }) })).rejects.toBeInstanceOf(IcalError);
  });

  it("rechaza un cuerpo truncado, aunque HTTP sea correcto", async () => {
    await expect(readAirbnbCalendar(TEST_AIRBNB_URL, { fetch: async () => new Response(BROKEN_AIRBNB) })).rejects.toBeInstanceOf(IcalError);
  });

  it("limita bytes leídos aunque no haya Content-Length y cancela la lectura", async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new TextEncoder().encode("x".repeat(200))); },
      cancel() { cancelled = true; },
    });
    await expect(readAirbnbCalendar(TEST_AIRBNB_URL, { maxBytes: 100, fetch: async () => new Response(body) })).rejects.toBeInstanceOf(IcalError);
    expect(cancelled).toBe(true);
  });

  it("el límite de tiempo incluye la lectura del cuerpo, no solo las cabeceras", async () => {
    vi.useFakeTimers();
    let aborted = false;
    const result = readAirbnbCalendar(TEST_AIRBNB_URL, {
      timeoutMs: 25,
      fetch: async (_input, init) => {
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("BEGIN:VCALENDAR\r\n"));
            init?.signal?.addEventListener("abort", () => { aborted = true; controller.error(new Error("URL privada que no debe salir")); }, { once: true });
          },
        });
        return new Response(body);
      },
    });
    const check = expect(result).rejects.toBeInstanceOf(IcalError);
    await vi.advanceTimersByTimeAsync(26);
    await check;
    expect(aborted).toBe(true);
  });

  it("un error de red se convierte en error seguro sin URL ni token", async () => {
    let caught: unknown;
    try { await readAirbnbCalendar(TEST_AIRBNB_URL, { fetch: async () => { throw new Error(TEST_AIRBNB_URL); } }); } catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(IcalError);
    expect(caught instanceof Error ? caught.message : "").not.toContain(TEST_AIRBNB_URL);
    expect(caught instanceof Error ? caught.message : "").not.toContain("?t=");
  });

  it("cumple el plazo aunque el transporte no responda a AbortSignal", async () => {
    vi.useFakeTimers();
    const result = readAirbnbCalendar(TEST_AIRBNB_URL, { timeoutMs: 25, fetch: () => new Promise<Response>(() => {}) });
    const check = expect(result).rejects.toBeInstanceOf(IcalError);
    await vi.advanceTimersByTimeAsync(26);
    await check;
  });

  it("una respuesta completa vacía de eventos sí es válida", async () => {
    await expect(readAirbnbCalendar(TEST_AIRBNB_URL, { fetch: async () => new Response(EMPTY_AIRBNB) })).resolves.toEqual([]);
  });
});
