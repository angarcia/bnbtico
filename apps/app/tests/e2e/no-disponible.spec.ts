import { expect, test, type Page } from "./helpers/test";
import type { CalendarHarness } from "../contract/harness";
import { sql } from "../db/local";
import { postgrestHarness } from "../db/postgrest-harness";
import { injectSession } from "./helpers/session";
import { addDays, addMonths } from "../../src/domain/calendar";
import { longDate, shortDate } from "../../src/domain/dates";
import { costaRicaToday } from "../../src/domain/inquiry";

// «Pausar la casa» arriba del Calendario de cada casa activa (antes «Cerrar la casa hasta…» y, antes aún, el interruptor
// «Anuncio visible» del detalle; fase 4 ticket 04, ronda de Ana del 2026-10-29 y ticket 04 de la del 2 nov) contra Supabase local. Cada prueba siembra sus casas. La ficha del
// servidor se mira solo en una casa que nadie ha visitado antes (la copia en caché del worker local y su purga son del
// ticket 05); tras reabrir se mira la ficha dentro de la SPA.
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
let h: CalendarHarness;

test.describe.configure({ mode: "serial" });

const today = () => costaRicaToday(Date.now());
const nextMonthDay = (d: number) => `${addMonths(today().slice(0, 7), 1)}-${String(d).padStart(2, "0")}`;
const closeRow = (page: Page) => page.getByRole("button", { name: /^Pausar la casa.*cuándo vuelve/ });
const sheet = (page: Page) => page.getByRole("dialog", { name: "Pausar la casa" });
const closedRow = (page: Page) => page.locator(".cal-action.is-paused");
const openBtn = (page: Page) => page.getByRole("button", { name: "Volver a publicarla" });
const calendar = (page: Page, id: string) => page.goto(`/propietario/calendario?casa=${id}`);
const reopenDue = (date: string) => Number(sql(`select public.reopen_due_listings('${date}')`));

async function seedHouse(title: string) {
  return h.seed({ status: "active", draft: { title, nightlyPriceCrc: 95000 } });
}

test.beforeAll(async () => {
  h = await postgrestHarness();
  await h.reset();
});

test.beforeEach(async ({ page }) => {
  await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
  await injectSession(page, "owner");
});

test("pausar con fecha → «Pausada hasta el …» → fuera de Explorar y ficha sin contacto → reapertura nocturna: abierta y con sus noches y precios", async ({ page }) => {
  const casa = await seedHouse("Casa Reapertura");
  const days = [
    { day: today(), available: false, specialPriceCrc: null },
    { day: nextMonthDay(5), available: false, specialPriceCrc: null },
    { day: nextMonthDay(20), available: true, specialPriceCrc: 150000 },
  ];
  for (const d of days) await h.putDay(casa.id, d);
  const reopen = addDays(today(), 10);

  await calendar(page, casa.id);
  await expect(closeRow(page)).toBeVisible();
  await expect(closeRow(page)).toContainText("No sale en Explorar ni recibe consultas. Puede elegir cuándo vuelve.");
  await expect(page.locator(".month-grid.is-dimmed")).toHaveCount(0);
  await closeRow(page).screenshot({ path: "test-results/no-disponible-fila.png" });

  // Tocar la fila abre la hoja; Escape, el fondo y «Cancelar» la cierran sin cambiar nada.
  await closeRow(page).click();
  await expect(sheet(page)).toBeVisible();
  const date = sheet(page).getByLabel("Volver a publicarla el (opcional)");
  await expect(date).toHaveAttribute("min", addDays(today(), 1));
  await expect(date).toHaveAttribute("max", addDays(today(), 365));
  await expect(sheet(page).getByText("No aparecerá en Explorar ni recibirá consultas. Sus noches y precios se conservan.")).toBeVisible();
  await expect(sheet(page)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(sheet(page)).toHaveCount(0);
  await expect(closeRow(page)).toBeFocused();
  await closeRow(page).click();
  await page.getByTestId("sheet-backdrop").click({ position: { x: 10, y: 10 } });
  await expect(sheet(page)).toHaveCount(0);
  await closeRow(page).click();
  await sheet(page).getByRole("button", { name: "Cancelar" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(closeRow(page)).toBeVisible();

  // Una fecha de hoy no vale (el campo la limita, pero se puede escribir): el mensaje es el de la base.
  await closeRow(page).click();
  await date.fill(today());
  await sheet(page).getByRole("button", { name: "Pausar la casa" }).click();
  await expect(sheet(page).locator('.note[role="alert"]')).toHaveText("La fecha para volver a publicarla debe ser a partir de mañana y dentro de un año.");
  // Tab no sale de la hoja.
  for (let i = 0; i < 5; i++) await page.keyboard.press("Tab");
  // Con el foco en un campo de la fecha (dentro del input) `:focus` no lo ve en Chrome: se mira el elemento activo.
  expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
  await date.fill(reopen);
  await page.screenshot({ path: "test-results/no-disponible-hoja.png" });
  await sheet(page).getByRole("button", { name: "Pausar la casa" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(closedRow(page)).toContainText(`Pausada hasta el ${shortDate(reopen)}`);
  await expect(openBtn(page)).toBeVisible();
  await expect(closeRow(page)).toHaveCount(0);
  await expect(page.locator(".month-grid.is-dimmed").first()).toBeVisible();
  await expect.poll(async () => (await h.owner("owner").getOwn(casa.id))?.reopenAt).toBe(reopen);
  await expect.poll(async () => (await h.anon.getPublic(casa.publicId))?.available).toBe(false);
  await page.screenshot({ path: "test-results/no-disponible-cerrada.png" });

  // Mis casas (una sola casa: la lista con su tarjeta) lo dice en la etiqueta de la foto.
  await page.goto("/propietario/casas");
  await expect(page.getByRole("article").getByRole("heading", { name: "Casa Reapertura" })).toBeVisible();
  await expect(page.getByRole("article").getByTestId("card-label")).toHaveText(`Pausada hasta el ${shortDate(reopen)}`);

  // Pausada: no sale en Explorar (ticket 20), pero su ficha se abre y dice que no está disponible por ahora.
  await page.goto("/explorar?prov=Todas");
  await expect(page.getByTestId("results-count")).toHaveText(/\d+ casas?/);
  await expect(page.getByRole("link", { name: /Casa Reapertura/ })).toHaveCount(0);
  await page.goto(`/casa/${casa.publicId}`);
  await expect(page.locator(".badge-mute", { hasText: "No disponible por ahora" })).toBeVisible();
  await expect(page.getByRole("button", { name: "No disponible por ahora" })).toBeDisabled();
  await expect(page.locator(".cta-bar").getByText(`Vuelve a estar disponible el ${longDate(reopen)}`)).toBeVisible();

  // La reapertura de las 00:00 de Costa Rica (el job de pg_cron llama a esta función).
  expect(reopenDue(reopen)).toBeGreaterThanOrEqual(1);
  await calendar(page, casa.id);
  await expect(closeRow(page)).toBeVisible();
  await expect(closedRow(page)).toHaveCount(0);
  await page.goto(`/propietario/casas/${casa.id}`);
  await expect(page.getByRole("switch")).toHaveCount(0);
  await expect(page.getByText("Anuncio visible")).toHaveCount(0);
  await page.getByRole("link", { name: "Ver ficha" }).click();
  await expect(page.getByRole("button", { name: "Contactar por WhatsApp", exact: true })).toBeVisible();
  await expect(page.getByText(/Vuelve a estar disponible/)).toHaveCount(0);

  const after = await h.owner("owner").getOwn(casa.id);
  expect(after).toMatchObject({ status: "active", available: true, reopenAt: null, nightlyPriceCrc: 95000 });
  expect(await h.calendar("owner").days(casa.id)).toEqual(days);
});

test("pausar sin fecha: «Pausada · No aparece en Explorar ni recibe consultas» y sigue pausada tras la reapertura nocturna de dentro de 40 días", async ({ page }) => {
  const casa = await seedHouse("Casa Sin Fecha");
  await calendar(page, casa.id);
  await closeRow(page).click();
  await sheet(page).getByRole("button", { name: "Pausar la casa" }).click();
  await expect(closedRow(page)).toContainText(/^Pausada\s*No aparece en Explorar ni recibe consultas/);
  await expect.poll(async () => (await h.owner("owner").getOwn(casa.id))?.available).toBe(false);

  reopenDue(addDays(today(), 40));
  await page.reload();
  await expect(closedRow(page)).toContainText(/^Pausada\s*No aparece en Explorar ni recibe consultas/);
  expect(await h.owner("owner").getOwn(casa.id)).toMatchObject({ available: false, reopenAt: null });
});

test("abrir a mano es un toque, borra la fecha y, si la base rechaza el cierre, vuelve atrás con su mensaje", async ({ page }) => {
  const casa = await seedHouse("Casa Manual");
  const reopen = addDays(today(), 3);
  await h.owner("owner").setAvailable(casa.id, false, reopen);
  await calendar(page, casa.id);
  await expect(closedRow(page)).toContainText(`Pausada hasta el ${shortDate(reopen)}`);

  await openBtn(page).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(closeRow(page)).toBeVisible();
  await expect(closedRow(page)).toHaveCount(0);
  await expect.poll(async () => (await h.owner("owner").getOwn(casa.id))?.reopenAt ?? "abierta").toBe("abierta");
  expect((await h.owner("owner").getOwn(casa.id))?.available).toBe(true);

  await page.route("**/rest/v1/rpc/set_listing_available", (route) =>
    route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "P0001", message: "Solo puede cambiar la disponibilidad de una casa activa.", details: null, hint: null }) }),
  );
  await closeRow(page).click();
  await sheet(page).getByLabel("Volver a publicarla el (opcional)").fill(reopen);
  await sheet(page).getByRole("button", { name: "Pausar la casa" }).click();
  await expect(page.locator('.note[role="alert"]')).toHaveText("Solo puede cambiar la disponibilidad de una casa activa.");
  await expect(closeRow(page)).toBeVisible();
  await expect(closedRow(page)).toHaveCount(0);
});

test("una casa vuelta a borrador con la fecha vencida se abre a consultas pero sigue oculta", async ({ page }) => {
  const casa = await seedHouse("Casa En Edición");
  const reopen = addDays(today(), 1);
  await h.owner("owner").setAvailable(casa.id, false, reopen);
  // Estado heredado: desde la edición de casas publicadas ningún propietario devuelve una casa activa a borrador, así que
  // se pasa como el servicio (igual que el estado "reopened" de la siembra).
  sql(`begin; select set_config('app.allow_status','on',true); update public.listings set status = 'draft' where id = '${casa.id}'; commit;`);

  expect(reopenDue(reopen)).toBeGreaterThanOrEqual(1);
  expect(await h.owner("owner").getOwn(casa.id)).toMatchObject({ status: "draft", available: true, reopenAt: null });
  expect(await h.anon.getPublic(casa.publicId)).toBeNull();

  await page.goto(`/propietario/casas/${casa.id}`);
  await expect(page.getByRole("link", { name: "Seguir publicando" })).toBeVisible(); // revisión UX 2026-10-29, A4
  await expect(page.getByRole("switch")).toHaveCount(0);
  await expect(page.getByText("Anuncio visible")).toHaveCount(0);
});

test("al confirmar, el foco pasa a «Volver a publicarla», que no se puede tocar hasta que la base contesta", async ({ page }) => {
  const casa = await seedHouse("Casa Foco");
  await calendar(page, casa.id);
  let release = () => {};
  const held = new Promise<void>((r) => (release = r));
  await page.route("**/rest/v1/rpc/set_listing_available", async (route) => {
    await held;
    await route.continue();
  });
  await closeRow(page).click();
  await sheet(page).getByRole("button", { name: "Pausar la casa" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(openBtn(page)).toBeFocused();
  await expect(openBtn(page)).toBeDisabled();
  // Tocarla mientras tanto no hace nada.
  await openBtn(page).click({ force: true });
  await expect(openBtn(page)).toBeVisible();
  release();
  await expect(openBtn(page)).toBeEnabled();
  await expect.poll(async () => (await h.anon.getPublic(casa.publicId))?.available).toBe(false);
  await page.unroute("**/rest/v1/rpc/set_listing_available");
});

test("sin el trozo de la hoja: avisa de la conexión y «Reintentar» la abre", async ({ page }) => {
  const casa = await seedHouse("Casa Sin Hoja");
  await page.route("**/assets/close-sheet-*.js", (route) => route.abort());
  await calendar(page, casa.id);
  await closeRow(page).click();
  await expect(page.getByRole("alert")).toHaveText("No pudimos abrir «Pausar la casa». Revise su conexión e inténtelo de nuevo.");
  await expect(sheet(page)).toHaveCount(0);
  await page.unroute("**/assets/close-sheet-*.js");
  await page.getByRole("button", { name: "Reintentar" }).click();
  await expect(sheet(page)).toBeVisible();
});
