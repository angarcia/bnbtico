import { expect, test } from "@playwright/test";

// Fase 1 · cuenta con WhatsApp verificado (modo demo: código 123456). Siempre en viewport móvil.
test("registro, código, Mi cuenta, editar, cerrar sesión y volver a entrar", async ({ page }) => {
  await page.goto("/cuenta");
  await expect(page.getByRole("heading", { name: "Creá tu cuenta" })).toBeVisible();

  await page.getByLabel("Nombre").fill("Ana Prueba");
  await page.getByLabel("WhatsApp con código de país").fill("8888 1234");
  await page.getByRole("button", { name: "Crear cuenta" }).click();

  await expect(page).toHaveURL(/\/cuenta\/codigo/);
  await expect(page.getByText("Para +506 8888 1234")).toBeVisible();
  await expect(page.getByRole("button", { name: /Pedir otro código/ })).toBeDisabled();
  await page.getByLabel("Código de 6 dígitos").fill("000000");
  await page.getByRole("button", { name: "Verificar y continuar" }).click();
  await expect(page.locator(".field-error")).toContainText("no es correcto");

  await page.getByLabel("Código de 6 dígitos").fill("123456");
  await page.getByRole("button", { name: "Verificar y continuar" }).click();
  await expect(page).toHaveURL(/\/cuenta\/lista/);
  await page.getByRole("link", { name: "Ahora no · continuar" }).click();
  await expect(page).toHaveURL(/\/explorar/);

  await page.getByRole("link", { name: "Mi cuenta", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ana Prueba" })).toBeVisible();
  await expect(page.getByText("✓ WhatsApp verificado")).toBeVisible();
  await expect(page.getByText("Identidad", { exact: false })).toHaveCount(0);

  await page.getByRole("link", { name: "Editar perfil" }).click();
  await page.getByLabel("Descripción (opcional)").fill("Viajo con mi familia");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Guardado" })).toBeVisible();

  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Creá tu cuenta" })).toBeVisible();

  await page.getByRole("link", { name: "Ya tengo cuenta · Iniciar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Iniciá sesión" })).toBeVisible();
  await page.getByLabel("WhatsApp con código de país").fill("+506 8888 1234");
  await page.getByRole("button", { name: "Recibir código" }).click();
  await page.getByLabel("Código de 6 dígitos").fill("123456");
  await page.getByRole("button", { name: "Verificar y continuar" }).click();
  await expect(page).toHaveURL(/\/cuenta$/);
  await expect(page.getByRole("heading", { name: "Ana Prueba" })).toBeVisible();
  await expect(page.getByLabel("Descripción (opcional)")).toHaveCount(0);
});

test("iniciar sesión con un número sin cuenta avisa", async ({ page }) => {
  await page.goto("/cuenta?modo=entrar");
  await page.getByLabel("WhatsApp con código de país").fill("8888 9999");
  await page.getByRole("button", { name: "Recibir código" }).click();
  await expect(page.locator(".field-error")).toContainText("No hay una cuenta");
});

test("modo propietario y vuelta a cliente; ayuda con el canal de cada rol", async ({ page }) => {
  await page.goto("/cuenta");
  await page.getByLabel("Nombre").fill("Marcela");
  await page.getByLabel("WhatsApp con código de país").fill("8777 0001");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.getByLabel("Código de 6 dígitos").fill("123456");
  await page.getByRole("button", { name: "Verificar y continuar" }).click();
  await expect(page).toHaveURL(/\/cuenta\/lista/);
  await page.goto("/cuenta");

  await page.getByRole("button", { name: "¿Tenés una casa? Publicala" }).click();
  await expect(page).toHaveURL(/\/propietario$/);
  await expect(page.getByRole("link", { name: "Mis casas" })).toBeVisible();
  await page.getByRole("link", { name: "Cuenta", exact: true }).click();
  await page.getByRole("link", { name: "Escribile a bnbtico por WhatsApp" }).click();
  await expect(page.getByText("atención a propietarios")).toBeVisible();

  await page.goto("/cuenta");
  await page.getByRole("button", { name: "Buscar una casa · modo cliente" }).click();
  await expect(page).toHaveURL(/\/explorar/);
  await page.goto("/ayuda");
  await expect(page.getByText("buscadores de alojamiento")).toBeVisible();

  // Cerrar sesión en modo propietario deja la app en modo cliente para la siguiente persona.
  await page.goto("/cuenta");
  await page.getByRole("button", { name: "¿Tenés una casa? Publicala" }).click();
  await page.getByRole("link", { name: "Cuenta", exact: true }).click();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Creá tu cuenta" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Explorar" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Mis casas" })).toHaveCount(0);
});
