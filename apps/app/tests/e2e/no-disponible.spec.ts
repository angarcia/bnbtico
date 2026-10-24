import { expect, test, type Page } from "./helpers/test";
import type { CalendarHarness } from "../contract/harness";
import { sql } from "../db/local";
import { postgrestHarness } from "../db/postgrest-harness";
import { injectSession } from "./helpers/session";
import { addDays, addMonths, occupiedNightsLabel } from "../../src/domain/calendar";
import { longDate } from "../../src/domain/dates";
import { costaRicaToday } from "../../src/domain/inquiry";

// «Disponible para consultas» con fecha de reapertura opcional y la fila «Calendario y precios» del detalle (pantalla 19,
// fase 4 ticket 04) contra Supabase local. Cada prueba siembra sus casas. La ficha del servidor se mira solo en una casa
// que nadie ha visitado antes (la copia en caché del worker local y su purga son del ticket 05); tras reabrir se mira la
// ficha dentro de la SPA.
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
let h: CalendarHarness;

test.describe.configure({ mode: "serial" });

const today = () => costaRicaToday(Date.now());
const nextMonthDay = (d: number) => `${addMonths(today().slice(0, 7), 1)}-${String(d).padStart(2, "0")}`;
const toggle = (page: Page) => page.getByRole("switch", { name: /Disponible para consultas/ });
const sheet = (page: Page) => page.getByRole("dialog", { name: "Cerrar a consultas" });
const row = (page: Page) => page.locator(".list-item").filter({ has: page.getByRole("switch") });
const calendarRow = (page: Page) => page.getByRole("link", { name: /Calendario y precios/ });
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

test("cerrar con fecha → «Cerrada hasta el …» → ficha sin contacto → reapertura nocturna: abierta y con sus noches y precios", async ({ page }) => {
  const casa = await seedHouse("Casa Reapertura");
  const days = [
    { day: today(), available: false, specialPriceCrc: null },
    { day: nextMonthDay(5), available: false, specialPriceCrc: null },
    { day: nextMonthDay(20), available: true, specialPriceCrc: 150000 },
  ];
  for (const d of days) await h.putDay(casa.id, d);
  const reopen = addDays(today(), 10);

  await page.goto(`/propietario/casas/${casa.id}`);
  await expect(toggle(page)).toHaveAttribute("aria-checked", "true");
  await expect(calendarRow(page)).toContainText(occupiedNightsLabel(days, today().slice(0, 7)));
  await expect(calendarRow(page)).toHaveAttribute("href", `/propietario/calendario?casa=${casa.id}`);

  // Apagar abre la hoja; Escape y el fondo la cierran sin cambiar nada.
  await toggle(page).click();
  await expect(sheet(page)).toBeVisible();
  await expect(toggle(page)).toHaveAttribute("aria-checked", "true");
  const date = sheet(page).getByLabel("¿Cuándo vuelve a abrir? (opcional)");
  await expect(date).toHaveAttribute("min", addDays(today(), 1));
  await expect(date).toHaveAttribute("max", addDays(today(), 365));
  await expect(sheet(page).getByText("Sin fecha, queda cerrada hasta que usted la abra.")).toBeVisible();
  await expect(sheet(page)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(sheet(page)).toHaveCount(0);
  await expect(toggle(page)).toBeFocused();
  await toggle(page).click();
  await page.getByTestId("sheet-backdrop").click({ position: { x: 10, y: 10 } });
  await expect(sheet(page)).toHaveCount(0);
  await toggle(page).click();
  await sheet(page).getByRole("button", { name: "Cancelar" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(toggle(page)).toHaveAttribute("aria-checked", "true");

  // Una fecha de hoy no vale (el campo la limita, pero se puede escribir): el mensaje es el de la base.
  await toggle(page).click();
  await date.fill(today());
  await sheet(page).getByRole("button", { name: "Cerrar a consultas" }).click();
  await expect(sheet(page).locator('.note[role="alert"]')).toHaveText("La fecha de reapertura debe ser a partir de mañana y dentro de un año.");
  // Tab no sale de la hoja.
  for (let i = 0; i < 5; i++) await page.keyboard.press("Tab");
  await expect(sheet(page).locator(":focus")).toHaveCount(1);
  await date.fill(reopen);
  await page.screenshot({ path: "test-results/no-disponible-hoja.png" });
  await sheet(page).getByRole("button", { name: "Cerrar a consultas" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(toggle(page)).toHaveAttribute("aria-checked", "false");
  await expect(row(page)).toContainText(`Cerrada hasta el ${longDate(reopen)}`);
  await expect.poll(async () => (await h.owner("owner").getOwn(casa.id))?.reopenAt).toBe(reopen);
  await page.screenshot({ path: "test-results/no-disponible-cerrada.png" });

  await page.goto("/propietario/casas");
  await expect(page.getByRole("article").filter({ hasText: "Casa Reapertura" }).getByText("No disponible", { exact: true })).toBeVisible();

  await page.goto(`/casa/${casa.publicId}`);
  await expect(page.getByRole("button", { name: "No disponible para consultas" })).toBeDisabled();
  await expect(page.locator(".cta-bar").getByText(`Vuelve a estar disponible el ${longDate(reopen)}`)).toBeVisible();

  // La reapertura de las 00:00 de Costa Rica (el job de pg_cron llama a esta función).
  expect(reopenDue(reopen)).toBeGreaterThanOrEqual(1);
  await page.goto(`/propietario/casas/${casa.id}`);
  await expect(toggle(page)).toHaveAttribute("aria-checked", "true");
  await expect(row(page)).toContainText("Si la cierra, la ficha sigue visible pero sin botón de contacto");
  await expect(row(page)).not.toContainText("Cerrada");
  await page.getByRole("link", { name: "Ver ficha" }).click();
  await expect(page.getByRole("button", { name: "Contactar por WhatsApp" })).toBeVisible();
  await expect(page.getByText(/Vuelve a estar disponible/)).toHaveCount(0);

  const after = await h.owner("owner").getOwn(casa.id);
  expect(after).toMatchObject({ status: "active", available: true, reopenAt: null, nightlyPriceCrc: 95000 });
  expect(await h.calendar("owner").days(casa.id)).toEqual(days);
});

test("cerrar sin fecha: «Cerrada a consultas» y sigue cerrada tras la reapertura nocturna de dentro de 40 días", async ({ page }) => {
  const casa = await seedHouse("Casa Sin Fecha");
  await page.goto(`/propietario/casas/${casa.id}`);
  await expect(calendarRow(page)).toContainText("Sin noches ocupadas este mes");
  await toggle(page).click();
  await sheet(page).getByRole("button", { name: "Cerrar a consultas" }).click();
  await expect(toggle(page)).toHaveAttribute("aria-checked", "false");
  await expect(row(page)).toContainText("Cerrada a consultas");
  await expect.poll(async () => (await h.owner("owner").getOwn(casa.id))?.available).toBe(false);

  reopenDue(addDays(today(), 40));
  await page.reload();
  await expect(toggle(page)).toHaveAttribute("aria-checked", "false");
  await expect(row(page)).toContainText("Cerrada a consultas");
  expect(await h.owner("owner").getOwn(casa.id)).toMatchObject({ available: false, reopenAt: null });
});

test("abrir a mano es un toque, borra la fecha y, si la base rechaza el cierre, vuelve atrás con su mensaje", async ({ page }) => {
  const casa = await seedHouse("Casa Manual");
  const reopen = addDays(today(), 3);
  await h.owner("owner").setAvailable(casa.id, false, reopen);
  await page.goto(`/propietario/casas/${casa.id}`);
  await expect(row(page)).toContainText(`Cerrada hasta el ${longDate(reopen)}`);

  await toggle(page).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(toggle(page)).toHaveAttribute("aria-checked", "true");
  await expect(row(page)).not.toContainText("Cerrada");
  await expect.poll(async () => (await h.owner("owner").getOwn(casa.id))?.reopenAt ?? "abierta").toBe("abierta");
  expect((await h.owner("owner").getOwn(casa.id))?.available).toBe(true);

  await page.route("**/rest/v1/rpc/set_listing_available", (route) =>
    route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "P0001", message: "Solo puede cambiar la disponibilidad de una casa activa.", details: null, hint: null }) }),
  );
  await toggle(page).click();
  await sheet(page).getByLabel("¿Cuándo vuelve a abrir? (opcional)").fill(reopen);
  await sheet(page).getByRole("button", { name: "Cerrar a consultas" }).click();
  await expect(page.locator('.note[role="alert"]')).toHaveText("Solo puede cambiar la disponibilidad de una casa activa.");
  await expect(toggle(page)).toHaveAttribute("aria-checked", "true");
  await expect(row(page)).not.toContainText("Cerrada");
});

test("una casa devuelta a edición con la fecha vencida se abre a consultas pero sigue oculta", async ({ page }) => {
  const casa = await seedHouse("Casa En Edición");
  const reopen = addDays(today(), 1);
  await h.owner("owner").setAvailable(casa.id, false, reopen);
  await h.owner("owner").reopenForEdit(casa.id);

  expect(reopenDue(reopen)).toBeGreaterThanOrEqual(1);
  expect(await h.owner("owner").getOwn(casa.id)).toMatchObject({ status: "draft", available: true, reopenAt: null });
  expect(await h.anon.getPublic(casa.publicId)).toBeNull();

  await page.goto(`/propietario/casas/${casa.id}`);
  await expect(page.getByText("Estuvo publicada. Está editándola: al enviarla volverá a revisión.")).toBeVisible();
  await expect(page.getByRole("switch")).toHaveCount(0);
});
