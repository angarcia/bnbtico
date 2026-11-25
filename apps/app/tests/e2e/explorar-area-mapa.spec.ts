import { expect, test, type Page, type Route } from "./helpers/test";
import { postgrestHarness } from "../db/postgrest-harness";

// Historia #96: al terminar de mover o acercar el mapa (escritorio y mapa completo del teléfono), la lista, los marcadores y
// el contador son los del área visible, con los mismos filtros. Una ráfaga de gestos es una sola búsqueda, los resultados no
// mueven el encuadre, el área va en la URL y, si falla, se conservan las casas de la búsqueda anterior.
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
// El Caribe Sur con margen de sobra para el desplazamiento del punto público (hasta 500 m).
const CARIBE = "-82.95,9.55,-82.6,9.85";

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const h = await postgrestHarness();
  await h.reset();
  await h.seed({ status: "active", draft: { title: "Casa Cocles", zone: "Cocles", zoneSource: "other", zoneId: null, lat: 9.645, lng: -82.735, features: ["wifi"] } });
  await h.seed({ status: "active", draft: { title: "Casa Manzanillo", zone: "Manzanillo", zoneSource: "other", zoneId: null, lat: 9.63, lng: -82.66, features: ["pool"] } });
  await h.seed({ status: "active", draft: { title: "Casa Cahuita", zone: "Cahuita", zoneSource: "other", zoneId: null, lat: 9.74, lng: -82.84, features: ["wifi"] } });
  await h.seed({ status: "active", draft: { province: "Guanacaste", canton: "Nicoya", title: "Casa Sámara", zone: "Sámara", zoneSource: "other", zoneId: null, lat: 9.88, lng: -85.53 } });
});

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
  await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
});

const count = (page: Page) => page.getByTestId("results-count");
const cards = (page: Page) => page.locator(".explore-results .listing-card h2");
const areaOfUrl = (page: Page) => new URL(page.url()).searchParams.get("area");
/** Las búsquedas que salen a la red (las que sirve la caché no cuentan). */
function searches(page: Page) {
  const seen: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("/rpc/search_listings")) seen.push(r.postData() ?? "");
  });
  return seen;
}
/** Las teselas a la vista (`z/x/y`): el mismo conjunto es el mismo encuadre y el mismo zoom. */
const tiles = (page: Page) =>
  page
    .getByTestId("explore-map")
    .locator(".leaflet-tile-loaded")
    .evaluateAll((els) => els.filter((el) => el.getBoundingClientRect().width > 0).map((el) => new URL((el as HTMLImageElement).src).pathname).sort());

test("al acercar el mapa busca el área una sola vez por ráfaga, sin mover el encuadre; la zona deja de filtrar", async ({ page }) => {
  await page.goto("/explorar?zona=704-cocles");
  await expect(count(page)).toContainText("en Cocles y alrededores");
  const sent = searches(page);
  const zoomIn = page.getByRole("button", { name: "Acercar mapa" });
  await zoomIn.click();
  await zoomIn.click();
  await zoomIn.click();
  await expect.poll(() => areaOfUrl(page)).not.toBeNull();
  await expect(count(page)).toContainText("en esta zona del mapa");
  // La zona deja de filtrar: no queda en la URL ni en el resumen.
  expect(new URL(page.url()).searchParams.get("zona")).toBeNull();
  await page.waitForTimeout(800);
  expect(sent).toHaveLength(1);
  expect(JSON.parse(sent[0]!)).toMatchObject({ p_west: expect.any(Number), p_north: expect.any(Number) });
  expect(JSON.parse(sent[0]!).p_zone).toBeUndefined();
  // La respuesta no reencuadra: el mapa se queda como lo dejó el viajero, y no sale otra búsqueda.
  const view = await tiles(page);
  await page.waitForTimeout(800);
  expect(await tiles(page)).toEqual(view);
  expect(sent).toHaveLength(1);
});

test("el área de la URL filtra lista, marcadores y contador; un filtro nuevo la conserva; volver de una ficha también", async ({ page }) => {
  await page.goto(`/explorar?area=${CARIBE}`);
  await expect(count(page)).toHaveText("3 casas en esta zona del mapa");
  await expect(cards(page)).toHaveCount(3);
  await expect(page.getByRole("heading", { name: "Casa Sámara" })).toHaveCount(0);
  // Un filtro sobre la misma área, sin reencuadrar.
  await page.getByRole("group", { name: "Qué necesitan" }).getByRole("button", { name: "Wifi", exact: true }).click();
  await expect(count(page)).toHaveText("2 casas en esta zona del mapa");
  expect(areaOfUrl(page)).toBe(CARIBE);
  // A la ficha y Atrás: la misma área y los mismos resultados.
  await cards(page).first().click();
  await expect(page).toHaveURL(/\/casa\/CT-/);
  await page.goBack();
  await expect(count(page)).toHaveText("2 casas en esta zona del mapa");
  expect(areaOfUrl(page)).toBe(CARIBE);
});

test("un área sin casas vacía la lista sin recentrar ni quitar filtros", async ({ page }) => {
  await page.goto("/explorar?area=-84.2,10.0,-84.1,10.1&wifi=1");
  await expect(count(page)).toHaveText("0 casas en esta zona del mapa");
  await expect(cards(page)).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get("wifi")).toBe("1");
  expect(areaOfUrl(page)).toBe("-84.2,10,-84.1,10.1");
});

test("una respuesta vieja no pisa la del área más reciente", async ({ page }) => {
  await page.goto("/explorar");
  await expect(count(page)).toHaveText("4 casas");
  // La primera área tarda; la segunda llega antes. Al final, se ve la segunda.
  let first: Route | null = null;
  await page.route("**/rpc/search_listings**", async (route) => {
    if (!first && route.request().method() === "POST") {
      first = route;
      return;
    }
    await route.fallback();
  });
  await page.getByRole("button", { name: "Acercar mapa" }).click();
  await expect.poll(() => first !== null).toBe(true);
  const firstArea = areaOfUrl(page);
  await page.getByRole("button", { name: "Alejar mapa" }).click();
  await page.getByRole("button", { name: "Alejar mapa" }).click();
  await expect.poll(() => areaOfUrl(page)).not.toBe(firstArea);
  await expect(count(page)).toContainText("en esta zona del mapa");
  const latest = await count(page).textContent();
  await (first as Route | null)?.fallback();
  await page.waitForTimeout(800);
  await expect(count(page)).toHaveText(latest!);
});

test("si falla la búsqueda del área, siguen las casas anteriores con un aviso y «Reintentar»", async ({ page }) => {
  await page.goto(`/explorar?area=${CARIBE}`);
  await expect(cards(page)).toHaveCount(3);
  let down = true;
  await page.route("**/rpc/search_listings**", (route) => (down && route.request().method() === "POST" ? route.abort() : route.fallback()));
  await page.getByRole("button", { name: "Alejar mapa" }).click();
  const stale = page.getByText("No pudimos actualizar las casas. Se ven las de la búsqueda anterior.");
  await expect(stale).toBeVisible({ timeout: 15_000 });
  await expect(cards(page)).toHaveCount(3);
  down = false;
  await page.getByRole("button", { name: "Reintentar" }).click();
  await expect(stale).toHaveCount(0);
  await expect(count(page)).toContainText("en esta zona del mapa");
});

test("teléfono: el mapa completo busca al moverlo y sigue abierto; el área queda en la URL", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/explorar?mapa=1");
  const box = page.locator(".map-full-box");
  await expect(page.getByRole("button", { name: /Ver lista · 4 casas/ })).toBeVisible();
  const b = (await box.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.wheel(0, -400);
  await expect.poll(() => areaOfUrl(page)).not.toBeNull();
  expect(new URL(page.url()).searchParams.get("mapa")).toBe("1");
  await expect(page.locator(".map-full")).toBeVisible();
  await expect(page.locator(".search-pill-text").first()).toHaveText("Zona del mapa");
});
