import { expect, test, type Page } from "./helpers/test";
import { readFileSync } from "node:fs";
import type { ListingsHarness } from "../contract/harness";
import { postgrestHarness } from "../db/postgrest-harness";
import { injectSession } from "./helpers/session";
import { touch } from "./helpers/touch";

// Paso 7: ordenar fotos. Botones ocultos «Mover foto N antes / después» para teclado y lector de pantalla, con el orden
// pintado al instante (optimista), anunciado en una región viva y con vuelta atrás si el servidor lo rechaza. Con el dedo
// (toques reales por CDP, helpers/touch.ts): mantener pulsada una foto la levanta; deslizar sigue haciendo scroll; al
// arrastrarla las demás se apartan y al soltar el orden nuevo se ve al instante y se guarda con una sola petición.
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
const foto = (name: string) => ({ name, mimeType: "image/jpeg", buffer: readFileSync(`${FOTOS}${name}`) });

/** Mantener pulsada la foto `from` (desde 0) y arrastrarla al centro de `target` sin soltar (se puede mirar antes de `up`). */
async function hold(page: Page, from: number, target: { x: number; y: number }) {
  const t = await touch(page);
  const tile = page.locator(".photos-grid [data-photo]").nth(from);
  const p = await t.center(tile);
  await t.down(p.x, p.y);
  await expect(tile).toHaveClass(/is-lifted/);
  await t.move(target.x, target.y, 12);
  return t;
}
/** Igual que `hold`, y suelta. */
async function drag(page: Page, from: number, target: { x: number; y: number }) {
  await (await hold(page, from, target)).up();
}
const transforms = (page: Page) => page.locator(".photos-grid [data-photo]").evaluateAll((els) => els.map((e) => getComputedStyle(e).transform));

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

test("si el paso de las fotos falla al pintarse, no culpa a la conexión y manda el error a /errors", async ({ page }) => {
  test.info().annotations.push({ type: "nota", description: "El error se provoca a propósito." });
  const { id } = await h.seed({ status: "draft", photos: 6 });
  const beacons: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && new URL(r.url()).pathname === "/errors") beacons.push(r.postData() ?? "");
  });
  await page.route("**/assets/photos-*.js", (r) =>
    r.fulfill({ contentType: "text/javascript", body: 'export const PhotoUploader = () => { throw new Error("fallo de pintado e2e"); };' }),
  );
  await page.goto(`/propietario/publicar/${id}/7`);
  await expect(page.locator('.field-error[role="alert"]')).toHaveText("Algo falló al mostrar las fotos. Inténtelo de nuevo.");
  await expect.poll(() => beacons.some((b) => b.includes("fallo de pintado e2e"))).toBe(true);
  const beacon = JSON.parse(beacons.find((b) => b.includes("fallo de pintado e2e"))!);
  expect(beacon).toMatchObject({ kind: "error", path: `/propietario/publicar/${id}/7` });
  expect(beacon.stack).toContain("fallo de pintado e2e");
  await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
});

test("al volver al paso 7 las fotos salen sin pasar por la espera", async ({ page }) => {
  const { id } = await h.seed({ status: "draft", photos: 6 });
  await page.goto(`/propietario/publicar/${id}/7`);
  await expect(page.getByRole("status")).toHaveText("6 de 5–15");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/8$/);
  // Cada vez que aparece el título «Fotos», ¿ya está el contador al lado? Si no, se vio la espera.
  await page.evaluate(() => {
    const w = window as unknown as { fallbacks: number };
    w.fallbacks = 0;
    new MutationObserver(() => {
      for (const h2 of document.querySelectorAll("h2")) if (h2.textContent === "Fotos" && !h2.parentElement?.querySelector(".photos-count")) w.fallbacks++;
    }).observe(document.body, { childList: true, subtree: true });
  });
  await page.getByRole("link", { name: "Atrás" }).click();
  await expect(page).toHaveURL(/\/7$/);
  await expect(page.getByRole("status")).toHaveText("6 de 5–15");
  expect(await page.evaluate(() => (window as unknown as { fallbacks: number }).fallbacks)).toBe(0);
});

test("durante una subida, los botones «Mover…» quedan sin efecto", async ({ page }) => {
  const { id } = await h.seed({ status: "draft", photos: 6 });
  const before = (await own(id)).photos.map((p) => p.id);
  await page.unroute("**/storage/v1/object/public/**"); // subida real en esta prueba
  await page.route("**/storage/v1/object/listings/**", async (r) => {
    if (r.request().method() === "POST") await new Promise((s) => setTimeout(s, 1500));
    await r.continue();
  });
  await page.goto(`/propietario/publicar/${id}/7`);
  await page.getByLabel("Añadir fotos").setInputFiles([foto("hero.jpg")]);
  await expect(page.getByRole("progressbar")).toBeVisible();
  const move = page.getByRole("button", { name: "Mover foto 3 antes" });
  await expect(move).toHaveAttribute("aria-disabled", "true");
  await move.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  expect(await grid(page)).toEqual(before);
  expect(reorders).toHaveLength(0);
  await expect(page.getByRole("status")).toHaveText("7 de 5–15", { timeout: 20_000 });
  await expect(move).not.toHaveAttribute("aria-disabled", "true");
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

test("6 fotos: arrastrar la 5 a la portada; queda «Portada», se guarda y hace una sola petición", async ({ page }) => {
  const { id } = await h.seed({ status: "draft", photos: 6 });
  const b = (await own(id)).photos.map((p) => p.id);
  await page.goto(`/propietario/publicar/${id}/7`);
  await expect(page.locator(".photos-grid [data-photo]")).toHaveCount(6); // el trozo de las fotos es diferido
  const scrollTop = await page.locator(".photos-scroll").evaluate((e) => e.scrollTop);
  await page.evaluate(() => {
    (window as any).__cancels = 0;
    addEventListener("pointercancel", () => (window as any).__cancels++, true);
  });
  const cover = await (await touch(page)).center(page.locator(".photos-grid .photo.cover"));
  const t = await hold(page, 4, cover);
  // Movimiento normal: la levantada crece un 5 % y las demás se apartan con transición.
  const lifted = page.locator(".photos-grid .photo.is-lifted");
  expect(await lifted.evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).a)).toBeCloseTo(1.05, 2);
  expect(await page.locator(".photos-grid [data-photo]").nth(0).evaluate((e) => getComputedStyle(e).transitionDuration)).toBe("0.15s");
  await t.up();
  const expected = [b[4], b[0], b[1], b[2], b[3], b[5]];
  await expect.poll(() => grid(page)).toEqual(expected);
  await expect(page.locator(`.photos-grid .photo.cover[data-photo="${b[4]}"] .tag`)).toHaveText("Portada");
  await expect(live(page)).toHaveText("Foto movida a la posición 1, portada");
  // Sin vuelta atrás ni transforms colgados: la rejilla queda quieta en el orden nuevo.
  await expect(page.locator(".photos-grid")).not.toHaveClass(/is-dragging/);
  expect(await transforms(page)).toEqual(Array(6).fill("none"));
  expect(await page.evaluate(() => (window as any).__cancels)).toBe(0);
  expect(await page.locator(".photos-scroll").evaluate((e) => e.scrollTop)).toBe(scrollTop);
  await expect.poll(async () => (await own(id)).photos.map((p) => p.id)).toEqual(expected);
  expect(reorders).toEqual([expected]);
  await page.reload();
  await expect.poll(() => grid(page)).toEqual(expected);
});

test("soltar en su sitio no hace ninguna petición", async ({ page }) => {
  const { id } = await h.seed({ status: "draft", photos: 6 });
  await page.goto(`/propietario/publicar/${id}/7`);
  const tile = page.locator(".photos-grid [data-photo]").nth(3);
  const p = await (await touch(page)).center(tile);
  await drag(page, 3, { x: p.x + 20, y: p.y + 10 });
  await page.waitForTimeout(300);
  await expect(page.locator(".photos-grid")).not.toHaveClass(/is-dragging/);
  expect(reorders).toHaveLength(0);
});

test("soltar fuera de la rejilla deja la foto donde se veía (y no toca «Continuar»)", async ({ page }) => {
  const { id } = await h.seed({ status: "draft", photos: 6 });
  const b = (await own(id)).photos.map((p) => p.id);
  await page.goto(`/propietario/publicar/${id}/7`);
  const t = await touch(page);
  const tile = page.locator(".photos-grid [data-photo]").nth(4);
  const p = await t.center(tile);
  const slot2 = await t.center(page.locator(".photos-grid [data-photo]").nth(1));
  const cont = await t.center(page.getByRole("button", { name: "Continuar" }));
  await t.down(p.x, p.y);
  await expect(tile).toHaveClass(/is-lifted/);
  await t.move(slot2.x, slot2.y, 10);
  // Sale de la rejilla por la derecha y baja por fuera hasta «Continuar» (en línea recta pasaría por la foto 6).
  const right = (await page.locator(".photos-grid").boundingBox())!;
  const outside = Math.min(right.x + right.width + 8, (page.viewportSize()?.width ?? 0) - 2);
  await t.move(outside, slot2.y, 4);
  await t.move(outside, cont.y, 10);
  await t.move(cont.x, cont.y, 4);
  await t.up();
  const expected = [b[0], b[4], b[1], b[2], b[3], b[5]];
  await expect.poll(() => grid(page)).toEqual(expected);
  await expect(page).toHaveURL(/\/7$/);
  expect(reorders).toEqual([expected]);
});

test("si el servidor rechaza el orden al soltar, vuelve el anterior y avisa", async ({ page }) => {
  const { id } = await h.seed({ status: "draft", photos: 6 });
  const b = (await own(id)).photos.map((p) => p.id);
  await page.route("**/rest/v1/rpc/reorder_listing_photos", (r) => r.fulfill({ status: 500, json: {} }));
  await page.goto(`/propietario/publicar/${id}/7`);
  await drag(page, 4, await (await touch(page)).center(page.locator(".photos-grid .photo.cover")));
  await expect(page.locator('.field-error[role="alert"]')).toHaveText("No pudimos cambiar las fotos. Intente de nuevo.");
  await expect.poll(() => grid(page)).toEqual(b);
  // La vuelta atrás no deja transforms colgados ni el arrastre a medias.
  await expect(page.locator(".photos-grid")).not.toHaveClass(/is-dragging/);
  await expect.poll(() => transforms(page)).toEqual(Array(6).fill("none"));
});

test("un segundo dedo: antes de levantar cancela; después se ignora y no quita fotos", async ({ page }) => {
  const { id } = await h.seed({ status: "draft", photos: 6 });
  const b = (await own(id)).photos.map((p) => p.id);
  await page.goto(`/propietario/publicar/${id}/7`);
  const t = await touch(page);
  const tiles = page.locator(".photos-grid [data-photo]");
  const p = await t.center(tiles.nth(4));
  // (a) Un segundo dedo durante la espera: no se levanta nada.
  await t.down(p.x, p.y);
  await page.waitForTimeout(100);
  const other = await t.center(tiles.nth(2));
  await t.second(other.x, other.y);
  await page.waitForTimeout(600);
  await expect(page.locator(".photo.is-lifted")).toHaveCount(0);
  await t.up();
  // (b) Un segundo dedo sobre el ✕ de la foto 2 ya levantada: se ignora; soltar aplica el orden; quedan 6 fotos.
  await t.down(p.x, p.y);
  await expect(tiles.nth(4)).toHaveClass(/is-lifted/);
  const x = await t.center(page.getByRole("button", { name: "Quitar foto 2" }));
  await t.second(x.x, x.y);
  const cover = await t.center(page.locator(".photos-grid .photo.cover"));
  await t.move(cover.x, cover.y, 12); // mueve el dedo 0; el dedo 1 se queda
  await t.up();
  await expect.poll(() => grid(page)).toEqual([b[4], b[0], b[1], b[2], b[3], b[5]]);
  await expect(page.getByRole("status")).toHaveText("6 de 5–15");
  expect(reorders).toHaveLength(1);
});

test("durante una subida no se levanta; al terminar, el orden incluye la foto nueva", async ({ page }) => {
  const { id } = await h.seed({ status: "draft", photos: 6 });
  await page.unroute("**/storage/v1/object/public/**"); // subida real en esta prueba
  await page.route("**/storage/v1/object/listings/**", async (r) => {
    if (r.request().method() === "POST") await new Promise((s) => setTimeout(s, 800));
    await r.continue();
  });
  await page.goto(`/propietario/publicar/${id}/7`);
  await page.getByLabel("Añadir fotos").setInputFiles([foto("hero.jpg")]);
  await expect(page.getByRole("progressbar")).toBeVisible();
  const t = await touch(page);
  const tile = page.locator(".photos-grid [data-photo]").nth(4);
  const p = await t.center(tile);
  await t.down(p.x, p.y);
  await page.waitForTimeout(600);
  await expect(page.locator(".photo.is-lifted")).toHaveCount(0);
  await t.up();
  await expect(page.getByRole("status")).toHaveText("7 de 5–15", { timeout: 20_000 });
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await drag(page, 4, await t.center(page.locator(".photos-grid .photo.cover")));
  await expect.poll(() => reorders.length).toBe(1);
  expect(reorders[0]).toHaveLength(7);
  expect(reorders[0]).toEqual(expect.arrayContaining((await own(id)).photos.map((p) => p.id)));
});

test("si la lista cambia a mitad del arrastre, se cancela y soltar no pide nada", async ({ page }) => {
  const { id } = await h.seed({ status: "draft", photos: 6 });
  const b = (await own(id)).photos.map((p) => p.id);
  await page.goto(`/propietario/publicar/${id}/7`);
  const t = await touch(page);
  const tile = page.locator(".photos-grid [data-photo]").nth(4);
  const p = await t.center(tile);
  await t.down(p.x, p.y);
  await expect(tile).toHaveClass(/is-lifted/);
  // Otro cambio de orden llega mientras la foto está levantada (aquí, el botón oculto de la foto 1).
  await page.getByRole("button", { name: "Mover foto 1 después" }).evaluate((e) => (e as HTMLElement).click());
  const moved = [b[1], b[0], ...b.slice(2)];
  await expect.poll(() => grid(page)).toEqual(moved);
  await expect(page.locator(".photo.is-lifted")).toHaveCount(0);
  const cover = await t.center(page.locator(".photos-grid .photo.cover"));
  await t.move(cover.x, cover.y, 8);
  await t.up();
  await expect.poll(async () => (await own(id)).photos.map((p) => p.id)).toEqual(moved);
  await page.waitForTimeout(300);
  expect(reorders).toEqual([moved]);
  expect(await grid(page)).toEqual(moved);
});

test.describe("rejilla con scroll", () => {
  test.use({ viewport: { width: 375, height: 667 } });
  test("cerca del borde de arriba la rejilla se desplaza sola y se puede soltar en la portada", async ({ page }) => {
    const { id } = await h.seed({ status: "draft", photos: 12 });
    const b = (await own(id)).photos.map((p) => p.id);
    await page.goto(`/propietario/publicar/${id}/7`);
    await expect(page.locator(".photos-grid [data-photo]")).toHaveCount(12); // el trozo de las fotos es diferido
    const scroller = page.locator(".photos-scroll");
    await scroller.evaluate((e) => (e.scrollTop = e.scrollHeight));
    expect(await scroller.evaluate((e) => e.scrollTop)).toBeGreaterThan(100);
    const t = await touch(page);
    const last = page.locator(".photos-grid [data-photo]").nth(11);
    const p = await t.center(last);
    await t.down(p.x, p.y);
    await expect(last).toHaveClass(/is-lifted/);
    const box = (await scroller.boundingBox())!;
    await t.move(box.x + 60, box.y + 6, 12); // dentro de la franja de 48 px de arriba
    await expect.poll(() => scroller.evaluate((e) => e.scrollTop), { timeout: 5_000 }).toBe(0);
    await t.move(box.x + 60, box.y + 60, 4); // sobre la portada, fuera de la franja
    await t.up();
    await expect.poll(() => grid(page)).toEqual([b[11], ...b.slice(0, 11)]);
    expect(reorders).toEqual([[b[11], ...b.slice(0, 11)]]);
  });
});

test("con movimiento reducido: sin escala al levantar y sin transición al apartarse", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const { id } = await h.seed({ status: "draft", photos: 6 });
  await page.goto(`/propietario/publicar/${id}/7`);
  const t = await touch(page);
  const tile = page.locator(".photos-grid [data-photo]").nth(4);
  const p = await t.center(tile);
  await t.down(p.x, p.y);
  await expect(tile).toHaveClass(/is-lifted/);
  expect(await tile.evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).a)).toBe(1);
  const cover = await t.center(page.locator(".photos-grid .photo.cover"));
  await t.move(cover.x, cover.y, 12);
  // Las demás saltan a su sitio: sin transición en ninguna de las que no están levantadas.
  const others = page.locator(".photos-grid [data-photo]:not(.is-lifted)");
  await expect.poll(() => others.nth(0).evaluate((e) => getComputedStyle(e).transform)).not.toBe("none");
  expect(await others.evaluateAll((els) => els.map((e) => getComputedStyle(e).transitionDuration))).toEqual(Array(5).fill("0s"));
  expect(await tile.evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).a)).toBe(1);
  await t.up();
  await expect(page.locator(".photos-grid")).not.toHaveClass(/is-dragging/);
});
