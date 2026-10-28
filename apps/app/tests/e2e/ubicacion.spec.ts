import { expect, test, type Page } from "./helpers/test";
import { postgrestHarness } from "../db/postgrest-harness";
import type { LatLng } from "../../src/domain/geo";
import { injectSession } from "./helpers/session";

// Ubicación por punto (.scratch/ubicacion-por-punto): el paso 2 «¿Dónde está su casa?» une el mapa con el cantón y la zona.
// El pin manda: place_at y zones_near contra Supabase local (límites de OpenStreetMap y zonas cargadas); teselas y Photon
// interceptados (nada sale a la red). iPhone SE (375×667): la pantalla entera cabe sin scroll.
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
/** Puntos de las zonas «Cocles» y «Limón centro» de la tabla zones. */
const COCLES: LatLng = { lat: 9.643783, lng: -82.730561 };
const LIMON_CENTRO: LatLng = { lat: 9.993161, lng: -83.029761 };
let h: Awaited<ReturnType<typeof postgrestHarness>>;

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 375, height: 667 } });

test.beforeAll(async () => {
  h = await postgrestHarness();
});

test.beforeEach(async ({ page }) => {
  await h.reset();
  await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
  await page.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
  await injectSession(page, "owner");
});

/** Borrador completo salvo la ubicación: sin zona y con el pin dado (o sin pin). */
const draftAt = async (pin: LatLng | null) => (await h.seed({ status: "draft", photos: 5, draft: { zone: "", zoneSource: null, zoneId: null, district: "", lat: pin?.lat ?? null, lng: pin?.lng ?? null } })).id;

async function expectNoScroll(page: Page, what: string) {
  await page.waitForLoadState("networkidle");
  const [scrollH, innerH] = await page.evaluate(() => [document.documentElement.scrollHeight, window.innerHeight]);
  expect(scrollH, `${what} hace scroll: ${scrollH} > ${innerH}`).toBeLessThanOrEqual(innerH);
}

const line = (page: Page) => page.locator(".place-line");
const zone = (page: Page) => page.getByRole("combobox", { name: "Zona" });
const chosen = (page: Page) => zone(page).locator("option:checked");
const continuar = (page: Page) => page.getByRole("button", { name: "Continuar" });

/** Centro del mapa (al abrir con pin, el pin está ahí, a zoom 13). */
async function mapCenter(page: Page) {
  const b = (await page.locator(".map-box").boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
const tapMap = async (page: Page, dx = 0, dy = 0) => {
  const c = await mapCenter(page);
  await page.mouse.click(c.x + dx, c.y + dy);
};

/** Peticiones a place_at desde que se llama. */
function placeAtCalls(page: Page) {
  const calls: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/rest/v1/rpc/place_at")) calls.push(r.url());
  });
  return calls;
}

test("busca Cocles, toca el mapa: Talamanca, Limón y Cocles elegida", async ({ page }) => {
  // El buscador llega en la tarea 8; hasta entonces se entra con el pin del borrador en Cocles.
  const id = await draftAt(COCLES);
  await page.goto(`/propietario/publicar/${id}/2`);
  await expect(page.getByRole("heading", { name: "¿Dónde está su casa?" })).toBeVisible();
  await expect(line(page)).toHaveText("Talamanca, Limón");
  await expect(chosen(page)).toHaveText("Cocles");
  // Las zonas a 5 km o menos, la más cercana primero; luego el distrito; al final «Otra…».
  const names = await zone(page).locator("option").allTextContents();
  expect(names[0]).toBe("Cocles");
  expect(names).toContain("Puerto Viejo");
  expect(names).not.toContain("Manzanillo");
  expect(names.at(-1)).toBe("Otra…");
  await expect(continuar(page)).toBeEnabled();
  await expect(page.getByText("Toque el mapa o arrastre el punto hasta su casa.")).toBeVisible();
  await expect(page.locator(".leaflet-control-attribution")).toContainText("OpenStreetMap");
  await expect(page.getByRole("button", { name: "Usar mi ubicación" })).toBeVisible();
  await expectNoScroll(page, "paso 2");

  // Otra zona de la lista también vale; se guarda con su id y su origen, y el cantón que da el pin.
  await zone(page).selectOption({ label: "Puerto Viejo" });
  await continuar(page).click();
  await expect(page).toHaveURL(/\/4$/);
  await expect.poll(async () => (await h.owner("owner").getOwn(id))?.zoneId).toBe("704-puerto-viejo");
  expect(await h.owner("owner").getOwn(id)).toMatchObject({ province: "Limón", canton: "Talamanca", district: "Cahuita", zone: "Puerto Viejo", zoneSource: "list", lat: COCLES.lat, lng: COCLES.lng });
  // «Atrás» desde la capacidad vuelve al 2 (el 3 ya no existe) con lo elegido.
  await page.getByRole("link", { name: "Atrás" }).click();
  await expect(page).toHaveURL(/\/2$/);
  await expect(chosen(page)).toHaveText("Puerto Viejo");
  await expect(line(page)).toHaveText("Talamanca, Limón");
});

test("mover el punto a Limón centro cambia la línea y la zona", async ({ page }) => {
  const id = await draftAt(LIMON_CENTRO);
  await page.goto(`/propietario/publicar/${id}/2`);
  await expect(line(page)).toHaveText("Limón, Limón");
  const calls = placeAtCalls(page);
  await tapMap(page);
  const pin = (await page.locator(".pin-icon").boundingBox())!;
  const from = { x: pin.x + pin.width / 2, y: pin.y + pin.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x - 20, from.y, { steps: 4 });
  await page.mouse.move(from.x - 40, from.y, { steps: 4 });
  await page.mouse.up();
  await expect.poll(() => calls.length).toBeGreaterThanOrEqual(1);
  await expect(line(page)).toHaveText("Limón, Limón");
  await expect(chosen(page)).toHaveText("Limón centro");
  await expect(continuar(page)).toBeEnabled();
  const lng = Number(await page.locator('input[name="lng"]').inputValue());
  expect(lng).toBeLessThan(LIMON_CENTRO.lng); // el arrastre a la izquierda movió el pin al oeste
});

test("el paso 3 viejo lleva a la pantalla nueva", async ({ page }) => {
  const id = await draftAt(null);
  await page.goto(`/propietario/publicar/${id}/3`);
  await expect(page).toHaveURL(new RegExp(`/propietario/publicar/${id}/2$`));
  await expect(page.getByRole("heading", { name: "¿Dónde está su casa?" })).toBeVisible();
  // Sin pin: Continuar espera, y el mapa abre en Limón.
  await expect(continuar(page)).toBeDisabled();
  await expect(line(page)).toHaveText("");
  // Un número que no es un paso no abre nada.
  await page.goto(`/propietario/publicar/${id}/10`);
  await expect(page.getByRole("heading", { name: "¿Dónde está su casa?" })).toHaveCount(0);
});

test("la primera respuesta llega tarde y no pisa a la segunda", async ({ page }) => {
  const id = await draftAt(LIMON_CENTRO);
  await page.goto(`/propietario/publicar/${id}/2`);
  await expect(line(page)).toHaveText("Limón, Limón");
  // La primera llamada que sigue tarda 1,5 s y respondería otro cantón: si pisara a la segunda, se vería.
  let n = 0;
  await page.route("**/rest/v1/rpc/place_at", async (route) => {
    if (++n > 1) return route.fallback();
    await new Promise((r) => setTimeout(r, 1500));
    await route.fulfill({ json: [{ province: "Limón", canton: "Talamanca", district: "Cahuita", district_code: "70403" }] });
  });
  await tapMap(page, -60, 30);
  await page.waitForTimeout(450); // la primera ya salió (300 ms de espera) y sigue en vuelo
  await tapMap(page, -90, 0);
  await expect.poll(() => n).toBe(2);
  await expect(line(page)).toHaveText("Limón, Limón");
  await page.waitForTimeout(2000);
  await expect(line(page)).toHaveText("Limón, Limón");
  await expect(chosen(page)).toHaveText("Limón centro");
});

test("sin red al mover el punto: aviso, Continuar deshabilitado y se recupera", async ({ page, context }) => {
  const id = await draftAt(LIMON_CENTRO);
  await page.goto(`/propietario/publicar/${id}/2`);
  await expect(line(page)).toHaveText("Limón, Limón");
  await expect(continuar(page)).toBeEnabled();
  await context.setOffline(true);
  await tapMap(page, -60, 0);
  await expect(line(page)).toContainText("No pudimos ubicar el punto. Revise su conexión.");
  await expect(line(page).getByRole("button", { name: "Reintentar" })).toBeVisible();
  await expect(continuar(page)).toBeDisabled();
  await context.setOffline(false);
  await expect(line(page)).toHaveText("Limón, Limón");
  await expect(continuar(page)).toBeEnabled();
});
