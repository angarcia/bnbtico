import { expect, test, type Page } from "./helpers/test";
import type { Seeded } from "../contract/harness";
import { sql } from "../db/local";
import { postgrestHarness } from "../db/postgrest-harness";

// El mapa de Explorar (maquetas v2 01 y 05): el primer elemento de la lista con los precios, «Mapa» al bajar, el mapa a
// pantalla completa con «8 casas» para volver y la tarjeta de la casa al tocar su marcador. Teselas falsas.
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
const COCO = "Casa Coco";
let coco: Seeded;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const h = await postgrestHarness();
  await h.reset();
  // Ocho casas tierra adentro a lo largo de la costa de Talamanca, a unos 3 km entre una y otra: los marcadores no se tapan.
  const houses: [number, number, number][] = [
    [9.73, -82.85, 55000],
    [9.7, -82.83, 38000],
    [9.66, -82.79, 29000],
    [9.645, -82.765, 68000],
    [9.635, -82.74, 95000],
    [9.625, -82.71, 48000],
    [9.62, -82.68, 35000],
  ];
  for (const [i, [lat, lng, price]] of houses.entries()) {
    await h.seed({ status: "active", draft: { title: `Cabina ${i + 1}`, zone: "Cocles", zoneSource: "other", zoneId: null, lat, lng, nightlyPriceCrc: price } });
  }
  coco = await h.seed({ status: "active", draft: { title: COCO, zone: "Cocles", zoneSource: "other", zoneId: null, lat: 9.615, lng: -82.66, nightlyPriceCrc: 42000 } });
});

test.beforeEach(async ({ page }) => {
  await page.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
  await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
});

const mapBox = (page: Page) => page.getByTestId("explore-map");
const mapLabel = (page: Page) => page.getByRole("button", { name: "Mapa", exact: true });
const countPill = (page: Page) => page.getByRole("button", { name: "8 casas", exact: true });

test("el mapa es el primer elemento de la lista y lleva precios", async ({ page }) => {
  await page.goto("/explorar");
  await expect(page.locator(".listing-grid > :first-child")).toHaveAttribute("data-testid", "explore-map");
  const box = await mapBox(page).boundingBox();
  expect(Math.abs(box!.height - 220)).toBeLessThanOrEqual(1);
  await expect(mapBox(page)).toHaveAttribute("aria-label", "Abrir el mapa de las casas");
  await expect(mapBox(page).locator(".map-price")).toHaveCount(8);
  await expect(mapBox(page).getByText("₡42 000", { exact: true })).toBeVisible();
  await expect(mapBox(page).getByText("₡42 000", { exact: true })).toHaveAttribute("title", COCO);
  await expect(mapBox(page).locator(".leaflet-control-attribution")).toBeVisible();
  // El mapa pequeño no se arrastra ni hace zoom: la página baja con el dedo.
  await expect(mapBox(page).locator(".leaflet-control-zoom")).toHaveCount(0);
});

test("al bajar aparece «Mapa»; a pantalla completa «8 casas»; un marcador muestra su casa; Atrás cierra y conserva el scroll", async ({ page }) => {
  await page.goto("/explorar");
  await expect(mapBox(page).locator(".map-price")).toHaveCount(8);
  await expect(mapLabel(page)).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 600));
  await expect(mapLabel(page)).toBeVisible();
  let searches = 0;
  page.on("request", (r) => {
    if (r.url().includes("rpc/search_listings")) searches++;
  });

  await mapLabel(page).click();
  await expect(page).toHaveURL(/[?&]mapa=1/);
  await expect(countPill(page)).toBeVisible();
  const full = page.locator(".map-full");
  await expect(full.locator(".map-price")).toHaveCount(8);
  await expect(full.getByRole("button", { name: "Volver a la lista" })).toBeFocused();
  // La lista de debajo no se enfoca ni se lee mientras el mapa está abierto.
  expect(await page.locator(".listing-grid").evaluate((el) => (el as HTMLElement).inert)).toBe(true);
  await expect(full.locator(".search-pill")).toBeVisible();
  await expect(mapLabel(page)).toHaveCount(0);

  const marker = full.locator(".map-price", { hasText: "₡42 000" });
  await marker.click();
  await expect(marker).toHaveClass(/is-selected/);
  const card = full.getByRole("link", { name: new RegExp(COCO) });
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute("href", `/casa/${coco.publicId}`);
  await expect(full.locator(".map-card")).toContainText("₡42 000 / noche");
  // Tocar el mapa en otro sitio quita la tarjeta.
  await full.locator(".leaflet-container").click({ position: { x: 20, y: 200 } });
  await expect(full.locator(".map-card")).toHaveCount(0);
  await expect(marker).not.toHaveClass(/is-selected/);

  await page.goBack();
  await expect(page.locator(".map-full")).toHaveCount(0);
  await expect(mapLabel(page)).toBeFocused();
  expect(await page.locator(".listing-grid").evaluate((el) => (el as HTMLElement).inert)).toBe(false);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThanOrEqual(598);
  expect(Math.abs((await page.evaluate(() => scrollY)) - 600)).toBeLessThanOrEqual(2);
  expect(searches).toBe(0);

  await page.evaluate(() => window.scrollTo(0, 0));
  await mapBox(page).click();
  await expect(page).toHaveURL(/[?&]mapa=1/);
  await countPill(page).click();
  await expect(page.locator(".map-full")).toHaveCount(0);
  await expect(page).not.toHaveURL(/mapa=1/);
  await expect(mapBox(page)).toBeFocused();
});

test("con teclado: Intro abre el mapa y, sobre un marcador, muestra su casa", async ({ page }) => {
  await page.goto("/explorar");
  await expect(mapBox(page).locator(".map-price")).toHaveCount(8);
  await mapBox(page).press("Enter");
  const marker = page.locator(".map-full .map-price", { hasText: "₡42 000" });
  await marker.focus();
  await marker.press("Enter");
  await expect(page.locator(".map-full").getByRole("link", { name: new RegExp(COCO) })).toBeVisible();
  await page.locator(".map-full .map-price", { hasText: "₡55 000" }).press(" ");
  await expect(page.locator(".map-full").getByRole("link", { name: /Cabina 1/ })).toBeVisible();
});

test("un marcador del mapa pequeño abre el mapa grande con su casa; sin historial, «8 casas» vuelve a la lista", async ({ page }) => {
  await page.goto("/explorar");
  // En la caja pequeña los marcadores del medio se solapan: el toque va directo al de ₡68 000.
  await mapBox(page).locator(".map-price", { hasText: "₡68 000" }).dispatchEvent("click");
  await expect(page).toHaveURL(/[?&]mapa=1/);
  await expect(page.locator(".map-full").getByRole("link", { name: /Cabina 4/ })).toBeVisible();
  await expect(page.locator(".map-full .map-price.is-selected")).toHaveText("₡68 000");
  // Abierto desde un enlace (sin entrada anterior en la app): «8 casas» sustituye la entrada.
  await page.goto("/explorar?mapa=1");
  await expect(countPill(page)).toBeVisible();
  await countPill(page).click();
  await expect(page.locator(".map-full")).toHaveCount(0);
  await expect(page).toHaveURL(/\/explorar$/);
});

test("sin red para el mapa, la caja se queda y la lista funciona", async ({ page }) => {
  await page.route("**/assets/explore-map-leaflet-*.js", (r) => r.abort());
  await page.route("**/assets/leaflet-*.js", (r) => r.abort());
  const aborted = page.waitForEvent("requestfailed", (r) => /\/assets\/(explore-map-)?leaflet-/.test(r.url()));
  await page.goto("/explorar");
  await expect(page.locator(".listing-grid:not(.skeleton) .listing-card")).toHaveCount(8);
  await expect(mapBox(page)).toBeVisible();
  await aborted;
  await expect(mapBox(page).locator(".leaflet-container")).toHaveCount(0);
  await expect(mapBox(page)).toHaveText("");
  const first = page.locator(".listing-grid .listing-card").first();
  await expect(first).toBeVisible();
  await first.click();
  await expect(page).toHaveURL(/\/casa\/CT-/);
});

test("telemetría: se cuentan la apertura del mapa y el toque en un marcador", async ({ page }) => {
  const since = sql("select now()::text");
  await page.goto("/explorar");
  await expect(mapBox(page).locator(".map-price")).toHaveCount(8);
  await mapBox(page).press("Enter");
  await page.locator(".map-full .map-price", { hasText: "₡42 000" }).click();
  await expect(page.locator(".map-full .map-card")).toBeVisible();
  const events = () => sql(`select string_agg(name || ':' || coalesce(listing_public_id, '-'), ',' order by name) from public.events where created_at >= '${since}' and name in ('explore_map_open', 'map_marker_tap')`);
  await expect.poll(events).toBe(`explore_map_open:-,map_marker_tap:${coco.publicId}`);
});
