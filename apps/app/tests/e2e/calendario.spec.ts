import { expect, test, type Page } from "./helpers/test";
import type { CalendarHarness } from "../contract/harness";
import { serviceClient } from "../db/local";
import { postgrestHarness } from "../db/postgrest-harness";
import { injectSession } from "./helpers/session";
import { addDays, addMonths, calendarMonths, monthTitle } from "../../src/domain/calendar";
import { longDate, longDateWithYear, shortDate } from "../../src/domain/dates";
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
const day = (page: Page, iso: string) => page.getByRole("button", { name: new RegExp(`^${longDate(iso)} de ${iso.slice(0, 4)}(,|$)`) });
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
  await expect(page.getByRole("link", { name: "Seguir publicando" })).toHaveAttribute("href", `/propietario/publicar/${draft.id}/7`); // sin fotos ni precio: la foto es obligatoria y va antes (2026-10-30)
});

// Auditoría de viajes (2026-11-05): los días de la casa esperaban a la lista de casas. Con la casa en la URL (o la última
// usada), salen a la vez que la lista.
test("con la casa en la URL, sus días se piden sin esperar a la lista de casas", async ({ page }) => {
  const house = await seedHouse("Casa Días Ya");
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route((u) => u.pathname.endsWith("/rest/v1/listings") && u.searchParams.has("owner_id") && !u.searchParams.has("id"), async (route) => {
    await held;
    await route.continue();
  });
  const days = page.waitForRequest((r) => r.method() === "POST" && new URL(r.url()).pathname.endsWith("/rest/v1/rpc/owner_calendar_days") && r.postDataJSON()?.p_listing === house.id);
  await open(page, house.id);
  await days;
  release();
  await expect(page.locator(".cal-house, .house-picker").first()).toBeVisible();
  await expect(grid(page).first()).toBeVisible();
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
  await expect(list.getByRole("option", { name: "Todas las casas", exact: true })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Elegir casa", exact: true })).toBeFocused();
  await page.getByRole("dialog", { name: "Elegir casa", exact: true }).getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(page.getByTestId("house-picker-trigger")).toBeFocused();
});

test("tres días → Ocupado → se guarda al instante (< 50 ms), sigue al recargar y liberar borra la fila", async ({ page }) => {
  const casa = await seedHouse("Casa Ocupada");
  await open(page, casa.id);
  await expect(page.getByRole("heading", { level: 1, name: "Calendario" })).toBeAttached();
  await expect(shown(page, "Casa Ocupada")).toBeVisible();
  await expect(page.getByText(monthTitle(next()), { exact: true })).toBeVisible();
  await expect(page.getByText("Toque los días para editarlos")).toBeVisible();
  await expect(panel(page)).toHaveCount(0);
  await expect(day(page, on(10))).toContainText("95\u00a0000");

  for (const d of [10, 11, 12]) await day(page, on(d)).click();
  await expect(day(page, on(11))).toHaveAttribute("aria-pressed", "true");
  await expect(panel(page).getByText(`3 noches · 10–12 ${shortMonth(next())}`)).toBeVisible();
  await expect(panel(page).getByRole("button", { name: "Disponible" })).toHaveAttribute("aria-pressed", "true");
  await expect(panel(page).getByLabel("Precio por noche")).toHaveValue("95 000");
  await expect(saveBtn(page)).toBeDisabled();
  // Revisión UX 2026-10-29 (C4): selección con marco terracota, sin relleno; el panel va pegado abajo y la barra de pestañas
  // se va mientras hay días seleccionados; «Guardar cambios» de 44 px y en gris hasta que hay un cambio.
  const style = await day(page, on(11)).evaluate((el) => {
    const c = getComputedStyle(el);
    return { border: c.borderTopColor, bg: c.backgroundColor };
  });
  expect(style.border).not.toBe("rgba(0, 0, 0, 0)");
  expect(style.bg).toBe(await day(page, on(13)).evaluate((el) => getComputedStyle(el).backgroundColor));
  await expect.poll(async () => (await page.locator(".tabbar").boundingBox())!.y).toBeGreaterThanOrEqual(page.viewportSize()!.height - 1);
  expect(Math.round((await panel(page).boundingBox())!.y + (await panel(page).boundingBox())!.height)).toBe(page.viewportSize()!.height);
  expect(Math.round((await saveBtn(page).boundingBox())!.height)).toBe(44);
  const grey = await saveBtn(page).evaluate((el) => getComputedStyle(el).backgroundColor);
  await page.screenshot({ path: "test-results/calendario-seleccion.png" });

  await panel(page).getByRole("button", { name: "Ocupado" }).click();
  await expect(saveBtn(page)).toBeEnabled();
  expect(await saveBtn(page).evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(grey);

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
  await expect(day(page, on(12))).toHaveAccessibleName(/, ocupado/);
  // Ocupado: solo el número.
  await expect(day(page, on(12))).toHaveText(String(12));
  // Sin días seleccionados, la barra de pestañas vuelve.
  await expect.poll(async () => (await page.locator(".tabbar").boundingBox())!.y).toBeLessThan(page.viewportSize()!.height - 40);
  release();
  await expect
    .poll(async () => (await h.calendar("owner").days(casa.id)).filter((d) => d.day.startsWith(next())))
    .toEqual([10, 11, 12].map((d) => ({ day: on(d), available: false, specialPriceCrc: null })));
  await page.unroute("**/rest/v1/rpc/save_listing_days");
  await page.screenshot({ path: "test-results/calendario-ocupado.png" });

  await page.reload();
  await expect(day(page, on(11))).toHaveAccessibleName(/, ocupado/);

  await day(page, on(10)).click();
  await expect(panel(page).getByText(`1 noche · 10 ${shortMonth(next())}`)).toBeVisible();
  await expect(panel(page).getByRole("button", { name: "Ocupado" })).toHaveAttribute("aria-pressed", "true");
  await panel(page).getByRole("button", { name: "Disponible" }).click();
  await saveBtn(page).click();
  await expect(day(page, on(10))).toContainText("95\u00a0000");
  await expect.poll(async () => (await h.calendar("owner").days(casa.id)).map((d) => d.day)).toEqual([on(11), on(12)]);
});

test("precio distinto (solo la cifra, sin ★) y, con el precio base («Usar el precio base»), la fila se borra", async ({ page }) => {
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
  await expect(day(page, on(15))).not.toContainText("★");
  await expect(day(page, on(15))).toContainText("120\u00a0000");
  await expect(day(page, on(15))).toHaveAccessibleName(/precio distinto$/);
  await expect.poll(async () => (await h.calendar("owner").days(casa.id)).find((d) => d.day === on(15))?.specialPriceCrc).toBe(120000);

  await day(page, on(15)).click();
  await expect(price).toHaveValue("120 000");
  await panel(page).getByRole("button", { name: "Usar el precio base (₡95 000)" }).click();
  await expect(price).toHaveValue("95 000");
  await saveBtn(page).click();
  await expect(day(page, on(15))).not.toContainText("★");
  await expect(day(page, on(15))).toContainText("95\u00a0000");
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

test("meses en vertical: sin flechas, del mes actual al último de la ventana; un mes fuera de la ventana abre arriba del todo", async ({ page }) => {
  const casa = await seedHouse("Casa Ventana");
  await open(page, casa.id, "2020-01");
  const now = today().slice(0, 7);
  const months = calendarMonths(today());
  const blocks = page.locator(".cal-month-block");
  await expect(blocks).toHaveCount(months.length);
  await expect(page.getByRole("button", { name: /Mes (anterior|siguiente)/ })).toHaveCount(0);
  await expect(blocks.first()).toHaveAttribute("data-month", now);
  await expect(blocks.last()).toHaveAttribute("data-month", addMonths(now, 12));
  // Revisión UX 2026-10-29 (A1): abre arriba del todo, con el mes actual.
  await expect(page.getByRole("heading", { name: monthTitle(now) })).toBeInViewport();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
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

test("casillas de 47 × 92 px con el precio completo; ₡ | $ cambia los precios a dólares", async ({ page }) => {
  const casa = await seedHouse("Casa Alta");
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, casa.id, next());
  await expect(day(page, on(15))).toBeVisible();
  const box = (await day(page, on(15)).boundingBox())!;
  expect(Math.round(box.height)).toBe(92);
  expect(Math.abs(box.width - 47)).toBeLessThanOrEqual(1);
  await expect(day(page, on(15))).toHaveText("1595\u00a0000");
  // La fila L K M J V S D en la misma rejilla: cada letra centrada sobre su columna.
  const letter = (await page.locator(".cal-weekdays .wd").nth(4).boundingBox())!;
  const friday = (await page.locator(`[data-month="${next()}"] .month-week`).nth(1).locator(".day").nth(4).boundingBox())!;
  expect(Math.abs(letter.x + letter.width / 2 - (friday.x + friday.width / 2))).toBeLessThanOrEqual(1);
  await page.screenshot({ path: "test-results/calendario-vertical.png" });

  await page.getByRole("group", { name: "Moneda de los precios" }).getByRole("button", { name: "Dólares" }).click();
  await expect(day(page, on(15))).toContainText(/^15\$\d+$/);
  await expect(day(page, on(15))).toHaveAccessibleName(/, \$\d+$/);
  await page.getByRole("group", { name: "Moneda de los precios" }).getByRole("button", { name: "Colones" }).click();
  await expect(day(page, on(15))).toHaveText("1595\u00a0000");
});

test("la barra de pestañas sale al bajar y vuelve al subir", async ({ page }) => {
  const casa = await seedHouse("Casa Barra");
  await open(page, casa.id, today().slice(0, 7));
  const barY = async () => (await page.locator(".tabbar").boundingBox())!.y;
  const h0 = page.viewportSize()!.height;
  await expect(day(page, today())).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(barY).toBeLessThan(h0 - 40);
  await page.evaluate(() => window.scrollBy(0, 400));
  await expect.poll(barY).toBeGreaterThanOrEqual(h0 - 1);
  await page.evaluate(() => window.scrollBy(0, -100));
  await expect.poll(barY).toBeLessThan(h0 - 40);
  // Un movimiento de menos de 8 px no la mueve.
  await page.evaluate(() => window.scrollBy(0, 4));
  await page.waitForTimeout(250);
  expect(await barY()).toBeLessThan(h0 - 40);
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
test("al abrir, arriba del todo: la casa, «Marcar una reserva» y «Pausar la casa», ₡ | $ y el mes actual entero con los días pasados tachados", async ({ page }) => {
  const casa = await seedHouse("Casa Primer Día");
  const now = await fixTodayLastMonth(page, 10);
  await page.goto(`/propietario/calendario?casa=${casa.id}`);
  await expect(day(page, now)).toBeEnabled();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(shown(page, "Casa Primer Día")).toBeInViewport();
  await expect(page.getByRole("button", { name: /Marcar una reserva/ })).toBeInViewport();
  await expect(page.getByRole("region", { name: "Acciones del calendario" }).getByRole("button", { name: "Pausar la casa", exact: true })).toBeInViewport();
  await expect(page.getByRole("group", { name: "Moneda de los precios" })).toBeInViewport();
  await expect(page.getByRole("heading", { name: monthTitle(now.slice(0, 7)) })).toBeInViewport();
  // El mes entero desde el día 1: los pasados, del mismo tamaño, tachados y sin tocar.
  const first = day(page, `${now.slice(0, 7)}-01`);
  await expect(first).toBeDisabled();
  await expect(first).toHaveClass(/is-past/);
  expect(await first.locator("b").evaluate((el) => getComputedStyle(el).textDecorationLine)).toBe("line-through");
  expect(Math.round((await first.boundingBox())!.height)).toBe(92);
  await page.screenshot({ path: "test-results/calendario-arriba.png" });
});

test("también al llegar desde la app abre arriba del todo: tarjeta de Mis casas y pestaña", async ({ page }) => {
  await seedHouse("Casa Fin De Mes");
  const now = await fixTodayLastMonth(page, 3);
  const top = async () => {
    await expect(page.getByRole("heading", { name: monthTitle(now.slice(0, 7)) })).toBeInViewport();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  };

  await page.goto("/propietario/casas");
  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Casa Fin De Mes" }) });
  await card.getByRole("link", { name: "Calendario" }).click();
  await expect(shown(page, "Casa Fin De Mes")).toBeVisible();
  await top();

  await nav(page).getByRole("link", { name: /^Mis? casas?$/ }).click();
  await expect(page).toHaveURL(/\/propietario\/casas$/);
  await nav(page).getByRole("link", { name: "Calendario" }).click();
  await expect(page).toHaveURL(/\/propietario\/calendario/);
  await top();
});

test("cambiar de casa no mezcla días; la rechazada no se ofrece y la última elegida se recuerda", async ({ page }) => {
  const a = await seedHouse("Casa Alfa");
  const b = await seedHouse("Casa Beta");
  await h.seed({ status: "rejected", draft: { title: "Casa Rechazada" } });
  await h.putDay(a.id, { day: on(5), available: false, specialPriceCrc: null });
  await open(page, a.id);
  await expect(day(page, on(5))).toHaveAccessibleName(/, ocupado/);
  await day(page, on(6)).click();
  await expect(panel(page)).toBeVisible();

  await page.getByRole("button", { name: /Casa Alfa/ }).click();
  const list = page.getByRole("listbox", { name: "Elegir casa" });
  await expect(list.getByRole("option", { name: "Casa Rechazada" })).toHaveCount(0);
  await list.getByRole("option", { name: "Casa Beta" }).click();
  await expect(page.getByRole("button", { name: /Casa Beta/ })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`casa=${b.id}`));
  await expect(day(page, on(5))).toContainText("95\u00a0000");
  await expect(panel(page)).toHaveCount(0);
  await expect(grid(page).first()).toBeVisible();

  await page.goto("/propietario/calendario");
  await expect(page.getByRole("button", { name: /Casa Beta/ })).toBeVisible();
});

test("sin red: el cambio vuelve atrás y avisa «Sin conexión…»; un rechazo de la base muestra su mensaje", async ({ page, context }) => {
  const casa = await seedHouse("Casa Sin Red");
  await open(page, casa.id);
  await expect(day(page, on(8))).toContainText("95\u00a0000");
  await day(page, on(8)).click();
  await panel(page).getByRole("button", { name: "Ocupado" }).click();
  await context.setOffline(true);
  await saveBtn(page).click();
  await expect(page.locator(".toast")).toHaveText(OFFLINE);
  await expect(day(page, on(8))).toContainText("95\u00a0000");
  await context.setOffline(false);

  await page.route("**/rest/v1/rpc/save_listing_days", (route) =>
    route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "P0001", message: "La casa está pausada. Vuelva a publicarla para cambiar el calendario.", details: null, hint: null }) }),
  );
  await day(page, on(9)).click();
  await panel(page).getByRole("button", { name: "Ocupado" }).click();
  await saveBtn(page).click();
  await expect(page.locator(".toast").last()).toHaveText("La casa está pausada. Vuelva a publicarla para cambiar el calendario.");
  await expect(day(page, on(9))).toContainText("95\u00a0000");
  expect(await h.calendar("owner").days(casa.id)).toEqual([]);
});

test("casa pausada: «Pausada hasta el …», días de solo lectura, sin «Marcar una reserva», y «Volver a publicarla»", async ({ page }) => {
  const casa = await seedHouse("Casa Pausada");
  await h.putDay(casa.id, { day: on(3), available: false, specialPriceCrc: null });
  const reopen = addDays(today(), 40);
  await h.owner("owner").setAvailable(casa.id, false, reopen);
  await open(page, casa.id);
  await expect(page.getByText(`Pausada hasta el ${shortDate(reopen)}`)).toBeVisible();
  await expect(page.getByRole("region", { name: "Acciones del calendario" }).getByRole("button", { name: "Pausar la casa", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Marcar una reserva/ })).toHaveCount(0);
  await expect(cellOf(page, on(3))).toHaveAccessibleName(/, ocupado/);
  await expect(page.locator(".month-grid button")).toHaveCount(0);
  await expect(page.locator(".month-grid.is-dimmed").first()).toBeVisible();
  await page.screenshot({ path: "test-results/calendario-cerrada.png" });

  await page.getByRole("button", { name: "Volver a publicarla" }).click();
  await expect(day(page, on(3))).toHaveAccessibleName(/, ocupado/);
  await expect(page.getByRole("button", { name: "Volver a publicarla" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Acciones del calendario" }).getByRole("button", { name: "Pausar la casa", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Marcar una reserva/ })).toBeVisible();
  await expect.poll(async () => (await h.anon.getPublic(casa.publicId))?.available).toBe(true);
});

// «Marcar una reserva» (ticket 04 de la ronda del 2 nov).
const markRow = (page: Page) => page.getByRole("button", { name: /Marcar una reserva/ });
const markSheet = (page: Page) => page.getByRole("dialog", { name: "Marcar una reserva" });
const pick = (page: Page, iso: string) => markSheet(page).getByRole("button", { name: longDateWithYear(iso)!, exact: true });
const confirmMark = (page: Page) => markSheet(page).getByRole("button", { name: "Marcar como ocupado" });
/** El aviso lleva espacios duros y un U+2060 tras «–» (no se parte la fecha): se compara sin ellos. */
const toastText = (page: Page) => page.locator(".toast").last().evaluate((el) => el.textContent!.replace(/\u00a0/g, " ").replace(/\u2060/g, ""));

test("«Marcar una reserva»: la fila, la hoja con el calendario de rango y las noches de llegada a salida − 1 quedan ocupadas, con sus precios especiales", async ({ page }) => {
  const casa = await seedHouse("Casa Reserva");
  await h.putDay(casa.id, { day: on(11), available: true, specialPriceCrc: 150000 });
  await h.putDay(casa.id, { day: on(12), available: false, specialPriceCrc: null });
  await open(page, casa.id);
  await expect(markRow(page)).not.toContainText("Marque de una vez las noches de una reserva larga como ocupadas.");

  await markRow(page).click();
  await expect(markSheet(page)).toBeVisible();
  await expect(markSheet(page)).toBeFocused();
  await expect(markSheet(page)).toContainText("Marque de una vez las noches de una reserva larga como ocupadas.");
  await expect(markSheet(page)).toContainText("Elija la llegada y la salida. La noche de la salida queda libre.");
  await expect(confirmMark(page)).toBeDisabled();
  await expect(markSheet(page).getByTestId("mark-summary")).toHaveText("Elija la llegada");
  await pick(page, on(10)).click();
  await expect(markSheet(page).getByTestId("mark-summary")).toHaveText("Ahora elija la salida");
  await expect(confirmMark(page)).toBeDisabled();
  // El día 12 ocupado no vale como llegada, pero sí como salida: su noche queda fuera.
  await pick(page, on(12)).click();
  await expect(markSheet(page).getByTestId("mark-summary")).toHaveText(`2 noches · 10–11 ${shortMonth(next())}`);
  await confirmMark(page).click();

  await expect(markSheet(page)).toHaveCount(0);
  await expect(markRow(page)).toBeFocused();
  expect(await toastText(page)).toBe(`2 noches marcadas como ocupadas · 10–11 ${shortMonth(next())}`);
  for (const d of [10, 11, 12]) await expect(day(page, on(d))).toHaveAccessibleName(/, ocupado/);
  // Las noches posteriores siguen libres; la salida conserva el bloqueo que ya tenía.
  await expect(day(page, on(14))).not.toHaveAccessibleName(/ocupado/);
  // El precio especial del día 11 se conserva (ahora ocupado); lo ya ocupado sigue igual.
  await expect
    .poll(() => h.calendar("owner").days(casa.id))
    .toEqual([
      { day: on(10), available: false, specialPriceCrc: null },
      { day: on(11), available: false, specialPriceCrc: 150000 },
      { day: on(12), available: false, specialPriceCrc: null },
    ]);
  expect((await h.anon.getPublicDays(casa.publicId)).filter((d) => !d.available).map((d) => d.day)).toEqual([on(10), on(11), on(12)]);
});

test("una sola noche (salida al día siguiente) dice «1 noche marcada como ocupada»; una selección a medias del panel se descarta", async ({ page }) => {
  const casa = await seedHouse("Casa Una Noche");
  await open(page, casa.id);
  await day(page, on(5)).click();
  await expect(panel(page)).toBeVisible();
  await markRow(page).click();
  await pick(page, on(20)).click();
  await pick(page, on(21)).click();
  await confirmMark(page).click();
  await expect(markSheet(page)).toHaveCount(0);
  expect(await toastText(page)).toBe(`1 noche marcada como ocupada · 20 ${shortMonth(next())}`);
  await expect(panel(page)).toHaveCount(0);
  await expect.poll(async () => (await h.calendar("owner").days(casa.id)).map((d) => d.day)).toEqual([on(20)]);
});

test("la hoja se cierra con Escape, el fondo o «Cancelar» sin guardar nada, y Tab no sale de ella", async ({ page }) => {
  const casa = await seedHouse("Casa Hoja Cancela");
  await open(page, casa.id);
  await markRow(page).click();
  await pick(page, on(5)).click();
  await pick(page, on(8)).click();
  for (let i = 0; i < 6; i++) await page.keyboard.press("Shift+Tab");
  expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(markSheet(page)).toHaveCount(0);
  await expect(markRow(page)).toBeFocused();
  await markRow(page).click();
  await page.getByTestId("sheet-backdrop").click({ position: { x: 10, y: 10 } });
  await expect(markSheet(page)).toHaveCount(0);
  await markRow(page).click();
  // Una hoja nueva empieza sin fechas.
  await expect(confirmMark(page)).toBeDisabled();
  await markSheet(page).getByRole("button", { name: "Cancelar" }).click();
  await expect(markSheet(page)).toHaveCount(0);
  await expect(markRow(page)).toBeFocused();
  expect(await h.calendar("owner").days(casa.id)).toEqual([]);
});

test("si la base rechaza el guardado, las noches vuelven a estar libres y avisa", async ({ page }) => {
  const casa = await seedHouse("Casa Reserva Rechazada");
  await open(page, casa.id);
  await page.route("**/rest/v1/rpc/mark_listing_reservation", (route) =>
    route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "P0001", message: "Este anuncio fue rechazado; publique uno nuevo.", details: null, hint: null }) }),
  );
  await markRow(page).click();
  await pick(page, on(6)).click();
  await pick(page, on(9)).click();
  await confirmMark(page).click();
  await expect(page.locator(".toast").last()).toHaveText("Este anuncio fue rechazado; publique uno nuevo.");
  await expect(day(page, on(6))).not.toHaveAccessibleName(/ocupado/);
  expect(await h.calendar("owner").days(casa.id)).toEqual([]);
});

test("sin el trozo de la hoja «Marcar una reserva»: avisa de la conexión y «Reintentar» la abre", async ({ page }) => {
  const casa = await seedHouse("Casa Sin Hoja Reserva");
  await page.route("**/assets/mark-sheet-*.js", (route) => route.abort());
  await open(page, casa.id);
  await markRow(page).click();
  await expect(page.getByRole("alert")).toHaveText("No pudimos abrir «Marcar una reserva». Revise su conexión e inténtelo de nuevo.");
  await expect(markSheet(page)).toHaveCount(0);
  await page.unroute("**/assets/mark-sheet-*.js");
  await page.getByRole("button", { name: "Reintentar" }).click();
  await expect(markSheet(page)).toBeVisible();
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
  // Una casa en revisión también se puede preparar.
  await showMonth(page, today().slice(0, 7));
  await expect(day(page, today())).toBeEnabled();
  // Con las dos filas de arriba, llegar al día de hoy baja la página y la barra se esconde: al subir, vuelve.
  await page.mouse.wheel(0, -2000);
  await expect(page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", { name: "Calendario" })).toBeInViewport();

  await page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", { name: "Calendario" }).click();
  await expect(page).toHaveURL(/\/propietario\/calendario/);
  await expect(page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", { name: "Calendario" })).toHaveAttribute("aria-current", "page");
  await expect(shown(page, "Casa Enviada")).toBeVisible();
});
