import { expect, test } from "./helpers/test";
import { TEST_PHONES } from "../db/local";
import { postgrestHarness } from "../db/postgrest-harness";

// Ingresar en escritorio es una ventana sobre la página. Al verificar el código (correcto), la ventana se cierra con la sesión
// iniciada; antes se quedaba abierta con «Solicite un código nuevo para continuar.» (Ana, 2026-11-17).
test.beforeAll(async () => {
  await (await postgrestHarness()).reset();
});

test("en escritorio, verificar el código cierra la ventana de Ingresar con la sesión iniciada", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/explorar");
  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  await nav.getByRole("button", { name: "Ingresar" }).click();
  const dialog = page.getByRole("dialog", { name: "Ingresar" });
  await dialog.getByLabel("Número de WhatsApp").fill(TEST_PHONES.other.replace(/^\+506/, ""));
  await dialog.getByRole("button", { name: /Recibir código/ }).click();
  await dialog.getByLabel("Código de 6 dígitos").fill("123456");
  await dialog.getByRole("button", { name: "Verificar y continuar" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Solicite un código nuevo para continuar.")).toHaveCount(0);
  await expect(page).toHaveURL(/\/explorar$/);
  await expect(nav.getByRole("button", { name: "Ingresar" })).toHaveCount(0);
});
