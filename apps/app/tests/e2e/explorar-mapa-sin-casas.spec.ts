import { expect, test, type Page } from "./helpers/test";
import { postgrestHarness } from "../db/postgrest-harness";

// Revisión de la app 2026-11-17, historia 05: en escritorio, con filtros que dejan cero casas, el mapa se quedaba sin
// cartografía (solo los controles y la atribución). Al pasar de casas a ninguna (o al revés), Leaflet se rehacía sin vista.
// Teselas falsas servidas aquí: su URL dice el zoom y la posición, y un fallo de red se puede provocar a propósito.
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
const COCLES = "/explorar?zona=704-cocles";

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const h = await postgrestHarness();
  await h.reset();
  // Dos casas en Cocles, cada una con una sola característica: «Wifi» y «Parqueo» juntas no dejan ninguna.
  await h.seed({ status: "active", draft: { title: "Casa Wifi", zone: "Cocles", zoneSource: "other", zoneId: null, lat: 9.645, lng: -82.735, features: ["wifi"] } });
  await h.seed({ status: "active", draft: { title: "Casa Parqueo", zone: "Cocles", zoneSource: "other", zoneId: null, lat: 9.64, lng: -82.72, features: ["parking"] } });
});

let tilesDown = false;
test.beforeEach(async ({ page }) => {
  tilesDown = false;
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.route("https://tile.openstreetmap.org/**", (route) => (tilesDown ? route.abort() : route.fulfill({ body: TILE, contentType: "image/png" })));
});

const mapBox = (page: Page) => page.getByTestId("explore-map");
const pins = (page: Page) => mapBox(page).locator(".leaflet-marker-pane .map-price");
const chip = (page: Page, name: string) => page.getByRole("group", { name: "Qué necesitan" }).getByRole("button", { name, exact: true });
const empty = (page: Page) => page.getByRole("heading", { name: "No hay casas con esos filtros" });
/** Las teselas a la vista (`z/x/y`), ordenadas: el mismo conjunto es el mismo encuadre y el mismo zoom. */
const tiles = (page: Page) =>
  mapBox(page)
    .locator(".leaflet-tile-loaded")
    .evaluateAll((els) =>
      els
        .filter((el) => el.isConnected && el.getBoundingClientRect().width > 0)
        .map((el) => new URL((el as HTMLImageElement).src).pathname.slice(1, -4))
        .sort(),
    );
const zooms = async (page: Page) => [...new Set((await tiles(page)).map((t) => t.split("/")[0]))];

test("de casas a ninguna por filtros: el mapa conserva teselas, encuadre y zoom, sin marcadores; al quitarlos vuelven", async ({ page }) => {
  await page.goto(COCLES);
  await expect(pins(page)).toHaveCount(2);
  await expect.poll(() => tiles(page).then((t) => t.length)).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: "Acercar mapa" })).toBeEnabled();

  await chip(page, "Wifi").click();
  await expect(pins(page)).toHaveCount(1);
  // El encuadre de esa casa, ya asentado.
  let before: string[] = [];
  await expect(async () => {
    before = await tiles(page);
    await page.waitForTimeout(300);
    expect(before.length).toBeGreaterThan(0);
    expect(await tiles(page)).toEqual(before);
  }).toPass();
  await chip(page, "Parqueo").click();
  await expect(empty(page)).toBeVisible();
  await expect(pins(page)).toHaveCount(0);
  await expect.poll(() => tiles(page)).toEqual(before);

  // Los controles siguen: acercar cambia el zoom de las teselas; ampliar agranda la caja.
  const zoom = Number((await zooms(page))[0]);
  await page.getByRole("button", { name: "Acercar mapa" }).click();
  // Leaflet puede tener aún las teselas del zoom anterior mientras anima: basta con que aparezcan las del siguiente.
  await expect.poll(() => zooms(page)).toContain(String(zoom + 1));
  const width = (await mapBox(page).boundingBox())!.width;
  await page.getByRole("button", { name: "Ampliar mapa" }).click();
  await expect.poll(async () => (await mapBox(page).boundingBox())!.width).toBeGreaterThan(width);
  await expect.poll(() => tiles(page).then((t) => t.length)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Reducir mapa" }).click();

  // Sin recargar la página: se marca la ventana y la marca sigue al volver las casas.
  await page.evaluate(() => ((window as unknown as { sinRecargar: boolean }).sinRecargar = true));
  await page.getByRole("button", { name: "Quitar filtros" }).click();
  await expect(pins(page)).not.toHaveCount(0);
  await expect.poll(() => tiles(page).then((t) => t.length)).toBeGreaterThan(0);
  expect(await page.evaluate(() => (window as unknown as { sinRecargar?: boolean }).sinRecargar)).toBe(true);
});

test("una búsqueda que ya abre sin casas enseña el mapa de la zona y el aviso; al quitar un filtro salen los marcadores", async ({ page }) => {
  await page.goto(`${COCLES}&wifi=1&parking=1`);
  await expect(empty(page)).toBeVisible();
  await expect.poll(() => tiles(page).then((t) => t.length)).toBeGreaterThan(0);
  await expect(pins(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Acercar mapa" })).toBeEnabled();
  await chip(page, "Parqueo").click();
  await expect(pins(page)).toHaveCount(1);
  await expect.poll(() => tiles(page).then((t) => t.length)).toBeGreaterThan(0);
});

test("sin red para las teselas no sale «No hay casas»: siguen las casas y, con red, el mapa se recupera al moverlo", async ({ page }) => {
  tilesDown = true;
  await page.goto(COCLES);
  await expect(pins(page)).toHaveCount(2);
  await expect(empty(page)).toHaveCount(0);
  expect(await tiles(page)).toEqual([]);
  tilesDown = false;
  await page.getByRole("button", { name: "Alejar mapa" }).click();
  await expect.poll(() => tiles(page).then((t) => t.length)).toBeGreaterThan(0);
});
