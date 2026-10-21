import { devices, expect, test, type Browser, type Page } from "@playwright/test";
import { registerAndEnter, switchToOwner } from "./helpers/session";
import { hasSupabase, makeAdmin, publicIdOf, resetListings } from "./helpers/supabase-admin";

// Fase 2 con el diseño v1 · publicar una casa, aprobarla y verla. Contra Supabase local; se salta sin la clave de servicio.
// El aviso del formulario (Next añade su propio role="alert" para anunciar rutas).
const alert = (page: Page) => page.locator(".note[role=\"alert\"]");
const TITLE = "Casa Manzanillo, a pie de playa";

test.describe.configure({ mode: "serial" });
test.skip(!hasSupabase(), "Necesita Supabase local y SUPABASE_SERVICE_ROLE_KEY en apps/web/.env.local");

test.beforeAll(async () => {
  await resetListings();
});

/** Pulsa «Más X» del contador n veces. */
async function count(page: Page, label: string, n: number) {
  for (let i = 0; i < n; i++) await page.getByRole("button", { name: `Más ${label}` }).click();
}

/** Ninguna pantalla del formulario hace scroll: todo cabe en la ventana (viewport de iPhone SE, 375×667). */
async function expectNoScroll(page: Page, what: string) {
  await page.waitForLoadState("networkidle");
  const [scrollH, innerH] = await page.evaluate(() => [document.documentElement.scrollHeight, window.innerHeight]);
  expect(scrollH, `${what} hace scroll: ${scrollH} > ${innerH}`).toBeLessThanOrEqual(innerH);
}

async function continuar(page: Page) {
  await page.getByRole("button", { name: "Continuar" }).click();
}

test.describe("publicar en pantallas cortas", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("el borrador se guarda pantalla a pantalla, sin scroll, con fotos, y se envía a revisión", async ({ page }) => {
    await registerAndEnter(page, "Yorleny Prueba", "8777 0001");
    await switchToOwner(page);
    await expect(page.getByRole("heading", { name: "Publique su casa", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Publicar casa" }).click();
    await expect(page).toHaveURL(/\/propietario\/publicar\/[0-9a-f-]+\/1$/);
    await expect(page.getByText("Paso 1 de 9")).toBeVisible();
    await expect(page.locator(".progress span")).toHaveCount(9);
    await expectNoScroll(page, "paso 1");

    // 1 Alojamiento: tipo y modalidad explícitos, nada preseleccionado.
    await expect(page.locator('label.choice[aria-pressed="true"]')).toHaveCount(0);
    await continuar(page);
    await expect(alert(page)).toContainText("Elija Alojamiento completo o Habitación.");
    await page.getByText("Alojamiento completo", { exact: true }).click();
    await continuar(page);
    await expect(alert(page)).toContainText("Marque Vacacional, Mensual o las dos.");
    await expect(page.locator('label.choice[aria-pressed="true"]')).toHaveCount(1); // el tipo elegido no se pierde
    await page.getByText("Vacacional", { exact: true }).click();
    await page.getByText("Mensual", { exact: true }).click();
    await continuar(page);
    await expect(page).toHaveURL(/\/2$/);
    await expect(page.getByText("Paso 2 de 9")).toBeVisible();
    await expectNoScroll(page, "paso 2");

    // 2 Dónde está: cantón de lista según la provincia; «Listo» en la zona envía el paso.
    const canton = page.getByLabel("Cantón");
    await expect(page.getByLabel("Provincia")).toHaveValue("Limón");
    await expect(canton.locator("option")).toHaveCount(7); // «Seleccione el cantón» + 6
    await expect(canton.locator("option").nth(4)).toHaveText("Talamanca");
    await continuar(page);
    await expect(alert(page)).toContainText("Elija el cantón.");
    await canton.selectOption("Talamanca");
    await page.getByLabel("Provincia").selectOption("Puntarenas");
    await expect(canton).toHaveValue(""); // cambiar de provincia vacía el cantón
    await expect(canton.locator("option")).toHaveCount(14);
    await page.getByLabel("Provincia").selectOption("Limón");
    await canton.selectOption("Talamanca");
    const zone = page.getByLabel("Zona, playa o barrio");
    await expect(zone).toHaveAttribute("enterkeyhint", "done");
    await zone.fill("Manzanillo");
    await zone.press("Enter");
    await expect(page).toHaveURL(/\/3$/);
    await expectNoScroll(page, "paso 3");

    // 3 Mapa: el pin es obligatorio y dentro del país.
    await continuar(page);
    await expect(alert(page)).toContainText("Marque en el mapa la ubicación aproximada.");
    await page.locator(".leaflet-container").click({ position: { x: 150, y: 120 } });
    await expect(page.locator('input[name="lat"]')).not.toHaveValue("");
    await expect(page.getByText("Arrastre el pin")).toBeVisible();
    await continuar(page);
    await expect(page).toHaveURL(/\/4$/);
    await expectNoScroll(page, "paso 4");

    // 4 Capacidad.
    await continuar(page);
    await expect(alert(page)).toContainText("Indique cuántas personas");
    await count(page, "personas", 5);
    await count(page, "habitaciones", 2);
    await count(page, "baños", 2);
    await continuar(page);
    await expect(page).toHaveURL(/\/5$/);
    await expectNoScroll(page, "paso 5");

    // 5 Características: tipo de parqueo al marcar Parqueo.
    await expect(page.getByLabel("Tipo de parqueo")).toHaveCount(0);
    await page.getByText("Parqueo", { exact: true }).click();
    await expect(page.getByLabel("Tipo de parqueo")).toBeVisible();
    await expectNoScroll(page, "paso 5 con parqueo");
    await continuar(page);
    await expect(alert(page)).toContainText("Indique si el parqueo es gratuito o de pago.");
    await page.getByLabel("Tipo de parqueo").selectOption("free");
    await page.getByText("Frente al mar", { exact: true }).click();
    await continuar(page);
    await expect(page).toHaveURL(/\/6$/);
    await expectNoScroll(page, "paso 6");

    // 6 Nombre y descripción: «Siguiente» en el nombre enfoca la descripción.
    const title = page.getByLabel("Nombre de la casa");
    await expect(title).toHaveAttribute("enterkeyhint", "next");
    await title.fill("Se pierde al recargar");
    await title.press("Enter");
    await expect(page.getByLabel("Descripción")).toBeFocused();
    await expect(page).toHaveURL(/\/6$/); // Enter en el nombre no envía

    // Recargar antes de guardar pierde lo no enviado; lo guardado en pasos anteriores sigue ahí.
    await page.reload();
    await expect(title).toHaveValue("");
    await page.goto(page.url().replace(/\/6$/, "/2"));
    await expect(page.getByLabel("Cantón")).toHaveValue("Talamanca");
    await page.goto(page.url().replace(/\/2$/, "/1"));
    await expect(page.locator('label.choice[aria-pressed="true"]')).toHaveCount(3);

    // «Nueva» con un borrador pendiente ofrece seguirlo; abrir esa página no crea borradores.
    await page.goto("/propietario/casas");
    await page.getByRole("button", { name: "Nueva" }).click();
    await expect(page).toHaveURL(/\/propietario\/publicar$/);
    await expect(page.getByText("Tiene un borrador sin enviar")).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "Seguir con el borrador" }).click();
    await expect(page).toHaveURL(/\/propietario\/publicar\/[0-9a-f-]+\/1$/);

    await page.goto(page.url().replace(/\/1$/, "/6"));
    await title.fill(TITLE);
    await page.getByLabel("Descripción").fill("Casa de madera a 80 m de la playa, con rancho y hamacas.");
    await continuar(page);
    await expect(page).toHaveURL(/\/7$/);

    // 7 Fotos generadas en el navegador; con 4 no deja seguir, con 5 sí. La rejilla hace scroll por dentro, la página no.
    const files = await jpegFiles(page, 5);
    await page.getByLabel("Agregar fotos").setInputFiles(files.slice(0, 4));
    await expect(page.getByRole("status")).toHaveText("4 de 5–15");
    await continuar(page);
    await expect(alert(page)).toContainText("Agregue al menos 5 fotos.");
    await page.getByLabel("Agregar fotos").setInputFiles(files.slice(4));
    await expect(page.getByRole("status")).toHaveText("5 de 5–15");
    await expect(page.locator(".photos-grid .photo.cover .tag")).toHaveText("Portada");
    await page.reload();
    await expect(page.getByRole("status")).toHaveText("5 de 5–15");
    await expectNoScroll(page, "paso 7 con 5 fotos");
    await continuar(page);
    await expect(page).toHaveURL(/\/8$/);
    await expectNoScroll(page, "paso 8");

    // 8 Precio: un precio por modalidad (acepta separadores); «Listo» en el último envía.
    await expect(page.getByLabel("Por noche")).toHaveAttribute("enterkeyhint", "next");
    await expect(page.getByLabel("Por mes")).toHaveAttribute("enterkeyhint", "done");
    await page.getByLabel("Por noche").fill("85.000");
    await page.getByLabel("Por noche").press("Enter");
    await expect(page.getByLabel("Por mes")).toBeFocused();
    await page.getByLabel("Por mes").fill("900.000");
    await page.getByLabel("Por mes").press("Enter");
    await expect(page).toHaveURL(/\/9$/);
    await expectNoScroll(page, "paso 9");

    // 9 Enviar.
    await expect(page.getByText("+506 8777 0001")).toBeVisible();
    await page.getByRole("button", { name: "Enviar a revisión" }).click();
    await expect(page).toHaveURL(/\/propietario\/casas\/[0-9a-f-]+\/enviada$/);
    await expect(page.getByRole("heading", { name: "¡Listo! Su casa está en revisión" })).toBeVisible();
    await page.getByRole("link", { name: "Ir a Mis casas" }).click();
    await expect(page).toHaveURL(/\/propietario\/casas$/);
    await expect(page.getByText("En revisión", { exact: true })).toBeVisible();
    await expect(page.getByText("₡85 000")).toBeVisible();
    await expect(page.getByRole("link", { name: TITLE })).toBeVisible();

    // Un borrador nuevo se puede descartar (con confirmación).
    await page.getByRole("button", { name: "Nueva" }).click();
    await expect(page).toHaveURL(/\/propietario\/publicar\/[0-9a-f-]+\/1$/);
    await page.goto("/propietario/casas");
    await expect(page.getByText("Borrador sin título")).toBeVisible();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Descartar" }).click();
    await expect(page.getByText("Borrador sin título")).toHaveCount(0);
  });
});

test("un usuario con sesión pero sin is_admin no ve /admin", async ({ page }) => {
  await registerAndEnter(page, "Ana Prueba", "8888 1234");
  const response = await page.goto("/admin");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("link", { name: /Revisión de anuncios/ })).toHaveCount(0);
});

test("el admin revisa: pedir cambios exige motivo; aprobar y publicar activa la casa", async ({ browser }) => {
  const page = await adminPage(browser);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Anuncios" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Por revisar · 1" })).toBeVisible();
  await page.getByRole("link", { name: new RegExp(TITLE) }).click();
  await expect(page.getByRole("heading", { level: 2, name: TITLE })).toBeVisible();
  await expect(page.getByText("Yorleny Prueba")).toBeVisible();
  await expect(page.getByText("5 fotos")).toBeVisible();
  await expect(page.getByText("Vacacional · Mensual · Alojamiento completo", { exact: false })).toBeVisible();
  await expect(page.getByText("Frente al mar")).toBeVisible();
  await expect(page.getByText("Identidad")).toHaveCount(0);
  await page.getByRole("button", { name: "Pedir cambios" }).click();
  await expect(page.locator(".field-error[role=\"alert\"]")).toContainText("Escriba un motivo");
  await page.getByRole("button", { name: "Aprobar y publicar" }).click();
  await expect(page.getByRole("status")).toContainText("Activa");
  await expect(page.getByRole("button", { name: "Aprobar y publicar" })).toHaveCount(0);
  await page.goto("/admin");
  await expect(page.getByText("No hay anuncios pendientes.")).toBeVisible();
  await page.context().close();
});

test("la ficha pública abre sin sesión con metadatos para WhatsApp y moneda", async ({ browser }) => {
  const ctx = await browser.newContext(devices["Pixel 7"]);
  const page = await ctx.newPage();
  const publicId = await publicIdOf(TITLE);
  await page.goto(`/casa/${publicId.toLowerCase()}`);
  await expect(page.getByRole("heading", { level: 1, name: TITLE })).toBeVisible();
  await expect(page.getByText("WhatsApp verificado", { exact: true })).toBeVisible();
  await expect(page.getByText("Vacacional · Mensual", { exact: true })).toBeVisible();
  await expect(page.getByText("Manzanillo, Talamanca · ubicación aproximada")).toBeVisible();
  await expect(page.getByText("5 personas · 2 habitaciones · 2 baños")).toBeVisible();
  await expect(page.getByText("Frente al mar")).toBeVisible();
  await expect(page.getByText("Parqueo gratis")).toBeVisible();
  await expect(page.getByText("Piscina")).toHaveCount(0);
  await expect(page.getByText(/Ref CT-/)).toHaveCount(0);
  // Precio una vez en la barra fija, mensual debajo, contacto deshabilitado hasta la fase 3.
  await expect(page.locator(".cta-bar")).toContainText("₡85 000");
  await expect(page.locator(".cta-bar")).toContainText("₡900 000");
  await expect(page.getByRole("button", { name: /Contactar por WhatsApp/ })).toBeDisabled();
  // Metadatos para la vista previa de WhatsApp.
  expect(await page.locator('meta[property="og:title"]').getAttribute("content")).toContain(TITLE);
  expect(await page.locator('meta[property="og:description"]').getAttribute("content")).toBe("Alojamiento completo en Manzanillo, Limón · 5 personas · ₡85 000 por noche · orientativo");
  expect(await page.locator('meta[property="og:image"]').getAttribute("content")).toMatch(/\/storage\/v1\/object\/public\/listings\//);
  expect(await page.locator('link[rel="canonical"]').getAttribute("href")).toBe(`https://bnbtico.com/casa/${publicId}`);
  // Dólares solo como visualización.
  await page.getByRole("button", { name: "Ver en dólares" }).click();
  await expect(page.locator(".cta-bar")).toContainText("$167");
  await expect(page.getByRole("button", { name: "Ver en colones" })).toContainText("≈ ₡85");
  await page.getByRole("button", { name: "Ver en colones" }).click();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  const r = await page.goto("/casa/CT-0001");
  expect(r?.status()).toBe(404);
  await ctx.close();
});

test("Explorar arranca en Limón, filtra desde Filtros, limpia y abre la ficha", async ({ page }) => {
  await page.goto("/explorar");
  await expect(page.getByRole("heading", { name: "¿Para dónde va?" })).toBeVisible();
  await expect(page.getByText("1 casa")).toBeVisible();
  await expect(page.getByText("en Limón")).toBeVisible();
  await expect(page.getByRole("link", { name: /^Limón/ })).toBeVisible(); // buscador-resumen
  await page.getByRole("link", { name: /Más filtros/ }).click();
  await expect(page).toHaveURL(/\/explorar\/filtros/);
  await expect(page.getByRole("heading", { name: "Filtros" })).toBeVisible();
  await expect(page.getByText("Cartago", { exact: true })).toHaveCount(0);
  await page.getByText("Piscina", { exact: true }).click();
  await page.getByRole("button", { name: /Ver 1 casa/ }).click();
  await expect(page).toHaveURL(/pool=1/);
  await expect(page.getByText("Sin resultados con esos filtros.")).toBeVisible();
  await page.getByRole("link", { name: /Más filtros/ }).click();
  await page.getByRole("link", { name: "Limpiar" }).click();
  await expect(page).toHaveURL(/\/explorar$/);
  await expect(page.getByText("1 casa")).toBeVisible();
  // Chip rápido Mensual: la casa acepta las dos modalidades.
  await page.getByRole("link", { name: "Mensual", exact: true }).click();
  await expect(page.getByText("1 casa")).toBeVisible();
  // Personas 6+ deja fuera la casa de 5.
  await page.goto("/explorar/filtros");
  await page.getByLabel("Personas").selectOption("6");
  await page.getByRole("button", { name: /Ver/ }).click();
  await expect(page.getByText("Sin resultados con esos filtros.")).toBeVisible();
  await page.goto("/explorar");
  // Moneda junto a la línea de resultados.
  await page.getByRole("button", { name: "$ Dólares" }).click();
  await expect(page.getByText("$167")).toBeVisible();
  await page.getByRole("button", { name: "₡ Colones" }).click();
  await page.getByRole("link", { name: new RegExp(TITLE) }).click();
  await expect(page).toHaveURL(/\/casa\/CT-\d+/);
});

test("detalle del propietario: disponible para consultas, compartir, editar y reenviar", async ({ page, browser }) => {
  await registerAndEnter(page, "Yorleny Prueba", "8777 0001");
  await switchToOwner(page);
  await expect(page.getByRole("heading", { name: "Su casa, en marcha" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Compartir ficha por WhatsApp" })).toBeVisible();
  await page.goto("/propietario/casas");
  await page.getByRole("link", { name: TITLE }).click();
  await expect(page).toHaveURL(/\/propietario\/casas\/[0-9a-f-]+$/);
  await expect(page.getByRole("link", { name: "Ver ficha" })).toBeVisible();
  const publicId = await publicIdOf(TITLE);
  await expect(page.getByRole("button", { name: /Compartir ficha/ })).toBeEnabled();
  await expect(page.locator(`[data-share-url$="/casa/${publicId}"]`)).toHaveCount(1);

  // Disponible para consultas: la ficha sigue abierta pero avisa.
  await page.getByRole("switch", { name: "Marcar no disponible" }).click();
  await expect(page.getByRole("switch", { name: "Marcar disponible" })).toBeVisible();
  const guest = await (await browser.newContext(devices["Pixel 7"])).newPage();
  await guest.goto(`/casa/${publicId}`);
  await expect(guest.getByText("No disponible por ahora")).toBeVisible();
  await page.getByRole("switch", { name: "Marcar disponible" }).click();
  await expect(page.getByRole("switch", { name: "Marcar no disponible" })).toBeVisible();

  // Editar una casa activa la oculta hasta la nueva aprobación.
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /Editar la ficha/ }).click();
  await expect(page).toHaveURL(/\/propietario\/publicar\/[0-9a-f-]+\/1$/);
  await guest.goto(`/casa/${publicId}`);
  await expect(guest.getByText("Este enlace ya no está activo")).toBeVisible();
  await guest.context().close();
  // El borrador de una casa que ya estuvo publicada no se puede descartar.
  await page.goto("/propietario/casas");
  await expect(page.getByText(/Estuvo publicada/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Descartar" })).toHaveCount(0);
  await page.getByRole("link", { name: TITLE }).click();
  await expect(page.getByRole("button", { name: "Descartar borrador" })).toHaveCount(0);
  await page.getByRole("link", { name: /Seguir con el borrador/ }).click();
  for (let i = 0; i < 8; i++) await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/9$/);
  await page.getByRole("button", { name: "Enviar a revisión" }).click();
  await expect(page).toHaveURL(/\/enviada$/);
  await page.getByRole("link", { name: "Ir a Mis casas" }).click();
  await expect(page.getByText("En revisión", { exact: true })).toBeVisible();
});

test("pedir cambios: el propietario ve el motivo, corrige y reenvía", async ({ page, browser }) => {
  const admin = await adminPage(browser);
  await admin.goto("/admin");
  await admin.getByRole("link", { name: new RegExp(TITLE) }).click();
  await admin.getByLabel(/Mensaje para el propietario/).fill("Necesitamos una foto de la cocina.");
  await admin.getByRole("button", { name: "Pedir cambios" }).click();
  await expect(admin.getByRole("status")).toContainText("Cambios pedidos");

  await registerAndEnter(page, "Yorleny Prueba", "8777 0001");
  await switchToOwner(page);
  await page.goto("/propietario/casas");
  await expect(page.getByText("Cambios pedidos", { exact: true })).toBeVisible();
  await expect(page.getByText("Nota de bnbtico: Necesitamos una foto de la cocina.")).toBeVisible();
  await page.getByRole("link", { name: TITLE }).click();
  await page.getByRole("button", { name: "Corregir y reenviar" }).click();
  await expect(page).toHaveURL(/\/propietario\/publicar\/[0-9a-f-]+\/1$/);
  for (let i = 0; i < 8; i++) await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Enviar a revisión" }).click();
  await expect(page).toHaveURL(/\/enviada$/);
  await page.getByRole("link", { name: "Ir a Mis casas" }).click();
  await expect(page.getByText("En revisión", { exact: true })).toBeVisible();

  await admin.goto("/admin");
  await expect(admin.getByRole("link", { name: "Por revisar · 1" })).toBeVisible();
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
    x.fillStyle = "#2F5D45";
    x.fillRect(0, 0, 640, 480);
    return c.toDataURL("image/jpeg", 0.8).split(",")[1];
  });
  const buffer = Buffer.from(base64, "base64");
  return Array.from({ length: count }, (_, i) => ({ name: `foto-${i + 1}.jpg`, mimeType: "image/jpeg", buffer }));
}
