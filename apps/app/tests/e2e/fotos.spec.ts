import { expect, test, type Page } from "./helpers/test";
import { readFileSync } from "node:fs";
import type { ListingsHarness } from "../contract/harness";
import { postgrestHarness } from "../db/postgrest-harness";
import { injectSession } from "./helpers/session";

// Paso 7 con subida real contra Supabase local: el navegador genera 480/800/1600 y los sube directo a Storage con la
// sesión del dueño; la base registra y ordena. iPhone SE (375×667): la página no hace scroll, la rejilla sí por dentro.
const FOTOS = new URL("../../../../design/pantallas/fotos/", import.meta.url).pathname;
const foto = (name: string) => ({ name, mimeType: "image/jpeg", buffer: readFileSync(`${FOTOS}${name}`) });
const SEIS = ["hero.jpg", "loft.jpg", "kitchen.jpg", "garden.jpg", "bedroom.jpg", "beach.jpg"].map(foto);
const fieldAlert = (page: Page) => page.locator('.field-error[role="alert"]');
let h: ListingsHarness;

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 375, height: 667 } });

test.beforeAll(async () => {
  h = await postgrestHarness();
});

test.beforeEach(async ({ page }) => {
  await h.reset();
  await injectSession(page, "owner");
});

const own = async (id: string) => (await h.owner("owner").getOwn(id))!;
const pick = (page: Page) => page.getByLabel("Añadir fotos");

/** Tamaño real (px) de una imagen pública de Storage, decodificada en el navegador. */
const sizeOf = (page: Page, url: string) =>
  page.evaluate(async (u) => {
    const bitmap = await createImageBitmap(await (await fetch(u)).blob());
    return [bitmap.width, bitmap.height];
  }, url);

test("subir seis fotos con progreso, cambiar la portada, quitar una y seguir", async ({ page }) => {
  const { id } = await h.seed({ status: "draft" });
  // Las subidas tardan un poco: así se ve el progreso por foto.
  await page.route("**/storage/v1/object/listings/**", async (route) => {
    if (route.request().method() === "POST") await new Promise((r) => setTimeout(r, 250));
    await route.continue();
  });
  await page.goto(`/propietario/publicar/${id}/7`);
  await expect(page.getByRole("status")).toHaveText("0 de 15");
  // Publicar v2: sin fotos se puede enviar; la ayuda lo dice y se va con la primera foto.
  const help = page.getByText("Puede enviarla sin fotos; para publicarla necesitamos al menos una.");
  await expect(help).toBeVisible();

  await pick(page).setInputFiles(SEIS);
  await expect(page.getByRole("progressbar", { name: "Subiendo hero.jpg" })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("6 de 15", { timeout: 20_000 });
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(help).toBeHidden();

  // En la base: seis carpetas en el orden elegido, tres objetos por foto con caché de un año, sin agrandar.
  const l = await own(id);
  expect(l.photos.map((p) => p.position)).toEqual([0, 1, 2, 3, 4, 5]);
  for (const p of l.photos) expect(p.path).toMatch(new RegExp(`^${id}/[0-9a-f-]{36}$`));
  const objects = await h.objects(id);
  expect(objects).toHaveLength(18);
  for (const o of objects) expect(o.cacheControl).toMatch(/max-age=31536000/);
  const hero = l.photos[0]!.url.replace(/800\.jpg$/, "");
  expect(await sizeOf(page, `${hero}480.jpg`)).toEqual([480, 360]);
  expect(await sizeOf(page, `${hero}800.jpg`)).toEqual([800, 600]);
  expect(await sizeOf(page, `${hero}1600.jpg`)).toEqual([1000, 750]); // el original es de 1000 px: no se agranda
  await expect(page.locator(".photos-grid .photo.cover img")).toHaveAttribute("src", `${hero}800.jpg`);
  await expect(page.locator(".photos-grid .photo:not(.cover) img").first()).toHaveAttribute("src", /\/480\.jpg$/);

  // La tercera a la portada con los botones ocultos (teclado): el orden se ve al instante y se guarda.
  const mover = (name: string) => page.getByRole("button", { name });
  await mover("Mover foto 3 antes").focus();
  await page.keyboard.press("Enter");
  await expect(mover("Mover foto 2 antes")).toBeFocused();
  await expect(mover("Mover foto 2 antes")).not.toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Enter");
  await expect(page.locator(".photos-grid .photo.cover img")).toHaveAttribute("src", l.photos[2]!.url);
  await expect(page.locator(".photos-grid .photo.cover .tag")).toHaveText("Portada");
  await expect.poll(async () => (await own(id)).photos.map((p) => p.id)).toEqual([2, 0, 1, 3, 4, 5].map((i) => l.photos[i]!.id));

  // Mover después.
  await expect(mover("Mover foto 2 después")).not.toHaveAttribute("aria-disabled", "true");
  await mover("Mover foto 2 después").focus();
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await own(id)).photos[2]!.id).toBe(l.photos[0]!.id);

  // Quitar la segunda: fila y tres objetos fuera.
  const before = await own(id);
  await page.getByRole("button", { name: "Quitar foto 2" }).click();
  await expect(page.getByRole("status")).toHaveText("5 de 15");
  const after = await own(id);
  expect(after.photos.map((p) => p.id)).toEqual(before.photos.filter((_, i) => i !== 1).map((p) => p.id));
  await expect.poll(async () => (await h.objects(id)).length).toBe(15);
  expect((await h.objects(id)).some((o) => o.name.startsWith(`${before.photos[1]!.path}/`))).toBe(false);

  // Un HEIC de iPhone se rechaza con el mensaje de siempre.
  await pick(page).setInputFiles({ name: "IMG_0001.HEIC", mimeType: "image/heic", buffer: Buffer.from("no es un jpeg") });
  await expect(fieldAlert(page)).toHaveText("Ese formato no se puede subir. Use JPG o PNG.");

  // La página no hace scroll.
  const [scrollH, innerH] = await page.evaluate(() => [document.documentElement.scrollHeight, window.innerHeight]);
  expect(scrollH).toBeLessThanOrEqual(innerH);

  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/8$/);

  // La ficha (al publicarse) y Mis casas usan las variantes: la portada nueva en Mis casas es la de 800 con la de 480 en srcset.
  await page.goto("/propietario/casas");
  const cover = page.locator(`.house-photo img[src="${after.photos[0]!.url}"]`).first();
  await expect(cover).toBeVisible();
  await expect(cover).toHaveAttribute("srcset", `${after.photos[0]!.url.replace(/800\.jpg$/, "480.jpg")} 480w, ${after.photos[0]!.url} 800w`);
});

test("no pasa de 15: sube solo las que caben y lo dice", async ({ page }) => {
  const { id } = await h.seed({ status: "draft", photos: 13 });
  await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: readFileSync(`${FOTOS}loft.jpg`), contentType: "image/jpeg" }));
  await page.goto(`/propietario/publicar/${id}/7`);
  await expect(page.getByRole("status")).toHaveText("13 de 15");
  await pick(page).setInputFiles(SEIS.slice(0, 4));
  await expect(fieldAlert(page)).toHaveText("Máximo 15 fotos.");
  await expect(page.getByRole("status")).toHaveText("15 de 15", { timeout: 20_000 });
  await expect(pick(page)).toHaveCount(0);
  expect((await own(id)).photoCount).toBe(15);
  expect(await h.objects(id)).toHaveLength(6);
});
