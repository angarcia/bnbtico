import { expect, test, type Page } from "./helpers/test";
import type { CalendarHarness, Seeded } from "../contract/harness";
import { postgrestHarness } from "../db/postgrest-harness";
import { addDays, addMonths, monthTitle, openingMonth } from "../../src/domain/calendar";
import { formatInquiryDates, longDate, longDateWithYear } from "../../src/domain/dates";
import { composeInquiryMessage, costaRicaToday } from "../../src/domain/inquiry";
import { formatUSD } from "../../src/domain/money";
import { stayTotalLabel } from "../../src/domain/search";
import { boxText, calendarDay, dateBox, messagePreview } from "./helpers/contact-sheet";

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
// Desde la ronda de Ana del 2 nov (ticket 08) los días son botones (se eligen llegada y salida) en un grupo con el nombre del mes.
const grid = (page: Page, month: string) => section(page).getByRole("group", { name: monthTitle(month) });
const cell = (page: Page, iso: string) => section(page).getByRole("button", { name: new RegExp(`^${longDateWithYear(iso)}(,|$)`) });
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
    localStorage.setItem("3bstays_currency", "USD");
    dispatchEvent(new StorageEvent("storage", { key: "3bstays_currency" }));
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

test("casa cerrada a consultas: «Calendario no disponible» y cuándo vuelve, ya en el HTML y sin rejilla", async ({ page }) => {
  const casa = await seedWithDays("Casa Cerrada Ficha");
  const reopen = addDays(today(), 12);
  await h.owner("owner").setAvailable(casa.id, false, reopen);
  const seen = watch(page);
  const res = await page.goto(`/casa/${casa.publicId}`);
  const html = await res!.text();
  expect(html).toContain("Calendario no disponible");
  expect(html).not.toContain('class="listing-calendar"');
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  const closed = page.locator(".note").filter({ hasText: "Calendario no disponible" });
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

// ---------- Ronda de Ana del 2 nov, ticket 08: el calendario de la ficha elige llegada y salida ----------

const FECHAS = "3bstays-fechas";
const FX = 510;
const stored = (page: Page) => page.evaluate((k) => sessionStorage.getItem(k), FECHAS);
const total = (page: Page) => section(page).getByTestId("stay-total");
const line = (nights: number, crc: number, a: string, b: string) => {
  const { amount, unit } = stayTotalLabel(crc, nights, "CRC", FX);
  return `${amount} ${unit} · ${formatInquiryDates(a, b)}`;
};
const barHeight = (page: Page) => page.locator(".cta-bar").evaluate((el) => el.getBoundingClientRect().height);
const withDates = (page: Page, a: string, b: string) => page.addInitScript(([k, v]) => sessionStorage.setItem(k, v), [FECHAS, JSON.stringify({ llegada: a, salida: b })] as const);
const contact = (page: Page) => page.getByRole("button", { name: "Contactar por WhatsApp", exact: true });
async function openHydrated(page: Page, casa: Seeded) {
  await page.goto(`/casa/${casa.publicId}`);
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  await expect(grid(page, opening())).toBeVisible();
  await toNextMonth(page);
  await expect(grid(page, next())).toBeVisible();
}

test("elegir llegada y salida: extremos y banda de «¿Cuándo?», total bajo el calendario y en la barra, fechas en la pestaña y la caja con el mismo alto", async ({ page }) => {
  const casa = await seedWithDays("Casa Rango Ficha");
  const seen = watch(page);
  await openHydrated(page, casa);
  const before = await boxHeight(page);
  const bar = await barHeight(page);
  await expect(total(page)).toHaveText("");
  await expect(section(page).getByRole("button", { name: "Quitar fechas" })).toHaveCount(0);

  await cell(page, on(13)).click();
  await expect(cell(page, on(13))).toHaveClass(/range-end/);
  await expect(cell(page, on(13))).toHaveAttribute("aria-pressed", "true");
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
  await expect(page.getByTestId("main-price")).toHaveText("≈ ₡285 000 / 3 noches");
  await expect(cell(page, on(14))).toHaveAttribute("aria-label", `${longDateWithYear(on(14))}, disponible, ₡95 000`);
  expect(await boxHeight(page), "con fechas y total, la caja mide lo mismo").toBe(before);
  expect(await barHeight(page), "con fechas, la barra mide lo mismo").toBe(bar);
  expect(await section(page).evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);

  // Los precios especiales cuentan noche por noche: 18, 19, 20 (₡150 000) y 21. Empezar de nuevo quita las de la pestaña.
  await cell(page, on(18)).click();
  await expect(total(page)).toHaveText("Ahora elija la salida.");
  expect(await stored(page)).toBeNull();
  await expect(page.getByTestId("main-price")).toHaveText("₡95 000 / noche");
  await cell(page, on(22)).click();
  await expect(total(page)).toHaveText(line(4, 3 * 95_000 + 150_000, on(18), on(22)));

  await section(page).getByRole("button", { name: "Quitar fechas" }).click();
  await expect(total(page)).toHaveText("");
  await expect(section(page).getByRole("button", { name: "Quitar fechas" })).toHaveCount(0);
  await expect(section(page).locator(".range-end, .in-range")).toHaveCount(0);
  expect(await stored(page)).toBeNull();
  await expect(page.getByTestId("main-price")).toHaveText("₡95 000 / noche");
  expect(await boxHeight(page)).toBe(before);
  expect(seen.problems, seen.problems.join("\n")).toEqual([]);
});

test("días ocupados en la ficha: no se llega en uno, la salida sí puede caer en el primer ocupado y un rango con una noche ocupada se rechaza", async ({ page }) => {
  const casa = await seedWithDays("Casa Ocupados Ficha");
  await openHydrated(page, casa);
  // Los ocupados son el 10 y el 11: sin llegada, no se tocan.
  await expect(cell(page, on(10))).toBeDisabled();
  await expect(cell(page, on(11))).toBeDisabled();
  await expect(cell(page, on(12))).toBeEnabled();

  await cell(page, on(8)).click();
  await expect(cell(page, on(10)), "con la llegada elegida, un ocupado posterior puede ser la salida").toBeEnabled();
  await cell(page, on(12)).click(); // noches 8 a 11: hay ocupadas
  await expect(section(page).getByRole("alert")).toHaveText("Hay noches ocupadas entre esas fechas.");
  expect(await stored(page)).toBeNull();
  await expect(cell(page, on(8))).toHaveClass(/range-end/);
  await expect(cell(page, on(12))).not.toHaveClass(/range-end/);

  await cell(page, on(10)).click(); // noches 8 y 9: la salida cae en el primer ocupado
  await expect(section(page).getByRole("alert")).toHaveCount(0);
  await expect(total(page)).toHaveText(line(2, 190_000, on(8), on(10)));
  await expect(cell(page, on(10))).toHaveClass(/range-end is-last/);
  expect(JSON.parse((await stored(page))!)).toEqual({ llegada: on(8), salida: on(10) });
  await expect(cell(page, on(11)), "con el rango completo, un ocupado vuelve a no valer de llegada").toBeDisabled();
});

test("las fechas de Explorar: el HTML no las lleva; tras hidratar, el mes de la llegada con la banda y el total, sin avisos de hidratación y con la misma caja y la misma barra", async ({ page }) => {
  const casa = await seedWithDays("Casa Fechas Explorar");
  const [a, b] = [on(13), on(16)];
  await withDates(page, a, b);
  const seen = watch(page);
  const release = await holdHero(page, casa);
  const res = await page.goto(`/casa/${casa.publicId}`, { waitUntil: "domcontentloaded" });
  const html = await res!.text();
  expect(html).not.toContain("3 noches");
  expect(html).not.toContain("range-end");
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const before = await boxHeight(page);
  const bar = await barHeight(page);
  await expect(page.getByTestId("main-price")).toHaveText("₡95 000 / noche");
  release();
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  await expect(grid(page, next()), "abre en el mes de la llegada").toBeVisible();
  await expect(cell(page, a)).toHaveClass(/range-end is-start/);
  await expect(cell(page, on(14))).toHaveClass(/in-range/);
  await expect(total(page)).toHaveText(line(3, 285_000, a, b));
  await expect(page.getByTestId("main-price")).toHaveText("≈ ₡285 000 / 3 noches");
  expect(await boxHeight(page), "la caja mide lo mismo antes y después de hidratar").toBe(before);
  expect(await barHeight(page), "la barra mide lo mismo antes y después de hidratar").toBe(bar);
  expect(seen.problems, seen.problems.join("\n")).toEqual([]);
});

test("barra de precio: sin fechas una línea; con fechas el total; «Mensual» solo con 30 noches o más, y entonces la barra crece", async ({ browser }) => {
  const conMensual = await seedWithDays("Casa Barra Mensual", { acceptsMonthly: true, monthlyPriceCrc: 900000 });
  const soloNoches = await seedWithDays("Casa Barra Noches");
  const negociable = await seedWithDays("Casa Barra Negociar", { acceptsMonthly: true, monthlyPriceCrc: null });
  const largo = [on(12), addDays(on(12), 35)] as const; // 35 noches desde el 12: sin los ocupados, con el 20 a ₡150 000
  for (const [casa, total35, monthly] of [
    [conMensual, "≈ ₡1 050 000 / 35 noches", "Mensual: ₡900 000 / mes"], // por meses: 900 000 × 35 / 30
    [soloNoches, "≈ ₡3 380 000 / 35 noches", null],
    [negociable, "≈ ₡3 380 000 / 35 noches", "Mensual: precio a negociar con el anfitrión"],
  ] as const) {
    const visit = async (dates: readonly [string, string] | null) => {
      const context = await browser.newContext({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
      const page = await context.newPage();
      await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
      if (dates) await withDates(page, dates[0], dates[1]);
      const release = await holdHero(page, casa);
      const res = await page.goto(`/casa/${casa.publicId}`, { waitUntil: "domcontentloaded" });
      // El servidor no conoce las fechas: una sola línea, sin «Mensual», con o sin fechas en la pestaña.
      expect(await res!.text()).not.toContain("Mensual:");
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      const server = await barHeight(page);
      release();
      await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
      return { page, server };
    };
    const noOverlap = async (page: Page) => {
      const [l, r] = await Promise.all([page.getByTestId("main-price").boundingBox(), page.getByTestId("price-usd").boundingBox()]);
      expect(l!.x + l!.width, "los colones no pisan los dólares").toBeLessThanOrEqual(r!.x);
    };

    const none = await visit(null);
    await expect(none.page.getByTestId("main-price")).toHaveText("₡95 000 / noche");
    await expect(none.page.getByTestId("price-usd")).toHaveText("≈ $186 / noche");
    await expect(none.page.getByTestId("monthly-line")).toHaveCount(0);
    await expect(none.page.getByTestId("monthly-usd")).toHaveCount(0);
    expect(await barHeight(none.page)).toBe(none.server);
    await none.page.context().close();

    const short = await visit([on(13), on(16)]);
    await expect(short.page.getByTestId("main-price")).toHaveText("≈ ₡285 000 / 3 noches");
    // Por debajo de 440 px los dólares van sin «/ 3 noches».
    await expect(short.page.getByTestId("price-usd")).toHaveText("≈ $559 / 3 noches");
    await expect(short.page.getByTestId("price-usd").locator("small")).toBeHidden();
    await expect(short.page.getByTestId("monthly-line")).toHaveCount(0);
    expect(await barHeight(short.page), "con 3 noches, la barra mide lo mismo").toBe(short.server);
    await noOverlap(short.page);
    await short.page.setViewportSize({ width: 440, height: 800 });
    await expect(short.page.getByTestId("price-usd").locator("small")).toBeVisible();
    await noOverlap(short.page);
    await short.page.context().close();

    const long = await visit(largo);
    await expect(long.page.getByTestId("main-price")).toHaveText(total35);
    await noOverlap(long.page);
    if (monthly) {
      await expect(long.page.getByTestId("monthly-line")).toHaveText(monthly);
      expect(await barHeight(long.page), "con el mensual de 30 noches o más, la barra crece").toBeGreaterThan(long.server + 10);
    } else {
      await expect(long.page.getByTestId("monthly-line")).toHaveCount(0);
      expect(await barHeight(long.page)).toBe(long.server);
    }
    await long.page.context().close();
  }
});

test("fechas que ya traen una noche ocupada: el aviso en vez de banda y total, la barra por noche, la hoja con el aviso y sin enviar hasta cambiarlas", async ({ page }) => {
  const casa = await seedWithDays("Casa Fechas Ocupadas");
  await withDates(page, on(8), on(13));
  const seen = watch(page);
  await page.goto(`/casa/${casa.publicId}`);
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  await expect(grid(page, next())).toBeVisible();
  await expect(total(page)).toHaveText("Hay noches ocupadas entre esas fechas.");
  await expect(total(page)).toHaveAttribute("role", "alert");
  await expect(section(page).locator(".range-end, .in-range")).toHaveCount(0);
  await expect(page.getByTestId("main-price")).toHaveText("₡95 000 / noche");

  await contact(page).click();
  const sheet = page.getByRole("dialog");
  await expect(dateBox(sheet, "Llegada")).toHaveText(boxText("Llegada", on(8)));
  await expect(sheet.getByTestId("stay-total")).toHaveText("Hay noches ocupadas entre esas fechas.");
  // Sin sesión el botón es «Continuar»: bloqueado hasta elegir otras fechas o quitarlas.
  await expect(sheet.getByRole("button", { name: "Continuar" })).toBeDisabled();
  await dateBox(sheet, "Llegada").click();
  await sheet.getByRole("button", { name: "Quitar fechas" }).click();
  await expect(sheet.getByRole("button", { name: "Continuar" })).toBeEnabled();
  await expect(sheet.getByTestId("stay-total")).toHaveCount(0);
  await sheet.getByRole("button", { name: "Cerrar" }).click();

  // Las fechas quitadas en la hoja también se quitan en la ficha; elegir otras trae la banda, el total y la barra con el total.
  await expect(total(page)).toHaveText("");
  await cell(page, on(14)).click();
  await cell(page, on(16)).click();
  await expect(total(page)).toHaveText(line(2, 190_000, on(14), on(16)));
  await expect(page.getByTestId("main-price")).toHaveText("≈ ₡190 000 / 2 noches");
  expect(seen.problems, seen.problems.join("\n")).toEqual([]);
});

test("ficha y hoja comparten fechas y total: lo elegido en una está en la otra; en la hoja los ocupados no valen de llegada y un rango con ocupados se rechaza", async ({ page }) => {
  const casa = await seedWithDays("Casa Hoja Fechas");
  await openHydrated(page, casa);
  await cell(page, on(13)).click();
  await cell(page, on(16)).click();
  await expect(total(page)).toHaveText(line(3, 285_000, on(13), on(16)));

  await contact(page).click();
  const sheet = page.getByRole("dialog");
  await expect(dateBox(sheet, "Llegada")).toHaveText(boxText("Llegada", on(13)));
  await expect(dateBox(sheet, "Salida")).toHaveText(boxText("Salida", on(16)));
  await expect(sheet.getByTestId("stay-total")).toHaveText(line(3, 285_000, on(13), on(16)));
  await expect(messagePreview(sheet)).toHaveText(composeInquiryMessage("Casa Hoja Fechas", { arrival: on(13), departure: on(16) }));

  // Los nombres de los días de la hoja son los de siempre (la fecha completa).
  await dateBox(sheet, "Llegada").click();
  await expect(calendarDay(sheet, on(10))).toBeDisabled();
  await expect(calendarDay(sheet, on(12))).toBeEnabled();
  await sheet.getByRole("button", { name: "Quitar fechas" }).click();
  await calendarDay(sheet, on(8)).click();
  await expect(calendarDay(sheet, on(10))).toBeEnabled();
  await calendarDay(sheet, on(12)).click(); // atraviesa las noches ocupadas
  await expect(sheet.getByRole("alert")).toHaveText("Hay noches ocupadas entre esas fechas.");
  await expect(dateBox(sheet, "Salida")).toHaveText(boxText("Salida", null));
  await calendarDay(sheet, on(9)).click();
  await expect(sheet.getByRole("alert")).toHaveCount(0);
  await expect(sheet.getByTestId("stay-total")).toHaveText(line(1, 95_000, on(8), on(9)));

  // Otro rango con precio especial: del 18 al 22, cuatro noches, una a ₡150 000.
  await dateBox(sheet, "Llegada").click();
  await calendarDay(sheet, on(18)).click();
  await calendarDay(sheet, on(22)).click();
  const expected = line(4, 3 * 95_000 + 150_000, on(18), on(22));
  await expect(sheet.getByTestId("stay-total")).toHaveText(expected);
  expect(JSON.parse((await stored(page))!)).toEqual({ llegada: on(18), salida: on(22) });
  await sheet.getByRole("button", { name: "Cerrar" }).click();

  // La ficha, al momento: la banda, el total y la barra.
  await expect(total(page)).toHaveText(expected);
  await expect(cell(page, on(18))).toHaveClass(/range-end is-start/);
  await expect(cell(page, on(22))).toHaveClass(/range-end is-last/);
  await expect(page.getByTestId("main-price")).toHaveText("≈ ₡435 000 / 4 noches");

  // Recargar la ficha conserva las fechas de la pestaña (y la hoja, que ya no guarda fechas propias, las mismas).
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  await expect(total(page)).toHaveText(expected);
  await contact(page).click();
  await expect(dateBox(page.getByRole("dialog"), "Llegada")).toHaveText(boxText("Llegada", on(18)));
});

test("la hoja no envía mientras se leen los días (ficha de la SPA con fechas): «Continuar» bloqueado hasta que llegan", async ({ page }) => {
  const casa = await seedWithDays("Casa Dias Cargando");
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/rest/v1/rpc/public_listing_days*", async (route) => {
    await held;
    await route.continue();
  });
  await page.goto(`/explorar?prov=Todas&llegada=${on(13)}&salida=${on(16)}`);
  await page.getByRole("link", { name: /Casa Dias Cargando/ }).first().click();
  await expect(page).toHaveURL(new RegExp(`/casa/${casa.publicId}$`));
  await contact(page).click();
  const sheet = page.getByRole("dialog");
  await expect(dateBox(sheet, "Llegada")).toHaveText(boxText("Llegada", on(13)));
  await expect(sheet.getByRole("button", { name: "Continuar" })).toBeDisabled();
  await expect(sheet.getByTestId("stay-total")).toHaveCount(0);
  release();
  await expect(sheet.getByRole("button", { name: "Continuar" })).toBeEnabled();
  await expect(sheet.getByTestId("stay-total")).toHaveText(line(3, 285_000, on(13), on(16)));
});
