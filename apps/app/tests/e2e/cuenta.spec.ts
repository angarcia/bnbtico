import { expect, test } from "./helpers/test";
import { deleteAccount, FREE_PHONE, INTL_PHONE } from "../db/postgrest-auth-harness";
import { enterCode, expectNoCookies, injectSession } from "./helpers/session";

// Cuenta con WhatsApp verificado por código (pantallas 06, 07, 08 y 20), en el navegador contra Supabase local.
test.describe.configure({ mode: "serial" });

const entryHeading = (page: import("@playwright/test").Page) => page.getByRole("heading", { name: "Su nombre y su WhatsApp. Nada más." });

test("registro, código, Mi cuenta, editar, cerrar sesión y volver a entrar, sin una sola cookie", async ({ page }) => {
  await deleteAccount(FREE_PHONE);
  await page.goto("/explorar");
  await expect(page.getByRole("link", { name: "Ingresar" })).toBeVisible();
  await page.getByRole("link", { name: "Mi cuenta", exact: true }).click();
  await expect(entryHeading(page)).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navegación principal" })).toHaveCount(0);

  await page.getByLabel("Nombre").fill("Ana Prueba");
  await page.getByLabel("Número de WhatsApp").fill("8888 9999");
  await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();

  await expect(page).toHaveURL(/\/cuenta\/codigo/);
  await expect(page.getByRole("heading", { name: "Introduzca el código" })).toBeVisible();
  await expect(page.getByText("+506 8888 9999")).toBeVisible();
  await expect(page.getByText(/Puede pedir otro en/)).toBeVisible();
  // El número pendiente sobrevive a recargar la pestaña.
  await page.reload();
  await expect(page.getByText("+506 8888 9999")).toBeVisible();
  await page.getByLabel("Código de 6 dígitos").fill("000000");
  await page.getByRole("button", { name: "Verificar y continuar" }).click();
  await expect(page.locator(".field-error")).toHaveText("Ese código no es correcto o caducó.");

  await enterCode(page);
  await expect(page).toHaveURL(/\/cuenta\/lista/);
  await expect(page.getByRole("heading", { name: "¡Listo! Su cuenta está creada" })).toBeVisible();
  await page.getByRole("link", { name: "Ahora no · continuar" }).click();
  await expect(page).toHaveURL(/\/explorar/);
  await expect(page.getByRole("link", { name: "Ingresar" })).toHaveCount(0);

  await page.getByRole("link", { name: "Mi cuenta", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ana Prueba" })).toBeVisible();
  await expect(page.getByText(/WhatsApp verificado/)).toBeVisible();
  await expect(page.getByText("Identidad", { exact: false })).toHaveCount(0);

  await page.getByRole("link", { name: "Editar", exact: true }).click();
  // «Guardar cambios» solo se activa con cambios y, al guardar, se desactiva con un aviso visible.
  const save = page.getByRole("button", { name: "Guardar cambios" });
  await expect(save).toBeDisabled();
  await page.getByLabel("Descripción (opcional)").fill("Viajo con mi familia");
  await expect(save).toBeEnabled();
  await page.getByLabel("Correo de recuperación (opcional)").fill("ana@");
  await save.click();
  await expect(page.getByRole("alert").filter({ hasText: "Ese correo no parece válido." })).toBeVisible();
  await page.getByLabel("Correo de recuperación (opcional)").fill("ana@ejemplo.com");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await save.click();
  await expect(page.getByRole("status").filter({ hasText: "Cambios guardados." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Guardado" })).toBeDisabled();
  await page.getByLabel("Nombre").fill("Ana Prueba ");
  await expect(save).toBeDisabled(); // solo espacios: sin cambios
  await page.getByLabel("Nombre").fill("Ana Prueba");

  // La sesión sigue tras cerrar y abrir la app.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Ana Prueba" })).toBeVisible();
  await expectNoCookies(page);

  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(entryHeading(page)).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("bnbtico-auth"))).toBeNull();

  await page.getByRole("link", { name: "Ya tengo cuenta · entrar con mi WhatsApp" }).click();
  await expect(page.getByRole("heading", { name: "Entre con su WhatsApp" })).toBeVisible();
  await page.getByLabel("Número de WhatsApp").fill("+506 8888 9999");
  await page.waitForTimeout(1100); // Supabase admite un código por segundo y número

  await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();
  await enterCode(page);
  await expect(page).toHaveURL(/\/cuenta$/);
  await expect(page.getByRole("heading", { name: "Ana Prueba" })).toBeVisible();
  await expect(page.getByLabel("Descripción (opcional)")).toHaveCount(0);
  await page.getByRole("link", { name: "Editar", exact: true }).click();
  await expect(page.getByLabel("Descripción (opcional)")).toHaveValue("Viajo con mi familia");
  await expectNoCookies(page);

  // Volver a «Crear cuenta» con un número que ya tiene correo no vuelve a ofrecer añadirlo.
  await page.goto("/cuenta");
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await page.getByLabel("Nombre").fill("Ana Prueba");
  await page.getByLabel("Número de WhatsApp").fill("8888 9999");
  await page.waitForTimeout(1100);
  await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();
  await enterCode(page);
  await expect(page).not.toHaveURL(/\/cuenta\/lista/);
  await expect(page.getByRole("heading", { name: "¡Listo! Su cuenta está creada" })).toHaveCount(0);
});

test("ingresar con un número sin cuenta avisa", async ({ page }) => {
  await deleteAccount(FREE_PHONE);
  await page.goto("/cuenta?modo=entrar");
  await page.getByLabel("Número de WhatsApp").fill("8888 9999");
  await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();
  await expect(page.locator(".field-error")).toHaveText("No hay una cuenta con ese WhatsApp. Cree una cuenta.");
  await page.getByLabel("Número de WhatsApp").fill("123");
  await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();
  await expect(page.locator(".field-error")).toHaveText("Ese número no parece válido para el país elegido.");
});

test("crear cuenta con un WhatsApp de otro país y volver a entrar con «Otro país»", async ({ page }) => {
  await deleteAccount(INTL_PHONE);
  await page.goto("/cuenta");
  const country = page.getByLabel("País de su WhatsApp");
  await expect(country).toHaveValue("506");
  await expect(page.locator(".input-prefix .prefix")).toHaveText("+506");
  await page.getByLabel("Nombre").fill("John Test");
  await country.selectOption({ label: "Estados Unidos / Canadá (+1)" });
  await expect(page.locator(".input-prefix .prefix")).toHaveText("+1");
  await page.getByLabel("Número de WhatsApp").fill("(415) 555-01");
  await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();
  await expect(page.locator(".field-error")).toHaveText("Ese número no parece válido para el país elegido.");
  await page.getByLabel("Número de WhatsApp").fill("(415) 555-0100");
  await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();

  await expect(page.getByText("+1 415 555 0100")).toBeVisible();
  await page.reload();
  await expect(page.getByText("+1 415 555 0100")).toBeVisible();
  await enterCode(page);
  await expect(page).toHaveURL(/\/cuenta\/lista/);
  await page.goto("/cuenta");
  await expect(page.getByText("WhatsApp verificado · +1 415 555 0100")).toBeVisible();

  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await page.getByRole("link", { name: "Ya tengo cuenta · entrar con mi WhatsApp" }).click();
  await page.getByLabel("País de su WhatsApp").selectOption("other");
  await expect(page.locator(".input-prefix .prefix")).toHaveCount(0);
  await page.getByLabel("Número de WhatsApp").fill("1 415 555 0100");
  await page.waitForTimeout(1100); // Supabase admite un código por segundo y número
  await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();
  await expect(page.getByText("+1 415 555 0100")).toBeVisible();
  await enterCode(page);
  await expect(page.getByRole("heading", { name: "John Test" })).toBeVisible();
  await deleteAccount(INTL_PHONE);
});

test("una ruta privada sin sesión lleva a Ingresar y, tras el código, vuelve a ella", async ({ page }) => {
  await page.goto("/propietario/casas");
  await expect(page).toHaveURL(/\/cuenta\?next=%2Fpropietario%2Fcasas$/);
  await page.getByRole("link", { name: "Ya tengo cuenta · entrar con mi WhatsApp" }).click();
  await page.getByLabel("Número de WhatsApp").fill("8777 0001");
  await page.waitForTimeout(1100); // otro archivo pudo pedir un código para este número hace un instante

  await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();
  await expect(page.getByText("Después de verificar vuelve adonde estaba.")).toBeVisible();
  await enterCode(page);
  await expect(page).toHaveURL(/\/propietario\/casas$/);
  await expect(page.getByRole("heading", { level: 1, name: "Mis casas" })).toBeVisible();
});

test("modo propietario y vuelta a cliente; ayuda con el canal de cada rol (sesión inyectada)", async ({ page }) => {
  await injectSession(page, "owner");
  await page.goto("/cuenta");
  await expect(page.getByRole("heading", { level: 1, name: "Mi cuenta" })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Navegación principal" });

  await page.getByRole("button", { name: "Publicar mi casa" }).click();
  await expect(page).toHaveURL(/\/propietario$/);
  await expect(nav.getByRole("link")).toHaveText(["Inicio", "Mis casas", "Calendario", "Consultas", "Cuenta"]);
  await expect(nav.getByRole("link", { name: "Inicio" })).toHaveAttribute("aria-current", "page");
  await nav.getByRole("link", { name: "Cuenta", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Cuenta" })).toBeVisible();
  await expect(page.getByText("Próximo cobro")).toBeVisible();
  await page.getByRole("link", { name: /Ayuda por WhatsApp/ }).click();
  await expect(page.getByText("atención a propietarios")).toBeVisible();

  await page.goto("/cuenta");
  await page.getByRole("button", { name: /Buscar una casa/ }).click();
  await expect(page).toHaveURL(/\/explorar/);
  await expect(nav.getByRole("link")).toHaveText(["Explorar", "Favoritos", "Mi cuenta"]);
  await page.goto("/ayuda");
  await expect(page.getByText("atención a clientes")).toBeVisible();

  // Cerrar sesión en modo propietario deja la app en modo cliente para la siguiente persona.
  await page.goto("/cuenta");
  await page.getByRole("button", { name: "Publicar mi casa" }).click();
  await nav.getByRole("link", { name: "Cuenta", exact: true }).click();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(entryHeading(page)).toBeVisible();
  await page.goto("/explorar");
  await expect(nav.getByRole("link")).toHaveText(["Explorar", "Favoritos", "Mi cuenta"]);
  await page.goto("/propietario");
  await expect(page).toHaveURL(/\/cuenta\?next=%2Fpropietario$/);
  await expectNoCookies(page);
});

test("recuperar la cuenta y Favoritos sin sesión", async ({ page }) => {
  await page.goto("/cuenta");
  await page.getByRole("link", { name: "No tengo acceso a mi WhatsApp" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Recuperar mi cuenta" })).toBeVisible();
  await page.getByRole("link", { name: "Escribir a bnbtico por WhatsApp" }).click();
  await expect(page.getByText("atención a clientes")).toBeVisible();
  await page.goto("/favoritos");
  await expect(page.getByRole("heading", { level: 1, name: "Favoritos" })).toBeVisible();
  await expect(page.getByText("No necesita cuenta.")).toBeVisible();
});
