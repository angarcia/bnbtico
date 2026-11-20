import { devices, expect, test, type Locator, type Page } from "./helpers/test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { BUILD_FLAGS } from "./helpers/flags";
import { expectErrorUnder } from "./helpers/field-error";
import { realPhotos } from "./helpers/real-photos";
import { injectSession } from "./helpers/session";
import { secondCode } from "./helpers/admin";
import { postgrestHarness } from "../db/postgrest-harness";

// Editar una casa publicada en escritorio (historia 06, revisión 2026-11-17, aprobada por Ana el 2026-11-20), contra Supabase
// local. Cada apartado abre una ventana sobre el detalle en su propia URL (/propietario/casas/$id/editar/$campo): 520 px, o
// 960 la Ubicación; «Cancelar» cierra sin preguntar; Escape, la ✕, el fondo (solo en la normal) y Atrás preguntan
// «¿Descartar los cambios?» si hay cambios. Las fotos, en una ventana casi a pantalla completa con un visor de la foto entera
// y una columna de miniaturas; quitar una aprobada pide confirmación; el orden y lo que se quita se guarda al momento.
const LOFT = readFileSync(new URL("../../../../design/pantallas/fotos/loft.jpg", import.meta.url));
// 300 × 400, sacada de design/pantallas/fotos/garden.jpg: una foto vertical de verdad.
const VERTICAL = readFileSync(new URL("../fixtures/foto-vertical.jpg", import.meta.url));
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
const SENT = "Enviado a revisión. Su ficha sigue como está hasta que lo aprobemos.";
const SAVED = "Guardado. Ya se ve en su ficha.";
/** La altura de la foto en la ficha de escritorio (10-ajustes.css: `.listing-view > .hero`, 480 px) y su ancho a 1280. */
const FICHA_H = 480, FICHA_W_1280 = 797;

let h: Awaited<ReturnType<typeof postgrestHarness>>;

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

test.beforeAll(async () => {
  h = await postgrestHarness();
});

test.beforeEach(async ({ page }) => {
  await h.reset();
  await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: LOFT, contentType: "image/jpeg" }));
  await page.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
  await injectSession(page, "owner");
});

const FIELDS: [title: string, campo: string][] = [
  ["Nombre", "nombre"],
  ...(BUILD_FLAGS.rooms ? ([["Tipo", "tipo"]] as [string, string][]) : []),
  ["Personas, dormitorios y baños", "capacidad"],
  ["Características", "caracteristicas"],
  ["Descripción", "descripcion"],
  ["Precio", "precio"],
  ["Ubicación", "ubicacion"],
];
const editLink = (page: Page, title: string) => page.getByRole("link", { name: `Editar: ${title}`, exact: true });
const dialog = (page: Page, name: string) => page.getByRole("dialog", { name, exact: true });
const ask = (page: Page) => page.getByRole("dialog", { name: "¿Descartar los cambios?" });
const toast = (page: Page, text: string) => page.getByRole("status").filter({ hasText: text });
const fieldRow = (page: Page, title: string) => page.getByTestId("field-rows").locator(".list-item").filter({ has: page.locator(".field-title", { hasText: new RegExp(`^${title}`) }) });
const detail = (id: string) => new RegExp(`/propietario/casas/${id}$`);
const inside = (d: Locator) => d.evaluate((el) => el.contains(document.activeElement));

async function openDetail(page: Page, id: string, title = "Casa Coco") {
  await page.goto(`/propietario/casas/${id}`);
  await expect(page.locator("main h1", { hasText: title })).toBeVisible();
}

test("cada apartado se abre en una ventana sobre el detalle, en su URL, y «Cancelar» vuelve con el foco en su «Editar»", async ({ page }) => {
  const { id } = await h.seed({ status: "active", draft: { title: "Casa Coco" } });
  await openDetail(page, id);
  for (const [title, campo] of FIELDS) {
    await editLink(page, title).click();
    await expect(page).toHaveURL(new RegExp(`/propietario/casas/${id}/editar/${campo}$`));
    const d = dialog(page, title);
    await expect(d).toBeVisible();
    // El nombre de la casa, bajo el título.
    await expect(d.locator(".dialog-head")).toContainText("Casa Coco");
    const box = (await d.boundingBox())!;
    expect(box.width).toBe(campo === "ubicacion" ? 960 : 520);
    expect(box.height).toBeLessThanOrEqual(800 - 32);
    // Detrás sigue el detalle, con su navegación y las filas sin desplegar.
    await expect(page.locator("main h1", { hasText: "Casa Coco" })).toBeVisible();
    await expect(page.locator(".desktop-nav")).toBeVisible();
    await expect(page.getByTestId("field-rows").locator("form, input, textarea")).toHaveCount(0);
    await expect(d.getByRole("button", { name: campo === "nombre" || campo === "tipo" || campo === "descripcion" || campo === "ubicacion" ? "Enviar a revisión" : "Guardar" })).toBeDisabled();
    await d.getByRole("button", { name: "Cancelar" }).click();
    await expect(d).toHaveCount(0);
    await expect(page).toHaveURL(detail(id));
    await expect(editLink(page, title)).toBeFocused();
  }
});

test("con cambios sin guardar, Escape, la ✕, el fondo y Atrás preguntan; «Descartar» vuelve sin guardar y «Cancelar» no pregunta", async ({ page }) => {
  const { id } = await h.seed({ status: "active", draft: { title: "Casa Coco" } });
  await openDetail(page, id);
  await editLink(page, "Precio").click();
  const d = dialog(page, "Precio");
  await d.getByLabel("Precio por noche").fill("55 000");
  for (const close of [
    () => page.keyboard.press("Escape"),
    () => d.getByRole("button", { name: "Cerrar" }).click(),
    () => page.mouse.click(20, 400),
    () => page.goBack(),
  ]) {
    await close();
    await expect(ask(page)).toBeVisible();
    await expect(ask(page)).toContainText("Los cambios que hizo no se guardarán.");
    await ask(page).getByRole("button", { name: "Seguir editando" }).click();
    await expect(ask(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/editar\/precio$/);
    await expect(d.getByLabel("Precio por noche")).toHaveValue("55 000");
  }
  await page.goBack();
  await ask(page).getByRole("button", { name: "Descartar" }).click();
  await expect(d).toHaveCount(0);
  await expect(page).toHaveURL(detail(id));
  await expect(fieldRow(page, "Precio")).toContainText("₡42 000 / noche");
  await expect(editLink(page, "Precio")).toBeFocused();
  expect((await h.owner("owner").getOwn(id))!.nightlyPriceCrc).toBe(42000);

  // «Cancelar» del pie: sin preguntar.
  await editLink(page, "Precio").click();
  await d.getByLabel("Precio por noche").fill("60 000");
  await d.getByRole("button", { name: "Cancelar" }).click();
  await expect(ask(page)).toHaveCount(0);
  await expect(d).toHaveCount(0);
  await expect(fieldRow(page, "Precio")).toContainText("₡42 000 / noche");

  // Sin cambios, el fondo cierra la normal y Atrás vuelve al detalle; la ancha (Ubicación) no se cierra con el fondo.
  await editLink(page, "Precio").click();
  await page.mouse.click(20, 400);
  await expect(d).toHaveCount(0);
  await editLink(page, "Precio").click();
  await page.goBack();
  await expect(d).toHaveCount(0);
  await expect(page).toHaveURL(detail(id));
  await editLink(page, "Ubicación").click();
  const loc = dialog(page, "Ubicación");
  await expect(loc).toBeVisible();
  await page.mouse.click(20, 400);
  await expect(loc).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(loc).toHaveCount(0);
});

test("guardar al momento y enviar a revisión cierran la ventana y el detalle muestra el valor o «En revisión»; Atrás no vuelve a la ventana", async ({ page }) => {
  const { id } = await h.seed({ status: "active", draft: { title: "Casa Coco" } });
  await page.goto("/propietario/calendario");
  await openDetail(page, id);
  await editLink(page, "Precio").click();
  await dialog(page, "Precio").getByLabel("Precio por noche").fill("55 000");
  await dialog(page, "Precio").getByRole("button", { name: "Guardar" }).click();
  await expect(toast(page, SAVED)).toBeVisible();
  await expect(dialog(page, "Precio")).toHaveCount(0);
  await expect(page).toHaveURL(detail(id));
  await expect(fieldRow(page, "Precio")).toContainText("₡55 000 / noche");
  expect((await h.owner("owner").getOwn(id))!.nightlyPriceCrc).toBe(55000);

  await editLink(page, "Nombre").click();
  await dialog(page, "Nombre").getByLabel("Nombre de la casa").fill("Casa Coco del Mar");
  await expect(dialog(page, "Nombre")).toContainText("Este cambio lo revisamos antes de publicarlo");
  await dialog(page, "Nombre").getByRole("button", { name: "Enviar a revisión" }).click();
  await expect(toast(page, SENT)).toBeVisible();
  await expect(page).toHaveURL(detail(id));
  await expect(page.getByTestId("pending-nombre")).toContainText("En revisión");
  await expect(page.getByTestId("pending-nombre")).toContainText("Casa Coco del Mar");
  await page.goBack();
  await expect(page).toHaveURL(/\/propietario\/calendario/);
});

test("un error de un campo va debajo del campo y uno de guardado arriba; la ventana sigue abierta con lo escrito y se reintenta", async ({ page }) => {
  const { id } = await h.seed({ status: "active", draft: { title: "Casa Coco" } });
  await openDetail(page, id);
  await editLink(page, "Nombre").click();
  const name = dialog(page, "Nombre");
  await name.getByLabel("Nombre de la casa").fill("Ca");
  await name.getByRole("button", { name: "Enviar a revisión" }).click();
  await expectErrorUnder(page, name.getByLabel("Nombre de la casa"), "El nombre de la casa debe tener entre 5 y 32 caracteres.");
  await expect(name.getByLabel("Nombre de la casa")).toHaveValue("Ca");
  await expect(page).toHaveURL(/\/editar\/nombre$/);
  await name.getByRole("button", { name: "Cancelar" }).click();

  await editLink(page, "Descripción").click();
  const desc = dialog(page, "Descripción");
  const text = "Casa de dos plantas a 200 m de la playa de Cocles, con jardín, rancho y wifi. Se llega por calle asfaltada.";
  await desc.getByLabel(/Descripción/).fill(text);
  await page.route("**/rest/v1/rpc/save_edit_full", (route) => route.abort("internetdisconnected"));
  await desc.getByRole("button", { name: "Enviar a revisión" }).click();
  const error = desc.locator('.note[role="alert"]');
  await expect(error).toHaveText("Sin conexión. Revise su internet e intente de nuevo.");
  await expect(error).toBeInViewport();
  await expect(desc.getByLabel(/Descripción/)).toHaveValue(text);
  await page.unroute("**/rest/v1/rpc/save_edit_full");
  await desc.getByRole("button", { name: "Enviar a revisión" }).click();
  await expect(toast(page, SENT)).toBeVisible();
  await expect(page).toHaveURL(detail(id));
});

/** Las fotos con sus tres variantes en Storage local; la segunda, vertical (la sirve la ruta). */
async function photosWithVertical(page: Page) {
  const seeded = await h.seed({ status: "active", draft: { title: "Casa Coco" } });
  await realPhotos(seeded.id);
  const photos = (await h.owner("owner").getOwn(seeded.id))!.photos;
  await page.route("**/storage/v1/object/public/**", (route) =>
    route.request().url().includes(`/${photos[1]!.path}/`) ? route.fulfill({ body: VERTICAL, contentType: "image/jpeg" }) : route.continue());
  return { ...seeded, photos };
}
const photosDialog = (page: Page) => dialog(page, "Fotos");
const viewer = (page: Page) => photosDialog(page).getByTestId("photo-viewer").locator("img");
const thumb = (page: Page, n: number) => photosDialog(page).getByRole("button", { name: new RegExp(`^Foto ${n}(,|$)`) });
const counter = (page: Page) => photosDialog(page).locator(".photos-count");
/** Proporción en pantalla frente a la del archivo: iguales = la foto entera, sin recorte. */
const shownRatio = (img: Locator) => img.evaluate((el: HTMLImageElement) => {
  const r = el.getBoundingClientRect();
  return { shown: r.width / r.height, natural: el.naturalWidth / el.naturalHeight, width: r.width, height: r.height, src: el.currentSrc };
});

test("el editor de fotos ocupa casi toda la pantalla y enseña cada foto entera, vertical u horizontal, al menos al tamaño de la ficha", async ({ page }) => {
  const { id, photos } = await photosWithVertical(page);
  await openDetail(page, id);
  await page.getByRole("link", { name: "Editar fotos: 5 fotos" }).click();
  await expect(page).toHaveURL(new RegExp(`/propietario/casas/${id}/editar/fotos$`));
  const d = photosDialog(page);
  await expect(d).toBeVisible();
  const box = (await d.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(1280 * 0.95);
  expect(box.height).toBeGreaterThanOrEqual(800 * 0.9);
  await expect(counter(page)).toHaveText("5 de 15");
  await expect(d.getByText("Arrastre una foto para cambiar el orden. La primera es la portada.")).toBeVisible();
  await expect(d.getByText(/Mantenga pulsada/)).toHaveCount(0);
  await expect(d.getByRole("button", { name: "Cancelar" })).toHaveCount(0);

  // La portada (horizontal): entera, al menos tan ancha como en la ficha, con la variante de 1600.
  await expect(thumb(page, 1)).toHaveAttribute("aria-current", "true");
  await expect.poll(async () => (await shownRatio(viewer(page))).natural).toBeGreaterThan(1);
  let shown = await shownRatio(viewer(page));
  expect(Math.abs(shown.shown - shown.natural) / shown.natural).toBeLessThan(0.02);
  expect(shown.width).toBeGreaterThanOrEqual(FICHA_W_1280);
  expect(shown.src).toContain(`/${photos[0]!.path}/1600.jpg`);
  // La vertical: entera y más alta que la franja de la ficha.
  await thumb(page, 2).click();
  await expect(thumb(page, 2)).toHaveAttribute("aria-current", "true");
  await expect.poll(async () => (await shownRatio(viewer(page))).natural).toBeLessThan(1);
  shown = await shownRatio(viewer(page));
  expect(Math.abs(shown.shown - shown.natural) / shown.natural).toBeLessThan(0.02);
  expect(shown.height).toBeGreaterThanOrEqual(FICHA_H);
  expect(shown.src).toContain(`/${photos[1]!.path}/1600.jpg`);
  await expect(d.getByText("Lo que se ve en la ficha")).toBeVisible();
  // Las miniaturas, también enteras (480).
  for (let n = 1; n <= 5; n++) {
    const img = thumb(page, n).locator("img");
    await expect.poll(async () => (await shownRatio(img)).natural).toBeGreaterThan(0);
    const t = await shownRatio(img);
    expect(Math.abs(t.shown - t.natural) / t.natural, `miniatura ${n}`).toBeLessThan(0.05);
    expect(t.src).toMatch(/\/480\.jpg$/);
  }
  // Lo que se guarda al momento, a la vista y sin tapar.
  const note = d.getByText("El orden y las fotos que quite se guardan al momento y ya se ven en su ficha. Las fotos nuevas las revisamos antes de publicarlas, normalmente en menos de 24 horas.");
  await expect(note).toBeInViewport({ ratio: 1 });
  expect(await note.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
  })).toBe(true);
  // El fondo no la cierra; Escape sí, sin preguntar (no queda nada sin guardar).
  await page.mouse.click(5, 5);
  await expect(d).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(d).toHaveCount(0);
  await expect(ask(page)).toHaveCount(0);
  await expect(page).toHaveURL(detail(id));
});

test("a 1440 el visor crece con la ventana y la vertical sigue entera", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { id } = await photosWithVertical(page);
  await page.goto(`/propietario/casas/${id}/editar/fotos`);
  await thumb(page, 2).click();
  await expect.poll(async () => (await shownRatio(viewer(page))).natural).toBeLessThan(1);
  const shown = await shownRatio(viewer(page));
  expect(Math.abs(shown.shown - shown.natural) / shown.natural).toBeLessThan(0.02);
  expect(shown.height).toBeGreaterThanOrEqual(600);
  const box = (await photosDialog(page).boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(1440 * 0.95);
});

test("reordenar y quitar se guardan al momento; quitar una aprobada pide confirmación y una nueva no; al cerrar se conserva", async ({ page }) => {
  const { id, photos } = await photosWithVertical(page);
  await h.photos("owner").addEditPhoto(id, `${id}/${randomUUID()}`);
  await openDetail(page, id);
  await page.getByRole("link", { name: "Editar fotos: 5 fotos · 1 nueva en revisión" }).click();
  const d = photosDialog(page);
  await expect(counter(page)).toHaveText("6 de 15");
  await expect(thumb(page, 6)).toContainText("En revisión");

  await thumb(page, 2).click();
  const saved = page.waitForResponse((r) => r.url().includes("/rest/v1/rpc/reorder_listing_photos"));
  await d.getByRole("button", { name: "Mover después" }).click();
  expect((await saved).ok()).toBe(true);
  await expect(d.getByRole("status").filter({ hasText: "Orden guardado" })).toBeVisible();
  const ids = photos.map((p) => p.id);
  await expect.poll(async () => (await h.owner("owner").getOwn(id))!.photos.map((p) => p.id)).toEqual([ids[0], ids[2], ids[1], ids[3], ids[4]]);
  // La foto movida sigue elegida, ahora tercera.
  await expect(thumb(page, 3)).toHaveAttribute("aria-current", "true");
  await d.getByRole("button", { name: "Hacer portada" }).click();
  await expect.poll(async () => (await h.owner("owner").getOwn(id))!.photos.map((p) => p.id)).toEqual([ids[1], ids[0], ids[2], ids[3], ids[4]]);
  await expect(thumb(page, 1)).toHaveAttribute("aria-current", "true");
  await expect(d.getByRole("button", { name: "Hacer portada" })).toHaveCount(0);

  // Quitar una aprobada: pregunta; «Cancelar» la deja.
  await d.getByRole("button", { name: "Quitar foto" }).click();
  const confirm = page.getByRole("dialog", { name: "¿Quitar esta foto?" });
  await expect(confirm).toContainText("Deja de verse en su ficha ahora. Si la vuelve a subir, la revisamos otra vez.");
  await confirm.getByRole("button", { name: "Cancelar" }).click();
  await expect(confirm).toHaveCount(0);
  await expect(counter(page)).toHaveText("6 de 15");
  await d.getByRole("button", { name: "Quitar foto" }).click();
  await confirm.getByRole("button", { name: "Quitar" }).click();
  await expect(counter(page)).toHaveText("5 de 15");
  await expect(d.getByRole("status").filter({ hasText: "Foto quitada" })).toBeVisible();
  await expect.poll(async () => (await h.owner("owner").getOwn(id))!.photos.map((p) => p.id)).toEqual([ids[0], ids[2], ids[3], ids[4]]);

  // La nueva (en revisión): se quita sin preguntar.
  await thumb(page, 5).click();
  await expect(d.getByRole("button", { name: "Mover antes" })).toHaveCount(0);
  await d.getByRole("button", { name: "Quitar foto" }).click();
  await expect(confirm).toHaveCount(0);
  await expect(counter(page)).toHaveText("4 de 15");
  await expect.poll(async () => (await h.owner("owner").getOwn(id))!.edit).toBeNull();

  // Al cerrar no se deshace nada ni se promete.
  await d.getByRole("button", { name: "Listo" }).click();
  await expect(d).toHaveCount(0);
  await expect(page).toHaveURL(detail(id));
  await expect(page.getByRole("link", { name: "Editar fotos: 4 fotos" })).toBeVisible();
  await expect(page.getByText(/deshac|revert/i)).toHaveCount(0);
  expect((await h.owner("owner").getOwn(id))!.photos).toHaveLength(4);
});

test("teclado: el foco se queda en la ventana, Escape la cierra y vuelve al disparador sin mover el fondo", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 560 });
  const { id } = await h.seed({ status: "active", draft: { title: "Casa Coco" } });
  await openDetail(page, id);
  await expect(page.getByTestId("subscription-card")).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    window.scrollTo({ top: 120, behavior: "instant" });
    return window.scrollY;
  })).toBeGreaterThan(0);
  const y = await page.evaluate(() => window.scrollY);
  for (const [trigger, name] of [[editLink(page, "Precio"), "Precio"], [page.getByRole("link", { name: "Editar fotos: 5 fotos" }), "Fotos"]] as const) {
    await trigger.focus();
    await page.keyboard.press("Enter");
    const d = dialog(page, name);
    await expect(d).toBeVisible();
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press("Tab");
      expect(await inside(d), `Tab ${i + 1} dentro de «${name}»`).toBe(true);
    }
    await page.keyboard.press("Shift+Tab");
    expect(await inside(d)).toBe(true);
    await page.keyboard.press("Escape");
    await expect(d).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => window.scrollY)).toBe(y);
  }
});

test("el admin edita igual que antes en escritorio: pantalla del dato, sin ventana", async ({ page }) => {
  const { id } = await h.seed({ status: "active", draft: { title: "Casa Coco" } });
  await injectSession(page, "admin");
  await page.goto(`/admin/casas/${id}/editar/precio`);
  await secondCode(page);
  await expect(page.getByRole("heading", { level: 1, name: "Precio" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto(`/admin/casas/${id}/editar/fotos`);
  await expect(page.getByRole("heading", { level: 1, name: "Fotos" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test.describe("teléfono", () => {
  const { defaultBrowserType: _browser, ...phone } = devices["Pixel 7"];
  test.use(phone);
  test("en el teléfono cada apartado sigue siendo su pantalla, sin ventana", async ({ page }) => {
    const { id } = await h.seed({ status: "active", draft: { title: "Casa Coco" } });
    await page.goto(`/propietario/casas/${id}`);
    await page.getByTestId("field-rows").getByRole("link").filter({ hasText: "Precio" }).click();
    await expect(page).toHaveURL(new RegExp(`/editar/precio$`));
    await expect(page.getByRole("heading", { level: 1, name: "Precio" })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Guardar" })).toBeVisible();
    await page.goto(`/propietario/casas/${id}/editar/fotos`);
    await expect(page.getByRole("heading", { level: 1, name: "Fotos" })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("Mantenga pulsada una foto y arrástrela para cambiar el orden. La primera es la portada.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Quitar foto 2" })).toBeVisible();
  });
});
