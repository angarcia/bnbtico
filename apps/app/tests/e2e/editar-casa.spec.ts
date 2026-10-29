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
