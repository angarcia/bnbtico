import { expect, test, type Page } from "./helpers/test";
import { injectSession } from "./helpers/session";
import { postgrestHarness } from "../db/postgrest-harness";

// Escritorio (2026-11-25): la barra empieza sobre el mapa en Explorar, Ayuda e Ingresar se abren en una ventana sobre la
// pantalla y Cuenta sin casas ocupa la misma columna que con casas, también al editar el perfil.
test.beforeAll(async () => {
  await (await postgrestHarness()).reset();
});

const desktop = (page: Page) => page.setViewportSize({ width: 1440, height: 900 });
const nav = (page: Page) => page.getByRole("navigation", { name: "Navegación principal" });

test("en Explorar, el logo de la barra empieza sobre el borde izquierdo del mapa", async ({ page }) => {
  await desktop(page);
  await page.goto("/explorar");
  const [logo, map] = await Promise.all([page.locator(".desktop-brand").boundingBox(), page.locator(".explore-map-pane").boundingBox()]);
  expect(Math.round(logo!.x)).toBe(Math.round(map!.x));
});

test("«Ayuda por WhatsApp» de la barra abre una ventana sin salir de la pantalla", async ({ page }) => {
  await desktop(page);
  await page.goto("/favoritos");
  await nav(page).getByRole("button", { name: "Ayuda por WhatsApp" }).click();
  const dialog = page.getByRole("dialog", { name: "Ayuda por WhatsApp" });
  await expect(dialog.getByText(/atención a clientes/i)).toBeVisible();
  await expect(page).toHaveURL(/\/favoritos$/);
  await dialog.getByRole("button", { name: "Cerrar" }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/favoritos$/);
});

test("sin sesión, una dirección privada abre Ingresar en una ventana, no a pantalla completa", async ({ page }) => {
  await desktop(page);
  await page.goto("/propietario/casas");
  const dialog = page.getByRole("dialog", { name: "Ingresar" });
  await expect(dialog.getByLabel("Número de WhatsApp")).toBeVisible();
  await expect(page.locator("main").getByLabel("Número de WhatsApp")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Cerrar" }).click();
  await expect(dialog).toBeHidden();
  await expect(page).not.toHaveURL(/\/cuenta/);
});

test("Cuenta sin casas queda en la columna izquierda y el perfil se edita en su tarjeta", async ({ page }) => {
  await desktop(page);
  await injectSession(page, "other");
  await page.goto("/cuenta");
  const card = page.locator(".account-card");
  await expect(card).toBeVisible();
  const [box, main] = await Promise.all([card.boundingBox(), page.locator("main").boundingBox()]);
  expect(box!.width).toBeLessThan(main!.width * 0.6);
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await expect(page).toHaveURL(/\/cuenta$/);
  const name = page.getByLabel("Nombre");
  await expect(name).toBeVisible();
  expect((await name.boundingBox())!.width).toBeLessThan(main!.width * 0.6);
  await expect(nav(page)).toBeVisible();
});
