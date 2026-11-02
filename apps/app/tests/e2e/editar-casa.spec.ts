import { expect, test, type Page } from "./helpers/test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { postgrestHarness } from "../db/postgrest-harness";
import { realPhotos } from "./helpers/real-photos";
import { secondCode } from "./helpers/admin";
import { injectSession } from "./helpers/session";
import { touch } from "./helpers/touch";

// Editar una casa publicada sin sacarla de Explorar (spec .scratch/editar-casa, maquetas 08a–08c), contra Supabase local.
// La ficha editable: cada dato es una fila que abre su pantalla; lo que pasa por revisión lleva la etiqueta «Revisión» y,
// con un cambio pendiente (revisión por dato, revisión UX 2026-10-29, A5), el valor nuevo con «En revisión» o «Cambios
// pedidos», su nota y su propio «Descartar»; en Mis casas, «Cambios en revisión».
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
const discardButton = (page: Page, field: string) => page.getByRole("button", { name: `Descartar el cambio de ${field}` });
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
  await expect(sub.getByRole("link")).toHaveAttribute("href", `/propietario/suscripcion?casa=${publicId}#pago=${publicId}`);
  await expect(page.getByText("Editar la ficha")).toHaveCount(0);
  await expect(page.getByText("Anuncio visible")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Descartar borrador" })).toHaveCount(0);
  await expect(page.getByText(/Cambios sin enviar/)).toHaveCount(0);
  // La suscripción al día va al final, no arriba.
  expect((await page.getByTestId("subscription-row").boundingBox())!.y).toBeGreaterThan((await share.boundingBox())!.y);

  // Un nombre nuevo, ya en revisión: el valor nuevo en su fila con «En revisión» y su «Descartar»; sin bloque arriba ni
  // «Enviar a revisión» general; la ficha pública no cambia.
  await h.owner("owner").saveEdit(id, { title: "Casa Coco frente al mar" });
  await page.reload();
  await expect(row(page, "Nombre")).toContainText("Casa Coco frente al mar");
  await expect(row(page, "Nombre").locator(".tag-rev")).toHaveText("En revisión");
  await expect(page.getByTestId("pending-nombre")).toContainText("Los clientes ven lo de antes hasta que lo aprobemos.");
  await expect(rows(page).locator(".tag-rev", { hasText: /^Revisión$/ })).toHaveCount(3);
  await expect(page.getByTestId("edit-banner")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Enviar a revisión" })).toHaveCount(0);
  await expect(page.locator(".detail-photo .state")).toHaveText("Cambios en revisión");
  await expect(page.getByRole("heading", { level: 1, name: "Casa Coco" })).toBeVisible();
  // Se puede volver a cambiar mientras está en revisión: la fila sigue siendo un enlace.
  await expect(row(page, "Nombre")).toHaveAttribute("href", `/propietario/casas/${id}/editar/nombre`);

  await page.goto("/propietario/casas");
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(card(page, "Casa Coco").getByTestId("card-label")).toHaveText("Cambios en revisión");
  await card(page, "Casa Coco").getByRole("link", { name: "Casa Coco" }).click();
  await expect(page).toHaveURL(new RegExp(`/propietario/casas/${id}$`));

  // «Descartar» pregunta; al cancelar no pasa nada, al aceptar el cambio desaparece.
  page.once("dialog", (d) => {
    expect(d.message()).toBe("¿Descartar este cambio? Su ficha sigue como está.");
    void d.dismiss();
  });
  await discardButton(page, "nombre").click();
  await expect(row(page, "Nombre").locator(".tag-rev")).toHaveText("En revisión");
  page.once("dialog", (d) => void d.accept());
  await discardButton(page, "nombre").click();
  await expect(row(page, "Nombre").locator(".tag-rev")).toHaveText("Revisión");
  await expect(row(page, "Nombre")).toContainText("Casa Coco");
  await expect.poll(async () => (await h.owner("owner").getOwn(id))!.edit).toBeNull();
});

test("descartar un dato: si la base se niega, vuelve con su mensaje; con cambios pedidos, la nota del admin", async ({ page }) => {
  const { id } = await h.seed({ status: "active", draft: { title: "Casa Coco" } });
  await h.owner("owner").saveEdit(id, { title: "Casa Coco frente al mar" });
  await page.goto(`/propietario/casas/${id}`);
  await page.route("**/rest/v1/rpc/discard_edit_field", (route) =>
    route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "P0001", message: "No encontramos esa edición.", details: null, hint: null }) }),
  );
  page.once("dialog", (d) => void d.accept());
  await discardButton(page, "nombre").click();
  await expect(page.locator(".toast")).toHaveText("No encontramos esa edición.");
  await expect(row(page, "Nombre").locator(".tag-rev")).toHaveText("En revisión");
  await page.unroute("**/rest/v1/rpc/discard_edit_field");

  // El admin pide cambios en el nombre: la fila lo dice con su nota, y la etiqueta de la casa también.
  const admin = h.admin("aal2");
  await admin.reviewEditField(id, "nombre", "changes", "Sin mayúsculas, por favor.", (await admin.getEdit(id))!.listing.edit!.fields.nombre!.submittedAt);
  await page.reload();
  await expect(row(page, "Nombre").locator(".tag-rev")).toHaveText("Cambios pedidos");
  await expect(page.getByTestId("pending-nombre")).toContainText("Le pedimos cambios: Sin mayúsculas, por favor.");
  await expect(page.locator(".detail-photo .state")).toHaveText("Cambios pedidos");
  expect((await h.owner("owner").getOwn(id))!.edit?.status).toBe("changes");
});

test("inactiva: el bloque ocre arriba", async ({ page }) => {
  const { id, publicId } = await h.seed({ status: "active", draft: { title: "Casa Coco" } });
  await h.billing("owner").stop(id);
  await page.goto(`/propietario/casas/${id}`);
  const block = page.getByTestId("stopped-notice");
  await expect(block.getByRole("heading", { name: "Suscripción parada" })).toBeVisible();
  await expect(block).toContainText("Casa Coco no aparece en Explorar y el enlace de su ficha no funciona. Actívela para que vuelvan a escribirle.");
  await expect(block.getByRole("link", { name: "Activar suscripción" })).toHaveAttribute("href", `/propietario/suscripcion?casa=${publicId}#pago=${publicId}`);
  await expect(block).toContainText("₡2 900 al mes, sin permanencia");
  expect((await block.boundingBox())!.y).toBeLessThan((await page.locator(".detail-photo").boundingBox())!.y);
  await expect(page.getByRole("button", { name: "Compartir ficha" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Ver ficha" })).toHaveCount(0);
  await expect(page.getByTestId("subscription-row")).toHaveCount(0);
  await expect(page.locator(".detail-photo .state")).toHaveText("Inactiva");
});

// ---------- Las pantallas de cada dato ----------

const save = (page: Page) => page.getByRole("button", { name: "Guardar" });
/** Los datos con revisión se mandan con «Enviar a revisión» (revisión UX 2026-10-29, A5). */
const send = (page: Page) => page.getByRole("button", { name: "Enviar a revisión" });
const toastText = (page: Page) => page.getByRole("status").filter({ hasText: /^(Guardado|Enviado a revisión)\./ });
const SENT = "Enviado a revisión. Su ficha sigue como está hasta que lo aprobemos.";
const NOTICE = "Este cambio lo revisamos antes de publicarlo, normalmente en menos de 24 horas. Mientras tanto los clientes ven";

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

test("historial: guardar un dato, volver de un dato o de las fotos regresa a la ficha sin apilarla", async ({ page }) => {
  const { id } = await h.seed({ status: "active" });
  const ficha = new RegExp(`/propietario/casas/${id}$`);
  await page.goto("/propietario/casas");
  await card(page, "Cabina Cahuita").getByRole("link").first().click();
  await expect(page).toHaveURL(ficha);
  // Guardar: la ficha, y «atrás» del navegador sale de ella (a Mis casas), no al formulario.
  await row(page, "Precio").click();
  await page.getByLabel("Precio por noche").fill("55 000");
  await save(page).click();
  await expect(toastText(page)).toHaveText("Guardado. Ya se ve en su ficha.");
  await expect(page).toHaveURL(ficha);
  await page.goBack();
  await expect(page).toHaveURL(/\/propietario\/casas$/);
  // La flecha de la cabecera de un dato y «Listo» de las fotos, igual.
  await card(page, "Cabina Cahuita").getByRole("link").first().click();
  await row(page, "Nombre").click();
  await page.getByRole("link", { name: "Volver" }).click();
  await expect(page).toHaveURL(ficha);
  await page.getByRole("link", { name: "5 fotos · Editar" }).click();
  await page.getByRole("link", { name: "Listo" }).click();
  await expect(page).toHaveURL(ficha);
  await page.getByRole("link", { name: "5 fotos · Editar" }).click();
  await page.getByRole("link", { name: "Volver" }).click();
  await expect(page).toHaveURL(ficha);
  await page.goBack();
  await expect(page).toHaveURL(/\/propietario\/casas$/);
});

test("cambiar el nombre: «Enviar a revisión» con el aviso; la ficha pública sigue igual hasta aprobar y se puede volver a cambiar", async ({ page }) => {
  const { id, publicId } = await h.seed({ status: "active" });
  await page.goto(`/propietario/casas/${id}`);
  await row(page, "Nombre").click();
  await expect(page.getByRole("heading", { level: 1, name: "Nombre" })).toBeVisible();
  // La casa bajo el título y el aviso que nombra lo que siguen viendo los clientes; sin «Guardar».
  await expect(page.locator(".edit-house")).toHaveText("Cabina Cahuita");
  await expect(page.getByTestId("review-notice")).toHaveText(`${NOTICE} «Cabina Cahuita».`);
  await expect(save(page)).toHaveCount(0);
  await expect(page.getByLabel("Nombre de la casa")).toHaveValue("Cabina Cahuita");
  await page.getByLabel("Nombre de la casa").fill("Casa Coco frente al mar");
  await send(page).click();
  await expect(toastText(page)).toHaveText(SENT);
  await expect(page).toHaveURL(new RegExp(`/propietario/casas/${id}$`));
  await expect(row(page, "Nombre")).toContainText("Casa Coco frente al mar");
  await expect(row(page, "Nombre").locator(".tag-rev")).toHaveText("En revisión");
  expect((await h.owner("owner").getOwn(id))!.edit?.fields.nombre?.status).toBe("review");

  await page.goto(`/casa/${publicId}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cabina Cahuita");
  await page.goto("/propietario/casas");
  await expect(card(page, "Cabina Cahuita").getByTestId("card-label")).toHaveText("Cambios en revisión");

  // En revisión se puede volver a cambiar: cuenta el último valor enviado.
  await page.goto(`/propietario/casas/${id}/editar/nombre`);
  await expect(page.getByLabel("Nombre de la casa")).toHaveValue("Casa Coco frente al mar");
  await expect(page.getByLabel("Nombre de la casa")).toBeEnabled();
  await page.getByLabel("Nombre de la casa").fill("Casa Coco del Caribe");
  await send(page).click();
  await expect(toastText(page)).toHaveText(SENT);
  await expect(row(page, "Nombre")).toContainText("Casa Coco del Caribe");
  // Lo inmediato se sigue cambiando con «Guardar».
  await page.goto(`/propietario/casas/${id}/editar/precio`);
  await expect(page.getByTestId("review-notice")).toHaveCount(0);
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

test("tipo habitación ofrece el baño; sin elegirlo se guarda y la capacidad avisa en ocre", async ({ page }) => {
  const { id } = await h.seed({ status: "active" });
  await page.goto(`/propietario/casas/${id}/editar/tipo`);
  await expect(page.getByRole("heading", { level: 1, name: "Tipo" })).toBeVisible();
  await expect(page.getByText("Baño de la habitación")).toHaveCount(0);
  await page.locator("label.choice", { hasText: "Habitación" }).click();
  await expect(page.getByText("Baño de la habitación")).toBeVisible();
  await expect(page.getByTestId("review-notice")).toHaveText(`${NOTICE} «Alojamiento completo».`);
  // Como al crear: el baño sin elegir no bloquea; lo dice el aviso ocre de la capacidad.
  await send(page).click();
  await expect(toastText(page)).toHaveText(SENT);
  await expect(page).toHaveURL(new RegExp(`/propietario/casas/${id}$`));
  expect((await h.owner("owner").getOwn(id))!.edit).toMatchObject({ kind: "habitacion", bathroomShared: null });
  await page.goto(`/propietario/casas/${id}/editar/tipo`);
  await page.locator("label.chip", { hasText: "Compartido" }).click();
  await send(page).click();
  await expect(toastText(page)).toHaveText(SENT);
  await expect(row(page, "Tipo")).toContainText("Habitación · baño compartido");
  expect((await h.owner("owner").getOwn(id))!.edit).toMatchObject({ kind: "habitacion", bathroomShared: true });
});

test("un tipo viejo (casa) abre con «Alojamiento completo» marcado", async ({ page }) => {
  const { id } = await h.seed({ status: "active", draft: { kind: "casa" as never } });
  await page.goto(`/propietario/casas/${id}/editar/tipo`);
  await expect(page.locator("label.choice", { hasText: "Alojamiento completo" }).locator("input")).toBeChecked();
});

// ---------- Editar sigue las reglas de crear (2026-11-02, ticket 12) ----------

test("una descripción corta se guarda con un aviso en ocre, y renombrar no se ve afectado por ella", async ({ page }) => {
  const { id } = await h.seed({ status: "active", draft: { description: "D".repeat(50) } });
  await page.goto(`/propietario/casas/${id}`);
  // La descripción de antes (50) ya avisa en ocre bajo su fila; no bloquea nada.
  await expect(page.getByTestId("warn-descripcion")).toHaveText("La descripción debe tener entre 80 y 2000 caracteres o quedar vacía.");
  await row(page, "Nombre").click();
  await page.getByLabel("Nombre de la casa").fill("Casa Coco frente al mar");
  await send(page).click();
  await expect(toastText(page)).toHaveText(SENT);
  await expect(row(page, "Nombre")).toContainText("Casa Coco frente al mar");
  // Una descripción nueva de 50 caracteres también se guarda (a revisión) y avisa.
  await row(page, "Descripción").click();
  await page.getByLabel("Descripción (opcional)").fill("E".repeat(50));
  await send(page).click();
  await expect(page.getByRole("status").filter({ hasText: `${SENT} La descripción debe tener entre 80 y 2000 caracteres o quedar vacía.` })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/propietario/casas/${id}$`));
  expect((await h.owner("owner").getOwn(id))!.edit).toMatchObject({ title: "Casa Coco frente al mar", description: "E".repeat(50) });
  await expect(page.getByTestId("warn-descripcion")).toBeVisible();
  // Un nombre vacío o de 4 letras sí bloquea, con el mensaje de crear.
  await row(page, "Nombre").click();
  await page.getByLabel("Nombre de la casa").fill("Casa");
  await send(page).click();
  await expect(page.locator('.note[role="alert"]')).toHaveText("El nombre de la casa debe tener entre 5 y 32 caracteres.");
  await page.getByLabel("Nombre de la casa").fill("   ");
  await send(page).click();
  await expect(page.locator('.note[role="alert"]')).toHaveText("Póngale un nombre a la casa.");
});

test("dejar vacía la capacidad que tenía valor no se guarda; una casa sin baños cambia el precio", async ({ page }) => {
  const { id } = await h.seed({ status: "active" });
  await page.goto(`/propietario/casas/${id}/editar/capacidad`);
  // Los contadores no bajan de su mínimo: justo al enviar, el campo oculto se vacía, como un valor perdido.
  await page.locator("form.publish-form").evaluate((form) => form.addEventListener("submit", () => ((form.querySelector('input[name="capacity"]') as HTMLInputElement).value = ""), { capture: true }));
  await save(page).click();
  await expect(page.locator('.note[role="alert"]')).toHaveText("Indique cuántas personas pueden alojarse (mínimo 1).");
  expect((await h.owner("owner").getOwn(id))!.capacity).toBe(2);

  const nobath = await h.seed({ status: "active", draft: { bathrooms: null } });
  await page.goto(`/propietario/casas/${nobath.id}`);
  await expect(page.getByTestId("warn-capacidad")).toHaveText("Indique el número de baños (mínimo 1).");
  await row(page, "Precio").click();
  await page.getByLabel("Precio por noche").fill("55 000");
  await save(page).click();
  await expect(toastText(page)).toHaveText("Guardado. Ya se ve en su ficha.");
  expect((await h.owner("owner").getOwn(nobath.id))).toMatchObject({ nightlyPriceCrc: 55000, bathrooms: null });
});

test("un nombre viejo de más de 32 caracteres sin tocar no se envía ni se recorta", async ({ page }) => {
  const { id } = await h.seed({ status: "active" });
  await h.setLegacyTitle(id, "Casa grande con vista al mar en Cahuita!");
  await page.goto(`/propietario/casas/${id}/editar/nombre`);
  await expect(page.getByLabel("Nombre de la casa")).toHaveValue("Casa grande con vista al mar en Cahuita!");
  await send(page).click();
  await expect(page).toHaveURL(new RegExp(`/propietario/casas/${id}$`));
  expect((await h.owner("owner").getOwn(id))!.edit).toBeNull();
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

test("ubicación con otro dato en revisión: el aviso nombra la zona y el mapa se puede mover", async ({ page }) => {
  const { id } = await h.seed({ status: "active" });
  await h.owner("owner").saveEdit(id, { title: "Casa Coco frente al mar" });
  await page.goto(`/propietario/casas/${id}/editar/ubicacion`);
  await expect(page.getByTestId("review-notice")).toHaveText(`${NOTICE} «Cahuita».`);
  await expect(send(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Usar mi ubicación" })).toBeVisible();
  await expect(page.getByText("Toque el mapa o arrastre el punto hasta su casa.")).toBeVisible();
  await expect(page.locator(".leaflet-marker-icon")).toBeVisible();
});

// ---------- Las fotos (maqueta 08d) ----------

const foto = (name: string) => ({ name, mimeType: "image/jpeg", buffer: readFileSync(`${FOTOS}${name}`) });
const tiles = (page: Page) => page.locator(".photos-grid > .photo");
const counter = (page: Page) => page.locator(".photos-count");

test("dos fotos nuevas van a revisión al subirlas; quitarlas las descarta y borra sus objetos", async ({ page }) => {
  const { id } = await h.seed({ status: "active" });
  await page.goto(`/propietario/casas/${id}/editar/fotos`);
  await expect(page.getByRole("heading", { level: 1, name: "Fotos" })).toBeVisible();
  await expect(counter(page)).toHaveText("5 de 15");
  await expect(page.getByText("El orden y las fotos que quite se guardan al momento. Las fotos nuevas las revisamos antes de publicarlas, normalmente en menos de 24 horas.")).toBeVisible();
  await page.getByLabel("Añadir fotos").setInputFiles([foto("beach.jpg"), foto("loft.jpg")]);
  await expect(counter(page)).toHaveText("7 de 15", { timeout: 20_000 });
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  // Las nuevas, al final y con «En revisión»; no se arrastran (sin data-photo).
  await expect.poll(() => tiles(page).evaluateAll((els) => els.map((e) => e.classList.contains("is-pending")))).toEqual([false, false, false, false, false, true, true]);
  await expect(page.locator(".photos-grid .photo.is-pending .tag")).toHaveText(["En revisión", "En revisión"]);
  await expect(page.locator(".photos-grid [data-photo]")).toHaveCount(5);
  const folders = (await h.owner("owner").getOwn(id))!.edit!.photos.map((p) => p.path);
  expect(folders).toHaveLength(2);

  await page.getByRole("link", { name: "Listo" }).click();
  await expect(page).toHaveURL(new RegExp(`/propietario/casas/${id}$`));
  await expect(page.getByRole("link", { name: "5 fotos · 2 nuevas en revisión · Editar" })).toBeVisible();
  await expect(page.locator(".detail-photo .state")).toHaveText("Cambios en revisión");
  expect((await h.owner("owner").getOwn(id))!.edit!.photos.map((p) => p.status)).toEqual(["review", "review"]);
  await page.getByRole("link", { name: "5 fotos · 2 nuevas en revisión · Editar" }).click();
  await page.getByRole("button", { name: "Quitar foto 7" }).click();
  await expect(counter(page)).toHaveText("6 de 15");
  await page.getByRole("button", { name: "Quitar foto 6" }).click();
  await expect(counter(page)).toHaveText("5 de 15");
  await expect.poll(async () => (await h.owner("owner").getOwn(id))!.edit).toBeNull();
  await expect.poll(async () => (await h.objects(id)).filter((o) => folders.some((f) => o.name.startsWith(`${f}/`))).length).toBe(0);
});

test.describe("arrastrar en el editor", () => {
  test.use({ viewport: { width: 375, height: 667 } });
  test("ordenar arrastrando en una casa activa se ve al momento en la ficha pública", async ({ page }) => {
    const { id, publicId } = await h.seed({ status: "active" });
    await realPhotos(id);
    const before = (await h.owner("owner").getOwn(id))!.photos;
    await page.goto(`/propietario/casas/${id}/editar/fotos`);
    await expect(page.locator(".photos-grid [data-photo]")).toHaveCount(5);
    const t = await touch(page);
    const cover = await t.center(page.locator(".photos-grid .photo.cover"));
    const tile = page.locator(".photos-grid [data-photo]").nth(2);
    const p = await t.center(tile);
    const saved = page.waitForResponse((r) => r.url().includes("/rest/v1/rpc/reorder_listing_photos"));
    await t.down(p.x, p.y);
    await expect(tile).toHaveClass(/is-lifted/);
    await t.move(cover.x, cover.y, 12);
    await t.up();
    expect((await saved).ok()).toBe(true);
    const expected = [before[2]!.id, before[0]!.id, before[1]!.id, before[3]!.id, before[4]!.id];
    await expect.poll(async () => (await h.owner("owner").getOwn(id))!.photos.map((x) => x.id)).toEqual(expected);
    expect((await h.owner("owner").getOwn(id))!.edit).toBeNull();
    await page.goto(`/casa/${publicId}`);
    await expect(page.locator(".hero .strip img").first()).toHaveAttribute("src", before[2]!.url);
  });
});

test("quitar la última foto aprobada se rechaza", async ({ page }) => {
  const { id } = await h.seed({ status: "active" });
  for (let i = 0; i < 4; i++) await h.dropPhoto(id); // una casa activa con una sola foto
  await page.goto(`/propietario/casas/${id}/editar/fotos`);
  await expect(counter(page)).toHaveText("1 de 15");
  await page.getByRole("button", { name: "Quitar foto 1" }).click();
  await expect(page.locator('.field-error[role="alert"]')).toHaveText("Su ficha necesita al menos una foto. Añada otra y, cuando la aprobemos, podrá quitar esta.");
  await expect(page.locator(".photos-grid [data-photo]")).toHaveCount(1);
});

test("quitar la portada aprobada: «Ver ficha», sin recargar, ya muestra la nueva portada", async ({ page }) => {
  const { id } = await h.seed({ status: "active" });
  const before = (await h.owner("owner").getOwn(id))!.photos;
  const cover = page.locator(".hero .strip img").first();
  await page.goto(`/propietario/casas/${id}`);
  // La ficha pública ya leída queda en la caché del teléfono.
  await page.getByRole("link", { name: "Ver ficha" }).click();
  await expect(cover).toHaveAttribute("src", before[0]!.url);
  await page.goBack();
  await page.getByRole("link", { name: "5 fotos · Editar" }).click();
  await page.getByRole("button", { name: "Quitar foto 1" }).click();
  await expect(counter(page)).toHaveText("4 de 15");
  await page.getByRole("link", { name: "Listo" }).click();
  await expect(page).toHaveURL(new RegExp(`/propietario/casas/${id}$`));
  await page.getByRole("link", { name: "Ver ficha" }).click();
  await expect(cover).toHaveAttribute("src", before[1]!.url);
});

test("quitar una foto nueva: el contador baja y sus objetos se borran", async ({ page }) => {
  const { id } = await h.seed({ status: "active" });
  await page.goto(`/propietario/casas/${id}/editar/fotos`);
  await expect(counter(page)).toHaveClass(/primary/); // el mismo contador que el paso 7 del asistente
  await page.getByLabel("Añadir fotos").setInputFiles([foto("beach.jpg"), foto("loft.jpg")]);
  await expect(counter(page)).toHaveText("7 de 15", { timeout: 20_000 });
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  const [, last] = (await h.owner("owner").getOwn(id))!.edit!.photos.map((p) => p.path);
  await expect.poll(async () => (await h.objects(id)).filter((o) => o.name.startsWith(`${last}/`)).length).toBe(3);
  await page.getByRole("button", { name: "Quitar foto 7" }).click();
  await expect(counter(page)).toHaveText("6 de 15");
  await expect(page.locator(".photos-grid .photo.is-pending")).toHaveCount(1);
  expect((await h.owner("owner").getOwn(id))!.edit!.photos.map((p) => p.path)).not.toContain(last);
  await expect.poll(async () => (await h.objects(id)).filter((o) => o.name.startsWith(`${last}/`)).length).toBe(0);
});

test("con fotos nuevas en revisión se añade y se quita; una con cambios pedidos lleva su nota", async ({ page }) => {
  const { id } = await h.seed({ status: "active" });
  const photo = await h.photos("owner").addEditPhoto(id, `${id}/${randomUUID()}`);
  await h.photos("owner").addEditPhoto(id, `${id}/${randomUUID()}`);
  const admin = h.admin("aal2");
  await admin.reviewEditPhoto(photo.id, "changes", "Se ve un teléfono.", (await admin.getEdit(id))!.listing.edit!.photos[0]!.submittedAt);
  await page.goto(`/propietario/casas/${id}/editar/fotos`);
  await expect(counter(page)).toHaveText("7 de 15");
  await expect(page.locator(".photos-grid .photo.is-pending .tag")).toHaveText(["Cambios pedidos", "En revisión"]);
  await expect(page.locator(".photos-grid .photo.is-pending").first()).toContainText("Se ve un teléfono.");
  await expect(page.getByLabel("Añadir fotos")).toHaveCount(1);
  await expect(page.locator(".photos-grid .photo.is-pending .remove")).toHaveCount(2);
  await page.getByRole("button", { name: "Quitar foto 6" }).click();
  await expect(counter(page)).toHaveText("6 de 15");
  await page.getByRole("button", { name: "Quitar foto 5" }).click();
  await expect(counter(page)).toHaveText("5 de 15");
  expect((await h.owner("owner").getOwn(id))!.photos).toHaveLength(4);
});

// ---------- La revisión del admin (spec §4) ----------

const editSection = (page: Page) => page.getByRole("region", { name: "Ediciones por revisar" });
const diff = (page: Page, title: string) => page.getByRole("region", { name: title });

async function asAdmin(page: Page, path: string) {
  await injectSession(page, "admin");
  await page.goto(path);
  await secondCode(page);
  await expect(page).toHaveURL(new RegExp(`${path}$`));
}

test("el admin aprueba el nombre: la ficha lo muestra al momento y la casa sale de la cola", async ({ page }) => {
  const { id, publicId } = await h.seed({ status: "active" });
  await h.owner("owner").saveEdit(id, { title: "Casa Coco frente al mar" });
  await asAdmin(page, "/admin");
  await expect(editSection(page).getByRole("heading", { name: "Ediciones por revisar" })).toBeVisible();
  const item = editSection(page).getByRole("link", { name: /Cabina Cahuita/ });
  await expect(item).toContainText(publicId);
  await expect(item).toContainText("Yorleny Prueba");
  await expect(item).toContainText("Edición: nombre");
  await item.click();
  await expect(page).toHaveURL(new RegExp(`/admin/ediciones/${id}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Revisar edición" })).toBeVisible();
  await expect(diff(page, "Nombre").locator(".diff-col")).toHaveText(["Antes Cabina Cahuita", "Ahora Casa Coco frente al mar"]);
  await expect(page.locator("details > summary", { hasText: "Lo que no cambia" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Rechazar" })).toHaveCount(0);
  await diff(page, "Nombre").getByRole("button", { name: "Aprobar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("status").filter({ hasText: "«Cabina Cahuita»: Cambios aprobados. La ficha ya los muestra." })).toBeVisible();
  await expect(editSection(page)).toHaveCount(0);
  await expect.poll(async () => (await h.owner("owner").getOwn(id))!.title).toBe("Casa Coco frente al mar");

  await page.goto(`/casa/${publicId}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Casa Coco frente al mar");
  await injectSession(page, "owner");
  await page.goto(`/propietario/casas/${id}`);
  await expect(page.getByRole("heading", { level: 1, name: "Casa Coco frente al mar" })).toBeVisible();
  await expect(page.locator(".tag-rev", { hasText: /En revisión|Cambios pedidos/ })).toHaveCount(0);
  await page.goto("/propietario/casas");
  await expect(card(page, "Casa Coco frente al mar").getByTestId("card-label")).toHaveText("Activa");
});

test("el admin pide cambios en el nombre: el propietario ve la nota, corrige y vuelve a revisión", async ({ page }) => {
  const { id } = await h.seed({ status: "active" });
  await h.owner("owner").saveEdit(id, { title: "CASA COCO FRENTE AL MAR" });
  await asAdmin(page, `/admin/ediciones/${id}`);
  const name = diff(page, "Nombre");
  await name.getByRole("button", { name: "Pedir cambios" }).click();
  await expect(name.locator('.field-error[role="alert"]')).toHaveText("Escriba una nota para pedir cambios.");
  await expect(page).toHaveURL(new RegExp(`/admin/ediciones/${id}$`));
  await name.getByLabel(/Mensaje para el anfitrión/).fill("Use un nombre sin mayúsculas sostenidas.");
  await name.getByRole("button", { name: "Pedir cambios" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("status").filter({ hasText: "Cambios pedidos. El anfitrión verá su mensaje." })).toBeVisible();
  await expect.poll(async () => (await h.owner("owner").getOwn(id))!.edit?.status).toBe("changes");

  await injectSession(page, "owner");
  await page.goto(`/propietario/casas/${id}`);
  await expect(row(page, "Nombre").locator(".tag-rev")).toHaveText("Cambios pedidos");
  await expect(page.getByTestId("pending-nombre")).toContainText("Le pedimos cambios: Use un nombre sin mayúsculas sostenidas.");
  await page.goto("/propietario/casas");
  await expect(card(page, "Cabina Cahuita").getByTestId("card-label")).toHaveText("Cambios pedidos");
  await page.goto(`/propietario/casas/${id}`);
  await row(page, "Nombre").click();
  await page.getByLabel("Nombre de la casa").fill("Casa Coco frente al mar");
  await send(page).click();
  await expect(toastText(page)).toHaveText(SENT);
  await expect(row(page, "Nombre").locator(".tag-rev")).toHaveText("En revisión");
  await expect(page.getByTestId("pending-nombre")).not.toContainText("Le pedimos cambios");
  expect((await h.owner("owner").getOwn(id))!.edit).toMatchObject({ status: "review", title: "Casa Coco frente al mar" });
});

test("el diff de la descripción, la ubicación y las fotos nuevas", async ({ page }) => {
  const { id } = await h.seed({ status: "active" });
  await h.owner("owner").saveEdit(id, { description: "Casa de madera nueva frente al parque nacional Cahuita, con hamacas, rancho y wifi." });
  await h.owner("owner").saveEdit(id, { lat: 9.6553, lng: -82.7536, zone: "Puerto Viejo", zoneId: "704-puerto-viejo", zoneSource: "list" });
  await h.photos("owner").addEditPhoto(id, `${id}/${randomUUID()}`);
  await asAdmin(page, "/admin");
  await expect(editSection(page).getByRole("link")).toContainText("Edición: ubicación, descripción, 1 foto nueva");
  await editSection(page).getByRole("link").click();
  const desc = diff(page, "Descripción");
  await expect(desc).toContainText("Casa de madera nueva frente al parque nacional Cahuita");
  await expect(desc.locator("details > summary")).toHaveText("Antes");
  await expect(desc.locator("details")).not.toHaveAttribute("open");
  const map = diff(page, "Ubicación");
  await expect(map.getByRole("img", { name: "Mapa con la ubicación de antes (Cahuita) y la de ahora (Puerto Viejo)" })).toBeVisible();
  await expect(map.locator(".leaflet-tooltip")).toHaveText(["Antes: Cahuita", "Ahora: Puerto Viejo"]);
  await expect(diff(page, "Fotos nuevas").locator("img")).toHaveCount(1);
  await expect(diff(page, "Nombre")).toHaveCount(0);
  // Cada dato y cada foto con su decisión: aprobar la descripción deja lo demás pendiente, en la misma pantalla.
  for (const t of ["Descripción", "Ubicación", "Foto nueva 1"]) await expect(diff(page, t).getByRole("button", { name: "Aprobar" })).toBeVisible();
  await desc.getByRole("button", { name: "Aprobar" }).click();
  await expect(diff(page, "Descripción")).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/admin/ediciones/${id}$`));
  await expect.poll(async () => (await h.owner("owner").getOwn(id))!.description).toContain("Casa de madera nueva");
  await diff(page, "Foto nueva 1").getByLabel(/Mensaje para el anfitrión/).fill("Se ve un teléfono.");
  await diff(page, "Foto nueva 1").getByRole("button", { name: "Pedir cambios" }).click();
  await expect(diff(page, "Foto nueva 1")).toContainText("Cambios pedidos: Se ve un teléfono.");
  await map.getByRole("button", { name: "Aprobar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect.poll(async () => (await h.owner("owner").getOwn(id))!.zone).toBe("Puerto Viejo");
});

test("si la base rechaza la decisión, la casa vuelve a la cola con su mensaje", async ({ page }) => {
  const { id } = await h.seed({ status: "active" });
  await h.owner("owner").saveEdit(id, { title: "Casa Coco frente al mar" });
  await asAdmin(page, `/admin/ediciones/${id}`);
  await page.route("**/rest/v1/rpc/review_edit_field", (route) =>
    route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "P0001", message: "Esta edición ya tiene una decisión.", details: null, hint: null }) }),
  );
  await diff(page, "Nombre").getByRole("button", { name: "Aprobar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("alert")).toHaveText("No se guardó la decisión sobre «Cabina Cahuita»: Esta edición ya tiene una decisión.");
  await expect(editSection(page).getByRole("link", { name: /Cabina Cahuita/ })).toContainText("Edición: nombre");
  expect((await h.owner("owner").getOwn(id))!.edit?.status).toBe("review");
});

test("lo que tiene cambios pedidos no se vuelve a decidir: espera al propietario", async ({ page }) => {
  const { id } = await h.seed({ status: "active" });
  await h.owner("owner").saveEdit(id, { title: "Casa Coco frente al mar" });
  const admin = h.admin("aal2");
  await admin.reviewEditField(id, "nombre", "changes", "Otro nombre, por favor.", (await admin.getEdit(id))!.listing.edit!.fields.nombre!.submittedAt);
  await asAdmin(page, `/admin/ediciones/${id}`);
  await expect(diff(page, "Nombre")).toContainText("Cambios pedidos: Otro nombre, por favor.");
  await expect(page.getByText("Lo pendiente tiene cambios pedidos: espera al anfitrión.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Aprobar" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Pedir cambios" })).toHaveCount(0);
});
