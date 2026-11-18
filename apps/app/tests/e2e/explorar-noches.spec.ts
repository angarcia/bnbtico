import { expect, test, type Page } from "./helpers/test";
import { onlySearchMode } from "./helpers/flags";
import { addDays, costaRicaToday } from "../../src/domain/dates";
import { COCLES } from "../contract/points";
import { postgrestHarness } from "../db/postgrest-harness";

// Búsqueda por número de noches (historia flags-noches, diseño #59 aprobado el 2026-11-17), contra Supabase local. Solo
// con el build en modo noches (valores iniciales de las feature flags: fechas apagadas, noches encendidas).
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
const today = costaRicaToday(Date.now());
const cocles = { ...COCLES, zone: "Cocles", zoneSource: "list" as const, zoneId: "704-cocles", capacity: 4 };

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const h = await postgrestHarness();
  await h.reset();
  const ocupada = await h.seed({ status: "active", draft: { ...cocles, title: "Casa Almendro", nightlyPriceCrc: 45_000 } });
  // Una noche ocupada no la saca de Explorar: en modo noches no se mira la disponibilidad.
  await h.putDay(ocupada.id, { day: addDays(today, 3), available: false, specialPriceCrc: null });
  await h.seed({ status: "active", draft: { ...cocles, title: "Casa Mensual", nightlyPriceCrc: 30_000, acceptsMonthly: true, monthlyPriceCrc: 600_000 } });
});

test.beforeEach(async ({ page }) => {
  onlySearchMode("nights");
  await page.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
  await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
});

const results = (page: Page) => page.getByTestId("results-count");
const price = (page: Page, title: string) => page.getByRole("link", { name: new RegExp(`^${title}`) }).locator(".card-price");

test("elegir 4 noches: el total orientativo en las tarjetas, sin excluir casas ocupadas, y se conserva al recargar y volver", async ({ page }) => {
  await page.goto("/explorar/buscar?abrir=cuando");
  await expect(page.getByRole("heading", { name: "¿Cuántas noches?" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "¿Cuándo?" })).toHaveCount(0);
  const more = page.getByRole("button", { name: "Una noche más" });
  for (let i = 0; i < 4; i++) await more.click();
  await expect(page.locator(".search-card .people-stepper b")).toHaveText("4");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();

  await expect(page).toHaveURL(/noches=4/);
  await expect(results(page)).toContainText("2 casas · 4 noches");
  await expect(page.getByText("Precios orientativos con el precio por noche. El anfitrión le confirma por WhatsApp si está libre.")).toBeVisible();
  await expect(price(page, "Casa Almendro")).toHaveText("≈ ₡180 000 por 4 noches");
  await expect(page.locator(".search-pill-text").first()).toHaveText("4 noches");

  await page.reload();
  await expect(price(page, "Casa Almendro")).toHaveText("≈ ₡180 000 por 4 noches");
  await page.getByRole("link", { name: /^Casa Almendro/ }).click();
  await expect(page).toHaveURL(/\/casa\/CT-/);
  await page.goBack();
  await expect(results(page)).toContainText("4 noches");
});

test("marcar un atajo no mueve los demás: rejilla de dos columnas con el check en su hueco, como «Qué necesitan»", async ({ page }) => {
  await page.goto("/explorar/buscar?abrir=cuando");
  const group = page.getByRole("group", { name: "Atajos de noches" });
  const boxes = async () =>
    Promise.all(["Fin de semana", "1 semana", "2 semanas", "1 mes"].map(async (name) => (await group.getByRole("button", { name }).boundingBox())!));
  const before = await boxes();
  const [weekend, week, twoWeeks] = before;
  expect(week!.y).toBe(weekend!.y);
  expect(twoWeeks!.y).toBeGreaterThan(weekend!.y);
  expect(week!.width).toBe(weekend!.width);
  for (const name of ["Fin de semana", "1 semana", "2 semanas", "1 mes"]) {
    await group.getByRole("button", { name }).click();
    await expect(group.getByRole("button", { name })).toHaveAttribute("aria-pressed", "true");
    expect(await boxes()).toEqual(before);
  }
});

test("los atajos y la regla mensual: «1 mes» son 30 noches y la casa con precio al mes se estima por meses", async ({ page }) => {
  await page.goto("/explorar/buscar?abrir=cuando");
  await page.getByRole("button", { name: "1 mes" }).click();
  await expect(page.getByRole("button", { name: "1 mes" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(price(page, "Casa Mensual")).toHaveText("≈ ₡600 000 por 30 noches");
  await expect(price(page, "Casa Almendro")).toHaveText("≈ ₡1 350 000 por 30 noches");
});

test("un enlace viejo con fechas no filtra a escondidas, y unas noches fuera de 1–90 se ignoran sin aviso", async ({ page }) => {
  await page.goto(`/explorar?llegada=${addDays(today, 2)}&salida=${addDays(today, 6)}`);
  await expect(results(page)).toHaveText("2 casas");
  await expect(price(page, "Casa Almendro")).toHaveText("₡45 000 / noche");

  await page.goto("/explorar?noches=91");
  await expect(results(page)).toHaveText("2 casas");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("la hoja de contacto redacta el mensaje con las noches de la búsqueda", async ({ page }) => {
  await page.goto("/explorar?noches=4&ppl=2");
  await page.getByRole("link", { name: /^Casa Almendro/ }).click();
  await page.getByRole("button", { name: "Contactar por WhatsApp" }).first().click();
  await expect(page.getByTestId("contact-message")).toHaveText("Hola, vi Casa Almendro en 3bstays y me interesa. ¿Está disponible para 4 noches y 2 personas? Gracias.");
});

// Opción B de Ana (2026-11-17): «Fechas | Número de noches», una cosa u otra.
test("en la hoja de contacto se elige entre fechas y número de noches; con noches, el mensaje las dice y no hay fechas", async ({ page }) => {
  await page.goto("/explorar?noches=4&ppl=2");
  await page.getByRole("link", { name: /^Casa Almendro/ }).click();
  await page.getByRole("button", { name: "Contactar por WhatsApp" }).first().click();
  const sheet = page.getByRole("dialog");
  const stay = sheet.getByRole("group", { name: "Cómo indicar la estancia" });
  const message = sheet.getByTestId("contact-message");
  // Llegan noches de la búsqueda y ninguna fecha: abre en noches, sin las casillas de llegada y salida.
  await expect(stay.getByRole("button", { name: "Número de noches" })).toHaveAttribute("aria-pressed", "true");
  await expect(sheet.getByRole("button", { name: /^Llegada/ })).toHaveCount(0);
  await sheet.getByRole("group", { name: "Atajos de noches" }).getByRole("button", { name: "1 semana" }).click();
  await expect(message).toHaveText("Hola, vi Casa Almendro en 3bstays y me interesa. ¿Está disponible para 7 noches y 2 personas? Gracias.");
  await sheet.getByRole("button", { name: "Una noche más" }).click();
  await expect(message).toContainText("para 8 noches y 2 personas");

  // Con fechas, las noches se quitan y vuelven las casillas.
  await stay.getByRole("button", { name: "Fechas" }).click();
  await expect(stay.getByRole("button", { name: "Fechas" })).toHaveAttribute("aria-pressed", "true");
  await expect(sheet.getByRole("button", { name: /^Llegada/ })).toBeVisible();
  await expect(message).toHaveText("Hola, vi Casa Almendro en 3bstays y me interesa. ¿Está disponible para 2 personas? Gracias.");
  await stay.getByRole("button", { name: "Número de noches" }).click();
  await expect(sheet.locator(".contact-nights .num")).toHaveText("–");
});

test("en escritorio, el campo «Noches» abre su panel (diferido) y aplica las noches", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/explorar");
  await page.getByRole("button", { name: "Noches", exact: true }).click();
  const panel = page.getByRole("region", { name: "Noches" });
  await expect(panel.getByRole("button", { name: "Aplicar noches" })).toBeDisabled();
  await panel.getByRole("button", { name: "1 semana" }).click();
  await panel.getByRole("button", { name: "Aplicar noches" }).click();
  await expect(page).toHaveURL(/noches=7/);
  await expect(price(page, "Casa Almendro")).toHaveText("≈ ₡315 000 por 7 noches");
});
