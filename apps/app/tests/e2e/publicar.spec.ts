import { expect, test, type Page } from "./helpers/test";
import type { ListingsHarness } from "../contract/harness";
import { sql, TEST_PHONES } from "../db/local";
import { postgrestHarness } from "../db/postgrest-harness";
import { SESSION_STORAGE_KEY } from "../../src/data/storage";
import { injectSession } from "./helpers/session";

// Asistente de publicar en ocho pantallas (decisión 2026-10-21; el mapa se unió al paso 2 el 2026-10-27) contra Supabase
// local, con la sesión inyectada.
// iPhone SE (375×667): ninguna pantalla hace scroll, con o sin teclado. Aquí las fotos se siembran en la base; la subida real está en fotos.spec.ts.
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
const TITLE = "Casa Manzanillo, a pie de playa";
const LATE = "Descripción que no espera a la anterior: sale ya, con keepalive, aunque la página se vaya enseguida.";
const alert = (page: Page) => page.locator('.note[role="alert"]');
const NO_PHOTOS_HELP = "Puede enviarla sin fotos; para publicarla necesitamos al menos una.";
let h: ListingsHarness;

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 375, height: 667 } });

test.beforeAll(async () => {
  h = await postgrestHarness();
});

test.beforeEach(async ({ page }) => {
  await h.reset();
  await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
  await page.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
  await injectSession(page, "owner");
});

/** Ninguna pantalla del asistente hace scroll: todo cabe en la ventana. */
async function expectNoScroll(page: Page, what: string) {
  await page.waitForLoadState("networkidle");
  const [scrollH, innerH] = await page.evaluate(() => [document.documentElement.scrollHeight, window.innerHeight]);
  expect(scrollH, `${what} hace scroll: ${scrollH} > ${innerH}`).toBeLessThanOrEqual(innerH);
}

const continuar = (page: Page) => page.getByRole("button", { name: "Continuar" }).click();
async function count(page: Page, label: string, n: number) {
  for (let i = 0; i < n; i++) await page.getByRole("button", { name: `Más ${label}` }).click();
}
const idFrom = (page: Page) => /\/publicar\/([0-9a-f-]{36})\//.exec(page.url())![1]!;

/** Al tocar un campo de texto la página gana sitio abajo y el campo sube hasta debajo de la cabecera (teclado del iPhone). */
async function expectKeyboardRoom(page: Page, fieldId: string) {
  const top = () => page.evaluate((id) => Math.round(document.getElementById(id)!.getBoundingClientRect().top), fieldId);
  const extra = () => page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  await page.locator(`#${fieldId}`).focus();
  await expect.poll(extra).toBeGreaterThanOrEqual(250);
  await expect.poll(top).toBeLessThanOrEqual(130);
  expect(await top()).toBeGreaterThanOrEqual(40);
  await page.locator(`#${fieldId}`).blur();
  await expect.poll(extra).toBe(0);
}

test("las ocho pantallas: se guardan por detrás, sin scroll con y sin teclado, y se envía a revisión", async ({ page }) => {
  // Revisión UX C4: «Publicar» entra directo al paso 1 (sin «Empezar»), y arriba del paso 1 de un borrador recién creado,
  // qué tener a mano.
  await page.goto("/propietario/publicar");
  await expect(page).toHaveURL(/\/propietario\/publicar\/[0-9a-f-]+\/1$/);
  const id = idFrom(page);
  await expect(page.locator(".ready-list li")).toHaveText(["Fotos horizontales, si ya las tiene", "El precio por noche", "Unos 10 minutos"]);
  await expect(page.locator(".stage-label")).toHaveText("Su casa1 de 4");
  await expect(page.locator(".stage-label")).toHaveAttribute("aria-label", "Su casa, 1 de 4. Paso 1 de 8.");
  await expect(page.locator(".progress span")).toHaveCount(8);
  await expect(page.locator(".progress span.on")).toHaveCount(1);
  await expectNoScroll(page, "paso 1");

  // 1 Alojamiento: solo el tipo, explícito y sin preselección (la modalidad ya no se pregunta: toda casa es por noches).
  await expect(page.getByRole("heading", { name: "¿Cómo alquila?" })).toHaveCount(0);
  await expect(page.locator('label.choice[aria-pressed="true"]')).toHaveCount(0);
  await continuar(page);
  await expect(alert(page)).toHaveText("Elija Alojamiento completo o Habitación.");
  await page.getByText("Alojamiento completo", { exact: true }).click();
  await expect(page.locator('label.choice[aria-pressed="true"]')).toHaveCount(1);
  await continuar(page);
  await expect(page).toHaveURL(/\/2$/);
  await expect(page.locator(".stage-label")).toHaveText("Su casa2 de 4");
  await expect(page.getByRole("heading", { name: "¿Dónde está su casa?" })).toBeVisible();
  await expectNoScroll(page, "paso 2");

  // 2 ¿Dónde está su casa?: sin pin no se sigue; un toque en el mapa (abre en Limón) da el cantón y la zona más cercana.
  await expect(page.getByRole("button", { name: "Continuar" })).toBeDisabled();
  await expect(page.getByText("Toque el mapa o arrastre el punto hasta su casa.")).toBeVisible();
  // El mapa abre en Limón a zoom 9, con la costa a unos 3 px al este del centro: el toque va 10 px al oeste, en tierra.
  await expect(page.locator(".map-box.leaflet-container")).toBeVisible();
  const map = (await page.locator(".map-box").boundingBox())!;
  await page.mouse.click(map.x + map.width / 2 - 10, map.y + map.height / 2);
  await expect(page.locator('input[name="lat"]')).not.toHaveValue("");
  await expect(page.locator(".place-line")).toHaveText("Limón, Limón");
  // La zona más cercana del pin, de la lista (zones), ya elegida.
  const chosenZone = page.getByRole("combobox", { name: "Zona" }).locator("option:checked");
  await expect(chosenZone).toHaveAttribute("value", /^list:701-/);
  const zoneName = (await chosenZone.textContent())!;
  await expectNoScroll(page, "paso 2 con el pin");
  await continuar(page);
  await expect(page).toHaveURL(/\/4$/);
  await expect(page.locator(".stage-label")).toHaveText("Su casa3 de 4");
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
  await expect(alert(page)).toHaveText("Indique si el parqueo es gratuito o de pago.");
  await page.getByLabel("Tipo de parqueo").selectOption("free");
  await page.getByText("Frente al mar", { exact: true }).click();
  await continuar(page);
  await expect(page).toHaveURL(/\/6$/);
  await expectNoScroll(page, "paso 6");

  // 6 Nombre y descripción: «Siguiente» en el nombre enfoca la descripción; con teclado tampoco hay scroll de más.
  const title = page.getByLabel("Nombre de la casa");
  await expect(title).toHaveAttribute("enterkeyhint", "next");
  await expectKeyboardRoom(page, "pub-title");
  await title.fill("Se pierde al recargar");
  await title.press("Enter");
  await expect(page.getByLabel("Descripción")).toBeFocused();
  await expect(page).toHaveURL(/\/6$/);

  // Lo no enviado se pierde al recargar; lo guardado en pantallas anteriores sigue en la base.
  await page.reload();
  await expect(title).toHaveValue("");
  await expect.poll(async () => (await h.owner("owner").getOwn(id))?.canton).toBe("Limón");
  expect(await h.owner("owner").getOwn(id)).toMatchObject({ kind: "completo", acceptsNightly: true, acceptsMonthly: false, province: "Limón", district: "Limón", zone: zoneName, zoneSource: "list", capacity: 5, bedrooms: 2, bathrooms: 2, features: ["parking", "beachfront"], parkingPaid: false });
  await page.getByRole("link", { name: "Atrás" }).click();
  await expect(page).toHaveURL(/\/5$/);
  await expect(page.locator('label.chip[aria-pressed="true"]')).toHaveCount(2);

  // «Nueva casa» (el «+» de Mis casas) con un borrador pendiente ofrece seguirlo; abrir esa pantalla no crea borradores.
  await page.goto("/propietario/casas");
  await page.getByRole("link", { name: "Nueva casa" }).click();
  await expect(page).toHaveURL(/\/propietario\/publicar$/);
  await expect(page.getByText("Tiene un borrador sin enviar")).toBeVisible();
  await page.reload();
  await page.getByRole("link", { name: "Seguir con el borrador" }).click();
  // Abre el primer paso con algo pendiente (revisión UX A1/C4): aquí, el 6 (nombre y descripción).
  await expect(page).toHaveURL(new RegExp(`/propietario/publicar/${id}/6$`));
  expect((await h.owner("owner").listOwn()).length).toBe(1);

  await page.goto(`/propietario/publicar/${id}/6`);
  // Ticket 19 y publicar v2: nombre de 5 a 32 y descripción opcional (vacía, o de 80 a 2000), con contador.
  await title.fill("Casa");
  await expect(page.locator("#pub-title-count")).toHaveText("4 / 32 · mínimo 5");
  await expect(page.locator("#pub-description-count")).toHaveText("Puede añadirla después");
  // Revisión UX N3: tres preguntas guía (sin texto para copiar) y, por debajo de 80, cuántos caracteres faltan.
  await expect(page.getByLabel("Descripción")).toHaveAttribute("placeholder", "¿Cómo es por dentro? ¿Qué hay cerca (playa, pulpería, parada de bus)? ¿Qué incluye o qué debe saber el cliente?");
  await page.getByLabel("Descripción").fill("Casa de madera a 80 m de la playa.");
  await expect(page.locator("#pub-description-count")).toHaveText("Faltan 46 caracteres");
  await continuar(page);
  await expect(alert(page)).toHaveText("El nombre de la casa debe tener entre 5 y 32 caracteres.");
  await expect(page).toHaveURL(/\/6$/);
  await title.fill(TITLE);
  await continuar(page);
  await expect(alert(page)).toHaveText("La descripción debe tener entre 80 y 2000 caracteres o quedar vacía.");
  await page.getByLabel("Descripción").fill("Casa de madera a 80 m de la playa, con rancho, hamacas y un jardín grande donde se ven monos.");
  await expect(page.locator("#pub-description-count")).toHaveText("93 / 2000");
  await expect(page.getByLabel("Nombre de la casa")).toHaveAttribute("maxlength", "32");
  await continuar(page);
  await expect(page).toHaveURL(/\/7$/);

  // 7 Fotos: el recuento sale de la base; sin fotos se puede seguir y enviar (publicar v2: para aprobarla basta una). La
  // rejilla hace scroll por dentro, la página no.
  await expect(page.getByRole("status")).toHaveText("0 de 15");
  await expect(page.getByText(NO_PHOTOS_HELP)).toBeVisible();
  await h.addPhotos(id, 4);
  await page.reload();
  await expect(page.getByRole("status")).toHaveText("4 de 15");
  await expect(page.getByText(NO_PHOTOS_HELP)).toBeHidden();
  await expect(page.locator(".photos-grid .photo.cover .tag")).toHaveText("Portada");
  await expectNoScroll(page, "paso 7 con 4 fotos");
  await continuar(page);
  await expect(page).toHaveURL(/\/8$/);
  await expectNoScroll(page, "paso 8");

  // 8 Precio: el precio por noche siempre; «¿Acepta alquiler por meses?» con No por defecto y, con Sí, el precio al mes
  // opcional. Volver a No vacía el campo. Acepta separadores; «Listo» en el último campo envía el paso. Los chips se tocan
  // (tap) con el teclado abierto, como en el teléfono: el toque no se pierde al cerrarse el sitio del teclado.
  const nightly = page.getByLabel("Precio por noche");
  const monthly = page.getByLabel("Precio al mes (opcional)");
  const accepts = page.getByRole("group", { name: "¿Acepta alquiler por meses?" });
  await expect(accepts.getByRole("radio", { name: "No" })).toBeChecked();
  await expect(monthly).toHaveCount(0);
  await expect(nightly).toHaveAttribute("enterkeyhint", "done");
  await continuar(page);
  await expect(alert(page)).toHaveText("Indique el precio por noche en colones.");
  await nightly.fill("85.000");
  await accepts.getByText("Sí", { exact: true }).tap();
  await expect(monthly).toBeVisible();
  await expect(monthly).toHaveAccessibleDescription("Si lo deja vacío, en su ficha dirá «Precio a negociar con el dueño».");
  await expect(nightly).toHaveAttribute("enterkeyhint", "next");
  await expect(monthly).toHaveAttribute("enterkeyhint", "done");
  await expectKeyboardRoom(page, "pub-monthlyPriceCrc");
  await monthly.fill("0");
  await continuar(page);
  await expect(alert(page)).toHaveText("Indique el precio al mes en colones o déjelo vacío.");
  await monthly.fill("480.000");
  await accepts.getByText("No", { exact: true }).tap();
  await expect(monthly).toHaveCount(0);
  await accepts.getByText("Sí", { exact: true }).tap();
  await expect(monthly).toHaveValue("");
  await expectNoScroll(page, "paso del precio con Sí");
  await accepts.getByText("No", { exact: true }).tap();
  await expectNoScroll(page, "paso del precio con No");
  await nightly.press("Enter");
  await expect(page).toHaveURL(/\/9$/);
  await expectNoScroll(page, "paso 9");

  // 9 Revisar y enviar (revisión UX C4, publicar v2): seis filas que llevan a su pantalla, y la vista previa.
  await expect(page.getByRole("heading", { name: "Revisar y enviar" })).toBeVisible();
  const review = page.getByRole("navigation", { name: "Lo que va a enviar" });
  await expect(review.getByRole("link")).toHaveCount(6);
  await expect(review.locator(".review-label")).toHaveText(["Alojamiento", "Dónde", "Capacidad", "Nombre", "Fotos", "Precio"]);
  const where = review.getByRole("link", { name: /Dónde/ });
  await expect(where.locator(".review-text")).toHaveText(`${zoneName} · Limón, Limón, Limón`);
  await expect(where).toHaveAttribute("href", `/propietario/publicar/${id}/2`);
  const nameRow = review.getByRole("link", { name: /Nombre/ });
  await expect(nameRow.locator(".review-text")).toHaveText(`«${TITLE}»`);
  await expect(nameRow).toHaveAttribute("href", `/propietario/publicar/${id}/6`);
  const photosRow = review.getByRole("link", { name: /Fotos/ });
  await expect(photosRow.locator(".review-text")).toHaveText("4 fotos");
  await expect(photosRow).toHaveAttribute("href", `/propietario/publicar/${id}/7`);
  await expect(review.getByRole("link", { name: /Precio/ }).locator(".review-text")).toHaveText("₡85 000 / noche");
  await page.getByRole("button", { name: "Ver cómo queda su ficha" }).click();
  const preview = page.getByRole("dialog", { name: "Vista previa de su ficha" });
  await expect(preview.getByRole("heading", { level: 1, name: TITLE })).toBeVisible();
  await expect(preview.getByRole("button", { name: "Contactar por WhatsApp" })).toHaveCount(0);
  await preview.getByRole("button", { name: "Cerrar" }).click();
  await expect(preview).toHaveCount(0);

  // 9 Enviar: WhatsApp de la cuenta (solo lectura) y la oferta; relee el borrador, valida todo y envía.
  await expect(page.getByText("+506 8777 0001")).toBeVisible();
  await expect(page.getByText("₡0 · 12 meses")).toBeVisible();
  await expect(page.locator(".offer-line")).toContainText("Después, ₡2\u00a0900 al mes."); // precio decidido el 2026-10-27
  await page.getByRole("button", { name: "Enviar a revisión" }).click();
  await expect(page).toHaveURL(new RegExp(`/propietario/casas/${id}/enviada$`));
  await expect(page.getByRole("heading", { name: "¡Listo! Su casa está en revisión" })).toBeVisible();
  expect(await h.owner("owner").getOwn(id)).toMatchObject({ status: "review", title: TITLE, nightlyPriceCrc: 85000, acceptsMonthly: false, monthlyPriceCrc: null, photoCount: 4 });
  await page.getByRole("link", { name: "Ir a Mis casas" }).click();
  // Una sola casa: Mis casas es la lista con su tarjeta, «En revisión» sobre la foto.
  await expect(page.getByRole("heading", { level: 1, name: "Mis casas" })).toBeVisible();
  await expect(page.getByRole("article").getByRole("heading", { name: TITLE })).toBeVisible();
  await expect(page.getByRole("article").getByTestId("card-label")).toHaveText("En revisión");
});

test("nombre: se detiene en 32 y muestra 32 / 32", async ({ page }) => {
  const { id } = await h.seed({ status: "draft" });
  await page.goto(`/propietario/publicar/${id}/6`);
  const title = page.getByLabel("Nombre de la casa");
  await title.fill("");
  await title.pressSequentially("a".repeat(40));
  await expect(title).toHaveValue("a".repeat(32));
  await expect(page.locator("#pub-title-count")).toContainText("32 / 32");
});

test("envía sin fotos ni descripción", async ({ page }) => {
  // Con correo en la cuenta: la pregunta del correo (si la hay) no se interpone al enviar.
  sql(`update public.profiles set email = 'yorleny@ejemplo.com' where phone = '${TEST_PHONES.owner}'`);
  try {
    await page.goto("/propietario/publicar");
    await expect(page).toHaveURL(/\/propietario\/publicar\/[0-9a-f-]+\/1$/);
    const id = idFrom(page);
    await page.getByText("Alojamiento completo", { exact: true }).click();
    await continuar(page);
    await expect(page).toHaveURL(/\/2$/);
    await expect(page.locator(".map-box.leaflet-container")).toBeVisible();
    const map = (await page.locator(".map-box").boundingBox())!;
    await page.mouse.click(map.x + map.width / 2 - 10, map.y + map.height / 2);
    await expect(page.locator(".place-line")).toHaveText("Limón, Limón");
    await continuar(page);
    await expect(page).toHaveURL(/\/4$/);
    await count(page, "personas", 2);
    await count(page, "habitaciones", 1);
    await count(page, "baños", 1);
    await continuar(page);
    await expect(page).toHaveURL(/\/5$/);
    await continuar(page);
    await expect(page).toHaveURL(/\/6$/);

    // 6: solo el nombre; la descripción queda vacía.
    await page.getByLabel("Nombre de la casa").fill(TITLE);
    await expect(page.getByLabel("Descripción (opcional)")).toHaveValue("");
    await continuar(page);
    await expect(page).toHaveURL(/\/7$/);

    // 7: sin fotos se puede seguir.
    await expect(page.getByRole("status")).toHaveText("0 de 15");
    await expect(page.getByText(NO_PHOTOS_HELP)).toBeVisible();
    await continuar(page);
    await expect(page).toHaveURL(/\/8$/);
    await page.getByLabel("Precio por noche").fill("40000");
    await continuar(page);
    await expect(page).toHaveURL(/\/9$/);

    // 9: el resumen dice lo que no hay, sin avisos que frenen.
    const review = page.getByRole("navigation", { name: "Lo que va a enviar" });
    await expect(review.getByRole("link", { name: /Fotos/ }).locator(".review-text")).toHaveText("Ninguna todavía");
    await expect(review.getByRole("link", { name: /Nombre/ }).locator(".review-text")).toHaveText(`«${TITLE}» · sin descripción`);
    await expectNoScroll(page, "paso 9 sin fotos ni descripción");
    await page.getByRole("button", { name: "Enviar a revisión" }).click();
    await expect(page).toHaveURL(new RegExp(`/propietario/casas/${id}/enviada$`));
    expect(await h.owner("owner").getOwn(id)).toMatchObject({ status: "review", title: TITLE, description: "", photoCount: 0 });
  } finally {
    sql(`update public.profiles set email = null where phone = '${TEST_PHONES.owner}'`);
  }
});

// Revisión de Ana: con el teclado abierto la descripción dejaba un hueco vacío debajo. Llena lo que queda de la pantalla con
// y sin teclado: lo último del paso (la nota) queda justo encima de la barra «Atrás / Continuar» o del teclado.
test("paso 6: la descripción llena el alto que queda, con y sin teclado", async ({ page }) => {
  const id = (await h.seed({ status: "draft", draft: { description: "" } })).id;
  await page.goto(`/propietario/publicar/${id}/6`);
  const area = page.getByLabel("Descripción");
  await expect(area).toBeVisible();
  const geometry = () =>
    page.evaluate(() => {
      const r = (el: Element) => el.getBoundingClientRect();
      const ta = r(document.getElementById("pub-description")!);
      const note = r(document.querySelector(".publish-form > span.xs")!);
      const bar = r(document.querySelector(".sticky-actions")!);
      const vv = window.visualViewport!;
      const bottom = Math.min(bar.top, vv.offsetTop + vv.height);
      return { taTop: Math.round(ta.top), taBottom: Math.round(ta.bottom), gap: Math.round(bottom - note.bottom), noteGap: Math.round(note.top - ta.bottom) };
    });
  const expectFilled = async (what: string) => {
    // Entre 0 (nada bajo la barra o el teclado) y 16 px de hueco; se espera a que acabe de subir (scroll suave).
    await expect.poll(async () => { const { gap } = await geometry(); return gap >= 0 && gap <= 16 ? "lleno" : gap; }, { message: `${what}: hueco bajo la descripción` }).toBe("lleno");
    const g = await geometry();
    expect(g.noteGap, `${what}: la nota va pegada a la descripción`).toBeLessThanOrEqual(16);
    expect(g.taBottom - g.taTop, `${what}: alto mínimo`).toBeGreaterThanOrEqual(96);
  };
  await expectFilled("sin teclado");
  await area.focus();
  await expect.poll(async () => Math.abs((await geometry()).taTop - 88)).toBeLessThanOrEqual(2); // sube hasta debajo de la cabecera
  await expectFilled("con el sitio del teclado");
  await area.fill("Casa de madera a 200 m de la playa. ".repeat(12));
  await expectFilled("escribiendo");
  // Un teclado que encoge la vista (Android, o la vista visible del iPhone): la descripción se ajusta encima de él.
  await page.setViewportSize({ width: 375, height: 380 });
  await expectFilled("con la vista encogida");
  await page.setViewportSize({ width: 375, height: 667 });
  await area.blur();
  await expectFilled("al cerrar el teclado");
});

test("publicar con mensual sin precio: tras aprobarla, la ficha dice «precio a negociar con el dueño» y lleva «Alquiler mensual»", async ({ page }) => {
  const draft = await h.seed({ status: "draft", photos: 5 });
  await page.goto(`/propietario/publicar/${draft.id}/8`);
  await page.getByLabel("Precio por noche").fill("45000");
  await page.getByRole("group", { name: "¿Acepta alquiler por meses?" }).getByText("Sí", { exact: true }).tap();
  await expect(page.getByLabel("Precio al mes (opcional)")).toHaveValue("");
  await continuar(page);
  await expect(page).toHaveURL(/\/9$/);
  const review = page.getByRole("navigation", { name: "Lo que va a enviar" });
  await expect(review.getByRole("link", { name: /Precio/ }).locator(".review-text")).toHaveText("₡45 000 / noche · mensual a negociar");
  await page.getByRole("button", { name: "Enviar a revisión" }).click();
  await expect(page).toHaveURL(new RegExp(`/propietario/casas/${draft.id}/enviada$`));
  expect(await h.owner("owner").getOwn(draft.id)).toMatchObject({ nightlyPriceCrc: 45000, acceptsMonthly: true, monthlyPriceCrc: null });
  await h.admin("aal2").review(draft.id, "approve", "");
  await page.goto(`/casa/${draft.publicId}`);
  await expect(page.getByTestId("monthly-line")).toHaveText("Mensual: precio a negociar con el dueño");
  await expect(page.locator(".feature-tiles")).toContainText("Alquiler mensual");
});

test("si la base rechaza un guardado, vuelve a esa pantalla con su mensaje y lo escrito intacto", async ({ page }) => {
  const draft = await h.seed({ status: "draft", photos: 5 });
  await page.goto(`/propietario/publicar/${draft.id}/6`);
  await expect(page.getByLabel("Nombre de la casa")).toHaveValue("Cabina Cahuita");
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route("**/rest/v1/listings?**", async (route) => {
    if (route.request().method() !== "PATCH") return route.fallback();
    await held;
    await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "P0001", message: "Este anuncio no se puede editar en su estado actual. Ábralo para editar y volverá a revisión." }) });
  });
  await page.getByLabel("Nombre de la casa").fill("Cabina renovada");
  await continuar(page);
  // Navega al instante mientras guarda por detrás.
  await expect(page).toHaveURL(/\/7$/);
  await expect(page.locator(".stage-label")).toHaveText("Fotos y texto2 de 2");
  release();
  await expect(page).toHaveURL(/\/6$/);
  await expect(alert(page)).toHaveText("Este anuncio no se puede editar en su estado actual. Ábralo para editar y volverá a revisión.");
  await expect(page.getByLabel("Nombre de la casa")).toHaveValue("Cabina renovada");
  await expect(page.getByLabel("Descripción")).toHaveValue("Cabina de madera frente al parque nacional Cahuita, a cinco minutos a pie de la playa, con hamacas y rancho.");
  expect((await h.owner("owner").getOwn(draft.id))?.title).toBe("Cabina Cahuita");

  // Con la base de vuelta, el mismo paso se guarda.
  await page.unroute("**/rest/v1/listings?**");
  await continuar(page);
  await expect(page).toHaveURL(/\/7$/);
  await expect.poll(async () => (await h.owner("owner").getOwn(draft.id))?.title).toBe("Cabina renovada");
});

test("cerrar o recargar la app justo al tocar «Continuar» no pierde el paso", async ({ page }) => {
  const draft = await h.seed({ status: "draft", photos: 5 });
  const submitAndReload = () =>
    page.evaluate(() => {
      // Envío y recarga en la misma tarea: la petición tiene que salir antes de que la página se vaya.
      document.querySelector<HTMLFormElement>("form.publish-form")!.requestSubmit();
      location.reload();
    });

  // 1. supabase-js está renovando el token (red lenta): el guardado no lo espera, sale con el token vigente.
  await page.goto(`/propietario/publicar/${draft.id}/6`);
  await expect(page.getByLabel("Nombre de la casa")).toHaveValue("Cabina Cahuita");
  await page.route("**/auth/v1/token**", () => undefined); // la renovación no vuelve nunca
  await page.evaluate((key) => {
    const s = JSON.parse(localStorage.getItem(key)!);
    localStorage.setItem(key, JSON.stringify({ ...s, expires_at: Math.floor(Date.now() / 1000) + 60 }));
  }, SESSION_STORAGE_KEY);
  await page.getByLabel("Nombre de la casa").fill("Cabina recién guardada");
  await submitAndReload();
  await expect.poll(async () => (await h.owner("owner").getOwn(draft.id))?.title).toBe("Cabina recién guardada");
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await injectSession(page, "owner");

  // 2. Con un guardado aún en vuelo, el siguiente espera su turno; si la página se va, sale ya, con keepalive.
  await page.goto(`/propietario/publicar/${draft.id}/6`);
  await expect(page.getByLabel("Nombre de la casa")).toHaveValue("Cabina recién guardada");
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  let patches = 0;
  await page.route("**/rest/v1/listings?**", async (route) => {
    if (route.request().method() !== "PATCH") return route.fallback();
    if (++patches === 1) await held;
    await route.fallback();
  });
  await page.getByLabel("Nombre de la casa").fill("Cabina en vuelo");
  await continuar(page);
  await expect(page).toHaveURL(/\/7$/);
  await expect.poll(() => patches).toBe(1);
  await page.getByRole("link", { name: "Atrás" }).click();
  await expect(page).toHaveURL(/\/6$/);
  await page.getByLabel("Descripción").fill(LATE);
  await submitAndReload();
  await expect.poll(async () => (await h.owner("owner").getOwn(draft.id))?.description).toBe(LATE);
  release();
  await expect.poll(async () => (await h.owner("owner").getOwn(draft.id))?.title).toBe("Cabina en vuelo");
});

test("«Volver» de Publicar casa: atrás si se abrió desde la app; abierta directamente, a Cuenta", async ({ page }) => {
  await h.seed({ status: "draft", draft: { title: "Borrador pendiente" } }); // con un borrador pendiente no se crea otro
  await page.goto("/propietario/casas");
  await page.getByRole("link", { name: "Nueva casa" }).click();
  await expect(page.getByText("Tiene un borrador sin enviar")).toBeVisible();
  await page.getByRole("link", { name: "Volver" }).click();
  await expect(page).toHaveURL(/\/propietario\/casas$/);
  await page.goto("/propietario/publicar");
  await expect(page.getByText("Tiene un borrador sin enviar")).toBeVisible();
  await page.getByRole("link", { name: "Volver" }).click();
  await expect(page).toHaveURL(/\/cuenta$/);
  await page.goBack();
  await expect(page).not.toHaveURL(/\/propietario\/publicar$/);
});

test("retomar un borrador empezado en otro dispositivo, y «Corregir y reenviar» abre el asistente con todo relleno", async ({ page }) => {
  const pending = await h.seed({ status: "draft", draft: { title: "Borrador del otro teléfono", kind: "habitacion", bathroomShared: true } });
  const changes = await h.seed({ status: "changes", draft: { title: "Cabina con cambios" } });
  await page.goto("/propietario/publicar");
  await expect(page.getByText("Tiene un borrador sin enviar")).toBeVisible();
  await expect(page.getByText(/«Borrador del otro teléfono»/)).toBeVisible();
  await page.getByRole("link", { name: "Seguir con el borrador" }).click();
  // El borrador sembrado no tiene fotos, que ya no son obligatorias para enviar (publicar v2): abre en «Revisar y enviar».
  await expect(page).toHaveURL(new RegExp(`/propietario/publicar/${pending.id}/9$`));
  await page.goto(`/propietario/publicar/${pending.id}/1`);
  await expect(page.locator('label.choice[aria-pressed="true"]')).toHaveText([/Habitación/]);
  await expect(page.locator(".ready-list")).toHaveCount(0); // con algo ya rellenado, no repite qué tener a mano
  await page.goto(`/propietario/publicar/${pending.id}/4`);
  await expect(page.getByText("Baño de la habitación")).toBeVisible();
  await expect(page.locator('label.chip[aria-pressed="true"]')).toHaveText("Compartido");

  await page.goto(`/propietario/casas/${changes.id}`);
  await page.getByRole("button", { name: "Corregir y reenviar" }).click();
  await expect(page).toHaveURL(new RegExp(`/propietario/publicar/${changes.id}/1$`));
  await expect(page.locator('label.choice[aria-pressed="true"]')).toHaveCount(1);
  await page.goto(`/propietario/publicar/${changes.id}/6`);
  await expect(page.getByLabel("Nombre de la casa")).toHaveValue("Cabina con cambios");
  await page.goto(`/propietario/publicar/${changes.id}/9`);
  await page.getByRole("button", { name: "Enviar a revisión" }).click();
  await expect(page).toHaveURL(new RegExp(`/propietario/casas/${changes.id}/enviada$`));
  expect((await h.owner("owner").getOwn(changes.id))?.status).toBe("review");

  // Una casa en revisión no se edita: el asistente lleva a su detalle.
  await page.goto(`/propietario/publicar/${changes.id}/2`);
  await expect(page).toHaveURL(new RegExp(`/propietario/casas/${changes.id}$`));
});

test("«Cerrar» en la cabecera espera al guardado en curso y vuelve a Mis casas con el borrador guardado (B11f)", async ({ page }) => {
  const draft = await h.seed({ status: "draft", photos: 5 });
  await page.goto(`/propietario/publicar/${draft.id}/6`);
  await expect(page.getByLabel("Nombre de la casa")).toHaveValue("Cabina Cahuita");
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route("**/rest/v1/listings?**", async (route) => {
    if (route.request().method() !== "PATCH") return route.fallback();
    await held;
    await route.fallback();
  });
  await page.getByLabel("Nombre de la casa").fill("Cabina que se cierra");
  await continuar(page);
  await expect(page).toHaveURL(/\/7$/);
  const close = page.getByRole("button", { name: "Cerrar y seguir después" });
  await expect(close).toBeVisible();
  await close.click();
  // Mientras el guardado no vuelve, sigue en el asistente y lo dice.
  await expect(page.getByRole("button", { name: "Guardando el borrador…" })).toBeDisabled();
  await expect(page).toHaveURL(/\/7$/);
  release();
  await expect(page).toHaveURL(/\/propietario\/casas$/);
  // Mis casas: la tarjeta del borrador, ya con el nombre guardado.
  await expect(page.getByRole("article").getByRole("heading", { name: "Cabina que se cierra" })).toBeVisible();
  expect((await h.owner("owner").getOwn(draft.id))?.title).toBe("Cabina que se cierra");
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await page.goto("/propietario/publicar");
  await expect(page.getByText(/«Cabina que se cierra»/)).toBeVisible();
});

test("enviar con un dato que falta lleva a la pantalla que lo pide", async ({ page }) => {
  const draft = await h.seed({ status: "draft", photos: 5, draft: { capacity: null } });
  await page.goto(`/propietario/publicar/${draft.id}/9`);
  await page.getByRole("button", { name: "Enviar a revisión" }).click();
  await expect(page).toHaveURL(/\/4$/);
  await expect(alert(page)).toHaveText("Indique cuántas personas pueden alojarse (mínimo 1).");
  expect((await h.owner("owner").getOwn(draft.id))?.status).toBe("draft");
});

// Revisión del movimiento: la pantalla nueva entra de lado (±16 px) y no debe ensanchar la página mientras entra.
test("la entrada de lado de cada paso no ensancha la página, y la barra «Atrás / Continuar» sigue fija abajo", async ({ page }) => {
  const draft = await h.seed({ status: "draft", photos: 5 });
  await page.goto(`/propietario/publicar/${draft.id}/4`);
  await expect(page.locator(".stage-label")).toHaveText("Su casa3 de 4");
  const sample = () =>
    page.evaluate(() => {
      const w = window as unknown as { maxScrollWidth: number };
      w.maxScrollWidth = 0;
      const t0 = performance.now();
      const tick = () => {
        w.maxScrollWidth = Math.max(w.maxScrollWidth, document.documentElement.scrollWidth);
        if (performance.now() - t0 < 600) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  const widest = async () => {
    await page.waitForTimeout(700);
    return page.evaluate(() => [(window as unknown as { maxScrollWidth: number }).maxScrollWidth, window.innerWidth]);
  };
  const barAtBottom = () => page.evaluate(() => Math.round(document.querySelector(".sticky-actions")!.getBoundingClientRect().bottom) === window.innerHeight);

  await sample();
  await continuar(page);
  await expect(page).toHaveURL(/\/5$/);
  await expect(page.locator('.publish-form[data-enter="forward"]')).toBeVisible();
  const [forward, width] = await widest();
  expect(forward, "al avanzar").toBeLessThanOrEqual(width!);
  expect(await barAtBottom()).toBe(true);

  await sample();
  await page.getByRole("link", { name: "Atrás" }).click();
  await expect(page).toHaveURL(/\/4$/);
  await expect(page.locator('.publish-form[data-enter="back"]')).toBeVisible();
  const [back] = await widest();
  expect(back, "al volver").toBeLessThanOrEqual(width!);
  expect(await barAtBottom()).toBe(true);
});
