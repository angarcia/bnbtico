import { expect, test, type Page, type Route } from "./helpers/test";
import { serviceClient } from "../db/local";
import { postgrestHarness } from "../db/postgrest-harness";
import { injectSession } from "./helpers/session";

// Zonas con sugerencias y zoom del mapa (ticket 22), con Photon interceptado (nada sale a la red). iPhone SE: el paso 2
// sigue sin scroll con la fila de zonas frecuentes, con y sin teclado.
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
let h: Awaited<ReturnType<typeof postgrestHarness>>;
let id: string;
let photon: URL[];
let zooms: number[];

test.use({ viewport: { width: 375, height: 667 } });

const feature = (name: string, county: string, state: string, lng: number, lat: number) => ({
  type: "Feature",
  properties: { name, county, state, country: "Costa Rica", countrycode: "CR", osm_key: "place", osm_value: "hamlet" },
  geometry: { type: "Point", coordinates: [lng, lat] },
});
const ANSWERS: Record<string, object[]> = {
  Coc: [feature("Coco", "Carrillo", "Guanacaste", -85.7, 10.55)],
  Cocles: [feature("Cocles", "Osa", "Puntarenas", -83.6, 8.9), feature("Cocles", "Talamanca", "Limón", -82.7305611, 9.6437829)],
};

test.beforeAll(async () => {
  h = await postgrestHarness();
});

test.beforeEach(async ({ page }) => {
  await h.reset();
  // Borrador con los pasos 1 y 2 sin zona ni pin.
  id = (await h.seed({ status: "draft", draft: { zone: "", lat: null, lng: null, canton: "Talamanca" } })).id;
  photon = [];
  zooms = [];
  await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
  await page.route("https://tile.openstreetmap.org/**", (route) => {
    zooms.push(Number(new URL(route.request().url()).pathname.split("/")[1]));
    return route.fulfill({ body: TILE, contentType: "image/png" });
  });
  await injectSession(page, "owner");
});

/** Photon falso: responde según `q` (con `slow` tarda en responder esa consulta). */
function fakePhoton(page: Page, slow: string | null = null) {
  return page.route("https://photon.komoot.io/**", async (route: Route) => {
    const url = new URL(route.request().url());
    photon.push(url);
    const q = url.searchParams.get("q") ?? "";
    if (q === slow) await new Promise((r) => setTimeout(r, 900));
    await route.fulfill({ json: { type: "FeatureCollection", features: ANSWERS[q] ?? [] }, headers: { "access-control-allow-origin": "*" } });
  });
}

async function expectNoScroll(page: Page, what: string) {
  const [scrollH, innerH] = await page.evaluate(() => [document.documentElement.scrollHeight, window.innerHeight]);
  expect(scrollH, `${what} hace scroll: ${scrollH} > ${innerH}`).toBeLessThanOrEqual(innerH);
}

const zone = (page: Page) => page.getByRole("combobox", { name: "Zona, playa o barrio" });
const savedZone = async () => (await serviceClient().from("listings").select("zone").eq("id", id).single()).data?.zone;

test("sugerencias de Photon con espera entre teclas, la vieja se descarta, se elige y el mapa abre con zoom en la zona", async ({ page }) => {
  await fakePhoton(page, "Coc");
  await page.goto(`/propietario/publicar/${id}/2`);
  await expect(page.getByText("Paso 2 de 9")).toBeVisible();
  await expectNoScroll(page, "paso 2");
  await expect(page.getByRole("group", { name: "Zonas frecuentes" }).getByRole("button")).toHaveText(["Puerto Viejo", "Playa Negra", "Cocles", "Playa Chiquita", "Punta Uva", "Manzanillo", "Cahuita", "Limón centro", "Otra"]);

  // Menos de 3 caracteres: nada. Teclas seguidas: una sola petición.
  await zone(page).pressSequentially("Co", { delay: 40 });
  await page.waitForTimeout(400);
  expect(photon).toHaveLength(0);
  await zone(page).pressSequentially("c", { delay: 40 });
  await expect.poll(() => photon.length).toBe(1);
  const first = photon[0]!;
  expect(first.searchParams.get("q")).toBe("Coc");
  expect(first.searchParams.get("bbox")).toBe("-86,8,-82.5,11.3");
  expect(first.searchParams.getAll("osm_tag")).toEqual(["place", "natural:beach"]);
  // La respuesta de «Coc» tarda; mientras, se sigue escribiendo: gana la última consulta.
  await zone(page).pressSequentially("les", { delay: 40 });
  const list = page.getByRole("listbox", { name: "Zonas sugeridas" });
  await expect(list.getByRole("option")).toHaveText(["CoclesTalamanca, Limón", "CoclesOsa, Puntarenas"]);
  await page.waitForTimeout(900);
  await expect(list.getByRole("option")).toHaveCount(2);
  await expect(list).not.toContainText("Coco");

  // Con el teclado: flecha abajo + Enter elige sin enviar el paso.
  await zone(page).press("ArrowDown");
  await zone(page).press("Enter");
  await expect(zone(page)).toHaveValue("Cocles");
  await expect(list).toBeHidden();
  await expect(page).toHaveURL(/\/2$/);
  await expect(page.getByRole("group", { name: "Zonas frecuentes" }).getByRole("button", { name: "Cocles" })).toHaveAttribute("aria-pressed", "true");
  await zone(page).press("Enter");
  await expect(page).toHaveURL(/\/3$/);
  await expect.poll(savedZone).toBe("Cocles");
  // Zoom 15 en Cocles de Talamanca (no en la provincia, zoom 9).
  await expect.poll(() => zooms.length).toBeGreaterThan(0);
  expect(new Set(zooms)).toEqual(new Set([15]));
  await page.locator(".leaflet-container").click({ position: { x: 150, y: 120 } });
  const lat = Number(await page.locator('input[name="lat"]').inputValue());
  expect(lat).toBeGreaterThan(9.6);
  expect(lat).toBeLessThan(9.7);
});

test("tocar una zona frecuente la escribe y centra el mapa; «Otra» deja escribir y el mapa abre en la provincia; con Photon caído todo sigue", async ({ page }) => {
  await page.route("https://photon.komoot.io/**", (route) => {
    photon.push(new URL(route.request().url()));
    return route.abort("failed");
  });
  await page.goto(`/propietario/publicar/${id}/2`);
  await page.getByRole("button", { name: "Punta Uva" }).click();
  await expect(zone(page)).toHaveValue("Punta Uva");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/3$/);
  await expect.poll(() => zooms.length).toBeGreaterThan(0);
  expect(new Set(zooms)).toEqual(new Set([15]));
  await expect.poll(savedZone).toBe("Punta Uva");

  await page.getByRole("button", { name: "Atrás" }).or(page.getByRole("link", { name: "Atrás" })).first().click();
  await expect(page).toHaveURL(/\/2$/);
  await expect(zone(page)).toHaveValue("Punta Uva");
  await page.getByRole("button", { name: "Otra" }).click();
  await expect(zone(page)).toHaveValue("");
  await expect(zone(page)).toBeFocused();
  await zone(page).pressSequentially("Cerca del río Cocles", { delay: 10 });
  await expect.poll(() => photon.length).toBeGreaterThan(0);
  await expect(page.getByRole("listbox", { name: "Zonas sugeridas" })).toBeHidden();
  zooms = [];
  await zone(page).press("Enter");
  await expect(page).toHaveURL(/\/3$/);
  await expect.poll(savedZone).toBe("Cerca del río Cocles");
  await expect.poll(() => zooms.length).toBeGreaterThan(0);
  expect(new Set(zooms)).toEqual(new Set([9]));
});

test("tocar una sugerencia la elige (el campo no pierde el foco antes del toque)", async ({ page }) => {
  await fakePhoton(page);
  await page.goto(`/propietario/publicar/${id}/2`);
  await zone(page).pressSequentially("Cocles", { delay: 20 });
  const option = page.getByRole("listbox", { name: "Zonas sugeridas" }).getByRole("option", { name: /Osa, Puntarenas/ });
  await option.tap();
  await expect(zone(page)).toHaveValue("Cocles");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/3$/);
  // El centro es el de la sugerencia tocada (Cocles de Osa), no el de la zona frecuente con el mismo nombre.
  await page.locator(".leaflet-container").click({ position: { x: 150, y: 120 } });
  const lat = Number(await page.locator('input[name="lat"]').inputValue());
  expect(lat).toBeGreaterThan(8.85);
  expect(lat).toBeLessThan(8.95);
});
