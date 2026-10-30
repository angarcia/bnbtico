import { expect, test, type Page } from "./helpers/test";
import type { CalendarHarness } from "../contract/harness";
import { serviceClient } from "../db/local";
import { postgrestHarness } from "../db/postgrest-harness";
import { injectSession } from "./helpers/session";
import { addDays, addMonths, calendarMonths, monthTitle, openingMonth } from "../../src/domain/calendar";
import { longDate, shortDate } from "../../src/domain/dates";
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
/** La casa que se muestra: en el selector (varias casas) o como subtítulo (una sola, revisión UX A5). */
const shown = (page: Page, title: string) => page.getByRole("button", { name: new RegExp(title) }).or(page.locator(".cal-house", { hasText: title }));
const panel = (page: Page) => page.getByRole("region", { name: "Días seleccionados" });
const saveBtn = (page: Page) => panel(page).getByRole("button", { name: "Guardar cambios" });
const open = (page: Page, id: string, month = next()) => page.goto(`/propietario/calendario?casa=${id}&mes=${month}`);
/** Los meses van uno debajo de otro: se lleva el que se quiere a la vista. */
const showMonth = (page: Page, month: string) => page.locator(`[data-month="${month}"]`).scrollIntoViewIfNeeded();

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

/** La cuenta «other» sin casas: punto de partida limpio para las pruebas de qué casas tienen calendario. */
async function clearOther() {
  const { data: other } = await serviceClient().from("profiles").select("id").eq("phone", h.phone("other")).single();
  await serviceClient().from("listings").delete().eq("owner_id", other!.id);
}

test("sin casas no hay Calendario: lleva a Explorar, con las pestañas del cliente", async ({ page }) => {
  await clearOther();
  await injectSession(page, "other");
  await page.goto("/propietario/calendario");
  await expect(page).toHaveURL(/\/explorar$/);
  await expect(page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link")).toHaveText(["Explorar", "Favoritos", "Cuenta"]);
});

// Revisión UX A5: el calendario nunca abre un borrador; con una sola casa no hay selector.
test("solo un borrador sin enviar: el aviso y «Seguir publicando» al paso donde se quedó", async ({ page }) => {
  await clearOther();
  const draft = await h.seed({ status: "draft", as: "other", draft: { title: "Borrador Cal", nightlyPriceCrc: null } });
  await injectSession(page, "other");
  await page.goto("/propietario/calendario");
  await expect(page.getByText("Su calendario se activa cuando envíe su casa a revisión.")).toBeVisible();
  await expect(grid(page)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Seguir publicando" })).toHaveAttribute("href", `/propietario/publicar/${draft.id}/8`); // sin precio (las fotos ya no son obligatorias)
});

test("una casa activa y un borrador más nuevo: abre la activa, sin selector, y el borrador no aparece", async ({ page }) => {
  await clearOther();
  const active = await h.seed({ status: "active", as: "other", draft: { title: "Casa Activa Cal", nightlyPriceCrc: 95000 } });
  const draft = await h.seed({ status: "draft", as: "other", draft: { title: "Borrador Nuevo Cal" } });
  await injectSession(page, "other");
  await page.goto("/propietario/calendario");
  await expect(page.locator(".cal-house")).toHaveText("Casa Activa Cal");
  await expect(page.getByRole("button", { name: /Casa Activa Cal/ })).toHaveCount(0);
  await expect(page.getByText("Borrador Nuevo Cal")).toHaveCount(0);
  await expect(grid(page).first()).toBeVisible();
  // Un enlace a un borrador cae en la casa activa.
  await page.goto(`/propietario/calendario?casa=${draft.id}`);
  await expect(page.locator(".cal-house")).toHaveText("Casa Activa Cal");
  await expect(page).toHaveURL(new RegExp(`casa=${active.id}`));
});

test("en el selector: activas, en revisión por primera vez y la publicada que se está editando; no el borrador nuevo ni la rechazada", async ({ page }) => {
  await clearOther();
  await h.seed({ status: "active", as: "other", draft: { title: "Cal Activa" } });
  await h.seed({ status: "review", as: "other", draft: { title: "Cal En Revisión" } });
  await h.seed({ status: "reopened", as: "other", draft: { title: "Cal Reabierta" } });
  await h.seed({ status: "draft", as: "other", draft: { title: "Cal Borrador" } });
  await h.seed({ status: "rejected", as: "other", draft: { title: "Cal Rechazada" } });
  await injectSession(page, "other");
  await page.goto("/propietario/calendario");
  await page.getByRole("button", { name: /Cal / }).click();
  const list = page.getByRole("listbox", { name: "Elegir casa" });
  await expect(list.getByRole("option")).toHaveText(["Cal Reabierta", "Cal En Revisión", "Cal Activa"]);
});

test("tres días → Ocupado → se guarda al instante (< 50 ms), sigue al recargar y liberar borra la fila", async ({ page }) => {
  const casa = await seedHouse("Casa Ocupada");
  await open(page, casa.id);
  await expect(page.getByRole("heading", { level: 1, name: "Calendario" })).toBeVisible();
  await expect(shown(page, "Casa Ocupada")).toBeVisible();
  await expect(page.getByText(monthTitle(next()), { exact: true })).toBeVisible();
  await expect(page.getByText("Toque los días para editarlos")).toBeVisible();
  await expect(panel(page)).toHaveCount(0);
  await expect(day(page, on(10))).toContainText("95\u00a0mil");

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
  await expect(day(page, on(12))).toContainText("Ocupado");
  release();
  await expect
    .poll(async () => (await h.calendar("owner").days(casa.id)).filter((d) => d.day.startsWith(next())))
    .toEqual([10, 11, 12].map((d) => ({ day: on(d), available: false, specialPriceCrc: null })));
  await page.unroute("**/rest/v1/rpc/save_listing_days");
  await page.screenshot({ path: "test-results/calendario-ocupado.png" });

  await page.reload();
  await expect(day(page, on(11))).toContainText("Ocupado");

  await day(page, on(10)).click();
  await expect(panel(page).getByText(`1 noche · 10 ${shortMonth(next())}`)).toBeVisible();
  await expect(panel(page).getByRole("button", { name: "Ocupado" })).toHaveAttribute("aria-pressed", "true");
  await panel(page).getByRole("button", { name: "Disponible" }).click();
  await saveBtn(page).click();
  await expect(day(page, on(10))).toContainText("95\u00a0mil");
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
  await expect(day(page, on(15))).toContainText("120\u00a0mil");
  await expect(day(page, on(15))).toHaveAccessibleName(/precio distinto$/);
  await expect.poll(async () => (await h.calendar("owner").days(casa.id)).find((d) => d.day === on(15))?.specialPriceCrc).toBe(120000);

  await day(page, on(15)).click();
  await expect(price).toHaveValue("120 000");
  await panel(page).getByRole("button", { name: "Usar el precio base (₡95 000)" }).click();
  await expect(price).toHaveValue("95 000");
  await saveBtn(page).click();
  await expect(day(page, on(15))).not.toContainText("★");
  await expect(day(page, on(15))).toContainText("95\u00a0mil");
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

test("meses en vertical: sin flechas, del mes actual al último de la ventana; un mes fuera de la ventana abre en el de apertura", async ({ page }) => {
  const casa = await seedHouse("Casa Ventana");
  await open(page, casa.id, "2020-01");
  const now = today().slice(0, 7);
  const months = calendarMonths(today());
  const blocks = page.locator(".cal-month-block");
  await expect(blocks).toHaveCount(months.length);
  await expect(page.getByRole("button", { name: /Mes (anterior|siguiente)/ })).toHaveCount(0);
  await expect(blocks.first()).toHaveAttribute("data-month", now);
  await expect(blocks.last()).toHaveAttribute("data-month", addMonths(now, 12));
  // Revisión UX A4: abre en el mes de apertura (a fin de mes, el siguiente); el actual queda encima.
  await expect(page.getByRole("heading", { name: monthTitle(openingMonth(today())) })).toBeInViewport();
  // Solo se montan las rejillas de los meses cerca de la vista.
  expect(await page.locator(".cal-month-block .month-grid").count()).toBeLessThanOrEqual(4);

  await showMonth(page, now);
  const yesterday = addDays(today(), -1);
  if (yesterday.startsWith(now)) await expect(day(page, yesterday)).toBeDisabled();
  await expect(day(page, today())).toBeEnabled();

  await page.getByRole("heading", { name: monthTitle(addMonths(now, 12)) }).scrollIntoViewIfNeeded();
  const beyond = addDays(today(), 366);
  if (beyond.startsWith(addMonths(now, 12))) await expect(day(page, beyond)).toBeDisabled();
});

test("un día en cada mes se elige y se guarda de una vez; ?mes= lleva a ese mes", async ({ page }) => {
  const casa = await seedHouse("Casa Dos Meses");
  await open(page, casa.id, next());
  const title = page.getByRole("heading", { name: monthTitle(next()) });
  await expect(title).toBeInViewport();
  // El título del mes queda bajo la fila L K M J V S D, sin que esta lo tape.
  const t = (await title.boundingBox())!;
  const w = (await page.locator(".cal-weekdays").boundingBox())!;
  expect(t.y).toBeGreaterThanOrEqual(w.y + w.height - 1);

  const later = addMonths(next(), 1);
  const ninth = (m: string) => `${m}-09`;
  await day(page, on(9)).click();
  await page.getByRole("heading", { name: monthTitle(later) }).scrollIntoViewIfNeeded();
  await day(page, ninth(later)).click();
  await expect(panel(page).locator("b").first()).toContainText("2 noches");
  await panel(page).getByRole("button", { name: "Ocupado" }).click();
  await saveBtn(page).click();
  await expect
    .poll(async () => (await h.calendar("owner").days(casa.id)).map((d) => [d.day, d.available]))
    .toEqual([
      [on(9), false],
      [ninth(later), false],
    ]);
  // Desplazarse no reescribe la URL.
  await expect(page).toHaveURL(new RegExp(`mes=${next()}`));
});

test("días altos: casillas de 64 px o más y el mes llena la pantalla", async ({ page }) => {
  const casa = await seedHouse("Casa Alta");
  await open(page, casa.id, next());
  await expect(day(page, on(15))).toBeVisible();
  expect((await day(page, on(15)).boundingBox())!.height).toBeGreaterThanOrEqual(64);
  await expect(day(page, on(15))).toContainText("₡95\u00a0mil");
  const block = (await page.locator(`[data-month="${next()}"]`).boundingBox())!;
  const bar = (await page.locator(".tabbar").boundingBox())!;
  expect(block.y + block.height).toBeGreaterThanOrEqual(bar.y - 1);
  await page.screenshot({ path: "test-results/calendario-vertical.png" });
});

/** Fija el reloj del navegador en un día del mes pasado: `fromEnd` días antes de su último (hacia atrás, la sesión sigue
 *  vigente). Devuelve ese «hoy». Solo cambia lo que el navegador cree que es hoy: la base sigue con el de verdad. */
async function fixTodayLastMonth(page: Page, fromEnd: number) {
  const month = addMonths(today().slice(0, 7), -1);
  const [y, m] = month.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const day = `${month}-${String(last - fromEnd).padStart(2, "0")}`;
  await page.clock.setFixedTime(new Date(`${day}T18:00:00Z`));
  return day;
}
const nav = (page: Page) => page.getByRole("navigation", { name: "Navegación principal" });
/** El mes empieza justo bajo la fila L K M J V S D: está arriba de todo. */
async function expectMonthOnTop(page: Page, month: string) {
  await expect(page.getByRole("heading", { name: monthTitle(month) })).toBeInViewport();
  await expect
    .poll(async () => {
      const b = (await page.locator(`[data-month="${month}"]`).boundingBox())!;
      const w = (await page.locator(".cal-weekdays").boundingBox())!;
      return b.y >= w.y + w.height - 1 && b.y <= w.y + w.height + 4;
    })
    .toBe(true);
}

test("al abrir, sin semanas pasadas enteras: el primer día que se puede tocar se ve encima de la barra", async ({ page }) => {
  const casa = await seedHouse("Casa Primer Día");
  // Once días antes de fin de mes: abre en el mes actual, con casi todas sus semanas ya pasadas.
  const now = await fixTodayLastMonth(page, 10);
  expect(openingMonth(now)).toBe(now.slice(0, 7));
  await page.goto(`/propietario/calendario?casa=${casa.id}`);
  await expect(day(page, now)).toBeEnabled();
  const d = (await day(page, now).boundingBox())!;
  const bar = (await page.locator(".tabbar").boundingBox())!;
  expect(d.y).toBeGreaterThanOrEqual(0);
  expect(d.y + d.height).toBeLessThanOrEqual(bar.y);
  // El mes que viene empieza enseguida: el primer bloque no se estira hasta llenar la pantalla.
  await expect(page.getByRole("heading", { name: monthTitle(addMonths(now.slice(0, 7), 1)) })).toBeInViewport();
  await page.screenshot({ path: "test-results/calendario-primer-dia.png" });
});

test("a fin de mes abre en el siguiente también al llegar desde la app: tarjeta de Mis casas y pestaña", async ({ page }) => {
  await seedHouse("Casa Fin De Mes");
  const now = await fixTodayLastMonth(page, 3);
  const opening = openingMonth(now);
  expect(opening).toBe(addMonths(now.slice(0, 7), 1));

  await page.goto("/propietario/casas");
  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Casa Fin De Mes" }) });
  await card.getByRole("link", { name: "Calendario" }).click();
  await expect(shown(page, "Casa Fin De Mes")).toBeVisible();
  await expectMonthOnTop(page, opening);

  await nav(page).getByRole("link", { name: /^Mis? casas?$/ }).click();
  await expect(page).toHaveURL(/\/propietario\/casas$/);
  await nav(page).getByRole("link", { name: "Calendario" }).click();
  await expect(page).toHaveURL(/\/propietario\/calendario/);
  await expectMonthOnTop(page, opening);
});

test("cambiar de casa no mezcla días; la rechazada no se ofrece y la última elegida se recuerda", async ({ page }) => {
  const a = await seedHouse("Casa Alfa");
  const b = await seedHouse("Casa Beta");
  await h.seed({ status: "rejected", draft: { title: "Casa Rechazada" } });
  await h.putDay(a.id, { day: on(5), available: false, specialPriceCrc: null });
  await open(page, a.id);
  await expect(day(page, on(5))).toContainText("Ocupado");
  await day(page, on(6)).click();
  await expect(panel(page)).toBeVisible();

  await page.getByRole("button", { name: /Casa Alfa/ }).click();
  const list = page.getByRole("listbox", { name: "Elegir casa" });
  await expect(list.getByRole("option", { name: "Casa Rechazada" })).toHaveCount(0);
  await list.getByRole("option", { name: "Casa Beta" }).click();
  await expect(page.getByRole("button", { name: /Casa Beta/ })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`casa=${b.id}`));
  await expect(day(page, on(5))).toContainText("95\u00a0mil");
  await expect(panel(page)).toHaveCount(0);
  await expect(grid(page).first()).toBeVisible();

  await page.goto("/propietario/calendario");
  await expect(page.getByRole("button", { name: /Casa Beta/ })).toBeVisible();
});

test("sin red: el cambio vuelve atrás y avisa «Sin conexión…»; un rechazo de la base muestra su mensaje", async ({ page, context }) => {
  const casa = await seedHouse("Casa Sin Red");
  await open(page, casa.id);
  await expect(day(page, on(8))).toContainText("95\u00a0mil");
  await day(page, on(8)).click();
  await panel(page).getByRole("button", { name: "Ocupado" }).click();
  await context.setOffline(true);
  await saveBtn(page).click();
  await expect(page.locator(".toast")).toHaveText(OFFLINE);
  await expect(day(page, on(8))).toContainText("95\u00a0mil");
  await context.setOffline(false);

  await page.route("**/rest/v1/rpc/save_listing_days", (route) =>
    route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "P0001", message: "La casa está cerrada a consultas. Ábrala para cambiar el calendario.", details: null, hint: null }) }),
  );
  await day(page, on(9)).click();
  await panel(page).getByRole("button", { name: "Ocupado" }).click();
  await saveBtn(page).click();
  await expect(page.locator(".toast").last()).toHaveText("La casa está cerrada a consultas. Ábrala para cambiar el calendario.");
  await expect(day(page, on(9))).toContainText("95\u00a0mil");
  expect(await h.calendar("owner").days(casa.id)).toEqual([]);
});

test("casa cerrada: «Cerrada hasta el …», días de solo lectura y «Abrir la casa»", async ({ page }) => {
  const casa = await seedHouse("Casa Cerrada");
  await h.putDay(casa.id, { day: on(3), available: false, specialPriceCrc: null });
  const reopen = addDays(today(), 40);
  await h.owner("owner").setAvailable(casa.id, false, reopen);
  await open(page, casa.id);
  await expect(page.getByText(`Cerrada hasta el ${shortDate(reopen)}`)).toBeVisible();
  await expect(page.getByRole("button", { name: /Cerrar la casa hasta…/ })).toHaveCount(0);
  await expect(cellOf(page, on(3))).toContainText("Ocupado");
  await expect(page.locator(".month-grid button")).toHaveCount(0);
  await expect(page.locator(".month-grid.is-dimmed").first()).toBeVisible();
  await page.screenshot({ path: "test-results/calendario-cerrada.png" });

  await page.getByRole("button", { name: "Abrir la casa" }).click();
  await expect(day(page, on(3))).toContainText("Ocupado");
  await expect(page.getByRole("button", { name: "Abrir la casa" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Cerrar la casa hasta…/ })).toBeVisible();
  await expect.poll(async () => (await h.anon.getPublic(casa.publicId))?.available).toBe(true);
});

test("puntos de entrada: pestaña, Mis casas y «Marcar las noches ocupadas» llevan a la casa; el detalle ya no lleva la fila", async ({ page }) => {
  const casa = await seedHouse("Casa Entradas");
  const sent = await h.seed({ status: "review", draft: { title: "Casa Enviada" } });
  await page.goto("/propietario/casas");
  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Casa Entradas" }) });
  await expect(card.getByRole("link", { name: "Calendario" })).toHaveAttribute("href", `/propietario/calendario?casa=${casa.id}`);
  await card.getByRole("link", { name: "Calendario" }).click();
  await expect(shown(page, "Casa Entradas")).toBeVisible();

  // Revisión de Ana: el detalle no repite la pestaña Calendario.
  await page.goto(`/propietario/casas/${casa.id}`);
  await expect(page.getByRole("button", { name: /Compartir ficha/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Calendario y precios/ })).toHaveCount(0);

  await page.goto(`/propietario/casas/${sent.id}/enviada`);
  await page.getByRole("link", { name: "Marcar las noches ocupadas" }).click();
  await expect(shown(page, "Casa Enviada")).toBeVisible();
  // Una casa en revisión también se puede preparar (a fin de mes abre en el siguiente: el actual queda encima).
  await showMonth(page, today().slice(0, 7));
  await expect(day(page, today())).toBeEnabled();

  await page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", { name: "Calendario" }).click();
  await expect(page).toHaveURL(/\/propietario\/calendario/);
  await expect(page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", { name: "Calendario" })).toHaveAttribute("aria-current", "page");
  await expect(shown(page, "Casa Enviada")).toBeVisible();
});
