import { devices, expect, test, type Browser, type Page } from "@playwright/test";
import { registerAndEnter, switchToOwner } from "./helpers/session";
import { hasSupabase, makeAdmin, publicIdOf, resetListings } from "./helpers/supabase-admin";

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
  await page.getByRole("button", { name: "Publicar casa" }).click();
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

  // Volver a publicar ofrece seguir con el borrador; abrir la página no crea borradores.
  await page.goto("/propietario");
  await page.getByRole("button", { name: "Publicar casa" }).click();
  await expect(page).toHaveURL(/\/propietario\/publicar$/);
  await expect(page.getByText("Tenés un borrador sin enviar")).toBeVisible();
  await page.reload();
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

  // Un borrador nuevo se puede descartar (con confirmación).
  await page.getByRole("button", { name: "Nueva" }).click();
  await expect(page).toHaveURL(/\/propietario\/publicar\/[0-9a-f-]+\/1$/);
  await page.goto("/propietario/casas");
  await expect(page.getByText("Borrador sin título")).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Descartar" }).click();
  await expect(page.getByText("Borrador sin título")).toHaveCount(0);
});

test("un usuario con sesión pero sin is_admin no ve /admin", async ({ page }) => {
  await registerAndEnter(page, "Ana Prueba", "8888 1234");
  const response = await page.goto("/admin");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("link", { name: /Revisión de anuncios/ })).toHaveCount(0);
});

test("el admin revisa: pedir cambios exige motivo; aprobar activa la casa", async ({ browser }) => {
  const page = await adminPage(browser);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Revisión de anuncios" })).toBeVisible();
  await expect(page.getByText("1 pendientes")).toBeVisible();
  await page.getByRole("link", { name: "Revisar" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Casa Manzanillo, a pie de playa" })).toBeVisible();
  await expect(page.getByText("Publicado por Yorleny Prueba")).toBeVisible();
  await expect(page.getByText("Fotos (5)")).toBeVisible();
  await expect(page.getByText("Frente al mar")).toBeVisible();
  await expect(page.getByText("Consultar con el propietario")).toBeVisible();
  await expect(page.getByText("Gratuito")).toBeVisible();
  await expect(page.getByText("Identidad")).toHaveCount(0);
  await page.getByRole("button", { name: "Ampliar foto 1, portada" }).click();
  await expect(page.getByText("Foto 1 de 5 · Portada")).toBeVisible();
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page.getByText("Foto 2 de 5")).toBeVisible();
  await page.getByRole("button", { name: "Pedir cambios" }).click();
  await expect(page.locator(".field-error[role=\"alert\"]")).toContainText("Escribí un motivo");
  await page.getByRole("button", { name: "Aprobar anuncio" }).click();
  await expect(page.getByRole("status")).toContainText("Activa");
  await expect(page.getByRole("button", { name: "Aprobar anuncio" })).toHaveCount(0);
  await page.goto("/admin");
  await expect(page.getByText("0 pendientes")).toBeVisible();
  await page.context().close();
});

test("la ficha pública abre sin sesión con metadatos para WhatsApp y moneda", async ({ browser }) => {
  const ctx = await browser.newContext(devices["Pixel 7"]);
  const page = await ctx.newPage();
  const publicId = await publicIdOf("Casa Manzanillo, a pie de playa");
  await page.goto(`/casa/${publicId.toLowerCase()}`);
  await expect(page.getByRole("heading", { level: 1, name: "Casa Manzanillo, a pie de playa" })).toBeVisible();
  await expect(page.getByText("✓ WhatsApp verificado")).toBeVisible();
  await expect(page.getByText(`Ref ${publicId}`)).toBeVisible();
  await expect(page.getByText("Manzanillo, Talamanca, Limón")).toBeVisible();
  // Lo que ofrece: solo lo que sí tiene.
  await expect(page.getByText("5 personas")).toBeVisible();
  await expect(page.getByText("Frente al mar")).toBeVisible();
  await expect(page.getByText("Parqueo · gratuito")).toBeVisible();
  await expect(page.getByText("Piscina")).toHaveCount(0);
  // Precio una vez en la barra fija, mensual «consultar», contacto deshabilitado hasta la fase 3.
  await expect(page.locator(".cta-bar")).toContainText("₡85 000");
  await expect(page.getByText("Mensual: consultar precio con el propietario")).toBeVisible();
  await expect(page.getByRole("button", { name: /Contactar por WhatsApp/ })).toBeDisabled();
  await expect(page.getByText("Disponible pronto")).toBeVisible();
  await expect(page.getByText("Identidad")).toHaveCount(0);
  await expect(page.locator(".note")).toHaveCount(1);
  // Metadatos para la vista previa de WhatsApp.
  expect(await page.locator('meta[property="og:title"]').getAttribute("content")).toContain("Casa Manzanillo, a pie de playa");
  expect(await page.locator('meta[property="og:description"]').getAttribute("content")).toBe("Casa en Manzanillo, Limón · 5 personas · ₡85\u00a0000 por noche · orientativo");
  expect(await page.locator('meta[property="og:image"]').getAttribute("content")).toMatch(/\/storage\/v1\/object\/public\/listings\//);
  expect(await page.locator('link[rel="canonical"]').getAttribute("href")).toBe(`https://bnbtico.com/casa/${publicId}`);
  // Dólares solo como visualización.
  await page.getByRole("button", { name: "$ Dólares" }).click();
  await expect(page.locator(".cta-bar")).toContainText("$167");
  await expect(page.getByText(/≈ ₡510 por US\$1/)).toBeVisible();
  // Mapa aproximado.
  await expect(page.locator(".leaflet-container")).toBeVisible();
  // Enlace inválido → 404.
  const r = await page.goto("/casa/CT-0001");
  expect(r?.status()).toBe(404);
  await ctx.close();
});

test("Explorar arranca en Limón, filtra, limpia y abre la ficha", async ({ page }) => {
  await page.goto("/explorar");
  await expect(page.getByRole("heading", { name: "¿A dónde vas?" })).toBeVisible();
  await expect(page.getByText("1 casa en Limón")).toBeVisible();
  await expect(page.getByRole("link", { name: "Limón", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("link", { name: "Cartago", exact: true })).toHaveCount(0);
  // Qué necesitan y precio están plegados en móvil.
  await expect(page.getByText("Qué necesitan")).toHaveCount(0);
  await page.getByRole("link", { name: /Más filtros/ }).click();
  await expect(page.getByText("Qué necesitan")).toBeVisible();
  await page.getByLabel("Piscina").check();
  await expect(page.getByText("Sin resultados con esos filtros.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Menos filtros/ })).toContainText("1");
  await page.getByRole("link", { name: "Limpiar" }).click();
  await expect(page.getByText("1 casa en Limón")).toBeVisible();
  // Personas 6+ deja fuera la casa de 5; Cualquiera la devuelve.
  await page.getByLabel("Personas").selectOption("6");
  await expect(page.getByText("Sin resultados con esos filtros.")).toBeVisible();
  await page.getByLabel("Personas").selectOption("0");
  await expect(page.getByText("1 casa en Limón")).toBeVisible();
  // Moneda junto a la línea de resultados.
  await page.getByRole("button", { name: "$ Dólares" }).click();
  await expect(page.getByText("$167")).toBeVisible();
  await expect(page.getByText(/≈ ₡510 por US\$1/)).toBeVisible();
  await page.getByRole("button", { name: "₡ Colones" }).click();
  await page.getByRole("link", { name: /Casa Manzanillo, a pie de playa/ }).click();
  await expect(page).toHaveURL(/\/casa\/CT-\d+/);
});

test("detalle del propietario: no disponible, compartir, editar y reenviar", async ({ page, browser }) => {
  await registerAndEnter(page, "Yorleny Prueba", "8777 0001");
  await switchToOwner(page);
  await page.goto("/propietario/casas");
  await page.getByRole("link", { name: "Casa Manzanillo, a pie de playa" }).click();
  await expect(page).toHaveURL(/\/propietario\/casas\/[0-9a-f-]+$/);
  await expect(page.getByText("Visible en bnbtico")).toBeVisible();
  const publicId = await publicIdOf("Casa Manzanillo, a pie de playa");
  await expect(page.getByRole("button", { name: "Compartir ficha" })).toBeEnabled();
  await expect(page.locator(`[data-share-url$="/casa/${publicId}"]`)).toHaveCount(1);

  // No disponible: la ficha sigue abierta pero avisa.
  await page.getByRole("button", { name: "Marcar no disponible" }).click();
  await expect(page.getByText("No disponible", { exact: true })).toBeVisible();
  const guest = await (await browser.newContext(devices["Pixel 7"])).newPage();
  await guest.goto(`/casa/${publicId}`);
  await expect(guest.getByText("No disponible por ahora")).toBeVisible();
  await page.getByRole("button", { name: "Marcar disponible" }).click();
  await expect(page.getByText("Activa", { exact: true })).toBeVisible();

  // Editar una casa activa la oculta hasta la nueva aprobación.
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Editar" }).click();
  await expect(page).toHaveURL(/\/propietario\/publicar\/[0-9a-f-]+\/1$/);
  // El borrador de una casa que ya estuvo publicada no se puede descartar.
  await page.goto("/propietario/casas");
  await expect(page.getByText("Estuvo publicada")).toBeVisible();
  await expect(page.getByRole("button", { name: "Descartar" })).toHaveCount(0);
  await page.getByRole("link", { name: "Casa Manzanillo, a pie de playa" }).click();
  await expect(page.getByRole("button", { name: "Descartar borrador" })).toHaveCount(0);
  await page.getByRole("link", { name: "Seguir" }).click();
  await guest.goto(`/casa/${publicId}`);
  await expect(guest.getByText("Este enlace ya no está activo")).toBeVisible();
  await guest.context().close();
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/5$/);
  await page.getByRole("button", { name: "Enviar a revisión" }).click();
  await expect(page).toHaveURL(/\/propietario\/casas\?enviada=1/);
  await expect(page.getByText("Pendiente de revisión")).toBeVisible();
});

test("pedir cambios: el propietario ve el motivo, corrige y reenvía", async ({ page, browser }) => {
  const admin = await adminPage(browser);
  await admin.goto("/admin");
  await admin.getByRole("link", { name: "Revisar" }).click();
  await admin.getByLabel("Motivo o indicaciones").fill("Necesitamos fotos de la cocina.");
  await admin.getByRole("button", { name: "Pedir cambios" }).click();
  await expect(admin.getByRole("status")).toContainText("Cambios solicitados");

  await registerAndEnter(page, "Yorleny Prueba", "8777 0001");
  await switchToOwner(page);
  await page.goto("/propietario/casas");
  await expect(page.getByText("Cambios solicitados")).toBeVisible();
  await expect(page.getByText("Nota de bnbtico: Necesitamos fotos de la cocina.")).toBeVisible();
  await page.getByRole("link", { name: "Casa Manzanillo, a pie de playa" }).click();
  await page.getByRole("button", { name: "Corregir y reenviar" }).click();
  await expect(page).toHaveURL(/\/propietario\/publicar\/[0-9a-f-]+\/1$/);
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Enviar a revisión" }).click();
  await expect(page.getByText("Pendiente de revisión")).toBeVisible();

  await admin.goto("/admin");
  await expect(admin.getByText("1 pendientes")).toBeVisible();
  await admin.context().close();
});

/** Contexto nuevo con la cuenta admin de prueba (8899 0001), marcada con seed_admin. */
async function adminPage(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext(devices["Pixel 7"]);
  const page = await ctx.newPage();
  await registerAndEnter(page, "Admin Prueba", "8899 0001");
  await makeAdmin("+50688990001");
  return page;
}

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
