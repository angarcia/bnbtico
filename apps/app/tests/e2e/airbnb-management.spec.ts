import { expect, test, type Route } from "./helpers/test";
import { injectSession } from "./helpers/session";
import { icalExportHarness } from "../db/ical-export-harness";
import { localSupabase } from "../db/local";
import type { SubscriptionHarness } from "../contract/harness";
import { createAirbnbService } from "../../src/data/postgrest/airbnb";
import { createIcalExportService } from "../../src/data/postgrest/ical-export";
import { addDays } from "../../src/domain/calendar";
import { costaRicaToday } from "../../src/domain/inquiry";
import { TEST_AIRBNB_URL } from "../fixtures/airbnb-ical";
import { calendarEvent, calendarFile } from "../fixtures/airbnb-ical";
import { createApp, type Env } from "../../src/server/app";

let h: SubscriptionHarness;
test.beforeAll(async () => { h = await icalExportHarness(); });
test.afterEach(async () => { if (h) await h.reset(); });
const day = (n: number) => addDays(costaRicaToday(Date.now()), n);

async function seedConnection() {
  const l = await h.seed({ status: "active", draft: { title: "Casa gestión iCal" } });
  const local = localSupabase();
  const cfg = { supabaseUrl: local.url, ...local, fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init) };
  const service = createAirbnbService(cfg);
  const exports = createIcalExportService(cfg);
  const jwt = await h.jwt("owner");
  const request = crypto.randomUUID();
  await service.begin(jwt, l.id, TEST_AIRBNB_URL, request);
  await service.context(l.id, request);
  await service.finish(l.id, request, [{ uid: "gestión-inicial", start: day(10), end: day(13) }], null);
  return { l, service, exports, jwt };
}

function imports(service: ReturnType<typeof createAirbnbService>, download: typeof fetch) {
  // Solo la descarga externa es controlada; HTTP, motor, permisos y SQL son reales.
  const app = createApp({ listings: () => h.anon, cache: () => null, purgeFetch: async () => Response.json({ success: true }),
    airbnb: { service: () => service, fetch: download } });
  const env: Env = { ENVIRONMENT: "pruebas", SUPABASE_URL: localSupabase().url, SUPABASE_ANON_KEY: localSupabase().anonKey, ASSETS: { fetch: async () => new Response("shell") } };
  return async (route: Route) => {
    const request = route.request();
    const response = await app.request(request.url(), { method: request.method(), headers: request.headers(), body: request.postData() ?? undefined }, env);
    await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
  };
}

test("cancelar no desconecta; confirmar retira solo importados y conserva precio y exportación", async ({ page }) => {
  const { l, service, exports, jwt } = await seedConnection();
  await h.calendar("owner").save(l.id, { days: [day(11)], available: false, priceCrc: 75000 });
  const exported = await exports.owner(jwt, l.id, true);
  await injectSession(page, "owner");
  await page.goto(`/propietario/casas/${l.id}/airbnb`);
  await expect(page.getByLabel("Enlace de bnbtico para Airbnb", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 667 });
  await page.screenshot({ path: "/tmp/bnbtico-gestion-07-375.jpg", fullPage: true, mask: [page.getByLabel("Enlace de bnbtico para Airbnb", { exact: true })] });
  await page.context().setOffline(true);
  await expect(page.getByRole("button", { name: "Actualizar ahora", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Desconectar Airbnb", exact: true })).toBeDisabled();
  await page.context().setOffline(false);
  await page.getByRole("button", { name: "Desconectar Airbnb", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "¿Desconectar Airbnb?" });
  await expect(dialog).toContainText("Sus bloqueos manuales y precios se conservan.");
  await page.setViewportSize({ width: 390, height: 844 });
  await dialog.screenshot({ path: "/tmp/bnbtico-gestion-07-confirmacion-390.jpg" });
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  expect(await service.overview(jwt, l.id)).toMatchObject({ connected: true, nights: 3 });
  await page.getByRole("button", { name: "Desconectar Airbnb", exact: true }).click();
  await dialog.getByRole("button", { name: "Desconectar Airbnb", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Airbnb desconectado", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Conectar Airbnb", exact: true })).toBeVisible();
  expect(await h.calendar("owner").days(l.id)).toEqual([{ day: day(11), available: false, specialPriceCrc: 75000 }]);
  expect(await exports.read(exported.token!)).toMatchObject({ nights: [day(11)] });
  await expect(page.getByText("Los calendarios se actualizan periódicamente. Los cambios pueden tardar en aparecer en la otra plataforma. Confirme la disponibilidad antes de acordar una estancia", { exact: true })).toBeVisible();
});

test("cancelar conserva el feed; revocar lo invalida y generar otro deja el antiguo inaccesible", async ({ page }) => {
  const { l, service, exports, jwt } = await seedConnection();
  await exports.owner(jwt, l.id, true);
  await injectSession(page, "owner");
  await page.goto(`/propietario/casas/${l.id}/airbnb`);
  const field = page.getByLabel("Enlace de bnbtico para Airbnb", { exact: true });
  await expect(field).toBeVisible();
  const previous = await field.inputValue();
  await page.getByRole("button", { name: "Revocar enlace", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "¿Revocar este enlace?" });
  await expect(dialog).toContainText("Retírelo también de Airbnb");
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  expect((await page.request.get(previous)).status()).toBe(200);
  await page.getByRole("button", { name: "Revocar enlace", exact: true }).click();
  await dialog.getByRole("button", { name: "Revocar enlace", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Enlace revocado", { exact: true })).toBeVisible();
  await expect(field).toHaveCount(0);
  expect((await page.request.get(previous)).status()).toBe(404);
  expect(await service.overview(jwt, l.id)).toMatchObject({ connected: true, nights: 3 });
  await page.getByRole("button", { name: "Generar enlace", exact: true }).click();
  await expect(field).toBeVisible();
  expect((await field.inputValue()) === previous).toBe(false);
  expect((await page.request.get(previous)).status()).toBe(404);
});

test("actualizar muestra error posterior sin perder éxito y el reintento doble hace una sola lectura", async ({ page }) => {
  const { l, service } = await seedConnection();
  let reads = 0;
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/calendarios/airbnb", imports(service, async () => {
    reads++;
    if (reads === 1) return new Response("<html>Error de prueba</html>");
    await gate;
    return new Response(calendarFile());
  }));
  await injectSession(page, "owner");
  await page.goto(`/propietario/casas/${l.id}/airbnb`);
  const success = page.getByText(/^Última importación correcta:/);
  await expect(success).toBeVisible();
  const previous = await success.innerText();
  await page.getByRole("button", { name: "Actualizar ahora", exact: true }).click();
  const section = page.getByRole("region", { name: "Importar desde Airbnb" });
  await expect(section.getByText(/Se conservan las últimas noches importadas/)).toBeVisible();
  await expect(success).toHaveText(previous);
  await expect(section.getByText("3 noches bloqueadas por Airbnb", { exact: true })).toBeVisible();
  try {
    await page.getByRole("button", { name: "Intentar de nuevo", exact: true }).click({ clickCount: 2 });
    await expect(page.getByRole("button", { name: "Actualizando…", exact: true })).toBeDisabled();
    await expect(success).toHaveText(previous);
  } finally { release(); }
  await expect(page.getByText("Calendario actualizado", { exact: true })).toBeVisible();
  await expect(section.getByText("No hay noches bloqueadas por Airbnb en este período.", { exact: true })).toBeVisible();
  await expect(section.getByText(/Se conservan las últimas noches importadas/)).toHaveCount(0);
  expect(reads).toBe(2);
});

test("sustituir conserva campo y conexión ante fallo; confirma solo la lectura válida", async ({ page }) => {
  const { l, service } = await seedConnection();
  const replacement = "https://www.airbnb.com/calendar/ical/987654321.ics?t=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  let fail = true;
  await page.route("**/api/calendarios/airbnb", imports(service, async () => {
    if (fail) { fail = false; return new Response("<html>Fallo de sustitución</html>"); }
    return new Response(calendarFile(calendarEvent("sustitución", day(15).replaceAll("-", ""), day(17).replaceAll("-", ""))));
  }));
  await injectSession(page, "owner");
  await page.goto(`/propietario/casas/${l.id}/airbnb`);
  await page.getByRole("button", { name: "Sustituir enlace", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Sustituir enlace" });
  await expect(dialog).toContainText("El enlace actual seguirá conectado hasta que podamos leer el nuevo.");
  await dialog.getByLabel("Enlace de calendario de Airbnb", { exact: true }).fill(replacement);
  await dialog.getByRole("button", { name: "Sustituir enlace", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("No pudimos leer el calendario");
  await expect(dialog.getByLabel("Enlace de calendario de Airbnb", { exact: true })).toHaveValue(replacement);
  await expect(page.getByText("Enlace de Airbnb sustituido", { exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Sustituir enlace", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Enlace de Airbnb sustituido", { exact: true })).toBeVisible();
  await expect(page.getByText("2 noches bloqueadas por Airbnb", { exact: true })).toBeVisible();
});

test("una respuesta perdida al desconectar se reconcilia con el estado confirmado de la base", async ({ page }) => {
  const { l, service, jwt } = await seedConnection();
  await page.route("**/rest/v1/rpc/disconnect_airbnb", async route => {
    await route.fetch();
    await route.abort("failed");
  });
  await injectSession(page, "owner");
  await page.goto(`/propietario/casas/${l.id}/airbnb`);
  await page.getByRole("button", { name: "Desconectar Airbnb", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "¿Desconectar Airbnb?" });
  await dialog.getByRole("button", { name: "Desconectar Airbnb", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Airbnb desconectado", { exact: true })).toBeVisible();
  expect(await service.overview(jwt, l.id)).toMatchObject({ connected: false, nights: 0 });
});

test("un reintento de revocación con respuesta perdida conserva una generación posterior", async ({ page }) => {
  const { l, exports, jwt } = await seedConnection();
  await exports.owner(jwt, l.id, true);
  let first = true;
  await page.route("**/rest/v1/rpc/revoke_ical_export_generation", async route => {
    if (!first) { await route.continue(); return; }
    first = false;
    await route.fetch();
    await exports.owner(jwt, l.id, true);
    await route.abort("failed");
  });
  await injectSession(page, "owner");
  await page.goto(`/propietario/casas/${l.id}/airbnb`);
  await page.getByRole("button", { name: "Revocar enlace", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "¿Revocar este enlace?" });
  await dialog.getByRole("button", { name: "Revocar enlace", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("El enlace cambió");
  await dialog.getByRole("button", { name: "Revocar enlace", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("El enlace cambió");
  const latest = await exports.owner(jwt, l.id, false);
  expect(latest.generated).toBe(true);
  expect(await exports.read(latest.token!)).not.toBeNull();
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.getByText("Enlace revocado", { exact: true })).toHaveCount(0);
});
