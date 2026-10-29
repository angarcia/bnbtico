import { expect, test, type Page } from "./helpers/test";
import { readFileSync } from "node:fs";
import { postgrestHarness } from "../db/postgrest-harness";
import { injectSession } from "./helpers/session";

// Editar una casa publicada sin sacarla de Explorar (spec .scratch/editar-casa, maquetas 08a–08c), contra Supabase local.
// La ficha editable: cada dato es una fila que abre su pantalla; lo que pasa por revisión lleva la etiqueta «Revisión» y,
// con un cambio pendiente, el valor nuevo con «Sin enviar» o «En revisión»; la edición se avisa arriba y en Mis casas.
const FOTOS = new URL("../../../../design/pantallas/fotos/", import.meta.url).pathname;
let h: Awaited<ReturnType<typeof postgrestHarness>>;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  h = await postgrestHarness();
});

test.beforeEach(async ({ page }) => {
  await h.reset();
  await injectSession(page, "owner");
  await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: readFileSync(`${FOTOS}loft.jpg`), contentType: "image/jpeg" }));
});

const rows = (page: Page) => page.getByTestId("field-rows");
const row = (page: Page, title: string) => rows(page).getByRole("link").filter({ has: page.locator(".field-title", { hasText: new RegExp(`^${title}`) }) });
const card = (page: Page, title: string) => page.getByRole("article").filter({ has: page.getByRole("heading", { name: title }) });

test("la ficha editable de una casa activa", async ({ page }) => {
  const { id, publicId } = await h.seed({ status: "active", draft: { title: "Casa Coco" } });
  await page.goto(`/propietario/casas/${id}`);
  await expect(page.getByRole("heading", { level: 1, name: "Casa Coco" })).toBeVisible();
  await expect(rows(page).locator(".field-title")).toHaveText([
    /^Nombre/,
    /^Tipo/,
    /^Personas, habitaciones y baños/,
    /^Características/,
    /^Descripción/,
    /^Precio/,
    /^Ubicación/,
  ]);
  await expect(rows(page).locator(".tag-rev", { hasText: /^Revisión$/ })).toHaveCount(4);
  await expect(row(page, "Nombre")).toHaveAttribute("href", `/propietario/casas/${id}/editar/nombre`);
  await expect(row(page, "Personas, habitaciones y baños")).toHaveAttribute("href", `/propietario/casas/${id}/editar/capacidad`);
  await expect(row(page, "Nombre")).toContainText("Casa Coco");
  await expect(page.getByText("Toque un dato para cambiarlo. Lo marcado con Revisión lo revisamos antes de publicarlo; mientras tanto, los clientes ven la versión actual.")).toBeVisible();
  const pill = page.getByRole("link", { name: "5 fotos · Editar" });
  await expect(pill).toHaveAttribute("href", `/propietario/casas/${id}/editar/fotos`);
  await expect(page.locator(".detail-photo .state")).toHaveText("Activa");
  const share = page.getByRole("button", { name: "Compartir ficha" });
  await expect(share).toHaveClass(/btn-primary/);
  await expect(page.getByTestId("share-url")).toHaveText(new RegExp(`/casa/${publicId}$`));
  await expect(page.getByText("WhatsApp de esta casa")).toBeVisible();
  const sub = page.getByTestId("subscription-card");
  await expect(sub.getByRole("heading", { name: "Suscripción" })).toBeVisible();
  await expect(sub).toContainText("Oferta de lanzamiento");
  await expect(sub).toContainText("Al día");
  await expect(sub.getByTestId("subscription-row")).toHaveText(/^Gratis hasta el /);
  await expect(sub).toContainText(". Después, ₡2 900 al mes, sin permanencia.");
  await expect(sub.getByRole("link")).toHaveAttribute("href", `/propietario/suscripcion#pago=${publicId}`);
  await expect(page.getByText("Editar la ficha")).toHaveCount(0);
  await expect(page.getByText("Anuncio visible")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Descartar borrador" })).toHaveCount(0);
  await expect(page.getByText(/Cambios sin enviar/)).toHaveCount(0);
  // La suscripción al día va al final, no arriba.
  expect((await page.getByTestId("subscription-row").boundingBox())!.y).toBeGreaterThan((await share.boundingBox())!.y);

  // Un nombre nuevo guardado en la edición: aviso arriba, el valor nuevo en su fila; la ficha pública no cambia.
  await h.owner("owner").saveEdit(id, { title: "Casa Coco frente al mar" });
  await page.reload();
  await expect(page.getByText("Cambios sin enviar: nombre")).toBeVisible();
  await expect(page.getByText("Mientras tanto, los clientes ven la versión aprobada.")).toBeVisible();
  await expect(row(page, "Nombre")).toContainText("Casa Coco frente al mar");
  await expect(row(page, "Nombre").locator(".tag-rev")).toHaveText("Sin enviar");
  await expect(rows(page).locator(".tag-rev", { hasText: /^Revisión$/ })).toHaveCount(3);
  await expect(page.locator(".detail-photo .state")).toHaveText("Edición sin enviar");
  await expect(page.getByRole("heading", { level: 1, name: "Casa Coco" })).toBeVisible();

  await page.goto("/propietario/casas");
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(card(page, "Casa Coco").getByTestId("card-label")).toHaveText("Edición sin enviar");
  await card(page, "Casa Coco").getByRole("link", { name: "Casa Coco" }).click();
  await expect(page).toHaveURL(new RegExp(`/propietario/casas/${id}$`));

  // «Descartar cambios» pregunta; al cancelar no pasa nada, al aceptar la edición desaparece.
  page.once("dialog", (d) => {
    expect(d.message()).toBe("¿Descartar los cambios sin aplicar? Su ficha sigue como está.");
    void d.dismiss();
  });
  await page.getByRole("button", { name: "Descartar cambios" }).click();
  await expect(page.getByText("Cambios sin enviar: nombre")).toBeVisible();
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Descartar cambios" }).click();
  await expect(page.getByText(/Cambios sin enviar/)).toHaveCount(0);
  await expect(row(page, "Nombre").locator(".tag-rev")).toHaveText("Revisión");
  await expect.poll(async () => (await h.owner("owner").getOwn(id))!.edit).toBeNull();
});

test("enviar a revisión: el aviso cambia y los errores se ven", async ({ page }) => {
  const { id } = await h.seed({ status: "active", draft: { title: "Casa Coco" } });
  await h.owner("owner").saveEdit(id, { title: "Casa Coco frente al mar" });
  await page.goto(`/propietario/casas/${id}`);
  // La base se niega (p. ej. una edición vacía): el mensaje en el aviso de error.
  await page.route("**/rest/v1/rpc/submit_edit", (route) =>
    route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "P0001", message: "No hay cambios que enviar.", details: null, hint: null }) }),
  );
  await page.getByRole("button", { name: "Enviar a revisión" }).click();
  await expect(page.locator('.note[role="alert"]')).toHaveText("No hay cambios que enviar.");
  await page.unroute("**/rest/v1/rpc/submit_edit");
  // Se ve el error de la última acción: si después falla descartar, sale el suyo y no el de enviar.
  await page.route("**/rest/v1/rpc/discard_edit", (route) =>
    route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "P0001", message: "No encontramos esa edición.", details: null, hint: null }) }),
  );
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Descartar cambios" }).click();
  await expect(page.locator('.note[role="alert"]')).toHaveText("No encontramos esa edición.");
  await page.unroute("**/rest/v1/rpc/discard_edit");

  await page.getByRole("button", { name: "Enviar a revisión" }).click();
  await expect(page.getByText("Edición en revisión: nombre · normalmente en menos de 24 horas")).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar a revisión" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Descartar cambios" })).toBeVisible();
  // En revisión, la fila deja de ser un enlace (maqueta 08c): candado y la etiqueta invertida; las demás siguen abriéndose.
  const locked = rows(page).locator(".list-item.is-locked");
  await expect(locked).toHaveCount(1);
  await expect(locked).toContainText("Casa Coco frente al mar");
  await expect(locked.locator(".tag-rev.is-pending")).toHaveText("En revisión");
  await expect(rows(page).getByRole("group", { name: "Nombre: en revisión" })).toHaveCount(1);
  await expect(rows(page).locator(`a[href="/propietario/casas/${id}/editar/nombre"]`)).toHaveCount(0);
  await expect(row(page, "Tipo")).toHaveAttribute("href", `/propietario/casas/${id}/editar/tipo`);
  await expect(page.locator(".detail-photo .state")).toHaveText("Edición en revisión");
  expect((await h.owner("owner").getOwn(id))!.edit?.status).toBe("review");
});

test("inactiva: el bloque ocre arriba", async ({ page }) => {
  const { id, publicId } = await h.seed({ status: "active", draft: { title: "Casa Coco" } });
  await h.billing("owner").stop(id);
  await page.goto(`/propietario/casas/${id}`);
  const block = page.getByTestId("stopped-notice");
  await expect(block.getByRole("heading", { name: "Suscripción parada" })).toBeVisible();
  await expect(block).toContainText("Casa Coco no aparece en Explorar y el enlace de su ficha no funciona. Actívela para que vuelvan a escribirle.");
  await expect(block.getByRole("link", { name: "Activar suscripción" })).toHaveAttribute("href", `/propietario/suscripcion#pago=${publicId}`);
  await expect(block).toContainText("₡2 900 al mes, sin permanencia");
  expect((await block.boundingBox())!.y).toBeLessThan((await page.locator(".detail-photo").boundingBox())!.y);
  await expect(page.getByRole("button", { name: "Compartir ficha" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Ver ficha" })).toHaveCount(0);
  await expect(page.getByTestId("subscription-row")).toHaveCount(0);
  await expect(page.locator(".detail-photo .state")).toHaveText("Inactiva");
});

// ---------- Las pantallas de cada dato ----------

const save = (page: Page) => page.getByRole("button", { name: "Guardar" });
const toastText = (page: Page) => page.getByRole("status").filter({ hasText: /^Guardado\./ });

test("cambiar el precio: al momento, en la ficha pública y en Explorar", async ({ page }) => {
  const { id, publicId } = await h.seed({ status: "active" });
  await page.goto(`/propietario/casas/${id}`);
  await row(page, "Precio").click();
  await expect(page).toHaveURL(new RegExp(`/propietario/casas/${id}/editar/precio$`));
  await expect(page.getByRole("heading", { level: 1, name: "Precio" })).toBeVisible();
  await expect(page.getByLabel("Precio por noche")).toHaveValue("42000");
  await page.getByLabel("Precio por noche").fill("55 000");
  await save(page).click();
  await expect(toastText(page)).toHaveText("Guardado. Ya se ve en su ficha.");
  await expect(page).toHaveURL(new RegExp(`/propietario/casas/${id}$`));
  await expect(row(page, "Precio")).toContainText("₡55 000 / noche");
  await expect(page.getByText(/Cambios sin enviar/)).toHaveCount(0);
  expect((await h.owner("owner").getOwn(id))!.nightlyPriceCrc).toBe(55000);
  await page.goto(`/casa/${publicId}`);
  await page.reload();
  await expect(page.getByText("₡55 000").first()).toBeVisible();
  await page.goto("/explorar");
  await expect(page.getByRole("link", { name: /Cabina Cahuita/ })).toBeVisible();
});

test("cambiar el nombre: la ficha pública sigue igual hasta aprobar", async ({ page }) => {
  const { id, publicId } = await h.seed({ status: "active" });
  await page.goto(`/propietario/casas/${id}`);
  await row(page, "Nombre").click();
  await expect(page.getByRole("heading", { level: 1, name: "Nombre" })).toBeVisible();
  await expect(page.getByLabel("Nombre de la casa")).toHaveValue("Cabina Cahuita");
  await page.getByLabel("Nombre de la casa").fill("Casa Coco frente al mar");
  await save(page).click();
  await expect(toastText(page)).toHaveText("Guardado. Envíelo a revisión cuando termine.");
  await expect(page).toHaveURL(new RegExp(`/propietario/casas/${id}$`));
  await expect(page.getByText("Cambios sin enviar: nombre")).toBeVisible();
  await expect(row(page, "Nombre")).toContainText("Casa Coco frente al mar");

  await page.goto(`/casa/${publicId}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cabina Cahuita");
  await page.goto("/propietario/casas");
  await expect(card(page, "Cabina Cahuita").getByTestId("card-label")).toHaveText("Edición sin enviar");

  await page.goto(`/propietario/casas/${id}`);
  await page.getByRole("button", { name: "Enviar a revisión" }).click();
  await expect(page.getByText("Edición en revisión: nombre · normalmente en menos de 24 horas")).toBeVisible();
  await page.goto("/propietario/casas");
  await expect(card(page, "Cabina Cahuita").getByTestId("card-label")).toHaveText("Edición en revisión");

  // En revisión, la pantalla del nombre (p. ej. desde un enlace guardado) se abre solo para leer.
  await page.goto(`/propietario/casas/${id}/editar/nombre`);
  await expect(page.getByLabel("Nombre de la casa")).toHaveValue("Casa Coco frente al mar");
  await expect(page.getByLabel("Nombre de la casa")).toBeDisabled();
  await expect(page.getByText("Este cambio está en revisión. Si quiere cambiar algo, descarte la edición y empiece otra.")).toBeVisible();
  await expect(save(page)).toHaveCount(0);
  // Lo inmediato se sigue cambiando.
  await page.goto(`/propietario/casas/${id}/editar/precio`);
  await expect(page.getByLabel("Precio por noche")).toBeEnabled();
  await expect(save(page)).toBeEnabled();
});

test("si la base rechaza el precio, la pantalla lo dice y nada cambia", async ({ page }) => {
  const { id } = await h.seed({ status: "active" });
  await page.route("**/rest/v1/rpc/update_listing_live", (route) =>
    route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "P0001", message: "Indique el precio por noche en colones.", details: null, hint: null }) }),
  );
  await page.goto(`/propietario/casas/${id}/editar/precio`);
  await page.getByLabel("Precio por noche").fill("55 000");
  await save(page).click();
  await expect(page.locator('.note[role="alert"]')).toHaveText("Indique el precio por noche en colones.");
  await expect(page).toHaveURL(new RegExp(`/editar/precio$`));
  // Lo escrito se queda (la caché vuelve atrás, el campo no) y una relectura al volver a la app tampoco lo pisa.
  await expect(page.getByLabel("Precio por noche")).toHaveValue("55 000");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await page.waitForTimeout(500);
  await expect(page.getByLabel("Precio por noche")).toHaveValue("55 000");
  await page.getByRole("link", { name: "Volver" }).click();
  await expect(page).toHaveURL(new RegExp(`/propietario/casas/${id}$`));
  await expect(row(page, "Precio")).toContainText("₡42 000 / noche");
});

test("tipo habitación pide el baño", async ({ page }) => {
  const { id } = await h.seed({ status: "active" });
  await page.goto(`/propietario/casas/${id}/editar/tipo`);
  await expect(page.getByRole("heading", { level: 1, name: "Tipo" })).toBeVisible();
  await expect(page.getByText("Baño de la habitación")).toHaveCount(0);
  await page.locator("label.choice", { hasText: "Habitación" }).click();
  await expect(page.getByText("Baño de la habitación")).toBeVisible();
  await save(page).click();
  await expect(page.locator('.note[role="alert"]')).toHaveText("Indique si el baño es privado o compartido.");
  await page.locator("label.chip", { hasText: "Compartido" }).click();
  await save(page).click();
  await expect(toastText(page)).toHaveText("Guardado. Envíelo a revisión cuando termine.");
  await expect(page).toHaveURL(new RegExp(`/propietario/casas/${id}$`));
  await expect(row(page, "Tipo")).toContainText("Habitación · baño compartido");
  expect((await h.owner("owner").getOwn(id))!.edit).toMatchObject({ kind: "habitacion", bathroomShared: true });
});

test("la pantalla de un dato muestra lo del servidor aunque el teléfono guarde una versión vieja", async ({ page }) => {
  const { id } = await h.seed({ status: "active" });
  await page.goto(`/propietario/casas/${id}/editar/precio`);
  await expect(page.getByLabel("Precio por noche")).toHaveValue("42000");
  await page.waitForTimeout(1500); // la caché se escribe en IndexedDB con retardo: que la próxima carga abra con ella
  // Desde otro teléfono: la caché de este se queda con la versión de antes hasta releer.
  await h.owner("owner").saveEdit(id, { title: "Casa Coco frente al mar" });
  await h.owner("owner").updateLive(id, { nightlyPriceCrc: 48000 });
  await page.goto(`/propietario/casas/${id}/editar/nombre`);
  await expect(page.getByLabel("Nombre de la casa")).toHaveValue("Casa Coco frente al mar");
  await page.goto(`/propietario/casas/${id}/editar/precio`);
  await expect(page.getByLabel("Precio por noche")).toHaveValue("48000");
});

test("ubicación con la edición en revisión: el mapa no se mueve", async ({ page }) => {
  const { id } = await h.seed({ status: "active" });
  await h.owner("owner").saveEdit(id, { title: "Casa Coco frente al mar" });
  await h.owner("owner").submitEdit(id);
  await page.goto(`/propietario/casas/${id}/editar/ubicacion`);
  await expect(page.getByText("Este cambio está en revisión. Si quiere cambiar algo, descarte la edición y empiece otra.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Guardar" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Usar mi ubicación" })).toHaveCount(0);
  await expect(page.getByText("Toque el mapa o arrastre el punto hasta su casa.")).toHaveCount(0);
  await expect(page.locator(".leaflet-marker-icon")).toBeVisible();
  await expect(page.locator(".place-line")).toHaveText("Talamanca, Limón");
  const box = (await page.locator(".map-box").boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.8);
  await page.waitForTimeout(500);
  await expect(page.locator('input[name="lat"]')).toHaveValue("9.7366");
  await expect(page.locator('input[name="lng"]')).toHaveValue("-82.8431");
  await expect(page.locator(".place-line")).toHaveText("Talamanca, Limón");
});
