import { expect, test, type Page } from "@playwright/test";
import type { Seeded } from "../contract/harness";
import { postgrestHarness } from "../db/postgrest-harness";

// Explorar y Filtros en el navegador (pantallas 01 y 02), contra Supabase local.
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
let manzanillo: Seeded;
let ultima: Seeded;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const h = await postgrestHarness();
  await h.reset();
  await h.seed({ status: "draft", draft: { province: "Cartago", canton: "Turrialba", zone: "Turrialba", lat: 9.9, lng: -83.68 } });
  await h.seed({ status: "active", draft: { title: "Cabina Sámara", province: "Guanacaste", canton: "Nicoya", zone: "Sámara", lat: 9.88, lng: -85.53, capacity: 2, features: ["pool"], nightlyPriceCrc: 60000 } });
  ultima = await h.seed({ status: "active", draft: { title: "Casa Cocles 7", zone: "Cocles", capacity: 2, nightlyPriceCrc: 40000 } });
  for (let i = 6; i >= 1; i--) await h.seed({ status: "active", draft: { title: `Casa Cocles ${i}`, zone: "Cocles", capacity: 2, nightlyPriceCrc: 40000 + i * 1000 } });
  manzanillo = await h.seed({ status: "active", draft: { title: "Casa Manzanillo", zone: "Manzanillo", capacity: 5, acceptsMonthly: true, monthlyPriceCrc: 480000, nightlyPriceCrc: 85000, features: ["wifi", "beachfront"] } });
});

test.beforeEach(async ({ page }) => {
  await page.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
  await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
});

const results = (page: Page) => page.getByTestId("results-count");

test("Explorar arranca en Limón y Filtros solo ofrece provincias con casas", async ({ page }) => {
  await page.goto("/explorar");
  await expect(page.getByRole("heading", { level: 1, name: "¿Para dónde va?" })).toBeVisible();
  await expect(results(page)).toHaveText("8 casas en Limón");
  await expect(page.getByRole("link", { name: /Casa Manzanillo/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Cabina Sámara/ })).toHaveCount(0);
  await page.getByRole("link", { name: /Más filtros/ }).click();
  await expect(page).toHaveURL(/\/explorar\/filtros$/);
  await expect(page.getByRole("heading", { level: 1, name: "Filtros" })).toBeVisible();
  const zona = page.getByRole("group", { name: "Zona" });
  await expect(zona.getByRole("button")).toHaveText(["Todas", "Guanacaste", "Limón"]);
  await expect(page.getByRole("button", { name: "Ver 8 casas" })).toBeVisible();
});

test("Filtros cuenta en vivo, intercambia mínimo y máximo, y «Ver N casas» aplica y vuelve", async ({ page }) => {
  await page.goto("/explorar/filtros");
  const zona = page.getByRole("group", { name: "Zona" });
  await zona.getByRole("button", { name: "Todas" }).click();
  await expect(page.getByRole("button", { name: "Ver 9 casas" })).toBeVisible();
  await page.getByRole("button", { name: "Piscina", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ver 1 casa" })).toBeVisible();
  await page.getByRole("button", { name: "Piscina", exact: true }).click();
  await page.getByLabel("Personas").selectOption("4");
  await expect(page.getByRole("button", { name: "Ver 1 casa" })).toBeVisible();
  await page.getByLabel("Personas").selectOption("0");
  await page.getByLabel("Precio mínimo por noche").fill("50.000");
  await page.getByLabel("Precio máximo por noche").fill("44000");
  await expect(page.getByRole("button", { name: "Ver 3 casas" })).toBeVisible();
  await page.getByRole("button", { name: "Ver 3 casas" }).click();
  await expect(page).toHaveURL(/\/explorar\?prov=Todas&min=44000&max=50000$/);
  await expect(results(page)).toHaveText("3 casas");

  await page.getByRole("link", { name: /Más filtros/ }).click();
  await expect(page.getByLabel("Precio mínimo por noche")).toHaveValue("44000");
  await page.getByRole("link", { name: "Limpiar" }).click();
  await expect(page).toHaveURL(/\/explorar$/);
  await expect(results(page)).toHaveText("8 casas en Limón");
});

test("los chips rápidos cambian la URL y la URL restaura la pantalla", async ({ page }) => {
  await page.goto("/explorar");
  await page.getByRole("button", { name: "Mensual", exact: true }).click();
  await expect(page).toHaveURL(/modo=monthly/);
  await expect(results(page)).toHaveText("1 casa en Limón");
  await page.goto("/explorar?prov=Guanacaste&pool=1");
  await expect(results(page)).toHaveText("1 casa en Guanacaste");
  await expect(page.getByRole("button", { name: "Piscina", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("la moneda cambia al instante y se comparte con la ficha", async ({ page }) => {
  await page.goto("/explorar");
  await expect(page.getByRole("link", { name: /Casa Manzanillo/ })).toContainText("₡85 000");
  await page.getByRole("button", { name: "$ Dólares" }).click();
  await expect(page.getByRole("link", { name: /Casa Manzanillo/ })).toContainText("$167");
  await page.getByRole("link", { name: /Casa Manzanillo/ }).click();
  await expect(page).toHaveURL(new RegExp(`/casa/${manzanillo.publicId}$`));
  await expect(page.getByTestId("main-price")).toHaveText("$167 / noche");
  await page.getByRole("button", { name: "Ver en colones" }).click();
});

test("volver de una ficha deja Explorar en el mismo punto del scroll", async ({ page }) => {
  await page.goto("/explorar");
  const card = page.getByRole("link", { name: /Casa Cocles 7/ });
  await card.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => window.scrollY);
  expect(before).toBeGreaterThan(200);
  await card.click();
  await expect(page).toHaveURL(new RegExp(`/casa/${ultima.publicId}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Casa Cocles 7" })).toBeVisible();
  await page.goBack();
  await expect(card).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before - 40);
});

test("la segunda visita pinta desde la caché sin red, y la ficha se pinta desde la tarjeta", async ({ page }) => {
  await page.goto("/explorar");
  await expect(results(page)).toHaveText("8 casas en Limón");
  await page.waitForTimeout(1500); // la caché se guarda en IndexedDB con un pequeño retraso
  await page.route("**/rest/v1/**", (route) => route.abort());
  await page.reload();
  await expect(results(page)).toHaveText("8 casas en Limón");
  await page.getByRole("link", { name: /Casa Manzanillo/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Casa Manzanillo" })).toBeVisible();
  await expect(page.getByTestId("main-price")).toHaveText("₡85 000 / noche");
});

test("sin resultados lo dice, y las pestañas cambian sin red", async ({ page }) => {
  await page.goto("/explorar/filtros");
  await page.getByLabel("Personas").selectOption("6");
  await expect(page.getByRole("button", { name: "Ver 0 casas" })).toBeVisible();
  await page.getByRole("button", { name: "Ver 0 casas" }).click();
  await expect(page).toHaveURL(/\/explorar\?ppl=6$/);
  await expect(page.getByText("Sin resultados con esos filtros.")).toBeVisible();
  await page.goto("/explorar");
  await expect(results(page)).toHaveText("8 casas en Limón");

  await page.route("**/*", (route) => route.abort());
  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  await nav.getByRole("link", { name: "Favoritos" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Favoritos" })).toBeVisible();
  await nav.getByRole("link", { name: "Mi cuenta" }).click();
  // Sin sesión, Mi cuenta es Ingresar (sin barra inferior); se pinta sin red porque no descarga supabase-js.
  await expect(page.getByRole("heading", { level: 1, name: "Ingresar" })).toBeVisible();
  await page.getByRole("link", { name: "Volver" }).click();
  await expect(results(page)).toHaveText("8 casas en Limón");
});
