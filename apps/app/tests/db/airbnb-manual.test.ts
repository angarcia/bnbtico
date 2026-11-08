// Arnés manual opt-in: repite el motor real con proveedor sintético solo contra Supabase local y una casa desechable.
import { expect, test } from "vitest";
import { createAirbnbService } from "../../src/data/postgrest/airbnb";
import { addDays } from "../../src/domain/dates";
import { costaRicaToday } from "../../src/domain/inquiry";
import { runAirbnbImport } from "../../src/server/airbnb";
import { calendarEvent, calendarFile, TEST_AIRBNB_URL } from "../fixtures/airbnb-ical";
import { localSupabase, serviceClient, signIn } from "./local";

const publicId = process.env.AIRBNB_MANUAL_HOUSE;
const scenario = process.env.AIRBNB_MANUAL_SCENARIO;
test.skipIf(!publicId || !scenario)("Airbnb · escenario manual local controlado", async () => {
  const cfg = localSupabase();
  expect(["127.0.0.1", "localhost", "[::1]"]).toContain(new URL(cfg.url).hostname);
  expect(["inicial", "repetir", "cambiar", "cancelar", "fallo"]).toContain(scenario);
  const owner = await signIn("owner");
  const session = (await owner.auth.getSession()).data.session!;
  const db = serviceClient();
  const { data: l, error } = await db.from("listings").select("id,title,owner_id").eq("public_id", publicId!).single();
  expect(error).toBeNull();
  expect(l?.owner_id).toBe(session.user.id);
  expect(l?.title).toMatch(/^Prueba Airbnb/);
  if (!l) throw new Error("Cree primero una casa desechable llamada Prueba Airbnb.");
  // Nunca alterar una conexión real desde este arnés, aunque la casa pertenezca al usuario de pruebas.
  const existing = await db.from("airbnb_connections").select("private_url").eq("listing_id", l.id).maybeSingle();
  expect(existing.error).toBeNull();
  if (existing.data?.private_url && existing.data.private_url !== TEST_AIRBNB_URL) throw new Error("El arnés no modifica conexiones reales.");
  const service = createAirbnbService({ supabaseUrl: cfg.url, anonKey: cfg.anonKey, serviceKey: cfg.serviceKey, fetch: (i, init) => fetch(i, init) });
  const request = crypto.randomUUID();
  const before = await service.overview(session.access_token, l.id);
  if (scenario === "inicial") await service.begin(session.access_token, l.id, TEST_AIRBNB_URL, request);
  else await service.claim(l.id, request);
  const d = (n: number) => addDays(costaRicaToday(Date.now()), n);
  const start = scenario === "cambiar" ? d(11) : d(10);
  const end = scenario === "cambiar" ? d(14) : d(13);
  const file = scenario === "cancelar" ? calendarFile() : calendarFile(calendarEvent("reserva-manual-inventada", start.replaceAll("-", ""), end.replaceAll("-", "")));
  await runAirbnbImport(service, l.id, request, { fetch: async () => {
    if (scenario === "fallo") throw new Error("Fallo sintético sin URL real");
    return new Response(file);
  } });
  const after = await service.overview(session.access_token, l.id);
  if (scenario === "fallo") expect(after).toMatchObject({ connected: true, lastSuccessAt: before.lastSuccessAt, nights: before.nights, errorCode: "download" });
  else expect(after).toMatchObject({ connected: true, nights: scenario === "cancelar" ? 0 : 3, errorCode: null });
  console.log(JSON.stringify({ house: publicId, scenario, arrival: start, departureExcluded: end, manualOverlapDate: d(11), importedNights: after.nights, errorCode: after.errorCode }));
});
