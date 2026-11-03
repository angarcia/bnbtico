import { expect, test, type Page } from "./helpers/test";
import type { CalendarHarness, Seeded } from "../contract/harness";
import { postgrestHarness } from "../db/postgrest-harness";
import { addDays, addMonths, monthTitle, openingMonth } from "../../src/domain/calendar";
import { formatInquiryDates, longDate } from "../../src/domain/dates";
import { composeInquiryMessage, costaRicaToday } from "../../src/domain/inquiry";
import { formatUSD } from "../../src/domain/money";
import { stayTotalLabel } from "../../src/domain/search";
import { calendarDay, dateBox, boxText, messagePreview } from "./helpers/contact-sheet";

// «Disponibilidad» en la ficha pública (fase 4, ticket 05) contra Supabase local. Cada prueba siembra sus casas y sus
// días ANTES de la primera visita (la ficha queda en la caché del worker local; la frescura tras un cambio la prueba
// frescura.spec.ts).
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
let h: CalendarHarness;

test.describe.configure({ mode: "serial" });

const today = () => costaRicaToday(Date.now());
const next = () => addMonths(today().slice(0, 7), 1);
// Revisión UX A4: a fin de mes el calendario ya abre en el siguiente.
const opening = () => openingMonth(today());
const toNextMonth = async (page: Page) => {
  if (opening() !== next()) await section(page).getByRole("button", { name: "Mes siguiente" }).click();
};
const on = (d: number) => `${next()}-${String(d).padStart(2, "0")}`;
const section = (page: Page) => page.locator(".listing-calendar");
// Desde el ticket 08 de la ronda del 2 nov las casillas son botones y la rejilla un grupo (se eligen llegada y salida).
const grid = (page: Page, month: string) => section(page).getByRole("group", { name: monthTitle(month) });
const cell = (page: Page, iso: string) => section(page).getByRole("button", { name: new RegExp(`^${longDate(iso)} de ${iso.slice(0, 4)}(,|$)`) });
const boxHeight = (page: Page) => section(page).evaluate((el) => el.getBoundingClientRect().height);

function watch(page: Page) {
  const problems: string[] = [];
  const rest: string[] = [];
  page.on("console", (msg) => {
    if (msg.text().includes("Service Worker registration blocked by Playwright")) return;
    if (msg.type() === "error" || msg.type() === "warning") problems.push(`${msg.type()}: ${msg.text()}`);
  });
  page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
  page.on("request", (req) => req.url().includes("/rest/v1/") && rest.push(req.url()));
  return { problems, rest };
}

async function seedWithDays(title: string, draft: Record<string, unknown> = {}): Promise<Seeded> {
  const casa = await h.seed({ status: "active", draft: { title, nightlyPriceCrc: 95000, ...draft } });
  await h.putDay(casa.id, { day: on(10), available: false, specialPriceCrc: null });
  await h.putDay(casa.id, { day: on(11), available: false, specialPriceCrc: null });
  await h.putDay(casa.id, { day: on(20), available: true, specialPriceCrc: 150000 });
  return casa;
}

/** Retiene la portada: la ficha no hidrata hasta soltarla (main.tsx espera a la portada). */
async function holdHero(page: Page, casa: Seeded) {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(`**/listings/${casa.photoPaths[0]}*`, async (route) => {
    await held;
    await route.fulfill({ body: TILE, contentType: "image/png" });
  });
  return release;
}

test.beforeAll(async () => {
  h = await postgrestHarness();
  await h.reset();
});

test.beforeEach(async ({ page }) => {
  await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
  await page.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
});

test("tras hidratar: el formato del calendario del propietario (N4): ocupados solo con el número y el precio completo de cada noche, sin ★; sin rejilla en el HTML ni peticiones", async ({ page }) => {
  const casa = await seedWithDays("Casa Calendario Ficha");
  const seen = watch(page);
  const scripts: string[] = [];
  page.on("request", (req) => req.resourceType() === "script" && scripts.push(new URL(req.url()).pathname));
  const release = await holdHero(page, casa);

  const res = await page.goto(`/casa/${casa.publicId}`, { waitUntil: "domcontentloaded" });
  const html = await res!.text();
  const body = html.slice(html.indexOf('<div id="root">'));
  expect(body).toContain('<span class="eyebrow">Disponibilidad</span><div class="listing-calendar" aria-hidden="true"></div>');
  expect(body).not.toContain("month-grid");
  // Los días van en ssr-data (el calendario se monta con ellos, sin pedirlos).
  expect(html).toContain(`{"day":"${on(10)}","available":false,"specialPriceCrc":null}`);
  expect(html).toContain(`{"day":"${on(20)}","available":true,"specialPriceCrc":150000}`);

  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  expect(await page.locator("html").getAttribute("data-hydrated")).toBeNull();
  const before = await boxHeight(page);
  expect(before).toBeGreaterThan(300);
  expect(scripts.some((s) => s.includes("listing-calendar-")), "el trozo del calendario espera a la hidratación").toBe(false);

  release();
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  await expect(grid(page, opening())).toBeVisible();
  expect(scripts.some((s) => s.includes("listing-calendar-"))).toBe(true);
  expect(await boxHeight(page), "la caja mide lo mismo con la rejilla").toBe(before);
  // Nada se sale de la caja.
  expect(await section(page).evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);

  await toNextMonth(page);
  await expect(grid(page, next())).toBeVisible();
  await expect(cell(page, on(10))).toHaveAttribute("aria-label", `${longDate(on(10))} de ${on(10).slice(0, 4)}, ocupado`);
  await expect(cell(page, on(10))).toHaveText("10");
  await expect(cell(page, on(10))).toHaveClass(/is-busy/);
  // Precio especial: solo la cifra distinta, completa y sin «₡» (revisión UX 2026-10-29, N4).
  await expect(cell(page, on(20))).toHaveText("20150\u00a0000");
  await expect(cell(page, on(20))).toHaveAttribute("aria-label", /disponible, ₡150\s000, precio distinto$/);
  await expect(cell(page, on(15))).toHaveText("1595\u00a0000");
  expect(Math.round((await cell(page, on(15)).boundingBox())!.height)).toBe(92);
  await expect(section(page).locator(".month-legend")).toHaveText("DisponibleOcupado");
  await expect(section(page).getByText("★")).toHaveCount(0);
  expect(await boxHeight(page), "en otro mes, el mismo alto").toBe(before);
  await section(page).evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.screenshot({ path: "test-results/ficha-calendario.png" });

  // La moneda de la página manda también en el calendario.
  await page.evaluate(() => {
    localStorage.setItem("bnbtico_currency", "USD");
    dispatchEvent(new StorageEvent("storage", { key: "bnbtico_currency" }));
  });
  await expect(cell(page, on(20))).toHaveText(`20${formatUSD(150000, 510)}`);
  expect(await boxHeight(page), "en dólares, el mismo alto").toBe(before);

  expect(seen.rest, "ni la hidratación ni el calendario piden datos").toEqual([]);
  expect(seen.problems, seen.problems.join("\n")).toEqual([]);
});

test("meses: abre en el de apertura, del actual a doce más; los días pasados se tachan", async ({ page }) => {
  const casa = await seedWithDays("Casa Meses Ficha");
  await page.goto(`/casa/${casa.publicId}`);
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  const prev = section(page).getByRole("button", { name: "Mes anterior" });
  const following = section(page).getByRole("button", { name: "Mes siguiente" });
  const first = today().slice(0, 7);
  await expect(grid(page, opening())).toBeVisible();
  if (opening() !== first) await prev.click();
  await expect(grid(page, first)).toBeVisible();
  await expect(prev).toBeDisabled();
  if (today().slice(8) !== "01") await expect(cell(page, addDays(today(), -1))).toHaveClass(/is-past/);
  await expect(cell(page, today())).not.toHaveClass(/is-past/);
  for (let i = 1; i <= 12; i++) {
    await following.click();
    await expect(grid(page, addMonths(first, i))).toBeVisible();
  }
  await expect(following).toBeDisabled();
  await prev.click();
  await expect(grid(page, addMonths(first, 11))).toBeVisible();
});

test("con alquiler mensual a negociar, el calendario sigue siendo por noches con su precio base", async ({ page }) => {
  const casa = await seedWithDays("Casa Mensual Ficha", { acceptsMonthly: true, monthlyPriceCrc: null });
  await page.goto(`/casa/${casa.publicId}`);
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  await toNextMonth(page);
  await expect(cell(page, on(10))).toHaveClass(/is-busy/);
  await expect(cell(page, on(20))).toHaveText("20150\u00a0000");
  await expect(cell(page, on(15))).toHaveText("1595\u00a0000");
});

test("casa cerrada a consultas: «Calendario cerrado» y cuándo vuelve, ya en el HTML y sin rejilla", async ({ page }) => {
  const casa = await seedWithDays("Casa Cerrada Ficha");
  const reopen = addDays(today(), 12);
  await h.setClosed(casa.id, true, reopen);
  const seen = watch(page);
  const res = await page.goto(`/casa/${casa.publicId}`);
  const html = await res!.text();
  expect(html).toContain("Calendario cerrado");
  expect(html).not.toContain('class="listing-calendar"');
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  const closed = page.locator(".note").filter({ hasText: "Calendario cerrado" });
  await expect(closed).toContainText(`Vuelve a estar disponible el ${longDate(reopen)}`);
  await expect(page.locator(".month-grid")).toHaveCount(0);
  await closed.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.screenshot({ path: "test-results/ficha-calendario-cerrada.png" });
  expect(seen.problems, seen.problems.join("\n")).toEqual([]);
});

test("ficha dentro de la SPA: pide los días una vez y muestra el calendario", async ({ page }) => {
  const casa = await seedWithDays("Casa Calendario SPA");
  const days: string[] = [];
  page.on("request", (req) => req.url().includes("/rest/v1/rpc/public_listing_days") && days.push(req.url()));
  await page.goto("/explorar");
  await page.getByRole("link", { name: /Casa Calendario SPA/ }).first().click();
  await expect(page).toHaveURL(new RegExp(`/casa/${casa.publicId}$`));
  await expect(grid(page, opening())).toBeVisible();
  await toNextMonth(page);
  await expect(cell(page, on(11))).toHaveClass(/is-busy/);
  await expect(cell(page, on(20))).toHaveText("20150\u00a0000");
  expect(days).toHaveLength(1);
});

test("ficha dentro de la SPA: si fallan los días, la ficha se ve sin «Disponibilidad» (ni caja ni error)", async ({ page }) => {
  const casa = await seedWithDays("Casa Sin Dias SPA");
  const seen = watch(page);
  let calls = 0;
  await page.route("**/rest/v1/rpc/public_listing_days*", (route) => {
    calls++;
    return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "caída" }) });
  });
  await page.goto("/explorar");
  await page.getByRole("link", { name: /Casa Sin Dias SPA/ }).first().click();
  await expect(page).toHaveURL(new RegExp(`/casa/${casa.publicId}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Casa Sin Dias SPA" })).toBeVisible();
  await expect.poll(() => calls).toBeGreaterThanOrEqual(2); // la consulta y su único reintento
  await expect(page.getByText("Disponibilidad")).toHaveCount(0);
  await expect(section(page)).toHaveCount(0);
  await expect(page.getByText(/No pudimos cargar/)).toHaveCount(0);
  await expect(page.getByText("Zona aproximada")).toBeVisible();
  expect(seen.problems.filter((p) => !/500|Failed to load resource/.test(p)), seen.problems.join("\n")).toEqual([]);
});

// ---------- Ticket 08 de la ronda del 2 nov: el calendario de la ficha elige llegada y salida ----------

const FECHAS = "bnbtico-fechas";
const stored = (page: Page) => page.evaluate((k) => sessionStorage.getItem(k), FECHAS);
const total = (page: Page) => section(page).getByTestId("stay-total");
const line = (nights: number, crc: number, a: string, b: string) => `${stayTotalLabel(crc, nights, "CRC", 510)} · ${formatInquiryDates(a, b)}`;
const barHeight = (page: Page) => page.locator(".cta-bar").evaluate((el) => el.getBoundingClientRect().height);
async function openHydrated(page: Page, casa: Seeded) {
  await page.goto(`/casa/${casa.publicId}`);
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  await expect(grid(page, opening())).toBeVisible();
  await toNextMonth(page);
  await expect(grid(page, next())).toBeVisible();
}

test("elegir llegada y salida: estilo de «¿Cuándo?» sobre los libres, total orientativo bajo el calendario, fechas en la pestaña y la caja con el mismo alto", async ({ page }) => {
  const casa = await seedWithDays("Casa Rango Ficha");
  const seen = watch(page);
  await openHydrated(page, casa);
  const before = await boxHeight(page);
  await expect(total(page)).toHaveText("");

  await cell(page, on(13)).click();
  await expect(cell(page, on(13))).toHaveClass(/range-end/);
  await expect(total(page)).toHaveText("Ahora elija la salida.");
  expect(await stored(page), "una llegada sola no se comparte").toBeNull();
  await cell(page, on(16)).click();
  // 3 noches (13, 14 y 15) a ₡95 000.
  await expect(total(page)).toHaveText(line(3, 285_000, on(13), on(16)));
  await expect(cell(page, on(13))).toHaveClass(/range-end is-start/);
  await expect(cell(page, on(14))).toHaveClass(/in-range/);
  await expect(cell(page, on(15))).toHaveClass(/in-range/);
  await expect(cell(page, on(16))).toHaveClass(/range-end is-last/);
  await expect(cell(page, on(17))).not.toHaveClass(/in-range|range-end/);
  expect(JSON.parse((await stored(page))!)).toEqual({ llegada: on(13), salida: on(16) });
  // Nombres de siempre (las usan las pruebas de la hoja con `exact`): ahora botones.
  await expect(cell(page, on(14))).toHaveAttribute("aria-label", /^\d+ de \p{L}+ de \d{4}, disponible, ₡95\s000$/u);
  expect(await boxHeight(page), "con fechas y total, la caja mide lo mismo").toBe(before);
  expect(await section(page).evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);
  await section(page).evaluate((el) => el.scrollIntoView({ block: "start" }));
  await page.screenshot({ path: "../../.scratch/ronda-ana-2026-11-02/capturas/08-1-calendario-rango.png" });

  // Los precios especiales cuentan noche por noche: 18, 19, 20 (₡150 000) y 21.
  await cell(page, on(18)).click();
  await expect(total(page)).toHaveText("Ahora elija la salida.");
  expect(await stored(page), "empezar de nuevo quita las fechas compartidas").toBeNull();
  await cell(page, on(22)).click();
  await expect(total(page)).toHaveText(line(4, 3 * 95_000 + 150_000, on(18), on(22)));

  // Quitar fechas.
  await section(page).getByRole("button", { name: "Quitar fechas" }).click();
  await expect(total(page)).toHaveText("");
  await expect(section(page).getByRole("button", { name: "Quitar fechas" })).toHaveCount(0);
  expect(await stored(page)).toBeNull();
  expect(await boxHeight(page)).toBe(before);
  expect(seen.problems, seen.problems.join("\n")).toEqual([]);
});

test("días ocupados: no se llega en uno, la salida sí puede caer en el primer ocupado y un rango con una noche ocupada se rechaza", async ({ page }) => {
  const casa = await seedWithDays("Casa Ocupados Ficha");
  await openHydrated(page, casa);
  // Sin llegada elegida, un ocupado no se toca (los ocupados son el 10 y el 11).
  await expect(cell(page, on(10))).toBeDisabled();
  await expect(cell(page, on(11))).toBeDisabled();
  await expect(cell(page, on(12))).toBeEnabled();

  await cell(page, on(8)).click();
  // Con la llegada elegida, un ocupado posterior sí se toca (puede ser la salida).
  await expect(cell(page, on(10))).toBeEnabled();
  await cell(page, on(12)).click(); // noches 8, 9, 10 y 11: hay ocupadas
  await expect(section(page).getByRole("alert")).toHaveText("Hay noches ocupadas entre esas fechas.");
  expect(await stored(page)).toBeNull();
  await expect(cell(page, on(8))).toHaveClass(/range-end/); // la llegada se queda
  await section(page).evaluate((el) => el.scrollIntoView({ block: "start" }));
  await page.screenshot({ path: "../../.scratch/ronda-ana-2026-11-02/capturas/08-4-rango-rechazado.png" });

  await cell(page, on(10)).click(); // noches 8 y 9: la salida cae en el primer ocupado
  await expect(section(page).getByRole("alert")).toHaveCount(0);
  await expect(total(page)).toHaveText(line(2, 190_000, on(8), on(10)));
  await expect(cell(page, on(10))).toHaveClass(/range-end is-last/);
  expect(JSON.parse((await stored(page))!)).toEqual({ llegada: on(8), salida: on(10) });
  // Con el rango completo, un ocupado vuelve a no valer de llegada.
  await expect(cell(page, on(11))).toBeDisabled();
});

test("las fechas de Explorar: el HTML no las lleva; tras hidratar el calendario abre en el mes de la llegada con la banda y el total, sin avisos de hidratación y con la misma caja", async ({ page }) => {
  const casa = await seedWithDays("Casa Fechas Explorar");
  const [a, b] = [on(13), on(16)];
  await page.addInitScript(([k, v]) => sessionStorage.setItem(k, v), [FECHAS, JSON.stringify({ llegada: a, salida: b })] as const);
  const seen = watch(page);
  const release = await holdHero(page, casa);
  const res = await page.goto(`/casa/${casa.publicId}`, { waitUntil: "domcontentloaded" });
  const html = await res!.text();
  expect(html).not.toContain("por 3 noches");
  expect(html).not.toContain("range-end");
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const before = await boxHeight(page);
  release();
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  // Abre en el mes de la llegada (no en el de apertura).
  await expect(grid(page, next())).toBeVisible();
  await expect(cell(page, a)).toHaveClass(/range-end is-start/);
  await expect(cell(page, on(14))).toHaveClass(/in-range/);
  await expect(total(page)).toHaveText(line(3, 285_000, a, b));
  expect(await boxHeight(page), "la caja mide lo mismo antes y después de hidratar").toBe(before);
  expect(seen.problems, seen.problems.join("\n")).toEqual([]);
});

test("barra de precio: con fechas la línea principal es el total (colones y dólares), la del mensual sigue igual y la barra no cambia de alto, con o sin mensual", async ({ page }) => {
  const conMensual = await seedWithDays("Casa Barra Total", { acceptsMonthly: true, monthlyPriceCrc: 900000 });
  const soloNoches = await seedWithDays("Casa Barra Noches");
  const mensualNegociable = await seedWithDays("Casa Barra Negociar", { acceptsMonthly: true, monthlyPriceCrc: null });
  for (const [casa, monthly] of [[conMensual, "Mensual: ₡900 000 / mes"], [soloNoches, null], [mensualNegociable, "Mensual: precio a negociar con el anfitrión"]] as const) {
    await page.addInitScript(([k, v]) => sessionStorage.setItem(k, v), [FECHAS, JSON.stringify({ llegada: on(13), salida: on(16) })] as const);
    const release = await holdHero(page, casa);
    await page.goto(`/casa/${casa.publicId}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("main-price")).toHaveText("₡95 000 / noche"); // el servidor no conoce las fechas
    const before = await barHeight(page);
    release();
    await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
    await expect(page.getByTestId("main-price")).toHaveText("≈ ₡285 000 / 3 noches");
    await expect(page.getByTestId("price-usd")).toContainText("/ 3 noches");
    if (monthly) await expect(page.getByTestId("monthly-line")).toHaveText(monthly);
    else await expect(page.getByTestId("monthly-line")).toHaveCount(0);
    expect(await barHeight(page), "la barra mide lo mismo con total").toBe(before);
    expect(await page.locator(".cta-prices").evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    if (casa === conMensual) await page.screenshot({ path: "../../.scratch/ronda-ana-2026-11-02/capturas/08-2-barra-total-con-mensual.png" });
    if (casa === soloNoches) await page.screenshot({ path: "../../.scratch/ronda-ana-2026-11-02/capturas/08-2b-barra-total-solo-noches.png" });
    // Quitar las fechas: la barra de siempre y el mismo alto.
    await section(page).evaluate((el) => el.scrollIntoView({ block: "center" }));
    await section(page).getByRole("button", { name: "Quitar fechas" }).click();
    await expect(page.getByTestId("main-price")).toHaveText("₡95 000 / noche");
    expect(await barHeight(page)).toBe(before);
    await page.context().clearCookies();
    await page.evaluate(() => sessionStorage.clear());
  }
  // Una estancia más larga («≈ ₡665 000 / 7 noches») cabe en un renglón.
  await page.addInitScript(([k, v]) => sessionStorage.setItem(k, v), [FECHAS, JSON.stringify({ llegada: on(21), salida: on(28) })] as const);
  await page.goto(`/casa/${soloNoches.publicId}`);
  await expect(page.getByTestId("main-price")).toHaveText("≈ ₡665 000 / 7 noches");
  expect(await page.locator(".cta-prices").evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
});

test("fechas que ya traen una noche ocupada (de Explorar o de un enlace viejo): el aviso en vez de banda y total, la barra con el precio por noche, y se pueden elegir otras", async ({ page }) => {
  const casa = await seedWithDays("Casa Fechas Ocupadas");
  await page.addInitScript(([k, v]) => sessionStorage.setItem(k, v), [FECHAS, JSON.stringify({ llegada: on(8), salida: on(13) })] as const);
  const seen = watch(page);
  await page.goto(`/casa/${casa.publicId}`);
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  await expect(grid(page, next())).toBeVisible();
  await expect(total(page)).toHaveText("Hay noches ocupadas entre esas fechas.");
  await expect(total(page)).toHaveAttribute("role", "alert");
  await expect(section(page).locator(".range-end, .in-range")).toHaveCount(0);
  await expect(page.getByTestId("main-price")).toHaveText("₡95 000 / noche");
  await section(page).evaluate((el) => el.scrollIntoView({ block: "start" }));
  await page.screenshot({ path: "../../.scratch/ronda-ana-2026-11-02/capturas/08-6-fechas-con-noches-ocupadas.png" });

  // La hoja: el mismo aviso en lugar del total.
  await page.getByRole("button", { name: "Contactar por WhatsApp", exact: true }).click();
  const sheet = page.getByRole("dialog");
  await expect(dateBox(sheet, "Llegada")).toHaveText(boxText("Llegada", on(8)));
  await expect(sheet.getByTestId("stay-total")).toHaveText("Hay noches ocupadas entre esas fechas.");
  await page.screenshot({ path: "../../.scratch/ronda-ana-2026-11-02/capturas/08-7-hoja-fechas-con-noches-ocupadas.png" });
  await sheet.getByRole("button", { name: "Cerrar" }).click();

  // Elegir otras fechas devuelve la banda, el total y la barra con el total.
  await cell(page, on(14)).click();
  await cell(page, on(16)).click();
  await expect(total(page)).toHaveText(line(2, 190_000, on(14), on(16)));
  await expect(page.getByTestId("main-price")).toHaveText("≈ ₡190 000 / 2 noches");
  expect(seen.problems, seen.problems.join("\n")).toEqual([]);
});

test("ficha y hoja comparten las fechas y el total: lo elegido en la ficha está en la hoja, lo cambiado en la hoja está en la ficha, y los ocupados no se eligen en la hoja", async ({ page }) => {
  const casa = await seedWithDays("Casa Hoja Fechas");
  await openHydrated(page, casa);
  await cell(page, on(13)).click();
  await cell(page, on(16)).click();
  await expect(total(page)).toHaveText(line(3, 285_000, on(13), on(16)));

  await page.getByRole("button", { name: "Contactar por WhatsApp", exact: true }).click();
  const sheet = page.getByRole("dialog");
  await expect(dateBox(sheet, "Llegada")).toHaveText(boxText("Llegada", on(13)));
  await expect(dateBox(sheet, "Salida")).toHaveText(boxText("Salida", on(16)));
  await expect(sheet.getByTestId("stay-total")).toHaveText(line(3, 285_000, on(13), on(16)));
  await expect(messagePreview(sheet)).toHaveText(composeInquiryMessage("Casa Hoja Fechas", { arrival: on(13), departure: on(16) }));

  // Un día ocupado no se elige de llegada; los nombres de los días son los de siempre.
  await dateBox(sheet, "Llegada").click();
  await expect(calendarDay(sheet, on(10))).toBeDisabled();
  await expect(calendarDay(sheet, on(12))).toBeEnabled();
  await sheet.getByRole("button", { name: "Quitar fechas" }).click();
  await calendarDay(sheet, on(8)).click();
  await expect(calendarDay(sheet, on(10))).toBeEnabled();
  await calendarDay(sheet, on(12)).click(); // atraviesa las noches ocupadas
  await expect(sheet.getByRole("alert")).toHaveText("Hay noches ocupadas entre esas fechas.");
  await expect(dateBox(sheet, "Salida")).toHaveText(boxText("Salida", null));
  await page.screenshot({ path: "../../.scratch/ronda-ana-2026-11-02/capturas/08-5-hoja-rechazado.png" });
  await calendarDay(sheet, on(9)).click();
  await expect(sheet.getByRole("alert")).toHaveCount(0);
  await expect(sheet.getByTestId("stay-total")).toHaveText(line(1, 95_000, on(8), on(9)));
  expect(JSON.parse((await stored(page))!)).toEqual({ llegada: on(8), salida: on(9) });

  // Otro rango en la hoja con precio especial: 18 a 22 son 4 noches, una a ₡150 000.
  await dateBox(sheet, "Llegada").click();
  await calendarDay(sheet, on(18)).click();
  await calendarDay(sheet, on(22)).click();
  const expected = line(4, 3 * 95_000 + 150_000, on(18), on(22));
  await expect(sheet.getByTestId("stay-total")).toHaveText(expected);
  await page.screenshot({ path: "../../.scratch/ronda-ana-2026-11-02/capturas/08-3-hoja-total.png" });

  // Al cerrar, la ficha tiene las fechas y el total de la hoja.
  await sheet.getByRole("button", { name: "Cerrar" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(cell(page, on(18))).toHaveClass(/range-end is-start/);
  await expect(cell(page, on(22))).toHaveClass(/range-end is-last/);
  await expect(total(page)).toHaveText(expected);

  // Y al reabrir la hoja, las mismas fechas y el mismo total (el borrador ya no guarda fechas propias).
  await page.getByRole("button", { name: "Contactar por WhatsApp", exact: true }).click();
  await expect(dateBox(sheet, "Llegada")).toHaveText(boxText("Llegada", on(18)));
  await expect(sheet.getByTestId("stay-total")).toHaveText(expected);
});
