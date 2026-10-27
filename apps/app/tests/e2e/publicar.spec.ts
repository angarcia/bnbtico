import { expect, test, type Page } from "./helpers/test";
import type { ListingsHarness } from "../contract/harness";
import { postgrestHarness } from "../db/postgrest-harness";
import { SESSION_STORAGE_KEY } from "../../src/data/storage";
import { injectSession } from "./helpers/session";

// Asistente de publicar en nueve pantallas (decisión 2026-10-21) contra Supabase local, con la sesión inyectada.
// iPhone SE (375×667): ninguna pantalla hace scroll, con o sin teclado. Aquí las fotos se siembran en la base; la subida real está en fotos.spec.ts.
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
const TITLE = "Casa Manzanillo, a pie de playa";
const LATE = "Descripción que no espera a la anterior: sale ya, con keepalive, aunque la página se vaya enseguida.";
const alert = (page: Page) => page.locator('.note[role="alert"]');
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

test("las nueve pantallas: se guardan por detrás, sin scroll con y sin teclado, y se envía a revisión", async ({ page }) => {
  await page.goto("/propietario");
  // Revisión UX C4: antes de empezar, qué tener a mano; y «Publicar casa» entra directo al paso 1 (sin «Empezar»).
  await expect(page.locator(".ready-list li")).toHaveText(["5 fotos horizontales o más", "El precio por noche o por mes", "Unos 10 minutos"]);
  await page.getByRole("link", { name: "Publicar casa" }).click();
  await expect(page).toHaveURL(/\/propietario\/publicar\/[0-9a-f-]+\/1$/);
  const id = idFrom(page);
  await expect(page.locator(".stage-label")).toHaveText("Su casa1 de 5");
  await expect(page.locator(".progress span")).toHaveCount(9);
  await expect(page.locator(".progress span.on")).toHaveCount(1);
  await expectNoScroll(page, "paso 1");

  // 1 Alojamiento: tipo y modalidad explícitos, nada preseleccionado; un error no borra lo elegido.
  await expect(page.locator('label.choice[aria-pressed="true"]')).toHaveCount(0);
  await continuar(page);
  await expect(alert(page)).toHaveText("Elija Alojamiento completo o Habitación.");
  await page.getByText("Alojamiento completo", { exact: true }).click();
  await continuar(page);
  await expect(alert(page)).toHaveText("Marque Vacacional, Mensual o las dos.");
  await expect(page.locator('label.choice[aria-pressed="true"]')).toHaveCount(1);
  await page.getByText("Vacacional", { exact: true }).click();
  await page.getByText("Mensual", { exact: true }).click();
  await continuar(page);
  await expect(page).toHaveURL(/\/2$/);
  await expect(page.locator(".stage-label")).toHaveText("Su casa2 de 5");
  await expectNoScroll(page, "paso 2");

  // 2 Dónde está: cantón de lista según la provincia; «Listo» en la zona envía el paso.
  const canton = page.getByLabel("Cantón");
  await expect(page.getByLabel("Provincia")).toHaveValue("Limón");
  await expect(canton.locator("option")).toHaveCount(7);
  await continuar(page);
  await expect(alert(page)).toHaveText("Elija el cantón.");
  await canton.selectOption("Talamanca");
  await page.getByLabel("Provincia").selectOption("Puntarenas");
  await expect(canton).toHaveValue("");
  await page.getByLabel("Provincia").selectOption("Limón");
  await canton.selectOption("Talamanca");
  const zone = page.getByLabel("Zona, playa o barrio");
  await expect(zone).toHaveAttribute("enterkeyhint", "done");
  expect(await page.evaluate(() => Math.round(document.getElementById("pub-zone")!.getBoundingClientRect().top))).toBeGreaterThan(300);
  await expectKeyboardRoom(page, "pub-zone");
  await zone.fill("Manzanillo");
  await zone.press("Enter");
  await expect(page).toHaveURL(/\/3$/);
  await expectNoScroll(page, "paso 3");

  // 3 Mapa (Leaflet bajo demanda): el pin es obligatorio.
  await continuar(page);
  await expect(alert(page)).toHaveText("Marque en el mapa la ubicación aproximada.");
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
  await expect.poll(async () => (await h.owner("owner").getOwn(id))?.canton).toBe("Talamanca");
  expect(await h.owner("owner").getOwn(id)).toMatchObject({ kind: "completo", acceptsNightly: true, acceptsMonthly: true, zone: "Manzanillo", capacity: 5, bedrooms: 2, bathrooms: 2, features: ["parking", "beachfront"], parkingPaid: false });
  await page.getByRole("link", { name: "Atrás" }).click();
  await expect(page).toHaveURL(/\/5$/);
  await expect(page.locator('label.chip[aria-pressed="true"]')).toHaveCount(2);

  // «Nueva» con un borrador pendiente ofrece seguirlo; abrir esa pantalla no crea borradores.
  await page.goto("/propietario/casas");
  await page.getByRole("link", { name: "Nueva" }).click();
  await expect(page).toHaveURL(/\/propietario\/publicar$/);
  await expect(page.getByText("Tiene un borrador sin enviar")).toBeVisible();
  await page.reload();
  await page.getByRole("link", { name: "Seguir con el borrador" }).click();
  // Abre el primer paso con algo pendiente (revisión UX A1/C4): aquí, el 6 (nombre y descripción).
  await expect(page).toHaveURL(new RegExp(`/propietario/publicar/${id}/6$`));
  expect((await h.owner("owner").listOwn()).length).toBe(1);

  await page.goto(`/propietario/publicar/${id}/6`);
  // Ticket 19: nombre de 5 a 60 y descripción de 80 a 2000, con contador.
  await title.fill("Casa");
  await expect(page.locator("#pub-title-count")).toHaveText("4 / 60 · mínimo 5");
  await page.getByLabel("Descripción").fill("Casa de madera a 80 m de la playa.");
  await continuar(page);
  await expect(alert(page)).toHaveText("El nombre de la casa debe tener entre 5 y 60 caracteres.");
  await expect(page).toHaveURL(/\/6$/);
  await title.fill(TITLE);
  await continuar(page);
  await expect(alert(page)).toHaveText("La descripción debe tener entre 80 y 2000 caracteres.");
  await page.getByLabel("Descripción").fill("Casa de madera a 80 m de la playa, con rancho, hamacas y un jardín grande donde se ven monos.");
  await expect(page.locator("#pub-description-count")).toHaveText("93 / 2000 · mínimo 80");
  await expect(page.getByLabel("Nombre de la casa")).toHaveAttribute("maxlength", "60");
  await continuar(page);
  await expect(page).toHaveURL(/\/7$/);

  // 7 Fotos: el recuento sale de la base; con 4 deja seguir y avisa de lo que falta (revisión UX C4): el mínimo de 5 se
  // pide al enviar. La rejilla hace scroll por dentro, la página no.
  await expect(page.getByRole("status")).toHaveText("0 de 5–15");
  await h.addPhotos(id, 4);
  await page.reload();
  await expect(page.getByRole("status")).toHaveText("4 de 5–15");
  await expect(page.getByText("Falta 1 foto · puede añadirlas al final")).toBeVisible();
  await continuar(page);
  await expect(page).toHaveURL(/\/8$/);
  await expectNoScroll(page, "paso 8");

  // 8 Precio: un precio por modalidad (acepta separadores); «Listo» en el último envía el paso.
  await expect(page.getByLabel("Por noche")).toHaveAttribute("enterkeyhint", "next");
  await expect(page.getByLabel("Por mes")).toHaveAttribute("enterkeyhint", "done");
  await expectKeyboardRoom(page, "pub-monthlyPriceCrc");
  await page.getByLabel("Por noche").fill("85.000");
  await page.getByLabel("Por noche").press("Enter");
  await expect(page.getByLabel("Por mes")).toBeFocused();
  await page.getByLabel("Por mes").fill("900.000");
  await page.getByLabel("Por mes").press("Enter");
  await expect(page).toHaveURL(/\/9$/);
  await expectNoScroll(page, "paso 9");

  // 9 Enviar con 4 fotos: vuelve al paso 7 con el aviso; con la quinta, se envía.
  await page.getByRole("button", { name: "Enviar a revisión" }).click();
  await expect(page).toHaveURL(/\/7$/);
  await expect(alert(page)).toHaveText("Agregue al menos 5 fotos.");
  await h.addPhotos(id, 1);
  await page.reload();
  await expect(page.getByRole("status")).toHaveText("5 de 5–15");
  await expect(page.locator(".photos-grid .photo.cover .tag")).toHaveText("Portada");
  await expectNoScroll(page, "paso 7 con 5 fotos");
  await continuar(page);
  await expect(page).toHaveURL(/\/8$/);
  await continuar(page);
  await expect(page).toHaveURL(/\/9$/);

  // 9 Enviar: WhatsApp de la cuenta (solo lectura) y la oferta; relee el borrador, valida todo y envía.
  await expect(page.getByText("+506 8777 0001")).toBeVisible();
  await expect(page.getByText("₡0 · 12 meses")).toBeVisible();
  await page.getByRole("button", { name: "Enviar a revisión" }).click();
  await expect(page).toHaveURL(new RegExp(`/propietario/casas/${id}/enviada$`));
  await expect(page.getByRole("heading", { name: "¡Listo! Su casa está en revisión" })).toBeVisible();
  expect(await h.owner("owner").getOwn(id)).toMatchObject({ status: "review", title: TITLE, nightlyPriceCrc: 85000, monthlyPriceCrc: 900000, photoCount: 5 });
  await page.getByRole("link", { name: "Ir a Mis casas" }).click();
  await expect(page.getByRole("article").getByText("En revisión", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: TITLE })).toBeVisible();
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

test("retomar un borrador empezado en otro dispositivo, y «Corregir y reenviar» abre el asistente con todo relleno", async ({ page }) => {
  const pending = await h.seed({ status: "draft", draft: { title: "Borrador del otro teléfono", kind: "habitacion", bathroomShared: true } });
  const changes = await h.seed({ status: "changes", draft: { title: "Cabina con cambios" } });
  await page.goto("/propietario/publicar");
  await expect(page.getByText("Tiene un borrador sin enviar")).toBeVisible();
  await expect(page.getByText(/«Borrador del otro teléfono»/)).toBeVisible();
  await page.getByRole("link", { name: "Seguir con el borrador" }).click();
  // El borrador sembrado solo tiene pendientes las fotos: abre en el paso 7 (revisión UX A1/C4).
  await expect(page).toHaveURL(new RegExp(`/propietario/publicar/${pending.id}/7$`));
  await page.goto(`/propietario/publicar/${pending.id}/1`);
  await expect(page.locator('label.choice[aria-pressed="true"]')).toHaveText([/Vacacional/, /Habitación/]);
  await page.goto(`/propietario/publicar/${pending.id}/4`);
  await expect(page.getByText("Baño de la habitación")).toBeVisible();
  await expect(page.locator('label.chip[aria-pressed="true"]')).toHaveText("Compartido");

  await page.goto(`/propietario/casas/${changes.id}`);
  await page.getByRole("button", { name: "Corregir y reenviar" }).click();
  await expect(page).toHaveURL(new RegExp(`/propietario/publicar/${changes.id}/1$`));
  await expect(page.locator('label.choice[aria-pressed="true"]')).toHaveCount(2);
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
  await expect(page.getByRole("heading", { level: 1, name: "Mis casas" })).toBeVisible();
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
  await expect(page.locator(".stage-label")).toHaveText("Su casa4 de 5");
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
