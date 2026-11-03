import { expect, test, type Page } from "./helpers/test";
import { readFileSync } from "node:fs";
import type { SubscriptionHarness } from "../contract/harness";
import { addMonths } from "../../src/domain/calendar";
import { longDate } from "../../src/domain/dates";
import { costaRicaToday } from "../../src/domain/inquiry";
import { postgrestHarness } from "../db/postgrest-harness";
import { secondCode } from "./helpers/admin";
import { injectSession } from "./helpers/session";

// El admin edita las casas (ronda de Ana del 2 nov, ticket 10, versión simple), contra Supabase local con el admin de prueba
// (8899 0001, TOTP): las pantallas del anfitrión con el puerto del admin, al momento y sin revisión. Capturas 375×667 en
// .scratch/ronda-ana-2026-11-02/capturas/r10-*.png.
const FOTOS = new URL("../../../../design/pantallas/fotos/", import.meta.url).pathname;
const CAPTURAS = new URL("../../../../.scratch/ronda-ana-2026-11-02/capturas/", import.meta.url).pathname;
const foto = (name: string) => ({ name, mimeType: "image/jpeg", buffer: readFileSync(`${FOTOS}${name}`) });
let h: SubscriptionHarness;

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 375, height: 667 } });

test.beforeAll(async () => {
  h = await postgrestHarness();
});

test.beforeEach(async ({ page }) => {
  await h.reset();
  await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: readFileSync(`${FOTOS}loft.jpg`), contentType: "image/jpeg" }));
});

/** Entra en una pantalla del admin con el segundo código. */
async function asAdmin(page: Page, path: string) {
  await injectSession(page, "admin");
  await page.goto(path);
  await secondCode(page);
  await expect(page).toHaveURL(new RegExp(`${path.replace(/[?]/g, "\\?")}$`));
}

/** La hoja de una casa en Casas, buscándola por su nombre. */
async function openSheet(page: Page, title: string) {
  await page.getByRole("searchbox", { name: "Buscar casas" }).fill(title);
  await page.locator(".house-row").filter({ hasText: title }).click();
  const sheet = page.getByRole("dialog", { name: title });
  await expect(sheet).toBeVisible();
  return sheet;
}

const rows = (page: Page) => page.getByTestId("field-rows");
const row = (page: Page, title: string) => rows(page).getByRole("link").filter({ has: page.locator(".field-title", { hasText: new RegExp(`^${title}`) }) });
const toastText = (page: Page) => page.getByRole("status").filter({ hasText: /^Guardado\./ });
const shot = (page: Page, n: string) => page.screenshot({ path: `${CAPTURAS}r10-${n}.png` });

test("editar el nombre y el precio de una casa publicada: al momento, sin revisión, y se ve en la ficha pública", async ({ page }) => {
  const title = `Casa Ajena ${Date.now().toString(36).slice(-4)}`;
  const { id, publicId } = await h.seed({ status: "active", draft: { title } });
  await asAdmin(page, "/admin/casas");
  const sheet = await openSheet(page, title);
  await expect(sheet.getByRole("link", { name: "Editar casa" })).toBeVisible();
  await expect(sheet.getByRole("link", { name: "Editar calendario" })).toBeVisible();
  // La hoja sube con una animación: la captura, ya quieta.
  await expect.poll(async () => (await sheet.boundingBox())?.y).toBeLessThan(400);
  await page.waitForTimeout(300);
  await shot(page, "1-hoja-editar-casa");
  await sheet.getByRole("link", { name: "Editar casa" }).click();

  await expect(page).toHaveURL(new RegExp(`/admin/casas/${id}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Editar casa" })).toBeVisible();
  await expect(page.getByText("Lo que guarde se publica al momento, sin revisión.")).toBeVisible();
  await expect(rows(page).locator(".tag-rev")).toHaveCount(0);
  await shot(page, "2-edicion-modo-admin");

  await row(page, "Nombre").click();
  await expect(page).toHaveURL(new RegExp(`/admin/casas/${id}/editar/nombre$`));
  await expect(page.getByTestId("review-notice")).toHaveCount(0);
  await page.getByLabel("Nombre de la casa").fill("Casa editada por Ana");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(toastText(page)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/admin/casas/${id}$`));
  await expect(row(page, "Nombre")).toContainText("Casa editada por Ana");

  await row(page, "Precio").click();
  await page.getByLabel("Precio por noche").fill("61 000");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/casas/${id}$`));
  await expect(row(page, "Precio")).toContainText("₡61 000 / noche");

  // En la base: la casa sigue activa, sin edición pendiente, y queda una línea por guardado en el registro.
  const own = await h.owner("owner").getOwn(id);
  expect(own).toMatchObject({ title: "Casa editada por Ana", nightlyPriceCrc: 61000, status: "active", edit: null });
  expect((await h.adminActions(id)).map((a) => a.action)).toEqual(["listing.edit", "listing.edit"]);
  await page.goto(`/casa/${publicId}`);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Casa editada por Ana" })).toBeVisible();
  await expect(page.getByText("₡61 000").first()).toBeVisible();
});

test("un dato que el anfitrión tenía en revisión: manda lo de Ana y ese pendiente se descarta", async ({ page }) => {
  const { id, publicId } = await h.seed({ status: "active", draft: { title: "Cabina Pendiente" } });
  await h.owner("owner").saveEdit(id, { title: "Nombre del anfitrión" });
  await asAdmin(page, `/admin/casas/${id}`);
  // Ana ve lo publicado y, aparte, lo que el anfitrión tiene en revisión.
  await expect(row(page, "Nombre")).toContainText("Cabina Pendiente");
  await expect(page.getByTestId("theirs-nombre")).toHaveText("Pendiente del anfitrión: Nombre del anfitrión");
  await page.getByTestId("theirs-nombre").scrollIntoViewIfNeeded();
  await shot(page, "2b-pendiente-del-anfitrion");
  await row(page, "Nombre").click();
  await expect(page.getByLabel("Nombre de la casa")).toHaveValue("Cabina Pendiente");
  await page.getByLabel("Nombre de la casa").fill("Nombre de Ana");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/casas/${id}$`));
  await expect(row(page, "Nombre")).toContainText("Nombre de Ana");
  await expect(page.getByTestId("theirs-nombre")).toHaveCount(0);
  expect((await h.owner("owner").getOwn(id))?.edit).toBeNull();
  expect((await h.admin("aal2").editQueue()).some((i) => i.listing.id === id)).toBe(false);
  expect((await h.anon.getPublic(publicId))?.title).toBe("Nombre de Ana");
});

test("asistir un borrador ajeno: rellenar un paso, subir una foto y enviarlo a revisión", async ({ page }) => {
  const { id } = await h.seed({ status: "draft", as: "other", draft: { title: "" } });
  await asAdmin(page, "/admin/casas");
  await page.getByRole("link", { name: "Borradores sin enviar" }).click();
  await expect(page).toHaveURL(/\/admin\/borradores$/);
  const item = page.getByRole("link").filter({ hasText: h.ownerName("other") });
  await expect(item).toContainText("Sin nombre");
  await expect(item).toContainText("Falta: nombre y fotos");
  await shot(page, "3-borradores");
  await item.click();

  // Abre donde se quedó: el nombre.
  await expect(page).toHaveURL(new RegExp(`/admin/casas/${id}/publicar/6$`));
  await expect(page.getByRole("heading", { level: 1, name: "Asistir casa" })).toBeVisible();
  await page.getByLabel("Nombre de la casa").fill("Cabina asistida por Ana");
  await shot(page, "4-asistente-modo-admin");
  await page.getByRole("button", { name: /Continuar/ }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/casas/${id}/publicar/7$`));
  await page.getByLabel("Añadir fotos").setInputFiles([foto("hero.jpg")]);
  await expect(page.getByRole("status").filter({ hasText: "de 15" })).toHaveText("1 de 15", { timeout: 20_000 });
  await page.getByRole("button", { name: /Continuar/ }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/casas/${id}/publicar/8$`));
  await page.getByRole("button", { name: /Continuar/ }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/casas/${id}/publicar/9$`));
  await page.getByRole("button", { name: "Enviar a revisión" }).click();

  // Enviada: a su revisión, donde Ana (o quien sea) la aprueba como siempre.
  await expect(page).toHaveURL(new RegExp(`/admin/anuncios/${id}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Revisar anuncio" })).toBeVisible();
  const own = await h.owner("other").getOwn(id);
  expect(own).toMatchObject({ title: "Cabina asistida por Ana", status: "review", photoCount: 1 });
  expect(own!.photos[0]!.path).toMatch(new RegExp(`^${id}/[0-9a-f-]{36}$`));
  expect((await h.objects(id)).map((o) => o.name.split("/")[2])).toEqual(["1600.jpg", "480.jpg", "800.jpg"]);
  expect((await h.adminActions(id)).map((a) => a.action)).toEqual(["listing.edit", "listing.edit", "listing.submit"]);
});

test("editar el calendario de una casa ajena", async ({ page }) => {
  const title = "Casa Calendario Ajeno";
  const { id, publicId } = await h.seed({ status: "active", as: "other", draft: { title, nightlyPriceCrc: 95000 } });
  const next = addMonths(costaRicaToday(Date.now()).slice(0, 7), 1);
  const iso = `${next}-12`;
  await asAdmin(page, "/admin/casas");
  const sheet = await openSheet(page, title);
  await sheet.getByRole("link", { name: "Editar calendario" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/casas/${id}/calendario$`));
  await expect(page.getByRole("heading", { level: 1, name: "Calendario" })).toBeVisible();
  await expect(page.locator(".cal-house")).toHaveText(title);
  // «Cerrar la casa hasta…» es del anfitrión.
  await expect(page.getByRole("button", { name: /Cerrar la casa hasta/ })).toHaveCount(0);
  await expect(page.getByText("Toque los días para editarlos")).toBeVisible();
  await shot(page, "5-calendario-casa-ajena");
  await page.locator(`[data-month="${next}"]`).scrollIntoViewIfNeeded();
  const day = page.getByRole("button", { name: new RegExp(`^${longDate(iso)} de ${iso.slice(0, 4)}(,|$)`) });
  await day.click();
  const panel = page.getByRole("region", { name: "Días seleccionados" });
  await panel.getByRole("button", { name: "Ocupado" }).click();
  await expect(panel.getByRole("button", { name: "Ocupado" })).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(400); // el panel entra con una animación
  await shot(page, "5b-calendario-dia-seleccionado");
  await panel.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(panel).toHaveCount(0);
  await expect.poll(async () => (await h.calendar("other").days(id)).map((d) => [d.day, d.available])).toEqual([[iso, false]]);
  expect(await h.anon.getPublicDays(publicId)).toEqual([{ day: iso, available: false, specialPriceCrc: null }]);
  expect((await h.adminActions(id)).map((a) => a.action)).toEqual(["listing.edit"]);
});
