import { describe, expect, it } from "vitest";
import { createApp, type Env } from "../../src/server/app";
import { fakeHarness } from "./fake-harness";
import { parseAirbnbCalendar } from "../../src/domain/ical";

// Se usa el worker real. La única salida ajena al endpoint es el shell de assets;
// recibir ese HTML en vez del feed/error seguro es precisamente la regresión.
function setup(read?: (token: string) => Promise<{ id: string; nights: string[] } | null>, production = false) {
  const h = fakeHarness();
  const app = createApp({ listings: () => h.anon, cache: () => null, purgeFetch: async () => Response.json({ success: true }),
    icalExport: read ? { read: (_env, token) => read(token), now: () => Date.parse("2026-11-08T12:00:00Z") } : undefined });
  const env: Env = {
    ENVIRONMENT: production ? "production" : "pruebas", SUPABASE_URL: "http://supabase.test", SUPABASE_ANON_KEY: "anon",
    ASSETS: { fetch: async () => new Response("shell") },
  };
  return (path: string, method = "GET") => app.request(`https://app.test${path}`, { method }, env);
}

describe("Exportación iCal · frontera pública de lectura", () => {
  const token = "a".repeat(64);
  const id = "11111111-1111-4111-8111-111111111111";

  it("entrega ICS sin sesión, con salida excluida y sin reflejar el secreto", async () => {
    const request = setup(async key => key === token ? { id, nights: ["2026-11-10", "2026-11-09", "2026-11-09"] } : null);
    const response = await request(`/ical/${token}.ics`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.has("set-cookie")).toBe(false);
    const body = await response.text();
    const blocks = parseAirbnbCalendar(body);
    expect(blocks.map(b => [b.start, b.end])).toEqual([["2026-11-09", "2026-11-10"], ["2026-11-10", "2026-11-11"]]);
    expect(body.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(body).not.toContain(token);
    expect(body).not.toMatch(/DESCRIPTION|LOCATION|ATTENDEE|ORGANIZER|PRICE|TEL|wa\.me|https?:\/\//i);
    expect(body.split("\r\n").every(line => new TextEncoder().encode(line).length <= 75)).toBe(true);
  });

  it("conserva los UID de noches sin cambios al añadir o quitar vecinas", async () => {
    let nights = ["2026-11-09", "2026-11-10"];
    const request = setup(async () => ({ id, nights }));
    const first = parseAirbnbCalendar(await (await request(`/ical/${token}.ics`)).text());
    nights = ["2026-11-08", "2026-11-09"];
    const second = parseAirbnbCalendar(await (await request(`/ical/${token}.ics`)).text());
    expect(second.find(b => b.start === "2026-11-09")?.uid).toBe(first.find(b => b.start === "2026-11-09")?.uid);
    expect(first).toHaveLength(2);
    expect(second).toHaveLength(2);
  });

  it("un calendario vacío es válido y HEAD comprueba el enlace sin enviar cuerpo", async () => {
    const request = setup(async () => ({ id, nights: [] }));
    const response = await request(`/ical/${token}.ics`);
    expect(response.status).toBe(200);
    expect(parseAirbnbCalendar(await response.text())).toEqual([]);
    const head = await request(`/ical/${token}.ics`, "HEAD");
    expect(head.status).toBe(200);
    expect(head.headers.get("cache-control")).toBe("no-store");
    expect(await head.text()).toBe("");
  });

  it("un fallo de base no entrega un feed vacío ni expone el error remoto", async () => {
    const response = await setup(async () => { throw new Error(`Error privado ${token}`); })(`/ical/${token}.ics`);
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.text();
    expect(body).not.toContain(token);
    expect(body).not.toContain("Error privado");
    expect(body).not.toContain("VCALENDAR");
  });

  it("un token mal formado no entrega ni el shell ni información privada", async () => {
    const request = setup();
    const response = await request("/ical/corto.ics");
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.text();
    expect(body).not.toContain("corto");
    expect(body).not.toContain("shell");
    expect(response.headers.has("set-cookie")).toBe(false);
  });

  it("un token desconocido o revocado devuelve el mismo error, sin caché ni ETag", async () => {
    let active = true;
    const request = setup(async key => key === token && active ? { id, nights: [] } : null);
    const first = await request(`/ical/${token}.ics`);
    expect(first.status).toBe(200);
    expect(first.headers.has("etag")).toBe(false);
    active = false;
    const revoked = await request(`/ical/${token}.ics`);
    const unknown = await request(`/ical/${"b".repeat(64)}.ics`);
    expect(revoked.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(await revoked.text()).toBe(await unknown.text());
    expect(revoked.headers.get("cache-control")).toBe("no-store");
    expect(revoked.headers.has("etag")).toBe(false);
  });

  it("antes del lanzamiento producción no sirve fechas ni cachea una portada bajo el token", async () => {
    const response = await setup(async () => ({ id, nights: ["2026-11-09"] }), true)(`/ical/${token}.ics`);
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).not.toContain("VCALENDAR");
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])("el enlace rechaza %s y no concede escritura", async method => {
    const response = await setup(async () => { throw new Error("No debe acceder al lector."); })(`/ical/${"a".repeat(64)}.ics`, method);
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, HEAD");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.has("set-cookie")).toBe(false);
  });
});
