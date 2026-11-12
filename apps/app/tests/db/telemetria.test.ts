// Tablas de telemetría (ticket 11): solo la service role; anon y authenticated no leen ni escriben. Y el escritor del
// worker contra PostgREST local.
import { afterAll, describe, expect, it } from "vitest";
import { createTelemetryWriter } from "../../src/data/postgrest/telemetry";
import { anonClient, localSupabase, serviceClient, signIn, sql } from "./local";

const TABLES = ["web_vitals", "client_errors", "events"] as const;
const BUILD = `prueba-${Date.now().toString(36)}`;

afterAll(() => {
  for (const t of TABLES) sql(`delete from public.${t} where build = '${BUILD}'`);
});

describe("telemetría · permisos", () => {
  it("anon y authenticated no tienen ningún privilegio sobre las tres tablas", () => {
    for (const role of ["anon", "authenticated"]) {
      for (const t of TABLES) {
        for (const priv of ["select", "insert", "update", "delete"]) {
          expect(sql(`select has_table_privilege('${role}', 'public.${t}', '${priv}')`), `${role} ${priv} ${t}`).toBe("f");
        }
      }
    }
  });

  it("anon no puede escribir ni leer por PostgREST", async () => {
    const db = anonClient();
    const ins = await db.from("events").insert({ name: "page_view", page: "inicio", path: "/", build: BUILD });
    expect(ins.error?.code).toBe("42501");
    const sel = await db.from("web_vitals").select("id").limit(1);
    expect(sel.error?.code).toBe("42501");
  });

  it("un usuario con sesión tampoco", async () => {
    const db = await signIn("other");
    const ins = await db.from("client_errors").insert({ kind: "error", message: "x", page: "inicio", path: "/", build: BUILD });
    expect(ins.error?.code).toBe("42501");
    const sel = await db.from("events").select("id").limit(1);
    expect(sel.error?.code).toBe("42501");
  });

  it("la service role escribe y lee", async () => {
    const db = serviceClient();
    const ins = await db.from("events").insert({ name: "page_view", page: "inicio", path: "/", build: BUILD, country: "CR" }).select("id, country").single();
    expect(ins.error).toBeNull();
    expect(ins.data?.country).toBe("CR");
  });

  it("acepta search_help_tap (fase 6) sin casa y sigue rechazando un nombre desconocido", async () => {
    const db = serviceClient();
    const ok = await db.from("events").insert({ name: "search_help_tap", page: "explorar", path: "/explorar", build: BUILD, country: "CR" }).select("name, listing_public_id").single();
    expect(ok.error).toBeNull();
    expect(ok.data).toEqual({ name: "search_help_tap", listing_public_id: null });
    expect((await db.from("events").insert({ name: "search_help", page: "explorar", path: "/explorar", build: BUILD })).error?.code).toBe("23514");
  });

  it("acepta monthly_filter_tap sin casa", async () => {
    const db = serviceClient();
    const ok = await db.from("events").insert({ name: "monthly_filter_tap", page: "explorar", path: "/explorar", build: BUILD, country: "CR" }).select("name, listing_public_id").single();
    expect(ok.error).toBeNull();
    expect(ok.data).toEqual({ name: "monthly_filter_tap", listing_public_id: null });
  });

  it("acepta search_submit con search_flags y los rechaza en otro evento", async () => {
    const db = serviceClient();
    const base = { page: "explorar", path: "/explorar", build: BUILD, country: "CR" };
    const ok = await db.from("events").insert({ ...base, name: "search_submit", search_flags: ["zona", "fechas"] }).select("name, search_flags").single();
    expect(ok.error).toBeNull();
    expect(ok.data).toEqual({ name: "search_submit", search_flags: ["zona", "fechas"] });
    expect((await db.from("events").insert({ ...base, name: "page_view", search_flags: ["zona"] })).error?.code).toBe("23514");
    expect((await db.from("events").insert({ ...base, name: "search_submit", search_flags: ["precio"] })).error?.code).toBe("23514");
    expect((await db.from("events").insert({ ...base, name: "explore_map_open" })).error).toBeNull();
    expect((await db.from("events").insert({ ...base, name: "map_marker_tap", listing_public_id: "CT-1015" })).error).toBeNull();
  });

  it("la base rechaza filas fuera de forma aunque vengan de la service role", async () => {
    const db = serviceClient();
    expect((await db.from("web_vitals").insert({ name: "FID", value: 1, metric_id: "x", page: "ficha", path: "/", build: BUILD })).error?.code).toBe("23514");
    expect((await db.from("events").insert({ name: "listing_view", listing_public_id: "nada", page: "ficha", path: "/", build: BUILD })).error?.code).toBe("23514");
  });
});

describe("telemetría · escritor del worker (PostgREST con la service role)", () => {
  const { url, serviceKey } = localSupabase();
  const writer = createTelemetryWriter(url, serviceKey, fetch);

  it("inserta en las tres tablas", async () => {
    await writer.insert("web_vitals", { name: "LCP", value: 1200, rating: "good", metric_id: "v5-1", page: "ficha", path: "/casa/CT-1015", build: BUILD, country: "CR" });
    await writer.insert("client_errors", { kind: "rejection", message: "Boom", page: "explorar", path: "/explorar", build: BUILD, country: null });
    await writer.insert("events", { name: "whatsapp_tap", listing_public_id: "CT-1015", page: "ficha", path: "/casa/CT-1015", build: BUILD, country: "CR" });
    for (const t of TABLES) expect(sql(`select count(*) from public.${t} where build = '${BUILD}'`), t).not.toBe("0");
  });

  it("una fila que la base rechaza es un error", async () => {
    await expect(writer.insert("web_vitals", { name: "LCP", value: -1, metric_id: "x", page: "ficha", path: "/", build: BUILD, country: null })).rejects.toThrow(/400|23514/);
  });

  it("recorta lo anterior a una fecha y devuelve cuántas filas borró", async () => {
    sql(`insert into public.events (name, page, path, build, created_at) values ('page_view', 'inicio', '/', '${BUILD}', now() - interval '200 days')`);
    const removed = await writer.prune(new Date(Date.now() - 90 * 86_400_000).toISOString());
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(sql(`select count(*) from public.events where build = '${BUILD}' and created_at < now() - interval '90 days'`)).toBe("0");
    expect(sql(`select count(*) from public.events where build = '${BUILD}'`)).not.toBe("0");
  });
});
