// Feature flags por entorno (historia #58, decisión 2026-11-17): cinco flags con valor inicial, configuradas con
// variables de GitHub por entorno. Un valor que no sea «true», «false» o vacío para el build y el despliegue nombrando
// la variable. El modo de Explorar sale de las dos flags de búsqueda: fechas, si no noches, si no sin estancia.
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { DEFAULT_FLAGS, FLAG_NAMES, FLAG_VARIABLES, parseFlags, searchModeOf, type Flags } from "../../src/domain/flags";

const script = new URL("../../scripts/deploy-target.mjs", import.meta.url).pathname;

describe("valores de las feature flags", () => {
  it("sin variables, los cinco valores iniciales", () => {
    expect(parseFlags({})).toEqual({
      ok: true,
      flags: { exploreDates: false, exploreNights: true, datePrices: false, externalCalendars: true, rooms: false },
    });
    expect(parseFlags({})).toEqual({ ok: true, flags: DEFAULT_FLAGS });
  });

  it("un valor explícito manda sobre el inicial; vacío o con espacios vale el inicial", () => {
    const result = parseFlags({ FLAG_EXPLORAR_FECHAS: "true", FLAG_HABITACIONES: " true ", FLAG_ICAL: "false", FLAG_EXPLORAR_NOCHES: "" });
    expect(result).toEqual({ ok: true, flags: { ...DEFAULT_FLAGS, exploreDates: true, rooms: true, externalCalendars: false } });
  });

  it.each(["1", "si", "TRUE", "on", "yes", "falso"])("«%s» no es válido y el error nombra la variable", (value) => {
    const result = parseFlags({ FLAG_PRECIOS_POR_FECHA: value });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toEqual(["FLAG_PRECIOS_POR_FECHA"]);
  });

  it("nombra todas las variables inválidas, no solo la primera", () => {
    const result = parseFlags({ FLAG_ICAL: "x", FLAG_HABITACIONES: "y" });
    expect(result.ok ? [] : result.errors).toEqual(["FLAG_ICAL", "FLAG_HABITACIONES"]);
  });

  it("cada flag tiene una variable propia y estable", () => {
    expect(FLAG_NAMES).toHaveLength(5);
    expect(new Set(FLAG_NAMES.map((name) => FLAG_VARIABLES[name])).size).toBe(5);
  });
});

describe("modo de búsqueda de Explorar", () => {
  const with_ = (exploreDates: boolean, exploreNights: boolean): Flags => ({ ...DEFAULT_FLAGS, exploreDates, exploreNights });
  it.each([
    [true, true, "dates"],
    [true, false, "dates"],
    [false, true, "nights"],
    [false, false, "none"],
  ] as const)("fechas %s y noches %s → %s", (dates, nights, mode) => {
    expect(searchModeOf(with_(dates, nights))).toBe(mode);
  });
});

describe("el despliegue interpreta las flags igual que la app", () => {
  const deploy = (env: Record<string, string>) => spawnSync(process.execPath, [script, "flags-check"], { encoding: "utf8", env: { DEPLOY_ENV: "pruebas", ...env } });

  it.each<Record<string, string>>([
    {},
    { FLAG_EXPLORAR_FECHAS: "true", FLAG_EXPLORAR_NOCHES: "false" },
    { FLAG_PRECIOS_POR_FECHA: "true", FLAG_ICAL: "false", FLAG_HABITACIONES: "true" },
  ])("%j", (env) => {
    const out = deploy(env);
    expect(out.status, out.stderr).toBe(0);
    const parsed = parseFlags(env);
    expect(parsed.ok && JSON.parse(out.stdout)).toEqual(parsed.ok && parsed.flags);
  });

  it("un valor inválido para el despliegue con el nombre de la variable de GitHub del entorno", () => {
    const pruebas = deploy({ FLAG_HABITACIONES: "si" });
    expect(pruebas.status).not.toBe(0);
    expect(pruebas.stderr).toContain("FLAG_HABITACIONES_PRUEBAS");
    const produccion = deploy({ DEPLOY_ENV: "production", FLAG_ICAL: "1" });
    expect(produccion.status).not.toBe(0);
    expect(produccion.stderr).toContain("FLAG_ICAL_PRODUCCION");
  });

  it("en pruebas las escribe en la base con la clave de servicio; en producción solo valida", async () => {
    const { createServer } = await import("node:http");
    const { spawn } = await import("node:child_process");
    const seen: { url?: string; auth?: string; body: string }[] = [];
    const server = createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => { seen.push({ url: req.url, auth: req.headers.authorization, body }); res.writeHead(204).end(); });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const exec = (env: Record<string, string>) => new Promise<number>((resolve) => {
      spawn(process.execPath, [script, "flags"], { env: { ...env, SUPABASE_URL: `http://127.0.0.1:${port}`, SUPABASE_SERVICE_ROLE_KEY: "clave-de-prueba" }, stdio: "ignore" })
        .on("exit", (code) => resolve(code ?? 1));
    });
    try {
      expect(await exec({ DEPLOY_ENV: "pruebas", FLAG_HABITACIONES: "true" })).toBe(0);
      expect(await exec({ DEPLOY_ENV: "production", FLAG_ICAL: "false" })).toBe(0);
    } finally { server.close(); }
    expect(seen).toEqual([{
      url: "/rest/v1/rpc/set_feature_flags", auth: "Bearer clave-de-prueba",
      body: JSON.stringify({ p_explore_dates: false, p_explore_nights: true, p_date_prices: false, p_external_calendars: true, p_rooms: true }),
    }]);
  });
});
