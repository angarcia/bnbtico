import { expect, test, type Page } from "./helpers/test";
import { readFileSync } from "node:fs";
import type { ListingsHarness } from "../contract/harness";
import { postgrestHarness } from "../db/postgrest-harness";
import { injectSession } from "./helpers/session";
import { touch } from "./helpers/touch";

// Paso 7: ordenar fotos. Botones ocultos «Mover foto N antes / después» para teclado y lector de pantalla, con el orden
// pintado al instante (optimista), anunciado en una región viva y con vuelta atrás si el servidor lo rechaza. Con el dedo
// (toques reales por CDP, helpers/touch.ts): mantener pulsada una foto la levanta; deslizar sigue haciendo scroll.
const FOTOS = new URL("../../../../design/pantallas/fotos/", import.meta.url).pathname;
let h: ListingsHarness;
let reorders: string[][];

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  h = await postgrestHarness();
});

test.beforeEach(async ({ page }) => {
  await h.reset();
  await injectSession(page, "owner");
  await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: readFileSync(`${FOTOS}loft.jpg`), contentType: "image/jpeg" }));
  reorders = [];
  page.on("request", (r) => {
    if (r.url().includes("/rest/v1/rpc/reorder_listing_photos")) reorders.push(JSON.parse(r.postData() ?? "{}").p_ids);
  });
});

const own = async (id: string) => (await h.owner("owner").getOwn(id))!;
const grid = (page: Page) => page.locator(".photos-grid [data-photo]").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.photo));
const live = (page: Page) => page.locator('[aria-live="polite"].sr-only');

test("teclado: «Mover foto 3 antes» la pone segunda, lo anuncia y el foco la sigue", async ({ page }) => {
  const { id } = await h.seed({ status: "draft", photos: 6 });
  const before = (await own(id)).photos.map((p) => p.id);
  await page.goto(`/propietario/publicar/${id}/7`);
  await expect(page.getByText("Mantenga pulsada una foto y arrástrela para cambiar el orden. La primera es la portada.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Hacer portada" })).toHaveCount(0);
  await page.getByRole("button", { name: "Mover foto 3 antes" }).focus();
  await page.keyboard.press("Enter");
  const expected = [before[0], before[2], before[1], ...before.slice(3)];
  await expect.poll(() => grid(page)).toEqual(expected);
  await expect(live(page)).toHaveText("Foto movida a la posición 2");
  await expect(page.getByRole("button", { name: "Mover foto 2 antes" })).toBeFocused();
  await expect.poll(async () => (await own(id)).photos.map((p) => p.id)).toEqual(expected);
  expect(reorders).toHaveLength(1);
  // A la portada: el «antes» de la foto 1 queda sin efecto y conserva el foco (se espera a que termine la relectura).
  await expect(page.getByRole("button", { name: "Mover foto 2 antes" })).not.toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Enter");
  await expect(live(page)).toHaveText("Foto movida a la posición 1, portada");
  await expect(page.getByRole("button", { name: "Mover foto 1 antes" })).toBeFocused();
  await expect(page.getByRole("button", { name: "Mover foto 1 antes" })).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByRole("button", { name: "Mover foto 6 después" })).toHaveAttribute("aria-disabled", "true");
  await expect(page.locator(".photos-grid .photo.cover .tag")).toHaveText("Portada");
  await expect.poll(async () => (await own(id)).photos[0]!.id).toBe(before[2]);
  expect(reorders).toHaveLength(2);
});

test("si el servidor rechaza el orden, vuelve el anterior y lo dice (teclado)", async ({ page }) => {
  const { id } = await h.seed({ status: "draft", photos: 6 });
  const before = (await own(id)).photos.map((p) => p.id);
  await page.route("**/rest/v1/rpc/reorder_listing_photos", (r) => r.fulfill({ status: 500, json: {} }));
  await page.goto(`/propietario/publicar/${id}/7`);
  await page.getByRole("button", { name: "Mover foto 4 después" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('.field-error[role="alert"]')).toHaveText("No pudimos cambiar las fotos. Intente de nuevo.");
  await expect.poll(() => grid(page)).toEqual(before);
});

test("con una sola foto no sale la ayuda de arrastrar", async ({ page }) => {
  const { id } = await h.seed({ status: "draft", photos: 1 });
  await page.goto(`/propietario/publicar/${id}/7`);
  await expect(page.getByRole("status")).toHaveText("1 de 5–15");
  await expect(page.getByText(/Mantenga pulsada una foto/)).toHaveCount(0);
});

test("tras mover con el teclado, quitar otra foto no devuelve el foco a un «Mover…»", async ({ page }) => {
  const { id } = await h.seed({ status: "draft", photos: 6 });
  await page.goto(`/propietario/publicar/${id}/7`);
  await page.getByRole("button", { name: "Mover foto 3 antes" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Mover foto 2 antes" })).toBeFocused();
  await expect(page.getByRole("button", { name: "Mover foto 2 antes" })).not.toHaveAttribute("aria-disabled", "true");
  await page.getByRole("button", { name: "Quitar foto 5" }).click();
  await expect(page.getByRole("status")).toHaveText("5 de 5–15");
  await expect(page.getByRole("button", { name: "Quitar foto 1" })).toBeEnabled();
  expect(await page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.move ?? null)).toBeNull();
});

test("si el trozo de las fotos no carga, lo dice y «Reintentar» lo vuelve a pedir", async ({ page }) => {
  const { id } = await h.seed({ status: "draft", photos: 6 });
  let failed = false;
  await page.route("**/assets/photos-*.js", (r) => {
    if (failed) return r.continue();
    failed = true;
    return r.abort();
  });
  await page.goto(`/propietario/publicar/${id}/7`);
  await expect(page.locator('.field-error[role="alert"]')).toHaveText("No pudimos cargar las fotos. Revise su conexión.");
  await expect(page.getByRole("heading", { name: "Fotos" })).toBeVisible();
  await page.getByRole("button", { name: "Reintentar" }).click();
  await expect(page.getByRole("status")).toHaveText("6 de 5–15");
  await expect(page.locator(".photos-grid [data-photo]")).toHaveCount(6);
});

test.describe("tocar y arrastrar", () => {
  test.use({ viewport: { width: 375, height: 667 } }); // la rejilla hace scroll por dentro: lo necesita la prueba de deslizar
  test("deslizar en vertical sobre una foto hace scroll y no reordena", async ({ page }) => {
    const { id } = await h.seed({ status: "draft", photos: 12 });
    const before = (await own(id)).photos.map((p) => p.id);
    await page.goto(`/propietario/publicar/${id}/7`);
    const scroller = page.locator(".photos-scroll");
    const t = await touch(page);
    const p = await t.center(page.locator(".photos-grid [data-photo]").nth(4));
    await t.down(p.x, p.y);
    await t.move(p.x, p.y - 200, 10); // sin pausa: es un desplazamiento, no una pulsación larga
    await t.up();
    await expect.poll(() => scroller.evaluate((e) => e.scrollTop)).toBeGreaterThan(50);
    await expect(page.locator(".photo.is-lifted")).toHaveCount(0);
    expect(await grid(page)).toEqual(before);
    expect(reorders).toHaveLength(0);
  });
});

test("un toque corto no hace nada", async ({ page }) => {
  const { id } = await h.seed({ status: "draft", photos: 6 });
  const before = (await own(id)).photos.map((p) => p.id);
  await page.goto(`/propietario/publicar/${id}/7`);
  const t = await touch(page);
  const p = await t.center(page.locator(".photos-grid [data-photo]").nth(2));
  await t.down(p.x, p.y);
  await page.waitForTimeout(120);
  await t.up();
  await page.waitForTimeout(600);
  await expect(page.locator(".photo.is-lifted")).toHaveCount(0);
  expect(await grid(page)).toEqual(before);
  expect(reorders).toHaveLength(0);
});

test("mantener pulsada levanta la foto sin mover la página; el ✕ no levanta", async ({ page }) => {
  const { id } = await h.seed({ status: "draft", photos: 6 });
  await page.goto(`/propietario/publicar/${id}/7`);
  await expect(page.locator(".photos-grid [data-photo]")).toHaveCount(6); // el trozo de las fotos es diferido
  const scrollBefore = await page.evaluate(() => [window.scrollY, document.querySelector(".photos-scroll")!.scrollTop]);
  const t = await touch(page);
  const tile = page.locator(".photos-grid [data-photo]").nth(3);
  const p = await t.center(tile);
  await t.down(p.x, p.y);
  await expect(tile).toHaveClass(/is-lifted/);
  await expect(page.locator(".photos-grid")).toHaveClass(/is-dragging/);
  expect(await page.evaluate(() => [window.scrollY, document.querySelector(".photos-scroll")!.scrollTop])).toEqual(scrollBefore);
  // Levantada, mover el dedo en vertical no hace scroll (touchmove nativo no pasivo con preventDefault).
  await t.move(p.x, p.y - 120, 6);
  await expect(tile).toHaveClass(/is-lifted/);
  expect(await page.evaluate(() => [window.scrollY, document.querySelector(".photos-scroll")!.scrollTop])).toEqual(scrollBefore);
  await t.up();
  await expect(tile).not.toHaveClass(/is-lifted/);
  expect(reorders).toHaveLength(0);
  // Pulsación larga sobre el ✕ de la foto 2: no se levanta nada ni se quita nada.
  const x = await t.center(page.getByRole("button", { name: "Quitar foto 2" }));
  await t.down(x.x, x.y);
  await page.waitForTimeout(600);
  await expect(page.locator(".photo.is-lifted")).toHaveCount(0);
  await t.up();
  await expect(page.getByRole("status")).toHaveText("6 de 5–15");
});

test("un segundo dedo durante la espera la cancela y no empieza otra", async ({ page }) => {
  const { id } = await h.seed({ status: "draft", photos: 6 });
  await page.goto(`/propietario/publicar/${id}/7`);
  const t = await touch(page);
  const a = await t.center(page.locator(".photos-grid [data-photo]").nth(1));
  const b = await t.center(page.locator(".photos-grid [data-photo]").nth(3));
  await t.down(a.x, a.y);
  await page.waitForTimeout(150);
  await t.second(b.x, b.y);
  await page.waitForTimeout(600);
  await expect(page.locator(".photo.is-lifted")).toHaveCount(0);
  await t.up();
  expect(reorders).toHaveLength(0);
});
