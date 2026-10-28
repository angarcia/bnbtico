import { expect, test, type Page } from "./helpers/test";
import { readFileSync } from "node:fs";
import type { ListingsHarness } from "../contract/harness";
import { postgrestHarness } from "../db/postgrest-harness";
import { injectSession } from "./helpers/session";

// Paso 7: ordenar fotos. Botones ocultos «Mover foto N antes / después» para teclado y lector de pantalla, con el orden
// pintado al instante (optimista), anunciado en una región viva y con vuelta atrás si el servidor lo rechaza.
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
