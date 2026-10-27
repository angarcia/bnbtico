import { expect, test, type Page } from "./helpers/test";
import type { CalendarHarness } from "../contract/harness";
import { serviceClient } from "../db/local";
import { postgrestHarness } from "../db/postgrest-harness";
import { injectSession } from "./helpers/session";
import { addDays, addMonths, monthTitle, openingMonth } from "../../src/domain/calendar";
import { longDate } from "../../src/domain/dates";
import { costaRicaToday } from "../../src/domain/inquiry";

// Calendario del propietario (pantalla 17, fase 4 ticket 03) contra Supabase local. Cada prueba siembra sus propias casas
// y solo mira los días que ella misma escribe: no supone recuentos ni días de otras pruebas.
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
const OFFLINE = "Sin conexión. Revise su internet e intente de nuevo.";
let h: CalendarHarness;

test.describe.configure({ mode: "serial" });

const today = () => costaRicaToday(Date.now());
/** Días del mes que viene (siempre dentro de la ventana y en el futuro). */
const next = () => addMonths(today().slice(0, 7), 1);
const on = (d: number) => `${next()}-${String(d).padStart(2, "0")}`;
const SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const shortMonth = (month: string) => SHORT[Number(month.slice(5)) - 1];

const grid = (page: Page) => page.getByRole("group", { name: /^\p{L}+ \d{4}$/u });
const day = (page: Page, iso: string) => page.getByRole("button", { name: new RegExp(`^${longDate(iso)} de ${iso.slice(0, 4)},`) });
const cellOf = (page: Page, iso: string) => page.getByRole("gridcell", { name: new RegExp(`^${longDate(iso)} de ${iso.slice(0, 4)},`) });
const panel = (page: Page) => page.getByRole("region", { name: "Días seleccionados" });
const saveBtn = (page: Page) => panel(page).getByRole("button", { name: "Guardar cambios" });
const open = (page: Page, id: string, month = next()) => page.goto(`/propietario/calendario?casa=${id}&mes=${month}`);

async function seedHouse(title: string, draft: Record<string, unknown> = {}) {
  return h.seed({ status: "active", draft: { title, nightlyPriceCrc: 95000, ...draft } });
}

test.beforeAll(async () => {
  h = await postgrestHarness();
  await h.reset();
});

test.beforeEach(async ({ page }) => {
  await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
  await injectSession(page, "owner");
});

test("sin casas: «Publique su casa para usar el calendario.» y «Publicar casa»", async ({ page }) => {
  const { data: other } = await serviceClient().from("profiles").select("id").eq("phone", h.phone("other")).single();
  await serviceClient().from("listings").delete().eq("owner_id", other!.id);
  await injectSession(page, "other");
  await page.goto("/propietario/calendario");
  await expect(page.getByRole("heading", { level: 1, name: "Calendario" })).toBeVisible();
  await expect(page.getByText("Publique su casa para usar el calendario.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Publicar casa" })).toHaveAttribute("href", "/propietario/publicar");
});

test("tres días → Ocupado → se guarda al instante (< 50 ms), sigue al recargar y liberar borra la fila", async ({ page }) => {
  const casa = await seedHouse("Casa Ocupada");
  await open(page, casa.id);
  await expect(page.getByRole("heading", { level: 1, name: "Calendario" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Casa Ocupada/ })).toBeVisible();
  await expect(page.getByText(monthTitle(next()), { exact: true })).toBeVisible();
  await expect(page.getByText("Toque los días para editarlos")).toBeVisible();
  await expect(panel(page)).toHaveCount(0);
  await expect(day(page, on(10))).toContainText("95k");

  for (const d of [10, 11, 12]) await day(page, on(d)).click();
  await expect(day(page, on(11))).toHaveAttribute("aria-pressed", "true");
  await expect(panel(page).getByText(`3 noches · 10–12 ${shortMonth(next())}`)).toBeVisible();
  await expect(panel(page).getByRole("button", { name: "Disponible" })).toHaveAttribute("aria-pressed", "true");
  await expect(panel(page).getByLabel("Precio por noche")).toHaveValue("95 000");
  await expect(saveBtn(page)).toBeDisabled();
  await page.screenshot({ path: "test-results/calendario-seleccion.png" });

  await panel(page).getByRole("button", { name: "Ocupado" }).click();
  await expect(saveBtn(page)).toBeEnabled();

  // La base tarda: la rejilla ya cambió y el panel se cerró en el mismo toque.
  let release = () => {};
  const held = new Promise<void>((r) => (release = r));
  await page.route("**/rest/v1/rpc/save_listing_days", async (route) => {
    await held;
    await route.continue();
  });
  const label = `${longDate(on(10))} de ${on(10).slice(0, 4)}, ocupado`;
  const ms = await saveBtn(page).evaluate(async (el, name) => {
    const t = performance.now();
    (el as HTMLButtonElement).click();
    const done = () => !document.querySelector('[aria-label="Días seleccionados"]') && !!document.querySelector(`button[aria-label^="${name}"]`);
    while (!done()) await new Promise((r) => setTimeout(r, 0));
    return performance.now() - t;
  }, label);
  expect(ms).toBeLessThan(50);
  await expect(day(page, on(12))).toContainText("ocupado");
  release();
  await expect
    .poll(async () => (await h.calendar("owner").days(casa.id)).filter((d) => d.day.startsWith(next())))
    .toEqual([10, 11, 12].map((d) => ({ day: on(d), available: false, specialPriceCrc: null })));
  await page.unroute("**/rest/v1/rpc/save_listing_days");
  await page.screenshot({ path: "test-results/calendario-ocupado.png" });

  await page.reload();
  await expect(day(page, on(11))).toContainText("ocupado");

  await day(page, on(10)).click();
  await expect(panel(page).getByText(`1 noche · 10 ${shortMonth(next())}`)).toBeVisible();
  await expect(panel(page).getByRole("button", { name: "Ocupado" })).toHaveAttribute("aria-pressed", "true");
  await panel(page).getByRole("button", { name: "Disponible" }).click();
  await saveBtn(page).click();
  await expect(day(page, on(10))).toContainText("95k");
  await expect.poll(async () => (await h.calendar("owner").days(casa.id)).map((d) => d.day)).toEqual([on(11), on(12)]);
});

test("precio distinto ★ y, con el precio base («Usar el precio base»), la ★ se va y la fila se borra", async ({ page }) => {
  const casa = await seedHouse("Casa Navidad");
  await open(page, casa.id);
  await day(page, on(15)).click();
  await expect(panel(page).getByRole("button", { name: /Usar el precio base/ })).toHaveCount(0);
  const price = panel(page).getByLabel("Precio por noche");
  await expect(price).toHaveAttribute("inputmode", "numeric");
  await expect(price).toHaveAttribute("enterkeyhint", "done");
  await price.fill("120000");
  // Teclado del iPhone: con el campo enfocado, el panel gana sitio abajo para que el campo suba por encima.
  await expect(panel(page)).toHaveClass(/\bkb\b/);
  await saveBtn(page).click();
  await expect(day(page, on(15))).toContainText("15 ★");
  await expect(day(page, on(15))).toContainText("120k");
  await expect(day(page, on(15))).toHaveAccessibleName(/precio distinto$/);
  await expect.poll(async () => (await h.calendar("owner").days(casa.id)).find((d) => d.day === on(15))?.specialPriceCrc).toBe(120000);

  await day(page, on(15)).click();
  await expect(price).toHaveValue("120 000");
  await panel(page).getByRole("button", { name: "Usar el precio base (₡95 000)" }).click();
  await expect(price).toHaveValue("95 000");
  await saveBtn(page).click();
  await expect(day(page, on(15))).not.toContainText("★");
  await expect(day(page, on(15))).toContainText("95k");
  await expect.poll(async () => (await h.calendar("owner").days(casa.id)).find((d) => d.day === on(15))).toBeUndefined();

  // Escribir el precio base a mano hace lo mismo; un precio que no vale se queda en el panel con el mensaje.
  await day(page, on(16)).click();
  await price.fill("0");
  await saveBtn(page).click();
  await expect(panel(page).getByRole("alert")).toHaveText("Escriba un precio por noche en colones, mayor que cero y sin decimales.");
  await expect(day(page, on(16))).toHaveAttribute("aria-pressed", "true");
});

test("precios mezclados: el campo queda en «Varios precios» y cambiar solo la disponibilidad los conserva", async ({ page }) => {
  const casa = await seedHouse("Casa Mezcla");
  await h.putDay(casa.id, { day: on(20), available: true, specialPriceCrc: 150000 });
  await open(page, casa.id);
  await day(page, on(20)).click();
  await day(page, on(21)).click();
  const price = panel(page).getByLabel("Precio por noche");
  await expect(price).toHaveValue("");
  await expect(price).toHaveAttribute("placeholder", "Varios precios");
  await expect(panel(page).getByRole("button", { name: "Usar el precio base (₡95 000)" })).toBeVisible();
  await panel(page).getByRole("button", { name: "Ocupado" }).click();
  await saveBtn(page).click();
  await expect.poll(async () => (await h.calendar("owner").days(casa.id)).filter((d) => d.day.startsWith(next()))).toEqual([
    { day: on(20), available: false, specialPriceCrc: 150000 },
    { day: on(21), available: false, specialPriceCrc: null },
  ]);

  // Mezcla de disponibilidad: ningún botón marcado hasta que se elige.
  await day(page, on(21)).click();
  await day(page, on(22)).click();
  await expect(panel(page).getByRole("button", { name: "Disponible" })).toHaveAttribute("aria-pressed", "false");
  await expect(panel(page).getByRole("button", { name: "Ocupado" })).toHaveAttribute("aria-pressed", "false");
  await panel(page).getByRole("button", { name: "Cancelar" }).click();
  await expect(panel(page)).toHaveCount(0);
  await expect(day(page, on(21))).toHaveAttribute("aria-pressed", "false");
});

test("ventana de un año: flechas desactivadas en los extremos, días pasados desactivados y un mes fuera de la ventana vuelve al de apertura", async ({ page }) => {
  const casa = await seedHouse("Casa Ventana");
  await open(page, casa.id, "2020-01");
  const now = today().slice(0, 7);
  // Revisión UX A4: abre en el mes de apertura (a fin de mes, el siguiente) y «‹» lleva al actual.
  const opening = openingMonth(today());
  await expect(page.getByText(monthTitle(opening), { exact: true })).toBeVisible();
  if (opening !== now) await page.getByRole("button", { name: "Mes anterior" }).click();
  await expect(page.getByText(monthTitle(now), { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mes anterior" })).toBeDisabled();
  const yesterday = addDays(today(), -1);
  if (yesterday.startsWith(now)) await expect(day(page, yesterday)).toBeDisabled();
  await expect(day(page, today())).toBeEnabled();

  for (let i = 0; i < 12; i++) await page.getByRole("button", { name: "Mes siguiente" }).click();
  await expect(page.getByText(monthTitle(addMonths(now, 12)), { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mes siguiente" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Mes anterior" })).toBeEnabled();
  const beyond = addDays(today(), 366);
  if (beyond.startsWith(addMonths(now, 12))) await expect(day(page, beyond)).toBeDisabled();
  await expect(page).toHaveURL(new RegExp(`mes=${addMonths(now, 12)}`));
});

test("cambiar de casa no mezcla días; la rechazada no se ofrece y la última elegida se recuerda", async ({ page }) => {
  const a = await seedHouse("Casa Alfa");
  const b = await seedHouse("Casa Beta");
  await h.seed({ status: "rejected", draft: { title: "Casa Rechazada" } });
  await h.putDay(a.id, { day: on(5), available: false, specialPriceCrc: null });
  await open(page, a.id);
  await expect(day(page, on(5))).toContainText("ocupado");
  await day(page, on(6)).click();
  await expect(panel(page)).toBeVisible();

  await page.getByRole("button", { name: /Casa Alfa/ }).click();
  const list = page.getByRole("listbox", { name: "Elegir casa" });
  await expect(list.getByRole("option", { name: "Casa Rechazada" })).toHaveCount(0);
  await list.getByRole("option", { name: "Casa Beta" }).click();
  await expect(page.getByRole("button", { name: /Casa Beta/ })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`casa=${b.id}`));
  await expect(day(page, on(5))).toContainText("95k");
  await expect(panel(page)).toHaveCount(0);
  await expect(grid(page)).toBeVisible();

  await page.goto("/propietario/calendario");
  await expect(page.getByRole("button", { name: /Casa Beta/ })).toBeVisible();
});

test("sin red: el cambio vuelve atrás y avisa «Sin conexión…»; un rechazo de la base muestra su mensaje", async ({ page, context }) => {
  const casa = await seedHouse("Casa Sin Red");
  await open(page, casa.id);
  await expect(day(page, on(8))).toContainText("95k");
  await day(page, on(8)).click();
  await panel(page).getByRole("button", { name: "Ocupado" }).click();
  await context.setOffline(true);
  await saveBtn(page).click();
  await expect(page.locator(".toast")).toHaveText(OFFLINE);
  await expect(day(page, on(8))).toContainText("95k");
  await context.setOffline(false);

  await page.route("**/rest/v1/rpc/save_listing_days", (route) =>
    route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "P0001", message: "La casa está cerrada a consultas. Ábrala para cambiar el calendario.", details: null, hint: null }) }),
  );
  await day(page, on(9)).click();
  await panel(page).getByRole("button", { name: "Ocupado" }).click();
  await saveBtn(page).click();
  await expect(page.locator(".toast").last()).toHaveText("La casa está cerrada a consultas. Ábrala para cambiar el calendario.");
  await expect(day(page, on(9))).toContainText("95k");
  expect(await h.calendar("owner").days(casa.id)).toEqual([]);
});

test("casa cerrada a consultas: nota con la fecha, días de solo lectura y «Abrir a consultas»", async ({ page }) => {
  const casa = await seedHouse("Casa Cerrada");
  await h.putDay(casa.id, { day: on(3), available: false, specialPriceCrc: null });
  const reopen = addDays(today(), 40);
  await h.owner("owner").setAvailable(casa.id, false, reopen);
  await open(page, casa.id);
  await expect(page.getByText(`Esta casa está cerrada a consultas hasta el ${longDate(reopen)}. Ábrala para cambiar el calendario; sus noches y precios se conservan.`)).toBeVisible();
  await expect(cellOf(page, on(3))).toContainText("ocupado");
  await expect(page.locator(".month-grid button")).toHaveCount(0);
  await expect(page.locator(".month-grid.is-dimmed")).toBeVisible();
  await page.screenshot({ path: "test-results/calendario-cerrada.png" });

  await page.getByRole("button", { name: "Abrir a consultas" }).click();
  await expect(day(page, on(3))).toContainText("ocupado");
  await expect(page.getByRole("button", { name: "Abrir a consultas" })).toHaveCount(0);
  await expect.poll(async () => (await h.anon.getPublic(casa.publicId))?.available).toBe(true);
});

test("casa solo mensual: ni precios en la rejilla ni campo de precio", async ({ page }) => {
  const casa = await h.seed({
    status: "active",
    draft: { title: "Casa Mensual", acceptsNightly: false, nightlyPriceCrc: null, acceptsMonthly: true, monthlyMode: "amount", monthlyPriceCrc: 480000 },
  });
  await open(page, casa.id);
  await expect(day(page, on(10))).toHaveAccessibleName(new RegExp(`${on(10).slice(0, 4)}, disponible$`));
  await expect(grid(page)).not.toContainText("k");
  await expect(page.getByText("★ Precio distinto")).toHaveCount(0);
  await day(page, on(10)).click();
  await expect(panel(page).getByLabel("Precio por noche")).toHaveCount(0);
  await panel(page).getByRole("button", { name: "Ocupado" }).click();
  await saveBtn(page).click();
  await expect(day(page, on(10))).toContainText("ocupado");
  await expect.poll(async () => (await h.calendar("owner").days(casa.id)).length).toBe(1);
});

test("puntos de entrada: pestaña, Mis casas, detalle y «Marcar las noches ocupadas» llevan a la casa", async ({ page }) => {
  const casa = await seedHouse("Casa Entradas");
  const sent = await h.seed({ status: "review", draft: { title: "Casa Enviada" } });
  await page.goto("/propietario/casas");
  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Casa Entradas" }) });
  await expect(card.getByRole("link", { name: "Calendario" })).toHaveAttribute("href", `/propietario/calendario?casa=${casa.id}`);
  await card.getByRole("link", { name: "Calendario" }).click();
  await expect(page.getByRole("button", { name: /Casa Entradas/ })).toBeVisible();

  await page.goto(`/propietario/casas/${casa.id}`);
  await page.getByRole("link", { name: /Calendario y precios/ }).click();
  await expect(page).toHaveURL(new RegExp(`/propietario/calendario\\?casa=${casa.id}`));
  await expect(page.getByRole("button", { name: /Casa Entradas/ })).toBeVisible();

  await page.goto(`/propietario/casas/${sent.id}/enviada`);
  await page.getByRole("link", { name: "Marcar las noches ocupadas" }).click();
  await expect(page.getByRole("button", { name: /Casa Enviada/ })).toBeVisible();
  // Una casa en revisión también se puede preparar (a fin de mes abre en el siguiente: «‹» vuelve a hoy).
  if (openingMonth(today()) !== today().slice(0, 7)) await page.getByRole("button", { name: "Mes anterior" }).click();
  await expect(day(page, today())).toBeEnabled();

  await page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", { name: "Calendario" }).click();
  await expect(page).toHaveURL(/\/propietario\/calendario/);
  await expect(page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", { name: "Calendario" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("button", { name: /Casa Enviada/ })).toBeVisible();
});
