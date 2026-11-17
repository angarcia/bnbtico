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
