import { expect, test, type Page } from "@playwright/test";
import type { ListingsHarness } from "../contract/harness";
import { postgrestHarness } from "../db/postgrest-harness";
import { injectSession } from "./helpers/session";

// Asistente de publicar en nueve pantallas (decisión 2026-10-21) contra Supabase local, con la sesión inyectada.
// iPhone SE (375×667): ninguna pantalla hace scroll, con o sin teclado. Las fotos se siembran en la base (la subida es el 08).
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
const TITLE = "Casa Manzanillo, a pie de playa";
const alert = (page: Page) => page.locator('.note[role="alert"]');
let h: ListingsHarness;

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

/** Ninguna pantalla del asistente hace scroll: todo cabe en la ventana. */
async function expectNoScroll(page: Page, what: string) {
  await page.waitForLoadState("networkidle");
  const [scrollH, innerH] = await page.evaluate(() => [document.documentElement.scrollHeight, window.innerHeight]);
  expect(scrollH, `${what} hace scroll: ${scrollH} > ${innerH}`).toBeLessThanOrEqual(innerH);
}

const continuar = (page: Page) => page.getByRole("button", { name: "Continuar" }).click();
async function count(page: Page, label: string, n: number) {
  for (let i = 0; i < n; i++) await page.getByRole("button", { name: `Más ${label}` }).click();
}
const idFrom = (page: Page) => /\/publicar\/([0-9a-f-]{36})\//.exec(page.url())![1]!;

/** Al tocar un campo de texto la página gana sitio abajo y el campo sube hasta debajo de la cabecera (teclado del iPhone). */
async function expectKeyboardRoom(page: Page, fieldId: string) {
  const top = () => page.evaluate((id) => Math.round(document.getElementById(id)!.getBoundingClientRect().top), fieldId);
  const extra = () => page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  await page.locator(`#${fieldId}`).focus();
  await expect.poll(extra).toBeGreaterThanOrEqual(250);
  await expect.poll(top).toBeLessThanOrEqual(130);
  expect(await top()).toBeGreaterThanOrEqual(40);
  await page.locator(`#${fieldId}`).blur();
  await expect.poll(extra).toBe(0);
}

test("las nueve pantallas: se guardan por detrás, sin scroll con y sin teclado, y se envía a revisión", async ({ page }) => {
  await page.goto("/propietario");
  await page.getByRole("link", { name: "Publicar casa" }).click();
  await expect(page).toHaveURL(/\/propietario\/publicar$/);
  await page.getByRole("button", { name: "Empezar" }).click();
  await expect(page).toHaveURL(/\/propietario\/publicar\/[0-9a-f-]+\/1$/);
  const id = idFrom(page);
  await expect(page.getByText("Paso 1 de 9")).toBeVisible();
  await expect(page.locator(".progress span")).toHaveCount(9);
  await expect(page.locator(".progress span.on")).toHaveCount(1);
  await expectNoScroll(page, "paso 1");

  // 1 Alojamiento: tipo y modalidad explícitos, nada preseleccionado; un error no borra lo elegido.
  await expect(page.locator('label.choice[aria-pressed="true"]')).toHaveCount(0);
  await continuar(page);
  await expect(alert(page)).toHaveText("Elija Alojamiento completo o Habitación.");
  await page.getByText("Alojamiento completo", { exact: true }).click();
  await continuar(page);
  await expect(alert(page)).toHaveText("Marque Vacacional, Mensual o las dos.");
  await expect(page.locator('label.choice[aria-pressed="true"]')).toHaveCount(1);
  await page.getByText("Vacacional", { exact: true }).click();
  await page.getByText("Mensual", { exact: true }).click();
  await continuar(page);
  await expect(page).toHaveURL(/\/2$/);
  await expect(page.getByText("Paso 2 de 9")).toBeVisible();
  await expectNoScroll(page, "paso 2");

  // 2 Dónde está: cantón de lista según la provincia; «Listo» en la zona envía el paso.
  const canton = page.getByLabel("Cantón");
  await expect(page.getByLabel("Provincia")).toHaveValue("Limón");
  await expect(canton.locator("option")).toHaveCount(7);
  await continuar(page);
  await expect(alert(page)).toHaveText("Elija el cantón.");
  await canton.selectOption("Talamanca");
  await page.getByLabel("Provincia").selectOption("Puntarenas");
  await expect(canton).toHaveValue("");
  await page.getByLabel("Provincia").selectOption("Limón");
  await canton.selectOption("Talamanca");
  const zone = page.getByLabel("Zona, playa o barrio");
  await expect(zone).toHaveAttribute("enterkeyhint", "done");
  expect(await page.evaluate(() => Math.round(document.getElementById("pub-zone")!.getBoundingClientRect().top))).toBeGreaterThan(300);
  await expectKeyboardRoom(page, "pub-zone");
  await zone.fill("Manzanillo");
  await zone.press("Enter");
  await expect(page).toHaveURL(/\/3$/);
  await expectNoScroll(page, "paso 3");

  // 3 Mapa (Leaflet bajo demanda): el pin es obligatorio.
  await continuar(page);
  await expect(alert(page)).toHaveText("Marque en el mapa la ubicación aproximada.");
  await page.locator(".leaflet-container").click({ position: { x: 150, y: 120 } });
  await expect(page.locator('input[name="lat"]')).not.toHaveValue("");
  await expect(page.getByText("Arrastre el pin")).toBeVisible();
  await continuar(page);
  await expect(page).toHaveURL(/\/4$/);
  await expectNoScroll(page, "paso 4");

  // 4 Capacidad.
  await continuar(page);
  await expect(alert(page)).toContainText("Indique cuántas personas");
  await count(page, "personas", 5);
  await count(page, "habitaciones", 2);
  await count(page, "baños", 2);
  await continuar(page);
  await expect(page).toHaveURL(/\/5$/);
  await expectNoScroll(page, "paso 5");

  // 5 Características: tipo de parqueo al marcar Parqueo.
  await expect(page.getByLabel("Tipo de parqueo")).toHaveCount(0);
  await page.getByText("Parqueo", { exact: true }).click();
  await expect(page.getByLabel("Tipo de parqueo")).toBeVisible();
  await expectNoScroll(page, "paso 5 con parqueo");
  await continuar(page);
  await expect(alert(page)).toHaveText("Indique si el parqueo es gratuito o de pago.");
  await page.getByLabel("Tipo de parqueo").selectOption("free");
  await page.getByText("Frente al mar", { exact: true }).click();
  await continuar(page);
  await expect(page).toHaveURL(/\/6$/);
  await expectNoScroll(page, "paso 6");

  // 6 Nombre y descripción: «Siguiente» en el nombre enfoca la descripción; con teclado tampoco hay scroll de más.
  const title = page.getByLabel("Nombre de la casa");
  await expect(title).toHaveAttribute("enterkeyhint", "next");
  await expectKeyboardRoom(page, "pub-title");
  await title.fill("Se pierde al recargar");
  await title.press("Enter");
  await expect(page.getByLabel("Descripción")).toBeFocused();
  await expect(page).toHaveURL(/\/6$/);

  // Lo no enviado se pierde al recargar; lo guardado en pantallas anteriores sigue en la base.
  await page.reload();
  await expect(title).toHaveValue("");
  await expect.poll(async () => (await h.owner("owner").getOwn(id))?.canton).toBe("Talamanca");
  expect(await h.owner("owner").getOwn(id)).toMatchObject({ kind: "completo", acceptsNightly: true, acceptsMonthly: true, zone: "Manzanillo", capacity: 5, bedrooms: 2, bathrooms: 2, features: ["parking", "beachfront"], parkingPaid: false });
  await page.getByRole("link", { name: "Atrás" }).click();
  await expect(page).toHaveURL(/\/5$/);
  await expect(page.locator('label.chip[aria-pressed="true"]')).toHaveCount(2);

  // «Nueva» con un borrador pendiente ofrece seguirlo; abrir esa pantalla no crea borradores.
  await page.goto("/propietario/casas");
  await page.getByRole("link", { name: "Nueva" }).click();
  await expect(page).toHaveURL(/\/propietario\/publicar$/);
  await expect(page.getByText("Tiene un borrador sin enviar")).toBeVisible();
  await page.reload();
  await page.getByRole("link", { name: "Seguir con el borrador" }).click();
  await expect(page).toHaveURL(new RegExp(`/propietario/publicar/${id}/1$`));
  expect((await h.owner("owner").listOwn()).length).toBe(1);

  await page.goto(`/propietario/publicar/${id}/6`);
  await title.fill(TITLE);
  await page.getByLabel("Descripción").fill("Casa de madera a 80 m de la playa, con rancho y hamacas.");
  await continuar(page);
  await expect(page).toHaveURL(/\/7$/);

  // 7 Fotos: el recuento sale de la base; con 4 no deja seguir, con 5 sí. La rejilla hace scroll por dentro, la página no.
  await expect(page.getByRole("status")).toHaveText("0 de 5–15");
  await h.addPhotos(id, 4);
  await page.reload();
  await expect(page.getByRole("status")).toHaveText("4 de 5–15");
  await continuar(page);
  await expect(alert(page)).toHaveText("Agregue al menos 5 fotos.");
  await h.addPhotos(id, 1);
  await page.reload();
  await expect(page.getByRole("status")).toHaveText("5 de 5–15");
  await expect(page.locator(".photos-grid .photo.cover .tag")).toHaveText("Portada");
  await expectNoScroll(page, "paso 7 con 5 fotos");
  await continuar(page);
  await expect(page).toHaveURL(/\/8$/);
  await expectNoScroll(page, "paso 8");

  // 8 Precio: un precio por modalidad (acepta separadores); «Listo» en el último envía el paso.
  await expect(page.getByLabel("Por noche")).toHaveAttribute("enterkeyhint", "next");
  await expect(page.getByLabel("Por mes")).toHaveAttribute("enterkeyhint", "done");
  await expectKeyboardRoom(page, "pub-monthlyPriceCrc");
  await page.getByLabel("Por noche").fill("85.000");
  await page.getByLabel("Por noche").press("Enter");
  await expect(page.getByLabel("Por mes")).toBeFocused();
  await page.getByLabel("Por mes").fill("900.000");
  await page.getByLabel("Por mes").press("Enter");
  await expect(page).toHaveURL(/\/9$/);
  await expectNoScroll(page, "paso 9");

  // 9 Enviar: WhatsApp de la cuenta (solo lectura) y la oferta; relee el borrador, valida todo y envía.
  await expect(page.getByText("+506 8777 0001")).toBeVisible();
  await expect(page.getByText("₡0 · 12 meses")).toBeVisible();
  await page.getByRole("button", { name: "Enviar a revisión" }).click();
  await expect(page).toHaveURL(new RegExp(`/propietario/casas/${id}/enviada$`));
  await expect(page.getByRole("heading", { name: "¡Listo! Su casa está en revisión" })).toBeVisible();
  expect(await h.owner("owner").getOwn(id)).toMatchObject({ status: "review", title: TITLE, nightlyPriceCrc: 85000, monthlyPriceCrc: 900000, photoCount: 5 });
  await page.getByRole("link", { name: "Ir a Mis casas" }).click();
  await expect(page.getByRole("article").getByText("En revisión", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: TITLE })).toBeVisible();
});

test("si la base rechaza un guardado, vuelve a esa pantalla con su mensaje y lo escrito intacto", async ({ page }) => {
  const draft = await h.seed({ status: "draft", photos: 5 });
  await page.goto(`/propietario/publicar/${draft.id}/6`);
  await expect(page.getByLabel("Nombre de la casa")).toHaveValue("Cabina Cahuita");
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route("**/rest/v1/listings?**", async (route) => {
    if (route.request().method() !== "PATCH") return route.fallback();
    await held;
    await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "P0001", message: "Este anuncio no se puede editar en su estado actual. Ábralo para editar y volverá a revisión." }) });
  });
  await page.getByLabel("Nombre de la casa").fill("Cabina renovada");
  await continuar(page);
  // Navega al instante mientras guarda por detrás.
  await expect(page).toHaveURL(/\/7$/);
  await expect(page.getByText("Paso 7 de 9")).toBeVisible();
  release();
  await expect(page).toHaveURL(/\/6$/);
  await expect(alert(page)).toHaveText("Este anuncio no se puede editar en su estado actual. Ábralo para editar y volverá a revisión.");
  await expect(page.getByLabel("Nombre de la casa")).toHaveValue("Cabina renovada");
  await expect(page.getByLabel("Descripción")).toHaveValue("Cabina frente al parque.");
  expect((await h.owner("owner").getOwn(draft.id))?.title).toBe("Cabina Cahuita");

  // Con la base de vuelta, el mismo paso se guarda.
  await page.unroute("**/rest/v1/listings?**");
  await continuar(page);
  await expect(page).toHaveURL(/\/7$/);
  await expect.poll(async () => (await h.owner("owner").getOwn(draft.id))?.title).toBe("Cabina renovada");
});

test("retomar un borrador empezado en otro dispositivo, y «Corregir y reenviar» abre el asistente con todo relleno", async ({ page }) => {
  const pending = await h.seed({ status: "draft", draft: { title: "Borrador del otro teléfono", kind: "habitacion", bathroomShared: true } });
  const changes = await h.seed({ status: "changes", draft: { title: "Cabina con cambios" } });
  await page.goto("/propietario/publicar");
  await expect(page.getByText("Tiene un borrador sin enviar")).toBeVisible();
  await expect(page.getByText(/«Borrador del otro teléfono»/)).toBeVisible();
  await page.getByRole("link", { name: "Seguir con el borrador" }).click();
  await expect(page).toHaveURL(new RegExp(`/propietario/publicar/${pending.id}/1$`));
  await expect(page.locator('label.choice[aria-pressed="true"]')).toHaveText([/Vacacional/, /Habitación/]);
  await page.goto(`/propietario/publicar/${pending.id}/4`);
  await expect(page.getByText("Baño de la habitación")).toBeVisible();
  await expect(page.locator('label.chip[aria-pressed="true"]')).toHaveText("Compartido");

  await page.goto(`/propietario/casas/${changes.id}`);
  await page.getByRole("button", { name: "Corregir y reenviar" }).click();
  await expect(page).toHaveURL(new RegExp(`/propietario/publicar/${changes.id}/1$`));
  await expect(page.locator('label.choice[aria-pressed="true"]')).toHaveCount(2);
  await page.goto(`/propietario/publicar/${changes.id}/6`);
  await expect(page.getByLabel("Nombre de la casa")).toHaveValue("Cabina con cambios");
  await page.goto(`/propietario/publicar/${changes.id}/9`);
  await page.getByRole("button", { name: "Enviar a revisión" }).click();
  await expect(page).toHaveURL(new RegExp(`/propietario/casas/${changes.id}/enviada$`));
  expect((await h.owner("owner").getOwn(changes.id))?.status).toBe("review");

  // Una casa en revisión no se edita: el asistente lleva a su detalle.
  await page.goto(`/propietario/publicar/${changes.id}/2`);
  await expect(page).toHaveURL(new RegExp(`/propietario/casas/${changes.id}$`));
});

test("enviar con un dato que falta lleva a la pantalla que lo pide", async ({ page }) => {
  const draft = await h.seed({ status: "draft", photos: 5, draft: { capacity: null } });
  await page.goto(`/propietario/publicar/${draft.id}/9`);
  await page.getByRole("button", { name: "Enviar a revisión" }).click();
  await expect(page).toHaveURL(/\/4$/);
  await expect(alert(page)).toHaveText("Indique cuántas personas pueden alojarse (mínimo 1).");
  expect((await h.owner("owner").getOwn(draft.id))?.status).toBe("draft");
});
