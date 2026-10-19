import { expect, test, type Page } from "@playwright/test";
import { registerAndEnter, switchToOwner } from "./helpers/session";
import { hasSupabase, resetListings } from "./helpers/supabase-admin";

// Fase 2 · publicar una casa, aprobarla y verla. Contra Supabase local (pnpm db:start); se salta sin la clave de servicio.
// El aviso del formulario (Next añade su propio role="alert" para anunciar rutas).
const alert = (page: Page) => page.locator(".note[role=\"alert\"]");

test.describe.configure({ mode: "serial" });
test.skip(!hasSupabase(), "Necesita Supabase local y SUPABASE_SERVICE_ROLE_KEY en apps/web/.env.local");

test.beforeAll(async () => {
  await resetListings();
});

test("el borrador se guarda paso a paso y sobrevive a recargar", async ({ page }) => {
  await registerAndEnter(page, "Yorleny Prueba", "8777 0001");
  await switchToOwner(page);
  await page.getByRole("link", { name: "Publicar casa" }).click();
  await expect(page).toHaveURL(/\/propietario\/publicar\/[0-9a-f-]+\/1$/);
  await expect(page.getByText("Paso 1 de 5")).toBeVisible();

  // Paso 1: la respuesta mensual es explícita.
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(alert(page)).toContainText("Elegí Casa, Apartamento o Habitación.");
  await page.getByLabel("Tipo de alojamiento *").selectOption("casa");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(alert(page)).toContainText("Respondé si aceptás alquiler mensual.");
  await page.getByLabel("¿Aceptás alquiler mensual? *").selectOption("yes");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/2$/);

  // Paso 2: ubicación con pin.
  await page.getByLabel("Provincia *").selectOption("Limón");
  await page.getByLabel("Cantón *").fill("Talamanca");
  await page.getByLabel("Zona / playa / barrio *").fill("Manzanillo");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(alert(page)).toContainText("Marcá en el mapa la ubicación aproximada.");
  await page.locator(".leaflet-container").click({ position: { x: 150, y: 120 } });
  await expect(page.locator('input[name="lat"]')).not.toHaveValue("");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/3$/);

  // Paso 3: campos del prototipo; el tipo de parqueo aparece al marcar Parqueo.
  await expect(page.getByLabel("Tipo de parqueo *")).toBeHidden();
  await page.getByLabel("Parqueo", { exact: true }).check();
  await expect(page.getByLabel("Tipo de parqueo *")).toBeVisible();
  await page.getByLabel("Máximo de personas *").fill("5");
  await page.getByLabel("Número de habitaciones ofrecidas *").fill("2");
  await page.getByLabel("Número de baños disponibles *").fill("2");
  await page.getByLabel("Tipo de parqueo *").selectOption("free");
  await page.getByLabel("Frente al mar").check();
  await page.getByLabel("Título *").fill("Casa Manzanillo, a pie de playa");
  await page.getByLabel("Descripción *").fill("Casa de madera a 80 m de la playa, con rancho y hamacas.");

  // Recargar antes de guardar pierde lo no enviado; lo guardado en pasos anteriores sigue ahí.
  await page.reload();
  await expect(page.getByLabel("Título *")).toHaveValue("");
  await page.goto(page.url().replace(/\/3$/, "/2"));
  await expect(page.getByLabel("Cantón *")).toHaveValue("Talamanca");
  await expect(page.getByLabel("Zona / playa / barrio *")).toHaveValue("Manzanillo");
  await page.goto(page.url().replace(/\/2$/, "/1"));
  await expect(page.getByLabel("Tipo de alojamiento *")).toHaveValue("casa");
  await expect(page.getByLabel("¿Aceptás alquiler mensual? *")).toHaveValue("yes");

  // Volver a /propietario/publicar ofrece seguir con el borrador.
  await page.goto("/propietario/publicar");
  await expect(page.getByText("Tenés un borrador sin enviar")).toBeVisible();
  await page.getByRole("button", { name: "Seguir con el borrador" }).click();
  await expect(page).toHaveURL(/\/propietario\/publicar\/[0-9a-f-]+\/1$/);

  // Paso 3 completo.
  await page.goto(page.url().replace(/\/1$/, "/3"));
  await page.getByLabel("Máximo de personas *").fill("5");
  await page.getByLabel("Número de habitaciones ofrecidas *").fill("2");
  await page.getByLabel("Número de baños disponibles *").fill("2");
  await page.getByLabel("Parqueo", { exact: true }).check();
  await page.getByLabel("Tipo de parqueo *").selectOption("free");
  await page.getByLabel("Frente al mar").check();
  await page.getByLabel("Título *").fill("Casa Manzanillo, a pie de playa");
  await page.getByLabel("Descripción *").fill("Casa de madera a 80 m de la playa, con rancho y hamacas.");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/4$/);

  // Paso 4: fotos generadas en el navegador; con 4 no deja seguir, con 5 sí.
  const files = await jpegFiles(page, 5);
  await page.getByLabel("Agregar fotos").setInputFiles(files.slice(0, 4));
  await expect(page.getByRole("status")).toHaveText("4 fotos");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(alert(page)).toContainText("Agregá al menos 5 fotos.");
  await page.getByLabel("Agregar fotos").setInputFiles(files.slice(4));
  await expect(page.getByRole("status")).toHaveText("5 fotos");
  await expect(page.locator(".photos-grid .tag")).toHaveText("Portada");
  await page.reload();
  await expect(page.getByRole("status")).toHaveText("5 fotos");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/5$/);

  // Paso 5: precio en colones (acepta separadores), mensual «consultar», enviar a revisión.
  await page.getByLabel("Precio por noche (₡) *").fill("85.000");
  await page.getByLabel("Estancia mínima (noches) *").fill("2");
  await page.getByLabel("Precio mensual *").selectOption("contact");
  await expect(page.getByText("Se mostrará «Consultar precio mensual con el propietario».")).toBeVisible();
  await expect(page.getByText("+506 8777 0001")).toBeVisible();
  await page.getByRole("button", { name: "Enviar a revisión" }).click();
  await expect(page).toHaveURL(/\/propietario\/casas\?enviada=1/);
  await expect(page.getByRole("status")).toContainText("Anuncio enviado a revisión");
  await expect(page.getByText("Pendiente de revisión")).toBeVisible();
  await expect(page.getByText("₡85 000")).toBeVisible();
  await expect(page.getByRole("link", { name: "Casa Manzanillo, a pie de playa" })).toBeVisible();

  // Un borrador nuevo se puede descartar.
  await page.getByRole("link", { name: "Nueva" }).click();
  await expect(page).toHaveURL(/\/propietario\/publicar\/[0-9a-f-]+\/1$/);
  await page.goto("/propietario/casas");
  await expect(page.getByText("Borrador sin título")).toBeVisible();
  await page.getByRole("button", { name: "Descartar" }).click();
  await expect(page.getByText("Borrador sin título")).toHaveCount(0);
});

/** JPEG de color plano dibujados con canvas en la página (sin archivos de prueba en el repo). */
async function jpegFiles(page: Page, count: number) {
  const base64 = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 640;
    c.height = 480;
    const x = c.getContext("2d")!;
    x.fillStyle = "#1f8a70";
    x.fillRect(0, 0, 640, 480);
    return c.toDataURL("image/jpeg", 0.8).split(",")[1];
  });
  const buffer = Buffer.from(base64, "base64");
  return Array.from({ length: count }, (_, i) => ({ name: `foto-${i + 1}.jpg`, mimeType: "image/jpeg", buffer }));
}
