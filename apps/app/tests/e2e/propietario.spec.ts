import { expect, test, type Page } from "./helpers/test";
import type { Seeded } from "../contract/harness";
import { postgrestHarness } from "../db/postgrest-harness";
import { injectSession } from "./helpers/session";

const HOST = `127.0.0.1:${process.env.E2E_PORT ?? 4173}`;

// Zona del propietario (pantallas 09, 10, 16 y 19) contra Supabase local, con la sesión inyectada por localStorage.
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
let h: Awaited<ReturnType<typeof postgrestHarness>>;
let active: Seeded;
let changes: Seeded;
let review: Seeded;
let draft: Seeded;
let draft2: Seeded;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  h = await postgrestHarness();
  await h.reset();
  await h.seed({ status: "active", as: "other", draft: { title: "Casa de Ana" } });
  draft = await h.seed({ status: "draft", draft: { title: "Borrador nuevo" } });
  draft2 = await h.seed({ status: "draft", draft: { title: "Otro borrador" } });
  review = await h.seed({ status: "review", draft: { title: "Casa en revisión" } });
  changes = await h.seed({ status: "changes", draft: { title: "Cabina con cambios" } });
  active = await h.seed({ status: "active", draft: { title: "Casa Cocles", zone: "Cocles", zoneSource: "other", zoneId: null, nightlyPriceCrc: 55000 } });
});

test.beforeEach(async ({ page }) => {
  await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
  await injectSession(page, "owner");
});

const card = (page: Page, title: string) => page.getByRole("article").filter({ has: page.getByRole("heading", { name: title }) });

test("Mis casas: estado, nota del admin y, sin red, desde la caché", async ({ page }) => {
  await page.goto("/propietario/casas");
  await expect(page.getByRole("heading", { level: 1, name: "Mis casas" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link")).toHaveText(["Explorar", "Favoritos", "Mis casas", "Calendario", /^Actividad\d*$/]);
  // Revisión UX A1: lo que falta por publicar va arriba (aquí, la casa con cambios más reciente), como único aviso y con el
  // único botón relleno; el botón de su tarjeta y el de compartir la casa activa van en contorno.
  const resume = page.getByTestId("resume-card");
  await expect(resume).toContainText("Cabina con cambios");
  await expect(resume).toContainText("Faltan fotos del baño.");
  await expect(resume.getByRole("link", { name: "Corregir y reenviar" })).toHaveAttribute("href", `/propietario/publicar/${changes.id}/1`);
  await expect(resume).not.toContainText("borradores más");
  await expect(page.getByTestId("pay-notice")).toHaveCount(0);
  await expect(page.getByTestId("offer-left")).toHaveCount(0); // sin tarjeta de la oferta de lanzamiento
  // Revisión UX N1: sin casillas a 0; un solo relleno y «Nueva» en contorno.
  await expect(page.locator(".tile")).toHaveText(["1activa", "1en revisión"]);
  await expect(page.locator("main .btn-primary")).toHaveCount(1);
  await expect(card(page, "Cabina con cambios").getByRole("button", { name: "Corregir y reenviar" })).toHaveClass(/btn-ghost/);
  await expect(card(page, "Casa Cocles").getByRole("button", { name: "Compartir ficha" })).toHaveClass(/btn-ghost/);
  await expect(card(page, "Casa Cocles").getByRole("button", { name: "Compartir ficha" })).toHaveAttribute("data-share-url", new RegExp(`/casa/${active.publicId}$`));
  await expect(page.getByRole("link", { name: "Nueva" })).toHaveClass(/btn-ghost/);
  await expect(page.getByRole("article")).toHaveCount(5);
  await expect(page.getByRole("heading", { name: "Casa de Ana" })).toHaveCount(0);
  await expect(card(page, "Cabina con cambios").getByText("Cambios pedidos", { exact: true })).toBeVisible();
  await expect(card(page, "Cabina con cambios").getByText("Nota de bnbtico: Faltan fotos del baño.")).toBeVisible();
  await expect(card(page, "Casa en revisión").getByText(/^Enviada hoy\. Le avisamos por WhatsApp\.$/)).toBeVisible();
  await expect(card(page, "Casa Cocles").getByText("₡55 000 / noche")).toBeVisible();

  await page.waitForTimeout(1500); // la caché se guarda en IndexedDB con un pequeño retraso
  await page.route("**/rest/v1/**", (route) => route.abort());
  await page.reload();
  await expect(page.getByRole("article")).toHaveCount(5);
  await expect(page.getByTestId("resume-card")).toContainText("Cabina con cambios");
});

// Revisión de Ana: toda la tarjeta abre el detalle (enlace estirado del título); sus botones siguen haciendo lo suyo y
// arrastrar sobre una tarjeta desplaza la lista.
test("Mis casas: tocar la foto o el precio abre el detalle; «Compartir ficha», «Calendario» y «Seguir» siguen; arrastrar desplaza", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.addInitScript(() => {
    const w = window as unknown as { shared: unknown[] };
    w.shared = [];
    Object.defineProperty(navigator, "share", { configurable: true, value: async (data: unknown) => void w.shared.push(data) });
  });
  await page.goto("/propietario/casas");
  // Un toque donde está la pieza (el enlace estirado la cubre: un clic «sobre el elemento» lo intercepta, que es la idea).
  const tap = async (target: ReturnType<Page["locator"]>) => {
    await target.evaluate((el) => el.scrollIntoView({ block: "center" })); // lejos de las barras fijas
    const b = (await target.boundingBox())!;
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  };
  await tap(card(page, "Casa Cocles").locator(".thumb"));
  await expect(page).toHaveURL(new RegExp(`/propietario/casas/${active.id}$`));
  await page.goBack();
  await tap(card(page, "Casa Cocles").locator(".price-line"));
  await expect(page).toHaveURL(new RegExp(`/propietario/casas/${active.id}$`));
  await page.goBack();
  await tap(card(page, "Casa en revisión").getByTestId("card-line"));
  await expect(page).toHaveURL(new RegExp(`/propietario/casas/${review.id}$`));
  await page.goBack();

  await card(page, "Casa Cocles").getByRole("button", { name: "Compartir ficha" }).click();
  await expect(page).toHaveURL(/\/propietario\/casas$/);
  expect(await page.evaluate(() => (window as unknown as { shared: { url: string }[] }).shared)).toEqual([expect.objectContaining({ url: `http://${HOST}/casa/${active.publicId}` })]);
  await card(page, "Casa Cocles").getByRole("link", { name: "Calendario" }).click();
  await expect(page).toHaveURL(new RegExp(`/propietario/calendario\\?casa=${active.id}`));
  await page.goBack();
  await card(page, "Borrador nuevo").getByRole("link", { name: "Seguir" }).click();
  await expect(page).toHaveURL(new RegExp(`/propietario/publicar/${draft.id}/\\d+$`));
  await page.goto("/propietario/casas");

  // Un arrastre con el dedo que empieza sobre una tarjeta desplaza la lista y no abre nada.
  await expect(card(page, "Casa en revisión")).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  const before = await page.evaluate(() => window.scrollY);
  const box = (await card(page, "Casa en revisión").boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.synthesizeScrollGesture", { x: Math.round(box.x + box.width / 2), y: Math.round(Math.min(box.y + box.height / 2, 600)), yDistance: -250, gestureSourceType: "touch", speed: 800 });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 100);
  await expect(page).toHaveURL(/\/propietario\/casas$/);
});

test("visitas y consultas de 30 días en el detalle de la casa", async ({ page }) => {
  await page.goto(`/propietario/casas/${active.id}`);
  // Revisión UX A2: sin visitas ni consultas, la invitación a compartir; con ellas, las cifras de 30 días.
  await expect(page.getByTestId("listing-stats")).toHaveText("Comparta su enlace para que lleguen las primeras visitas");
  await h.recordViews(active.publicId, 4);
  await h.recordViews(active.publicId, 2, 45);
  await h.inquiries("other").create(active.publicId, { arrival: null, departure: null, people: null, message: "Hola, ¿está libre?" });
  await page.goto("/robots.txt");
  await page.evaluate(() => new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase("bnbtico");
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  }));
  await page.goto(`/propietario/casas/${active.id}`);
  await expect(page.getByTestId("listing-stats")).toHaveText("4 visitas · 1 consulta · últimos 30 días");
});

test("detalle: compartir con la hoja nativa y, si no la hay, copiar el enlace", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { shared: unknown[]; copied: string[] };
    w.shared = [];
    w.copied = [];
    Object.defineProperty(navigator, "share", { configurable: true, value: async (data: unknown) => void w.shared.push(data) });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (t: string) => void w.copied.push(t) } });
  });
  await page.goto("/propietario/casas");
  await card(page, "Casa Cocles").getByRole("link", { name: "Casa Cocles" }).click();
  await expect(page).toHaveURL(new RegExp(`/propietario/casas/${active.id}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Casa Cocles" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver ficha" })).toHaveAttribute("href", `/casa/${active.publicId}`);
  // Revisión UX N7: la referencia no va sobre la foto; se ve como enlace en «Compartir ficha».
  await expect(page.locator(".detail-photo")).not.toContainText(active.publicId);
  await expect(page.getByRole("button", { name: /Compartir ficha/ })).toContainText(`${HOST}/casa/${active.publicId}`);
  await expect(page.getByText("+506 8777 0001 · verificado")).toBeVisible();
  // Los textos de compartir no se animan al abrir el detalle; solo al cambiar a «Enlace copiado».
  expect(await page.locator(".swap-in").evaluateAll((els) => els.reduce((n, el) => n + el.getAnimations().length, 0))).toBe(0);
  await expect(page.locator(".swap-in.changed")).toHaveCount(0);

  await page.getByRole("button", { name: /Compartir ficha/ }).click();
  const shared = await page.evaluate(() => (window as unknown as { shared: { url: string; title: string }[] }).shared);
  expect(shared).toEqual([expect.objectContaining({ url: `http://${HOST}/casa/${active.publicId}`, title: "Casa Cocles" })]);

  await page.evaluate(() => Object.defineProperty(navigator, "share", { configurable: true, value: undefined }));
  await page.getByRole("button", { name: /Compartir ficha/ }).click();
  await expect(page.getByText("Enlace copiado")).toBeVisible();
  await expect(page.locator(".swap-in.changed").first()).toHaveText("Enlace copiado");
  expect(await page.evaluate(() => (window as unknown as { copied: string[] }).copied)).toEqual([`http://${HOST}/casa/${active.publicId}`]);

  // Una casa que no está activa no se comparte: su enlace no funcionaría.
  await page.goto(`/propietario/casas/${review.id}`);
  await expect(page.getByText("La estamos revisando")).toBeVisible();
  await expect(page.getByRole("button", { name: /Compartir ficha/ })).toBeDisabled();
  await expect(page.getByRole("switch")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Editar la ficha/ })).toHaveCount(0);
});

test("disponible para consultas responde al instante y vuelve atrás con el mensaje de la base si falla", async ({ page }) => {
  await page.goto(`/propietario/casas/${active.id}`);
  const toggle = page.getByRole("switch", { name: /Anuncio visible/ });
  await expect(toggle).toHaveAttribute("aria-checked", "true");

  // La respuesta tarda: el interruptor ya cambió antes de que llegue.
  let release = () => {};
  const held = new Promise<void>((r) => (release = r));
  await page.route("**/rest/v1/rpc/set_listing_available", async (route) => {
    await held;
    await route.continue();
  });
  // Apagar pide la fecha opcional en una hoja (ticket 04 de la fase 4); sin fecha, «Cerrar a consultas».
  await toggle.click();
  await page.getByRole("dialog", { name: "Pausar anuncio" }).getByRole("button", { name: "Pausar anuncio" }).click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(page.getByText("Pausado", { exact: true })).toBeVisible();
  release();
  await expect.poll(async () => (await h.anon.getPublic(active.publicId))?.available).toBe(false);
  await page.unroute("**/rest/v1/rpc/set_listing_available");

  await page.route("**/rest/v1/rpc/set_listing_available", (route) =>
    route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "P0001", message: "Solo puede cambiar la disponibilidad de una casa activa.", details: null, hint: null }) }),
  );
  await toggle.click();
  await expect(page.locator('.note[role="alert"]')).toHaveText("Solo puede cambiar la disponibilidad de una casa activa.");
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await page.unroute("**/rest/v1/rpc/set_listing_available");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect.poll(async () => (await h.anon.getPublic(active.publicId))?.available).toBe(true);
});

test("editar una casa activa pide confirmación, la reabre y deja de verse", async ({ page }) => {
  await page.goto(`/propietario/casas/${active.id}`);
  let warning = "";
  page.once("dialog", (d) => {
    warning = d.message();
    void d.dismiss();
  });
  await page.getByRole("button", { name: /Editar la ficha/ }).click();
  expect(warning).toContain("dejará de verse");
  await expect(page.getByText("Activa", { exact: true })).toBeVisible();
  expect(await h.anon.linkState(active.publicId)).toBe("active");

  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: /Editar la ficha/ }).click();
  await expect(page).toHaveURL(new RegExp(`/propietario/publicar/${active.id}/1$`));
  expect(await h.anon.linkState(active.publicId)).toBe("blocked");

  // El borrador de una casa que ya estuvo publicada no se descarta.
  await page.goto("/propietario/casas");
  const reopened = card(page, "Casa Cocles");
  await expect(reopened.getByText("Borrador", { exact: true })).toBeVisible();
  await expect(reopened.getByText(/Estuvo publicada/)).toBeVisible();
  await expect(reopened.getByRole("button", { name: "Descartar" })).toHaveCount(0);
  await reopened.getByRole("link", { name: "Casa Cocles" }).click();
  await expect(page.getByText("Estuvo publicada. Está editándola")).toBeVisible();
  await expect(page.getByRole("button", { name: "Descartar borrador" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Seguir con el borrador/ })).toBeVisible();
});

test("con cambios pedidos: la nota y «Corregir y reenviar» abre el asistente", async ({ page }) => {
  await page.goto(`/propietario/casas/${changes.id}`);
  await expect(page.getByText("Le pedimos cambios")).toBeVisible();
  await expect(page.getByText("Faltan fotos del baño.")).toBeVisible();
  await page.getByRole("button", { name: "Corregir y reenviar" }).click();
  await expect(page).toHaveURL(new RegExp(`/propietario/publicar/${changes.id}/1$`));
});

test("descartar un borrador nunca enviado, desde Mis casas y desde el detalle", async ({ page }) => {
  await page.goto("/propietario/casas");
  page.once("dialog", (d) => void d.dismiss());
  await card(page, "Borrador nuevo").getByRole("button", { name: "Descartar" }).click();
  await expect(card(page, "Borrador nuevo")).toHaveCount(1);
  page.once("dialog", (d) => void d.accept());
  await card(page, "Borrador nuevo").getByRole("button", { name: "Descartar" }).click();
  await expect(card(page, "Borrador nuevo")).toHaveCount(0);
  expect(await h.anon.linkState(draft.publicId)).toBeNull();

  await card(page, "Otro borrador").getByRole("link", { name: "Otro borrador" }).click();
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Descartar borrador" }).click();
  await expect(page).toHaveURL(/\/propietario\/casas$/);
  await expect(card(page, "Otro borrador")).toHaveCount(0);
  await expect.poll(async () => (await h.owner("owner").getOwn(draft2.id)) === null).toBe(true);
});

test("«enviada» confirma la revisión con la referencia, y una casa ajena no existe", async ({ page }) => {
  await page.goto(`/propietario/casas/${review.id}/enviada`);
  await expect(page.getByRole("heading", { level: 1, name: "¡Listo! Su casa está en revisión" })).toBeVisible();
  await expect(page.getByText("Revisamos Casa en revisión a mano")).toBeVisible();
  await expect(page.getByText(review.publicId)).toBeVisible();
  await page.getByRole("link", { name: "Ir a Mis casas" }).click();
  await expect(page).toHaveURL(/\/propietario\/casas$/);

  const ana = (await h.owner("other").listOwn())[0]!;
  await page.goto(`/propietario/casas/${ana.id}`);
  await expect(page.getByRole("heading", { name: "No encontramos esta casa" })).toBeVisible();
});
