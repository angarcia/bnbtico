import { webkit } from "@playwright/test";
import { expect, test, type Page } from "./helpers/test";
import { addDays, costaRicaToday, formatInquiryDates, longDateWithYear, shortDate } from "../../src/domain/dates";
import { monthlyWindowLabel } from "../../src/domain/search";
import { COCLES } from "../contract/points";
import { postgrestHarness } from "../db/postgrest-harness";

// La búsqueda a pantalla completa de Explorar (pantallas v2 02–04): ¿Dónde?, ¿Cuándo? y ¿Quiénes?, contra Supabase local.
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
const today = costaRicaToday(Date.now());
const day = (n: number) => addDays(today, n);
const cocles = { ...COCLES, zone: "Cocles", zoneSource: "list" as const, zoneId: "704-cocles", capacity: 4 };
const busy = (d: string) => ({ day: d, available: false, specialPriceCrc: null });

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const h = await postgrestHarness();
  await h.reset();
  await h.seed({ status: "active", draft: { ...cocles, title: "Casa Coco" } });
  const ocupada = await h.seed({ status: "active", draft: { ...cocles, title: "Casa Ocupada" } });
  await h.putDay(ocupada.id, busy(day(22)));
  await h.seed({ status: "active", draft: { title: "Cabina Cahuita" } });
  const mensual = await h.seed({ status: "active", draft: { ...cocles, title: "Casa Mensual", acceptsMonthly: true } });
  await h.putDay(mensual.id, busy(day(10 + 10)));
  await h.seed({ status: "active", draft: { ...cocles, title: "Casa Larga", acceptsMonthly: true } });
  await h.seed({ status: "active", draft: { ...cocles, title: "Casa Piscina", features: ["pool"] } });
});

test.beforeEach(async ({ page }) => {
  await page.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
  await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
});

const results = (page: Page) => page.getByTestId("results-count");
const house = (page: Page, title: string) => page.getByRole("link", { name: new RegExp(`^${title}`) });

test("buscar «coc» → Cocles, fechas y 4 personas", async ({ page }) => {
  await page.goto("/explorar");
  await page.getByRole("link", { name: "Empiece su búsqueda" }).click();
  await expect(page).toHaveURL(/\/explorar\/buscar$/);
  await expect(page.locator("nav.tabbar")).toHaveCount(0);
  await page.getByRole("combobox", { name: "Busque una zona" }).fill("coc");
  await expect(page.getByRole("option")).toHaveText([/^Cocles/]);
  await page.getByRole("option", { name: /^Cocles/ }).click();
  await expect(page.getByRole("button", { name: "¿Dónde? Cocles" })).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("button", { name: "¿Cuándo?", exact: true })).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("button", { name: longDateWithYear(day(20))!, exact: true }).click();
  await page.getByRole("button", { name: longDateWithYear(day(24))!, exact: true }).click();
  await expect(page.getByText(formatInquiryDates(day(20), day(24)), { exact: true })).toBeVisible();
  await expect(page.getByText("4 noches", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Siguiente" }).click();
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Una persona más" }).click();
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/explorar\\?zona=704-cocles&llegada=${day(20)}&salida=${day(24)}&ppl=4$`));
  await expect(page.locator(".search-pill")).toHaveText(`Cocles · ${formatInquiryDates(day(20), day(24))} · 4 personas`);
  await expect(house(page, "Casa Coco")).toBeVisible();
  await expect(house(page, "Casa Ocupada")).toHaveCount(0);
  await expect(house(page, "Cabina Cahuita")).toHaveCount(0);
  await expect(results(page)).toHaveText(`3 casas en Cocles y alrededores · ${formatInquiryDates(day(20), day(24))}`);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test("con «Solo alquiler mensual», «¿Cuándo?» pide «Desde» y deja fuera la ocupada el día 10", async ({ page }) => {
  await page.goto("/explorar?mensual=1&zona=704-cocles");
  await page.locator(".search-pill").click();
  await expect(page).toHaveURL(/\/explorar\/buscar/);
  await page.getByRole("button", { name: /^¿Cuándo?/ }).click();
  await expect(page.getByText("Solo alquiler mensual", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: longDateWithYear(day(10))!, exact: true }).click();
  await expect(page.getByText(`Desde el ${shortDate(day(10))}`, { exact: true })).toBeVisible();
  await expect(page.getByText(monthlyWindowLabel(day(10)), { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/explorar\\?.*desde=${day(10)}`));
  await expect(house(page, "Casa Larga")).toBeVisible();
  await expect(house(page, "Casa Mensual")).toHaveCount(0);
});

test("Borrar todo quita zona, fechas y personas y conserva una característica", async ({ page }) => {
  await page.goto(`/explorar?zona=704-cocles&llegada=${day(20)}&salida=${day(24)}&ppl=4&pool=1`);
  await page.locator(".search-pill").click();
  await expect(page).toHaveURL(/\/explorar\/buscar/);
  await page.getByRole("button", { name: "Borrar todo" }).click();
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page).toHaveURL(/\/explorar\?pool=1$/);
  await expect(page.locator(".search-pill")).toHaveText("Empiece su búsqueda");
});

test("✕ vuelve sin aplicar", async ({ page }) => {
  await page.goto("/explorar");
  await page.getByRole("link", { name: "Empiece su búsqueda" }).click();
  await page.getByRole("combobox", { name: "Busque una zona" }).fill("pu");
  await page.getByRole("option", { name: /^Puerto Viejo/ }).click();
  await page.getByRole("button", { name: "Cerrar la búsqueda" }).click();
  await expect(page).toHaveURL(/\/explorar$/);
  await expect(page.locator(".search-pill")).toHaveText("Empiece su búsqueda");
});

test("sin coincidencias", async ({ page }) => {
  await page.goto("/explorar/buscar");
  await page.getByRole("combobox", { name: "Busque una zona" }).fill("zzz");
  await expect(page.getByText("Todavía no hay casas en esa zona.")).toBeVisible();
  await expect(page.getByRole("option")).toHaveCount(0);
  await expect(page.getByText("Le mostramos las casas de la zona y las que están a 5 km o menos.")).toBeVisible();
});

test("?abrir=quienes abre «¿Quiénes?»", async ({ page }) => {
  await page.goto("/explorar/buscar?abrir=quienes");
  await expect(page.getByRole("button", { name: "¿Quiénes?", exact: true })).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: "¿Dónde? Añadir zona" })).toHaveAttribute("aria-expanded", "false");
  // Sin personas, «–» en gris, como la hoja de contacto y el asistente (Daniel, 2026-10-29; antes «Sin indicar»).
  await expect(page.locator(".people-stepper b")).toHaveText("–");
  await expect(page.locator(".people-stepper b")).toHaveClass(/is-empty/);
  await expect(page.getByRole("button", { name: "Una persona menos" })).toBeDisabled();
  // `abrir` no pasa a la URL de Explorar.
  await page.getByRole("button", { name: "Una persona más" }).click();
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page).toHaveURL(/\/explorar\?ppl=1$/);
});

test("con el teclado: Enter abre una tarjeta sin perder el foco, y elegir una zona con Enter lo lleva a «¿Cuándo?»", async ({ page }) => {
  await page.goto("/explorar/buscar");
  const focusedCard = () => page.evaluate(() => document.activeElement?.closest("section")?.querySelector("h2")?.textContent ?? null);
  await page.getByRole("button", { name: "¿Cuándo? Añadir fechas" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "¿Cuándo?", exact: true })).toHaveAttribute("aria-expanded", "true");
  await expect.poll(focusedCard).toBe("¿Cuándo?");
  await page.getByRole("button", { name: "¿Dónde? Añadir zona" }).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await page.keyboard.type("coc");
  await expect(page.getByRole("option")).toHaveText([/^Cocles/]);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "¿Dónde? Cocles" })).toBeVisible();
  await expect.poll(focusedCard).toBe("¿Cuándo?");
});

test("límites: hoy + 365 solo como salida, el «Desde» del mensual hasta hoy + 335 y 50 personas", async ({ page }) => {
  await page.goto("/explorar/buscar?abrir=cuando");
  const dayButton = (n: number) => page.getByRole("button", { name: longDateWithYear(day(n))!, exact: true });
  await expect(dayButton(365)).toBeDisabled();
  await expect(dayButton(366)).toBeDisabled();
  await dayButton(360).click();
  await expect(dayButton(365)).toBeEnabled();
  await page.goto("/explorar/buscar?mensual=1&abrir=cuando");
  await expect(dayButton(335)).toBeEnabled();
  await expect(dayButton(336)).toBeDisabled();
  await page.goto("/explorar/buscar?ppl=49&abrir=quienes");
  await page.getByRole("button", { name: "Una persona más" }).click();
  await expect(page.getByText("50", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Una persona más" })).toBeDisabled();
});

test("Filtros: «Su búsqueda» abre la búsqueda en su tarjeta; con una sola provincia no sale el bloque de provincias", async ({ page }) => {
  await page.goto("/explorar/filtros?zona=704-cocles&ppl=4");
  const mine = page.getByRole("group", { name: "Su búsqueda" });
  await expect(mine.getByRole("link")).toHaveText([/^Zona\s*Cocles$/, /^Fechas\s*Sin fechas$/, /^Personas\s*4 personas$/]);
  await expect(page.getByLabel("Personas", { exact: true })).toHaveCount(0);
  await mine.getByRole("link", { name: /^Personas/ }).click();
  await expect(page).toHaveURL(/\/explorar\/buscar\?.*abrir=quienes/);
  await expect(page.getByRole("button", { name: /¿Quiénes\?/ })).toHaveAttribute("aria-expanded", "true");
  await page.goBack();
  // Revisión UX 2026-10-29 (A7): con casas solo en Limón, la zona sale una vez, en «Su búsqueda»; sin zona, «Todo Limón».
  await expect(page.getByRole("group", { name: "Zona", exact: true })).toHaveCount(0);
  await page.goto("/explorar/filtros");
  await expect(mine.getByRole("link").first()).toHaveText(/^Zona\s*Todo Limón$/);
});

test("al volver a abrir «¿Dónde?» con una zona de dos palabras, la zona sigue en la lista", async ({ page }) => {
  await page.goto("/explorar/buscar?zona=704-puerto-viejo");
  await expect(page.getByRole("combobox", { name: "Busque una zona" })).toHaveValue("Puerto Viejo");
  await expect(page.getByRole("option", { name: /^Puerto Viejo/ })).toBeVisible();
  await expect(page.getByText("Todavía no hay casas en esa zona.")).toHaveCount(0);
});

test("una zona que ya no está en la lista se muestra como «Añadir zona»", async ({ page }) => {
  await page.goto("/explorar/buscar?zona=704-no-existe&abrir=quienes");
  await expect(page.getByRole("button", { name: "¿Dónde? Añadir zona" })).toBeVisible();
});

test("si la base rechaza las fechas, Explorar lo dice y ofrece quitarlas", async ({ page }) => {
  await page.route("**/rest/v1/rpc/search_listings*", (route) =>
    new URL(route.request().url()).searchParams.has("p_from") || route.request().postDataJSON()?.p_from
      ? route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "P0001", message: "Revise las fechas.", details: null, hint: null }) })
      : route.fallback(),
  );
  await page.goto(`/explorar?llegada=${day(20)}&salida=${day(24)}`);
  await expect(page.getByText("Revise las fechas de su búsqueda.")).toBeVisible();
  await expect(page.getByText(/Revise su conexión/)).toHaveCount(0);
  await page.getByRole("button", { name: "Quitar fechas" }).click();
  await expect(page).toHaveURL(/\/explorar$/);
  await expect(house(page, "Casa Coco")).toBeVisible();
});

// Revisión UX 2026-10-29 (N9): «Siguiente» de «¿Cuándo?» siempre encima de la barra «Borrar todo · Buscar»; el calendario
// se desplaza por dentro. Los tamaños son el espacio útil de Safari en un iPhone 13 (390 × 664) y un SE (375 × 553).
const SAFARI_SIZES = [
  { width: 390, height: 664 },
  { width: 375, height: 553 },
];
async function expectNextAboveBar(page: Page) {
  const next = page.getByRole("button", { name: "Siguiente" });
  await expect(next).toBeVisible();
  const n = (await next.boundingBox())!;
  const bar = (await page.locator(".sticky-actions").boundingBox())!;
  expect(n.y + n.height).toBeLessThanOrEqual(bar.y);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  // El calendario sigue siendo de varios meses: se desplaza por dentro.
  expect(await page.locator(".range-scroll").evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
}

test("«Siguiente» de «¿Cuándo?» no queda bajo la barra de abajo (iPhone 13 y SE en Safari)", async ({ page }) => {
  for (const size of SAFARI_SIZES) {
    await page.setViewportSize(size);
    await page.goto("/explorar/buscar?abrir=cuando");
    await expectNextAboveBar(page);
  }
});

test("lo mismo en WebKit (si está instalado; en CI solo hay Chromium)", async ({ baseURL }) => {
  let browser;
  try {
    // La ruta de Chrome de la configuración (CHROMIUM_PATH) se aplicaría también aquí: WebKit con la suya.
    browser = await webkit.launch({ executablePath: webkit.executablePath() });
  } catch {
    test.skip(true, "WebKit no está instalado");
    return;
  }
  try {
    for (const size of SAFARI_SIZES) {
      const page = await browser.newPage({ viewport: size, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
      await page.goto(`${baseURL}/explorar/buscar?abrir=cuando`);
      await expectNextAboveBar(page);
      await page.screenshot({ path: `test-results/buscar-siguiente-${size.width}x${size.height}.png` });
      await page.close();
    }
  } finally {
    await browser.close();
  }
});
