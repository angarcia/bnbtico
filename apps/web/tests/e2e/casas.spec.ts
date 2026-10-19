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
});
