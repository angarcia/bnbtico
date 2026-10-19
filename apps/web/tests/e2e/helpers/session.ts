import { expect, type Page } from "@playwright/test";

/** Registro (o inicio de sesión si la cuenta ya existe) con número de prueba y código 123456; termina en /explorar. */
export async function registerAndEnter(page: Page, name: string, phone: string) {
  await page.goto("/cuenta");
  await page.getByLabel("Nombre").fill(name);
  await page.getByLabel("WhatsApp con código de país").fill(phone);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/cuenta\/codigo/);
  await page.getByLabel("Código de 6 dígitos").fill("123456");
  await page.getByRole("button", { name: "Verificar y continuar" }).click();
  await expect(page).toHaveURL(/\/cuenta\/lista/);
  await page.getByRole("link", { name: "Ahora no · continuar" }).click();
  await expect(page).toHaveURL(/\/explorar/);
}

/** Pasa la interfaz a modo propietario desde Mi cuenta. */
export async function switchToOwner(page: Page) {
  await page.goto("/cuenta");
  await page.getByRole("button", { name: "¿Tenés una casa? Publicala" }).click();
  await expect(page).toHaveURL(/\/propietario$/);
}
