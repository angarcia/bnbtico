import { expect, test, type Route } from "./helpers/test";
import { injectSession } from "./helpers/session";
import { icalExportHarness } from "../db/ical-export-harness";
import { localSupabase, serviceClient } from "../db/local";
import type { SubscriptionHarness } from "../contract/harness";
import { createAirbnbService } from "../../src/data/postgrest/airbnb";
import { addDays, longDateWithYear } from "../../src/domain/dates";
import { costaRicaToday } from "../../src/domain/inquiry";
import { TEST_AIRBNB_URL, calendarEvent, calendarFile } from "../fixtures/airbnb-ical";
import { createApp, type Env } from "../../src/server/app";

let h: SubscriptionHarness;
test.beforeAll(async () => { h = await icalExportHarness(); });
test.afterEach(async () => { if (h) await h.reset(); });
const day = (n: number) => addDays(costaRicaToday(Date.now()), n);
const dateName = (n: number) => longDateWithYear(day(n))!;

async function connected() {
  const l = await h.seed({ status: "active", draft: { title: "Casa reserva disponible" } });
  const local = localSupabase();
  const service = createAirbnbService({ ...local, supabaseUrl: local.url, fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init) });
  const jwt = await h.jwt("owner");
  const request = crypto.randomUUID();
  await service.begin(jwt, l.id, TEST_AIRBNB_URL, request);
  await service.context(l.id, request);
  await service.finish(l.id, request, [{ uid: "ocupación-anterior", start: day(10), end: day(12) }], null);
  const aged = await serviceClient().from("airbnb_connections").update({ last_success_at: new Date(Date.now() - 300_000).toISOString() }).eq("listing_id", l.id);
  if (aged.error) throw aged.error;
  return { l, service };
}

function imports(service: ReturnType<typeof createAirbnbService>, download: typeof fetch) {
  const app = createApp({ listings: () => h.anon, cache: () => null, purgeFetch: async () => Response.json({ success: true }), airbnb: { service: () => service, fetch: download } });
  const env: Env = { ENVIRONMENT: "pruebas", SUPABASE_URL: localSupabase().url, SUPABASE_ANON_KEY: localSupabase().anonKey, ASSETS: { fetch: async () => new Response("shell") } };
  return async (route: Route) => {
    const request = route.request();
    const response = await app.request(request.url(), { method: request.method(), headers: request.headers(), body: request.postData() ?? undefined }, env);
    await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
  };
}

test("marcar reserva recibe los días manuales; la salida ocupada vale y no se atraviesan noches ocupadas", async ({ page }) => {
  const l = await h.seed({ status: "active", draft: { title: "Casa reserva manual" } });
  await h.calendar("owner").save(l.id, { days: [day(10)], available: false, priceCrc: 78_000 });
  await injectSession(page, "owner");
  await page.goto(`/propietario/calendario?casa=${l.id}`);
  await expect(page.getByRole("button", { name: "Conectar con Airbnb", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 667 });
  await page.screenshot({ path: "/tmp/3bstays-calendario-07-sin-conectar.jpg" });
  await page.getByRole("button", { name: "Marcar una reserva", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Marcar una reserva", exact: true });
  const busy = dialog.getByRole("button", { name: dateName(10), exact: true });
  await expect(busy).toBeDisabled();
  await dialog.getByRole("button", { name: dateName(9), exact: true }).click();
  await dialog.getByRole("button", { name: dateName(12), exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Hay noches ocupadas");
  await expect(dialog.getByRole("button", { name: "Marcar como ocupado", exact: true })).toBeDisabled();
  await expect(busy).toBeEnabled();
  await busy.click();
  await dialog.getByRole("button", { name: "Marcar como ocupado", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(async () => (await h.calendar("owner").days(l.id)).map(d => d.day)).toEqual([day(9), day(10)]);
  expect((await h.calendar("owner").days(l.id)).find(d => d.day === day(10))?.specialPriceCrc).toBe(78_000);
});

test("actualiza antes de seleccionar y reabrir inmediatamente reutiliza el éxito sin otra descarga", async ({ page }) => {
  const { l, service } = await connected();
  let reads = 0;
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/calendarios/airbnb", imports(service, async () => {
    reads++;
    await gate;
    return new Response(calendarFile(calendarEvent("ocupación-nueva", day(15).replaceAll("-", ""), day(17).replaceAll("-", ""))));
  }));
  await injectSession(page, "owner");
  await page.goto(`/propietario/calendario?casa=${l.id}`);
  await page.getByRole("button", { name: "Marcar una reserva", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Marcar una reserva", exact: true });
  try {
    await expect(dialog.getByRole("status")).toContainText("Comprobando disponibilidad");
    await expect(dialog.locator(".range-calendar")).toHaveCount(0);
    await expect.poll(() => reads).toBe(1);
  } finally { release(); }
  await expect(dialog.getByRole("button", { name: dateName(15), exact: true })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: dateName(10), exact: true })).toBeEnabled();
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.getByRole("button", { name: "Marcar una reserva", exact: true }).click();
  await expect(dialog.getByRole("button", { name: dateName(15), exact: true })).toBeDisabled();
  expect(reads).toBe(1);
});

test("un fallo exige confirmar el uso del último calendario válido y mantiene sus noches ocupadas", async ({ page }) => {
  const { l, service } = await connected();
  await page.route("**/api/calendarios/airbnb", imports(service, async () => new Response("<html>Fallo sintético</html>")));
  await injectSession(page, "owner");
  await page.goto(`/propietario/calendario?casa=${l.id}`);
  await page.getByRole("button", { name: "Marcar una reserva", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Marcar una reserva", exact: true });
  await expect(dialog.getByRole("alert")).toContainText("No pudimos actualizar Airbnb");
  await expect(dialog.locator(".range-calendar")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Continuar con el último calendario", exact: true }).click();
  await expect(dialog.getByRole("button", { name: dateName(10), exact: true })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: dateName(14), exact: true })).toBeEnabled();
});

test("el acceso directo actualiza sin salir del calendario y deshabilita el botón sin red", async ({ page }) => {
  const { l, service } = await connected();
  let reads = 0;
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/calendarios/airbnb", imports(service, async () => { reads++; await gate; return new Response(calendarFile()); }));
  await injectSession(page, "owner");
  await page.goto(`/propietario/calendario?casa=${l.id}`);
  const update = page.getByRole("button", { name: "Actualizar importación de Airbnb", exact: true });
  await expect(update).toBeEnabled();
  await expect(page.getByRole("button", { name: /Sincronización con Airbnb/ })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/3bstays-calendario-07-conectado.jpg" });
  await page.context().setOffline(true);
  await expect(update).toBeDisabled();
  await page.context().setOffline(false);
  try {
    await update.click({ clickCount: 2 });
    await expect(page.getByRole("button", { name: "Actualizando importación de Airbnb", exact: true })).toBeDisabled();
    await expect.poll(() => reads).toBe(1);
  } finally { release(); }
  await expect(page.getByText("Calendario actualizado", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/propietario/calendario\\?casa=${l.id}`));
  expect((await h.calendar("owner").days(l.id)).filter(d => d.imported)).toEqual([]);
});

test("un error al leer disponibilidad no convierte el calendario en vacío aunque haya una caché previa", async ({ page }) => {
  const l = await h.seed({ status: "active" });
  await injectSession(page, "owner");
  const firstRead = page.waitForResponse(r => r.url().includes("/rest/v1/rpc/owner_calendar_days") && r.status() === 200);
  await page.goto(`/propietario/calendario?casa=${l.id}`);
  await firstRead;
  await page.route("**/rest/v1/rpc/owner_calendar_days", route => route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ code: "42501", message: "denied" }) }));
  await page.getByRole("button", { name: "Marcar una reserva", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Marcar una reserva", exact: true });
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog.locator(".range-calendar")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Continuar con el último calendario", exact: true })).toHaveCount(0);
  await page.unroute("**/rest/v1/rpc/owner_calendar_days");
  await dialog.getByRole("button", { name: "Intentar de nuevo", exact: true }).click();
  await expect(dialog.getByRole("button", { name: dateName(10), exact: true })).toBeEnabled();
});
