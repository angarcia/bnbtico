import { expect, test } from "./helpers/test";
import { deleteAccount, FREE_PHONE, INTL_PHONE } from "../db/postgrest-auth-harness";
import { postgrestHarness } from "../db/postgrest-harness";
import { enterCode, expectNoCookies, injectSession, signOut } from "./helpers/session";

// Cuenta con WhatsApp verificado por código (pantallas 06, 07, 08 y 20), en el navegador contra Supabase local.
test.describe.configure({ mode: "serial" });

const entryHeading = (page: import("@playwright/test").Page) => page.getByRole("heading", { name: "Entre con su WhatsApp" });

test("registro, código, Cuenta, editar, cerrar sesión y volver a entrar, sin una sola cookie", async ({ page }) => {
  await deleteAccount(FREE_PHONE);
  await page.goto("/explorar");
  await page.locator(".explore-top").getByRole("link", { name: "Ingresar" }).click();
  await expect(entryHeading(page)).toBeVisible();
  // Ingresar, el código y Cuenta van a pantalla completa, sin la barra inferior.
  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  await expect(nav).toHaveCount(0);

  // Un único flujo (ticket 18): primero el número; sin cuenta, el nombre y entonces el código.
  await expect(page.getByRole("link", { name: /Ya tengo cuenta/ })).toHaveCount(0);
  await expect(page.getByLabel("Nombre")).toHaveCount(0);
  // Revisión UX A6: un solo control de país (la caja «+506» es el selector) y errores en su campo.
  await expect(page.locator(".field > label", { hasText: "País de su WhatsApp" })).toHaveCount(0);
  await expect(page.getByLabel("País de su WhatsApp")).toHaveValue("506");
  await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();
  await expect(page.locator("#account-phone-error")).toHaveText("Escriba su número de WhatsApp.");
  await expect(page.getByLabel("Número de WhatsApp")).toBeFocused();
  await expect(page.getByLabel("Número de WhatsApp")).toHaveAttribute("aria-invalid", "true");
  await page.getByLabel("Número de WhatsApp").fill("123");
  await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();
  await expect(page.locator("#account-phone-error")).toHaveText("Ese número no parece válido para el país elegido.");
  await page.getByLabel("Número de WhatsApp").fill("8888 9999");
  await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();
  await expect(page.getByRole("heading", { name: "Es su primera vez en bnbtico" })).toBeVisible();
  await expect(page.getByText("+506 8888 9999")).toBeVisible();
  await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();
  await expect(page.locator("#account-name-error")).toHaveText("Escriba su nombre.");
  await expect(page.getByLabel("Nombre")).toBeFocused();
  await page.getByLabel("Nombre").fill("Ana Prueba");
  await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();

  await expect(page).toHaveURL(/\/cuenta\/codigo/);
  await expect(page.getByRole("heading", { name: "Introduzca el código" })).toBeVisible();
  await expect(nav).toHaveCount(0);
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
  await page.getByRole("link", { name: "No, busco casa" }).click();
  await expect(page).toHaveURL(/\/explorar/);
  await expect(page.getByRole("link", { name: "Ingresar" })).toHaveCount(0);

  await page.locator(".explore-top").getByRole("link", { name: "Cuenta" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Cuenta" })).toBeVisible();
  await expect(nav).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Ana Prueba" })).toBeVisible();
  await expect(page.getByText(/WhatsApp verificado/)).toBeVisible();
  // Veriff queda fuera de la v1: la única mención de la identidad es la línea «Pronto podrá…» de la tarjeta.
  await expect(page.getByText("Identidad", { exact: false })).toHaveCount(1);
  await expect(page.getByTestId("identity-soon")).toHaveText("Pronto podrá verificar también su identidad (opcional).");

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

  await signOut(page);
  await expect(entryHeading(page)).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("bnbtico-auth"))).toBeNull();

  // Con cuenta: el código sale al primer paso, sin pedir el nombre.
  await page.getByLabel("Número de WhatsApp").fill("+506 8888 9999");
  await page.waitForTimeout(1100); // Supabase admite un código por segundo y número

  await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();
  await enterCode(page);
  // Sin casas, se llega a Explorar.
  await expect(page).toHaveURL(/\/explorar$/);
  await page.locator(".explore-top").getByRole("link", { name: "Cuenta" }).click();
  await expect(page.getByRole("heading", { name: "Ana Prueba" })).toBeVisible();
  await expect(page.getByLabel("Descripción (opcional)")).toHaveCount(0);
  await page.getByRole("link", { name: "Editar", exact: true }).click();
  await expect(page.getByLabel("Descripción (opcional)")).toHaveValue("Viajo con mi familia");
  await expectNoCookies(page);

  // Volver a entrar con un número que ya tiene cuenta no ofrece «¡Listo!» (solo sale al crear una cuenta).
  await page.goto("/cuenta");
  await signOut(page);
  await page.getByLabel("Número de WhatsApp").fill("8888 9999");
  await page.waitForTimeout(1100);
  await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();
  await enterCode(page);
  await expect(page).not.toHaveURL(/\/cuenta\/lista/);
  await expect(page.getByRole("heading", { name: "¡Listo! Su cuenta está creada" })).toHaveCount(0);
});

test("un enlace viejo con ?modo=entrar abre el mismo flujo; «Cambiar número» vuelve al primer paso", async ({ page }) => {
  await deleteAccount(FREE_PHONE);
  await page.goto("/cuenta?modo=entrar");
  await expect(entryHeading(page)).toBeVisible();
  await page.getByLabel("Número de WhatsApp").fill("123");
  await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();
  await expect(page.locator(".field-error")).toHaveText("Ese número no parece válido para el país elegido.");
  await page.getByLabel("Número de WhatsApp").fill("8888 9999");
  await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();
  await expect(page.getByRole("heading", { name: "Es su primera vez en bnbtico" })).toBeVisible();
  await page.getByRole("button", { name: "Cambiar número" }).click();
  await expect(entryHeading(page)).toBeVisible();
  await expect(page.getByLabel("Número de WhatsApp")).toBeVisible();
});

test("crear cuenta con un WhatsApp de otro país y volver a entrar con «Otro país»", async ({ page }) => {
  await deleteAccount(INTL_PHONE);
  await page.goto("/cuenta");
  const country = page.getByLabel("País de su WhatsApp");
  await expect(country).toHaveValue("506");
  await expect(page.locator(".input-prefix .prefix-value")).toHaveText("+506");
  await country.selectOption({ label: "Estados Unidos / Canadá (+1)" });
  await expect(page.locator(".input-prefix .prefix-value")).toHaveText("+1");
  await page.getByLabel("Número de WhatsApp").fill("(415) 555-01");
  await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();
  await expect(page.locator("#account-phone-error")).toHaveText("Ese número no parece válido para el país elegido.");
  await page.getByLabel("Número de WhatsApp").fill("(415) 555-0100");
  await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();
  await page.getByLabel("Nombre").fill("John Test");
  await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();

  await expect(page).toHaveURL(/\/cuenta\/codigo/);
  await expect(page.getByText("+1 415 555 0100")).toBeVisible();
  await page.reload();
  await expect(page.getByText("+1 415 555 0100")).toBeVisible();
  await enterCode(page);
  await expect(page).toHaveURL(/\/cuenta\/lista/);
  await page.goto("/cuenta");
  await expect(page.getByText("WhatsApp verificado · +1 415 555 0100")).toBeVisible();

  await signOut(page);
  await page.getByLabel("País de su WhatsApp").selectOption("other");
  // El selector sigue a la vista (para volver a otro país) y dice «Otro».
  await expect(page.locator(".input-prefix .prefix-value")).toHaveText("Otro");
  await page.getByLabel("Número de WhatsApp").fill("1 415 555 0100");
  await page.waitForTimeout(1100); // Supabase admite un código por segundo y número
  await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();
  await expect(page.getByText("+1 415 555 0100")).toBeVisible();
  await enterCode(page);
  await expect(page).toHaveURL(/\/explorar$/);
  await page.goto("/cuenta");
  await expect(page.getByRole("heading", { name: "John Test" })).toBeVisible();
  await deleteAccount(INTL_PHONE);
});

test("una ruta privada sin sesión lleva a Ingresar y, tras el código, vuelve a ella", async ({ page }) => {
  const h = await postgrestHarness();
  await h.reset();
  await h.seed({ status: "draft", draft: { title: "Casa de vuelta" } });
  await page.goto("/propietario/casas");
  await expect(page).toHaveURL(/\/cuenta\?next=%2Fpropietario%2Fcasas$/);
  await page.getByLabel("Número de WhatsApp").fill("8777 0001");
  await page.waitForTimeout(1100); // otro archivo pudo pedir un código para este número hace un instante

  await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();
  await expect(page.getByText("Después de verificar vuelve adonde estaba.")).toBeVisible();
  await enterCode(page);
  await expect(page).toHaveURL(/\/propietario\/casas$/);
  await expect(page.getByRole("heading", { level: 1, name: "Mis casas" })).toBeVisible();
  await expect(page.getByRole("article").getByRole("heading", { name: "Casa de vuelta" })).toBeVisible();
});

test("el canal de ayuda sigue a las casas: sin casas, el de clientes; con una, el de propietarios (sesión inyectada)", async ({ page }) => {
  const h = await postgrestHarness();
  await h.reset();
  await injectSession(page, "owner");
  await page.goto("/cuenta");
  await expect(page.getByRole("heading", { level: 1, name: "Cuenta" })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  await expect(nav).toHaveCount(0);
  // Sin casas: «Publicar mi casa», «Mi perfil» y la línea de clientes; nada de suscripción ni de cambiar de modo.
  await expect(page.getByRole("link", { name: /Publicar mi casa/ })).toHaveAttribute("href", "/propietario/publicar");
  await expect(page.getByRole("link", { name: /Mi perfil/ })).toBeVisible();
  await expect(page.getByText("Próximo cobro")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Buscar una casa/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Ayuda por WhatsApp/ })).toContainText("Línea de bnbtico para clientes");
  await page.getByRole("link", { name: /Ayuda por WhatsApp/ }).click();
  await expect(page.getByText("atención a clientes")).toBeVisible();

  // Con una casa (en cualquier estado): la suscripción y la línea de propietarios; sin «Publicar mi casa».
  await h.seed({ status: "draft", draft: { title: "Casa de la ayuda" } });
  await page.goto("/cuenta");
  await expect(page.getByText("Próximo cobro")).toBeVisible();
  await expect(page.getByRole("link", { name: /Publicar mi casa/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Mi perfil/ })).toHaveCount(0);
  await page.getByRole("link", { name: /Ayuda por WhatsApp/ }).click();
  await expect(page.getByText("atención a propietarios")).toBeVisible();

  // Cerrar sesión deja la app sin sesión para la siguiente persona: dos pestañas y la zona del propietario pide ingresar.
  await page.goto("/cuenta");
  await signOut(page);
  await expect(entryHeading(page)).toBeVisible();
  await page.goto("/explorar");
  await expect(nav.getByRole("link")).toHaveText(["Explorar", "Favoritos"]);
  await page.goto("/propietario");
  await expect(page).toHaveURL(/\/cuenta\?next=%2Fpropietario%2Fcasas$/);
  await expectNoCookies(page);
  await h.reset();
});

test("recuperar la cuenta y Favoritos sin sesión", async ({ page }) => {
  await page.goto("/cuenta");
  await page.getByRole("link", { name: "No tengo acceso a mi WhatsApp" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Recuperar mi cuenta" })).toBeVisible();
  await page.getByRole("link", { name: "Escribir a bnbtico por WhatsApp" }).click();
  await expect(page.getByText("atención a clientes")).toBeVisible();
  await page.goto("/favoritos");
  await expect(page.getByRole("heading", { level: 1, name: "Favoritos" })).toBeVisible();
  await expect(page.getByText(/Guardar casas no necesita cuenta/)).toBeVisible();
});
