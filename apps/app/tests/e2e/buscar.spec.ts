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
  await expect(page.getByText("Sin indicar", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Una persona menos" })).toBeDisabled();
  // `abrir` no pasa a la URL de Explorar.
  await page.getByRole("button", { name: "Una persona más" }).click();
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page).toHaveURL(/\/explorar\?ppl=1$/);
});
