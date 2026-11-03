import { expect, test, type Page } from "./helpers/test";
import type { Seeded } from "../contract/harness";
import { addDays } from "../../src/domain/dates";
import { costaRicaToday } from "../../src/domain/inquiry";
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
  // approx_point mueve cada punto entre 150 y 499 m al azar (por UUID): siete cabinas tierra adentro a unos 7 km entre
  // una y otra y Casa Coco sola, a más de 30 km, para que su marcador nunca quede tapado y se toque de verdad.
  const houses: [number, number, number][] = [
    [9.8, -83.0, 55000],
    [9.8, -82.93, 38000],
    [9.74, -83.0, 29000],
    [9.74, -82.93, 68000],
    [9.74, -82.86, 95000],
    [9.68, -82.93, 48000],
    [9.68, -82.86, 35000],
  ];
  for (const [i, [lat, lng, price]] of houses.entries()) {
    await h.seed({ status: "active", draft: { title: `Cabina ${i + 1}`, zone: "Cocles", zoneSource: "other", zoneId: null, lat, lng, nightlyPriceCrc: price } });
  }
  coco = await h.seed({ status: "active", draft: { title: COCO, zone: "Cocles", zoneSource: "other", zoneId: null, lat: 9.55, lng: -82.55, nightlyPriceCrc: 42000 } });
});

test.beforeEach(async ({ page }) => {
  await page.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
  await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
});

const mapBox = (page: Page) => page.getByTestId("explore-map");
const mapLabel = (page: Page) => page.getByRole("button", { name: "Mapa", exact: true });
const countPill = (page: Page) => page.getByRole("button", { name: "8 casas", exact: true });
/** Revisión UX 2026-10-29 (C2): las siete cabinas, a unos 7 km entre sí, se pisan en el mapa pequeño y van juntas. */
const ready = (page: Page) => expect(mapBox(page).locator(".leaflet-marker-pane .map-price", { hasText: "₡42 000" })).toBeVisible();
/** Ningún precio tapa a otro ni se sale de la caja. */
async function expectPinsClear(box: import("@playwright/test").Locator, pinsOf = ".leaflet-marker-pane .map-price") {
  const area = (await box.boundingBox())!;
  const pins = await box.locator(pinsOf).evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as DOMRect));
  for (const r of pins) {
    expect(r.left).toBeGreaterThanOrEqual(area.x);
    expect(r.right).toBeLessThanOrEqual(area.x + area.width);
    expect(r.top).toBeGreaterThanOrEqual(area.y);
    expect(r.bottom).toBeLessThanOrEqual(area.y + area.height);
  }
  for (const [i, a] of pins.entries()) for (const b of pins.slice(i + 1)) expect(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top).toBe(true);
}
/** En el mapa grande, tocar los grupos hasta que todas las casas salen solas. */
async function expandGroups(full: import("@playwright/test").Locator) {
  // Acercar el mapa anima el zoom y rehace los marcadores al terminar: se reintenta hasta que no queda ningún grupo.
  const groups = full.locator(".map-price.is-group");
  await expect(async () => {
    if (await groups.count()) await groups.first().click({ timeout: 1000 });
    await expect(groups).toHaveCount(0, { timeout: 1000 });
  }).toPass({ timeout: 10_000 });
}

test("el mapa es el primer elemento de la lista y lleva precios", async ({ page }) => {
  await page.goto("/explorar");
  await expect(page.locator(".listing-grid > :first-child")).toHaveAttribute("data-testid", "explore-map");
  const box = await mapBox(page).boundingBox();
  expect(Math.abs(box!.height - 220)).toBeLessThanOrEqual(1);
  await expect(mapBox(page)).toHaveAttribute("aria-label", "Abrir el mapa de las casas");
  await ready(page);
  await expect(mapBox(page).locator(".leaflet-marker-pane .map-price")).toHaveCount(2);
  await expect(mapBox(page).locator(".leaflet-marker-pane .map-price").filter({ hasText: /^7 casas$/ })).toHaveCount(1);
  await expect(mapBox(page).locator(".leaflet-marker-pane .map-price").filter({ hasText: /^₡42\s000$/ })).toHaveCount(1);
  await expectPinsClear(mapBox(page));
  await expect(mapBox(page).getByText("₡42 000", { exact: true })).toBeVisible();
  await expect(mapBox(page).getByText("₡42 000", { exact: true })).toHaveAttribute("title", COCO);
  await expect(mapBox(page).locator(".leaflet-control-attribution")).toBeVisible();
  // El mapa pequeño no se arrastra ni hace zoom: la página baja con el dedo.
  await expect(mapBox(page).locator(".leaflet-control-zoom")).toHaveCount(0);
});

test("al bajar aparece «Mapa»; a pantalla completa «8 casas»; un marcador muestra su casa; Atrás cierra y conserva el scroll", async ({ page }) => {
  await page.goto("/explorar");
  await ready(page);
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
  await expect(full.locator(".map-price", { hasText: "₡42 000" })).toBeVisible();
  await expectPinsClear(full.locator(".leaflet-container"));
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
  // Tocar el mapa en otro sitio (el propio mapa, sin marcador debajo) quita la tarjeta.
  await full.locator(".leaflet-container").dispatchEvent("click");
  await expect(full.locator(".map-card")).toHaveCount(0);
  await expect(marker).not.toHaveClass(/is-selected/);
  // Con una casa elegida, Atrás cierra el mapa y la olvida: Adelante lo vuelve a abrir sin tarjeta.
  await marker.click();
  await expect(full.locator(".map-card")).toBeVisible();

  await page.goBack();
  await expect(page.locator(".map-full")).toHaveCount(0);
  await expect(mapLabel(page)).toBeFocused();
  expect(await page.locator(".listing-grid").evaluate((el) => (el as HTMLElement).inert)).toBe(false);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThanOrEqual(598);
  expect(Math.abs((await page.evaluate(() => scrollY)) - 600)).toBeLessThanOrEqual(2);
  expect(searches).toBe(0);
  await page.goForward();
  await expect(full.locator(".map-price", { hasText: "₡42 000" })).toBeVisible();
  await expect(full.locator(".map-card")).toHaveCount(0);
  await page.goBack();
  await expect(page.locator(".map-full")).toHaveCount(0);

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
  await ready(page);
  await mapBox(page).press("Enter");
  const marker = page.locator(".map-full .map-price", { hasText: "₡42 000" });
  // Un grupo, con Intro, acerca el mapa a sus casas.
  const group = page.locator(".map-full .map-price.is-group").first();
  await group.focus();
  await group.press("Enter");
  await expandGroups(page.locator(".map-full"));
  await marker.focus();
  await marker.press("Enter");
  await expect(page.locator(".map-full").getByRole("link", { name: new RegExp(COCO) })).toBeVisible();
  await page.locator(".map-full .map-price", { hasText: "₡55 000" }).press(" ");
  await expect(page.locator(".map-full").getByRole("link", { name: /Cabina 1/ })).toBeVisible();
});

test("un marcador del mapa pequeño abre el mapa grande con su casa; un grupo, el mapa grande; sin historial, «8 casas» vuelve a la lista", async ({ page }) => {
  await page.goto("/explorar");
  await ready(page);
  await mapBox(page).locator(".map-price", { hasText: "₡42 000" }).click();
  await expect(page).toHaveURL(/[?&]mapa=1/);
  await expect(page.locator(".map-full").getByRole("link", { name: new RegExp(COCO) })).toBeVisible();
  await expect(page.locator(".map-full .map-price.is-selected")).toHaveText("₡42 000");
  await page.goBack();
  await expect(page.locator(".map-full")).toHaveCount(0);
  await mapBox(page).locator(".map-price", { hasText: "7 casas" }).click();
  await expect(page).toHaveURL(/[?&]mapa=1/);
  await expect(page.locator(".map-full .map-card")).toHaveCount(0);
  // Abierto desde un enlace (sin entrada anterior en la app): «8 casas» sustituye la entrada.
  await page.goto("/explorar?mapa=1");
  await expect(countPill(page)).toBeVisible();
  await countPill(page).click();
  await expect(page.locator(".map-full")).toHaveCount(0);
  await expect(page).toHaveURL(/\/explorar$/);
});

test("sin red para el mapa, la caja se queda con los precios y la lista funciona", async ({ page }) => {
  await page.route("**/assets/explore-map-leaflet-*.js", (r) => r.abort());
  await page.route("**/assets/leaflet-*.js", (r) => r.abort());
  const aborted = page.waitForEvent("requestfailed", (r) => /\/assets\/(explore-map-)?leaflet-/.test(r.url()));
  await page.goto("/explorar");
  await expect(page.locator(".listing-grid:not(.skeleton) .listing-card")).toHaveCount(8);
  await expect(mapBox(page)).toBeVisible();
  await aborted;
  await expect(mapBox(page).locator(".leaflet-container")).toHaveCount(0);
  // La caja no se queda lisa: los precios, ya juntos si se pisan, sobre su fondo (revisión UX 2026-10-29, C2).
  await expect(mapBox(page).locator(".map-preview .map-price").filter({ hasText: /^₡42\s000$/ })).toHaveCount(1);
  await expect(mapBox(page).locator(".map-preview .map-price").filter({ hasText: /casas$/ }).first()).toBeVisible();
  await expectPinsClear(mapBox(page), ".map-preview .map-price");
  const first = page.locator(".listing-grid .listing-card").first();
  await expect(first).toBeVisible();
  await first.click();
  await expect(page).toHaveURL(/\/casa\/CT-/);
});

test("telemetría: se cuentan la apertura del mapa y el toque en un marcador", async ({ page }) => {
  const since = sql("select now()::text");
  await page.goto("/explorar");
  await ready(page);
  await mapBox(page).press("Enter");
  await page.locator(".map-full .map-price", { hasText: "₡42 000" }).click();
  await expect(page.locator(".map-full .map-card")).toBeVisible();
  const events = () => sql(`select string_agg(name || ':' || coalesce(listing_public_id, '-'), ',' order by name) from public.events where created_at >= '${since}' and name in ('explore_map_open', 'map_marker_tap')`);
  await expect.poll(events).toBe(`explore_map_open:-,map_marker_tap:${coco.publicId}`);
});

test("con llegada y salida, el marcador lleva la misma cifra que la tarjeta (el total, sin «por N noches») y la tarjeta del mapa, el total", async ({ page }) => {
  const today = costaRicaToday(Date.now());
  await page.goto(`/explorar?llegada=${addDays(today, 20)}&salida=${addDays(today, 24)}`);
  // Casa Coco: ₡42 000 la noche × 4.
  await expect(mapBox(page).locator(".leaflet-marker-pane .map-price").filter({ hasText: /^₡168\s000$/ })).toHaveCount(1);
  await expect(page.getByRole("link", { name: new RegExp(COCO) }).locator(".card-price")).toHaveText("≈ ₡168 000 por 4 noches");
  await mapBox(page).locator(".map-price", { hasText: "₡168 000" }).click();
  const full = page.locator(".map-full");
  await expect(full.locator(".map-price.is-selected")).toHaveText("₡168 000");
  await expect(full.locator(".map-card .card-price")).toHaveText("≈ ₡168 000 por 4 noches");
});
