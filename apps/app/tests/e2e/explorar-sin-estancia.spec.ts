import { expect, test, type Page } from "./helpers/test";
import { onlySearchMode } from "./helpers/flags";
import { addDays, costaRicaToday } from "../../src/domain/dates";
import { COCLES } from "../contract/points";
import { postgrestHarness } from "../db/postgrest-harness";

// Explorar sin estancia (historia #64, escenario C de la matriz de feature flags): fechas y número de noches apagados. Solo
// con un build en ese modo (FLAG_EXPLORAR_FECHAS=false FLAG_EXPLORAR_NOCHES=false); CI no tiene ese build y la salta.
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
const today = costaRicaToday(Date.now());
const cocles = { ...COCLES, zone: "Cocles", zoneSource: "list" as const, zoneId: "704-cocles", capacity: 4 };

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const h = await postgrestHarness();
  await h.reset();
  await h.seed({ status: "active", draft: { ...cocles, title: "Casa Almendro", nightlyPriceCrc: 45_000 } });
});

test.beforeEach(async ({ page }) => {
  onlySearchMode("none");
  await page.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
  await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
});

const price = (page: Page) => page.getByRole("link", { name: /^Casa Almendro/ }).locator(".card-price");

test("la búsqueda solo tiene «¿Dónde?» y «¿Quiénes?», y las tarjetas dicen el precio por noche", async ({ page }) => {
  await page.goto("/explorar/buscar?abrir=quienes");
  await expect(page.getByRole("heading", { name: "¿Dónde?" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "¿Quiénes?" })).toBeVisible();
  await expect(page.getByText("¿Cuándo?")).toHaveCount(0);
  await expect(page.getByText("¿Cuántas noches?")).toHaveCount(0);
  await expect(page.getByText("Las personas van en el mensaje de WhatsApp que le preparamos para el anfitrión.")).toBeVisible();
  await page.goto("/explorar");
  await expect(price(page)).toHaveText("₡45 000 / noche");
});

test("ni fechas ni noches de un enlace viejo filtran o cambian el precio", async ({ page }) => {
  await page.goto(`/explorar?llegada=${addDays(today, 2)}&salida=${addDays(today, 6)}&noches=4`);
  await expect(page.getByTestId("results-count")).toHaveText("1 casa");
  await expect(price(page)).toHaveText("₡45 000 / noche");
  await page.goto("/explorar/filtros");
  await expect(page.getByText("Sin fechas")).toHaveCount(0);
  await expect(page.getByText("Sin noches")).toHaveCount(0);
});
