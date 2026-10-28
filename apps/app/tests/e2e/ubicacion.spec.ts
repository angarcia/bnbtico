import { expect, test, type Page } from "./helpers/test";
import { postgrestHarness } from "../db/postgrest-harness";
import { bboxAround, type LatLng } from "../../src/domain/geo";
import { secondCode } from "./helpers/admin";
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
  // Y nada queda debajo de la barra de «Continuar».
  const last = (await page.locator(".publish-form > :not(.sticky-actions):not([type=hidden])").last().boundingBox())!;
  const bar = (await page.locator(".sticky-actions").boundingBox())!;
  expect(last.y + last.height, `${what}: lo último queda bajo «Continuar»`).toBeLessThanOrEqual(bar.y);
}

const line = (page: Page) => page.locator(".place-line");
const zone = (page: Page) => page.getByRole("combobox", { name: "Zona", exact: true });
const search = (page: Page) => page.getByRole("combobox", { name: "Busque un pueblo, playa o barrio" });
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

/** Peticiones a Photon desde que se llama (las responde vacías el fixture noPhoton). */
function photonCalls(page: Page) {
  const calls: URL[] = [];
  page.on("request", (r) => {
    if (r.url().startsWith("https://photon.komoot.io/")) calls.push(new URL(r.url()));
  });
  return calls;
}

/** Busca una zona de la lista con el buscador del mapa y la elige; el mapa va allí sin poner el pin. */
async function searchZone(page: Page, name: string) {
  await search(page).fill(name);
  await page.getByRole("option", { name, exact: true }).click();
  await expect(search(page)).not.toBeFocused();
  await expect(page.locator(".pin-icon")).toHaveCount(0);
}

/** Peticiones a place_at desde que se llama. */
function placeAtCalls(page: Page) {
  const calls: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/rest/v1/rpc/place_at")) calls.push(r.url());
  });
  return calls;
}

test("busca Cocles, toca el mapa: Talamanca, Limón y Cocles elegida", async ({ page }) => {
  const id = await draftAt(null);
  const photon = photonCalls(page);
  await page.goto(`/propietario/publicar/${id}/2`);
  await expect(page.getByRole("heading", { name: "¿Dónde está su casa?" })).toBeVisible();
  await expect(search(page)).toHaveAttribute("placeholder", "Busque un pueblo, playa o barrio…");
  // Enfocado y vacío: las zonas de la base, sin pedir nada a Photon.
  await search(page).focus();
  await expect(page.getByRole("option", { name: "Cocles", exact: true })).toBeVisible();
  expect(photon.length).toBe(0);
  // Elegir mueve el mapa (zoom de calle), cierra el teclado y no pone el pin.
  await searchZone(page, "Cocles");
  await tapMap(page);
  await expect(line(page)).toHaveText("Talamanca, Limón");
  await expect(chosen(page)).toHaveText("Cocles");
  const pin = { lat: Number(await page.locator('input[name="lat"]').inputValue()), lng: Number(await page.locator('input[name="lng"]').inputValue()) };
  expect(Math.abs(pin.lat - COCLES.lat)).toBeLessThan(0.001);
  expect(Math.abs(pin.lng - COCLES.lng)).toBeLessThan(0.001);
  // Las zonas a 5 km o menos, la más cercana primero; luego el distrito; al final «Otra…».
  const names = await zone(page).locator("option").allTextContents();
  expect(names[0]).toBe("Cocles");
  expect(names).toContain("Puerto Viejo");
  expect(names).not.toContain("Manzanillo");
  expect(names.at(-1)).toBe("Otra…");
  await expect(continuar(page)).toBeEnabled();
  await expect(page.getByText("Toque el mapa o arrastre el punto hasta su casa.")).toBeVisible();
  // El punto exacto no se publica: el propietario lo sabe antes de marcarlo.
  await expect(page.getByText("En la ficha solo se ve una zona aproximada de unos 500 m; la dirección exacta la da usted por WhatsApp.")).toBeVisible();
  await expect(page.locator(".leaflet-control-attribution")).toContainText("OpenStreetMap");
  await expect(page.getByRole("button", { name: "Usar mi ubicación" })).toBeVisible();
  await expectNoScroll(page, "paso 2");

  // Otra zona de la lista también vale; se guarda con su id y su origen, y el cantón que da el pin.
  await zone(page).selectOption({ label: "Puerto Viejo" });
  await continuar(page).click();
  await expect(page).toHaveURL(/\/4$/);
  await expect.poll(async () => (await h.owner("owner").getOwn(id))?.zoneId).toBe("704-puerto-viejo");
  expect(await h.owner("owner").getOwn(id)).toMatchObject({ province: "Limón", canton: "Talamanca", district: "Cahuita", zone: "Puerto Viejo", zoneSource: "list", lat: pin.lat, lng: pin.lng });
  // «Atrás» desde la capacidad vuelve al 2 (el 3 ya no existe) con lo elegido.
  await page.getByRole("link", { name: "Atrás" }).click();
  await expect(page).toHaveURL(/\/2$/);
  await expect(chosen(page)).toHaveText("Puerto Viejo");
  await expect(line(page)).toHaveText("Talamanca, Limón");
});

test("mover el punto a Limón centro cambia la línea y la zona", async ({ page }) => {
  const id = await draftAt(null);
  await page.goto(`/propietario/publicar/${id}/2`);
  await searchZone(page, "Limón centro");
  const calls = placeAtCalls(page);
  await tapMap(page);
  await expect(line(page)).toHaveText("Limón, Limón");
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

test("Otra… con un nombre inventado y Usar", async ({ page }) => {
  const id = await draftAt(COCLES);
  const photon = photonCalls(page);
  await page.goto(`/propietario/publicar/${id}/2`);
  await expect(line(page)).toHaveText("Talamanca, Limón");
  await zone(page).selectOption({ label: "Otra…" });
  const other = page.getByRole("combobox", { name: "Otra zona" });
  await expect(other).toBeFocused();
  await other.fill("Rancho Escondido");
  // Photon no conoce el nombre (responde []): el último elemento deja usar lo escrito.
  await expect.poll(() => photon.length).toBeGreaterThan(0);
  const options = page.getByRole("listbox", { name: "Otra zona" }).getByRole("option");
  await expect(options.last()).toHaveText('Usar "Rancho Escondido"');
  // Enter sobre una sugerencia no envía el paso.
  await other.press("ArrowDown");
  await other.press("Enter");
  await expect(page).toHaveURL(/\/2$/);
  await expect(chosen(page)).toHaveText("Rancho Escondido");
  await expect(other).toHaveCount(0);
  await expect(page.locator('input[name="zoneSource"]')).toHaveValue("other");
  // Photon busca dentro de los 5 km alrededor del pin.
  const bbox = photon.at(-1)!.searchParams.get("bbox")!.split(",").map((n) => Number(n).toFixed(3));
  expect(bbox).toEqual(bboxAround(COCLES, 5000).map((n) => n.toFixed(3)));
  expect(photon.at(-1)!.searchParams.get("q")).toBe("Rancho Escondido");
  await continuar(page).click();
  await expect(page).toHaveURL(/\/4$/);
  await expect.poll(async () => (await h.owner("owner").getOwn(id))?.zoneSource).toBe("other");
  expect(await h.owner("owner").getOwn(id)).toMatchObject({ zone: "Rancho Escondido", zoneId: null, canton: "Talamanca" });

  // El borrador ya está completo: se envía a revisión y el admin ve la línea de ubicación y la marca de zona propuesta.
  await page.goto(`/propietario/publicar/${id}/9`);
  await page.getByRole("button", { name: "Enviar a revisión" }).click();
  await expect.poll(async () => (await h.owner("owner").getOwn(id))?.status).toBe("review");
  const admin = await page.context().browser()!.newContext({ viewport: { width: 375, height: 667 } });
  const adminPage = await admin.newPage();
  await adminPage.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
  await adminPage.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
  await injectSession(adminPage, "admin");
  await adminPage.goto(`/admin/anuncios/${id}`);
  await secondCode(adminPage);
  await expect(adminPage.getByText("Rancho Escondido · Cahuita, Talamanca, Limón")).toBeVisible();
  await expect(adminPage.getByText("Zona propuesta por el dueño")).toBeVisible();
  await admin.close();
});

test("Otra… con el nombre de una zona de la lista elige esa zona; Enter sin marcar usa lo escrito", async ({ page }) => {
  const id = await draftAt(COCLES);
  await page.goto(`/propietario/publicar/${id}/2`);
  await expect(line(page)).toHaveText("Talamanca, Limón");
  await zone(page).selectOption({ label: "Puerto Viejo" });
  await zone(page).selectOption({ label: "Otra…" });
  const other = page.getByRole("combobox", { name: "Otra zona" });
  await other.fill("cocles");
  await expect(page.getByRole("listbox", { name: "Otra zona" }).getByRole("option").last()).toHaveText('Usar "cocles"');
  // Enter sin sugerencia marcada: el último elemento («Usar "…"»). Como Cocles ya está en la lista, queda esa zona, no
  // una propuesta (el admin no ve la marca).
  await other.press("Enter");
  await expect(other).toHaveCount(0);
  await expect(chosen(page)).toHaveText("Cocles");
  await expect(page.locator('input[name="zoneSource"]')).toHaveValue("list");
  await expect(page.locator('input[name="zoneId"]')).toHaveValue("704-cocles");
});

test("Otra…: las sugerencias de Photon que llegan después no cambian lo marcado", async ({ page }) => {
  const id = await draftAt(COCLES);
  await page.route("https://photon.komoot.io/**", async (route) => {
    await new Promise((r) => setTimeout(r, 800));
    await route.fulfill({
      json: { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [-82.7, 9.63] }, properties: { name: "Playa Chiquita", countrycode: "CR", county: "Talamanca", state: "Limón" } }] },
      headers: { "access-control-allow-origin": "*" },
    });
  });
  await page.goto(`/propietario/publicar/${id}/2`);
  await expect(line(page)).toHaveText("Talamanca, Limón");
  await zone(page).selectOption({ label: "Otra…" });
  const other = page.getByRole("combobox", { name: "Otra zona" });
  await other.fill("Playa Ch");
  const list = page.getByRole("listbox", { name: "Otra zona" });
  await other.press("ArrowDown");
  await expect(list.getByRole("option", { selected: true })).toHaveText('Usar "Playa Ch"');
  await expect(list.getByRole("option", { name: "Playa Chiquita" })).toBeVisible();
  await expect(list.getByRole("option", { selected: true })).toHaveCount(0);
  await other.press("Enter");
  await expect(chosen(page)).toHaveText("Playa Ch");
});

test("Ayuda cita los límites de OpenStreetMap con su licencia", async ({ page }) => {
  await page.goto("/ayuda");
  const link = page.getByRole("link", { name: "colaboradores de OpenStreetMap" });
  await expect(link).toHaveAttribute("href", "https://www.openstreetmap.org/copyright");
  await expect(page.getByText("Open Database License (ODbL)")).toBeVisible();
});
