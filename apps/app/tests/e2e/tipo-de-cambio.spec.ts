import { expect, test, type Page } from "./helpers/test";
import type { Seeded } from "../contract/harness";
import { sql } from "../db/local";
import { postgrestHarness } from "../db/postgrest-harness";

// Tipo de cambio diario (ticket 21): con un tipo sembrado distinto de 510, Explorar, Filtros y la ficha del servidor
// convierten con él y dicen de qué día es. La atribución solo sale si la fuente la exige, y nunca en la ficha.
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
let casa: Seeded;

const putRate = (crc: number, day: string, source: string) =>
  sql(`insert into public.fx_rates (day, crc_per_usd, source) values ('${day}', ${crc}, '${source}') on conflict (day) do update set crc_per_usd = excluded.crc_per_usd, source = excluded.source`);
const resetRates = () => sql("delete from public.fx_rates where source <> 'constante'");

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  resetRates();
  // ₡95 000 a ₡400 por dólar = $238 (con la constante de antes, $186). El tipo va antes de la casa: la ficha nueva no
  // está en la caché del worker con otro tipo.
  putRate(400, "2026-11-02", "exchangerate-api");
  const h = await postgrestHarness();
  await h.reset();
  casa = await h.seed({ status: "active", photos: 5, draft: { title: "Casa Playa Negra", zone: "Playa Negra", zoneSource: "other", zoneId: null, nightlyPriceCrc: 95000 } });
});

test.afterAll(() => resetRates());

test.beforeEach(async ({ page }) => {
  await page.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
  await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
});

function watch(page: Page) {
  const problems: string[] = [];
  page.on("console", (msg) => {
    if (msg.text().includes("Service Worker registration blocked by Playwright")) return;
    if (msg.type() === "error" || msg.type() === "warning") problems.push(`${msg.type()}: ${msg.text()}`);
  });
  page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
  return problems;
}

const usd = (page: Page) => page.addInitScript(() => localStorage.setItem("bnbtico_currency", "USD"));

test("Explorar y Filtros en dólares usan el tipo sembrado, con su día y la atribución al final de la nota", async ({ page }) => {
  await usd(page);
  await page.goto("/explorar");
  await expect(page.getByRole("link", { name: /Casa Playa Negra/ })).toContainText("$238");
  const note = page.getByTestId("usd-note");
  await expect(note).toContainText("≈ ₡400 por US$1 (tipo de referencia del 2 nov.).");
  await expect(note).toContainText(/colones\. · Rates By Exchange Rate API$/);
  await expect(note.getByRole("link", { name: "Rates By Exchange Rate API" })).toHaveAttribute("href", "https://www.exchangerate-api.com");

  await page.getByRole("link", { name: /^Filtros/ }).click();
  await expect(page.locator("#f-price-help")).toContainText("≈ ₡400 por US$1 (tipo de referencia del 2 nov.).");
  await page.getByLabel("Precio mínimo por noche").fill("200");
  await page.getByLabel("Precio máximo por noche").fill("250");
  await page.getByRole("button", { name: "Ver 1 casa" }).click();
  // $200 y $250 a ₡400 = ₡80 000 y ₡100 000 (la búsqueda va en colones).
  await expect(page).toHaveURL(/min=80000&max=100000/);
  await page.getByRole("link", { name: /^Filtros/ }).click();
  await expect(page.getByLabel("Precio mínimo por noche")).toHaveValue("200");
});

test("la ficha del servidor convierte con el tipo vigente, hidrata sin avisos y no lleva atribución", async ({ page }) => {
  const problems = watch(page);
  await page.goto(`/casa/${casa.publicId}`);
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  await expect(page.getByTestId("price-usd")).toHaveText("≈ $238 / noche");
  await expect(page.getByTestId("price-usd")).toHaveAttribute("title", "Orientativo: ≈ ₡400 por US$1, tipo de referencia del 2 nov.");
  await expect(page.getByText("Exchange Rate API")).toHaveCount(0);
  // En dólares desde el principio: la ficha no sigue la moneda, así que el servidor y la hidratación pintan lo mismo.
  await page.evaluate(() => localStorage.setItem("bnbtico_currency", "USD"));
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  await expect(page.getByTestId("main-price")).toHaveText("₡95 000 / noche");
  await expect(page.getByTestId("price-usd")).toHaveText("≈ $238 / noche");
  expect(problems, problems.join("\n")).toEqual([]);
});

test("con la fuente principal (sin atribución) no hay enlace en ningún sitio", async ({ page }) => {
  putRate(455.07, "2026-11-03", "fawazahmed0");
  await usd(page);
  await page.goto("/explorar");
  await expect(page.getByRole("link", { name: /Casa Playa Negra/ })).toContainText("$209");
  await expect(page.getByTestId("usd-note")).toHaveText("Dólares solo para orientarle: ≈ ₡455 por US$1 (tipo de referencia del 3 nov.). Los anfitriones fijan sus precios en colones.");
  await expect(page.getByTestId("usd-note").getByRole("link")).toHaveCount(0);
});
