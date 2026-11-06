import { expect, test, type Page } from "./helpers/test";
import type { Seeded } from "../contract/harness";
import { postgrestHarness } from "../db/postgrest-harness";
import { injectSession } from "./helpers/session";
import { touch } from "./helpers/touch";
import { resumeStep } from "../../src/domain/publish-rules";

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

test("Mis casas: la etiqueta sobre la foto, barra de estados y acciones por tarjeta", async ({ page }) => {
  await page.goto("/propietario/casas");
  await expect(page.getByRole("heading", { level: 1, name: "Mis casas" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link")).toHaveText(["Explorar", "Mis casas", "Calendario", /^Consultas\d*$/, "Cuenta"]);
  await expect(page.getByRole("article")).toHaveCount(5);
  await expect(page.getByRole("heading", { name: "Casa de Ana" })).toHaveCount(0);
  // Un borrador es un solo elemento (decisión B): nada arriba salvo el pago, y aquí no toca pagar.
  await expect(page.getByTestId("resume-card")).toHaveCount(0);
  await expect(page.getByTestId("pay-notice")).toHaveCount(0);
  await expect(page.getByTestId("offer-left")).toHaveCount(0); // sin tarjeta de la oferta de lanzamiento
  // Revisión UX N1: sin casillas a 0; «Nueva» en contorno.
  await expect(page.locator(".tile")).toHaveText(["1activa", "1en revisión", "2borradores"]);
  // Revisión UX 2026-10-29 (T2): «Nueva casa» junto a las cifras, sin fondo verde (recuadro con la línea fina).
  await expect(page.getByRole("link", { name: "Nueva casa" })).toHaveClass(/new-house/);
  expect(await page.getByRole("link", { name: "Nueva casa" }).evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgba(0, 0, 0, 0)");

  const cocles = card(page, "Casa Cocles");
  await expect(cocles.getByTestId("card-label")).toHaveText("Activa");
  await expect(cocles.getByTestId("card-zone")).toHaveText("Cocles");
  await expect(cocles).not.toContainText("₡");
  const share = cocles.getByRole("button", { name: "Compartir ficha" });
  await expect(share).toHaveClass(/btn-primary/); // icono y texto verdes; el dorado se conserva para pagos
  await expect(share).toHaveText("Compartir");
  await expect(share).toHaveAttribute("data-share-url", new RegExp(`/casa/${active.publicId}$`));
  await expect(cocles.getByRole("link", { name: "Calendario" })).toHaveAttribute("href", `/propietario/calendario?casa=${active.id}`);
  await expect(cocles.getByRole("link", { name: "Consultas", exact: true })).toHaveAttribute("href", `/propietario/actividad?casa=${active.id}`);

  const cambios = card(page, "Cabina con cambios");
  await expect(cambios.getByTestId("card-label")).toHaveText("Cambios pedidos");
  await expect(cambios.getByText("Nota de bnbtico: Faltan fotos del baño.")).toHaveClass(/note-arena/);
  await expect(cambios.getByRole("link", { name: "Corregir y reenviar" })).toHaveClass(/btn-primary/);
  await expect(cambios.getByRole("link", { name: "Corregir y reenviar" })).toHaveAttribute("href", `/propietario/publicar/${changes.id}/1`);

  const enRevision = card(page, "Casa en revisión");
  await expect(enRevision.getByTestId("card-label")).toHaveText("En revisión");
  await expect(enRevision.getByRole("button")).toHaveCount(0);
  await expect(enRevision.locator(".btn")).toHaveCount(0);

  const borrador = card(page, "Borrador nuevo");
  await expect(borrador.getByTestId("card-label")).toHaveText("Borrador");
  const seguir = borrador.getByRole("link", { name: "Seguir publicando" });
  await expect(seguir).toHaveClass(/btn-ghost/);
  await expect(seguir).toHaveAttribute("href", `/propietario/publicar/${draft.id}/${resumeStep((await h.owner("owner").getOwn(draft.id))!)}`);
  await expect(borrador.getByRole("button", { name: "Descartar" })).toBeVisible();

  // Como mucho un botón relleno (verde o, si es dinero, ocre) por tarjeta.
  for (const article of await page.getByRole("article").all()) expect(await article.locator(".btn-primary, .btn-sun").count()).toBeLessThanOrEqual(1);
  // La primera foto se pide enseguida; las demás, al acercarse. Foto 3:2 a todo el ancho de su tarjeta;
  // desde el 2026-11-06, tarjetas y barra de estados comparten 16 px de margen a cada lado de la pantalla.
  const photos = page.locator("article .house-photo");
  await expect(photos.first().locator("img")).toHaveAttribute("loading", "eager");
  await expect(page.locator("article .house-photo img").nth(1)).toHaveAttribute("loading", "lazy");
  const box = (await photos.first().boundingBox())!;
  expect(Math.abs(box.width / box.height - 3 / 2)).toBeLessThan(0.02);
  expect(Math.abs(box.x - 16)).toBeLessThanOrEqual(1);
  expect(Math.abs(box.width - (page.viewportSize()!.width - 32))).toBeLessThanOrEqual(1);

  await page.waitForTimeout(1500); // la caché se guarda en IndexedDB con un pequeño retraso
  await page.route("**/rest/v1/**", (route) => route.abort());
  await page.reload();
  await expect(page.getByRole("article")).toHaveCount(5);
  await expect(card(page, "Cabina con cambios").getByTestId("card-label")).toHaveText("Cambios pedidos");
});

// Revisión de Ana: toda la tarjeta abre el detalle (enlace estirado del título); sus botones siguen haciendo lo suyo y
// arrastrar sobre una tarjeta desplaza la lista.
test("Mis casas: tocar la foto o el nombre abre el detalle; «Compartir ficha», «Calendario» y «Seguir publicando» siguen; arrastrar desplaza", async ({ page }) => {
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
  await tap(card(page, "Casa Cocles").locator(".house-photo"));
  await expect(page).toHaveURL(new RegExp(`/propietario/casas/${active.id}$`));
  await page.goBack();
  await tap(card(page, "Casa en revisión").locator(".house-photo"));
  await expect(page).toHaveURL(new RegExp(`/propietario/casas/${review.id}$`));
  await page.goBack();
  await tap(card(page, "Casa Cocles").getByTestId("card-zone"));
  await expect(page).toHaveURL(new RegExp(`/propietario/casas/${active.id}$`));
  await page.goBack();

  await card(page, "Casa Cocles").getByRole("button", { name: "Compartir ficha" }).click();
  await expect(page).toHaveURL(/\/propietario\/casas$/);
  expect(await page.evaluate(() => (window as unknown as { shared: { url: string }[] }).shared)).toEqual([expect.objectContaining({ url: `http://${HOST}/casa/${active.publicId}` })]);
  const shareBeforeCopy = (await card(page, "Casa Cocles").getByRole("button", { name: "Compartir ficha" }).boundingBox())!;
  await page.evaluate(() => {
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => undefined } });
  });
  await card(page, "Casa Cocles").getByRole("button", { name: "Compartir ficha" }).click();
  const copiedButton = card(page, "Casa Cocles").getByRole("button", { name: "Enlace copiado" });
  await expect(copiedButton).toBeVisible();
  const shareAfterCopy = (await copiedButton.boundingBox())!;
  expect(shareAfterCopy.width).toBe(shareBeforeCopy.width);
  expect(shareAfterCopy.height).toBe(shareBeforeCopy.height);
  await card(page, "Casa Cocles").getByRole("link", { name: "Calendario" }).click();
  await expect(page).toHaveURL(new RegExp(`/propietario/calendario\\?casa=${active.id}`));
  // Es otra pestaña: no deja rastro en el historial (2026-11-03), «Atrás» sale de la app.
  await page.goBack();
  expect(page.url()).toMatch(/^about:blank$|\/robots\.txt$/); // fuera de la app (injectSession pasa por /robots.txt)
  await page.goto("/propietario/casas");
  await card(page, "Borrador nuevo").getByRole("link", { name: "Seguir publicando" }).click();
  await expect(page).toHaveURL(new RegExp(`/propietario/publicar/${draft.id}/\\d+$`));
  await page.goto("/propietario/casas");

  // Un arrastre con el dedo que empieza sobre una tarjeta desplaza la lista y no abre nada. El dedo baja sobre la tarjeta,
  // no sobre la barra fija de abajo.
  const target = page.getByRole("article").first(); // la primera, para que quede lista por debajo
  await expect(target).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await target.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top - 120)); // arriba, lejos de la barra
  const before = await page.evaluate(() => window.scrollY);
  const box = (await target.boundingBox())!;
  const start = { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + Math.min(box.height / 2, 40)) };
  // Precondiciones, para que la prueba no pase ni falle en vacío: queda recorrido y el dedo cae dentro de la tarjeta.
  expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight - scrollY)).toBeGreaterThan(150);
  expect(await target.evaluate((el, p) => el.contains(document.elementFromPoint(p.x, p.y)), start)).toBe(true);
  // Dedo real por CDP (helpers/touch): Input.synthesizeScrollGesture con touch no desplaza nada en Chromium de Linux (CI).
  const finger = await touch(page);
  await finger.down(start.x, start.y);
  await finger.move(start.x, start.y - 250, 15);
  await finger.up();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 100);
  await expect(page).toHaveURL(/\/propietario\/casas$/);
});

test("visitas, toques y consultas de 30 días en el detalle de la casa, bajo la portada", async ({ page }) => {
  await page.goto(`/propietario/casas/${active.id}`);
  // Revisión UX 2026-10-29 (C1): las tres cifras, en una tarjeta bajo la portada (salieron de Consultas).
  const stats = page.getByTestId("listing-stats");
  await expect(stats).toHaveText(/Últimos 30 días\s*0\s*visitas\s*0\s*toques en WhatsApp\s*0\s*consultas/);
  expect((await stats.boundingBox())!.y).toBeGreaterThan((await page.locator(".detail-photo").boundingBox())!.y);
  expect((await stats.boundingBox())!.y).toBeLessThan((await page.getByTestId("field-rows").boundingBox())!.y);
  expect((await stats.boundingBox())!.height).toBeGreaterThanOrEqual(130);
  expect((await stats.boundingBox())!.height).toBeLessThanOrEqual(150);
  await h.recordViews(active.publicId, 4);
  await h.recordViews(active.publicId, 2, 45);
  await h.inquiries("other").create(active.publicId, { arrival: null, departure: null, people: null, message: "Hola, ¿está libre?" });
  await page.goto("/robots.txt");
  await page.evaluate(() => new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase("bnbtico");
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  }));
  await page.goto(`/propietario/casas/${active.id}`);
  await expect(page.getByTestId("listing-stats")).toHaveText(/4\s*visitas\s*0\s*toques en WhatsApp\s*1\s*consulta/);
});

test("detalle: «Ver ficha» es una tarjeta flotante clara abajo con el aspecto de «Mapa», fuera de la cabecera y sin tapar el final", async ({ page }) => {
  await page.goto(`/propietario/casas/${active.id}`);
  await expect(page.getByRole("heading", { level: 1, name: "Casa Cocles" })).toBeVisible();
  await expect(page.getByTestId("field-rows")).toBeVisible();
  const ver = page.getByRole("link", { name: "Ver ficha", exact: true });
  await expect(ver).toHaveCount(1);
  await expect(ver).toHaveAttribute("href", `/casa/${active.publicId}`);
  await expect(page.locator("header").getByRole("link", { name: "Ver ficha" })).toHaveCount(0);
  await expect(ver.locator("svg")).toHaveCount(1); // el ojo, a la izquierda del texto
  // El mismo aspecto que «Mapa» de Explorar: se compara con un `.map-label` puesto en esta página (la regla es la misma en global.css).
  const looks = await ver.evaluate((el) => {
    const pick = (node: Element) => {
      const c = getComputedStyle(node);
      return [c.backgroundColor, c.borderRadius, c.height, c.paddingLeft, c.paddingRight, c.color, c.font, c.boxShadow, c.columnGap, c.textDecorationLine, c.backdropFilter, c.borderTopColor].join(" | ");
    };
    const ref = document.createElement("button");
    ref.className = "map-label";
    ref.textContent = "Mapa";
    document.body.append(ref);
    const c = getComputedStyle(el);
    const out = { ver: pick(el), mapa: pick(ref), pos: c.position, radius: c.borderTopLeftRadius, color: c.color, blur: c.backdropFilter, height: c.height };
    ref.remove();
    return out;
  });
  expect(looks.ver).toBe(looks.mapa);
  expect(looks.pos).toBe("fixed");
  // Tarjetas flotantes, tanda 1 (decisión 8, variante B): clara como las demás tarjetas, texto e icono en tinta, 44 px de alto
  // y esquinas de 12 px.
  expect(looks).toMatchObject({ radius: "12px", color: "rgb(28, 43, 42)", blur: "blur(16px) saturate(1.2)", height: "44px" });
  // El ojo y el texto en la misma línea, centrados en el alto del botón.
  const [icon, box] = [(await ver.locator("svg").boundingBox())!, (await ver.boundingBox())!];
  expect(Math.abs(icon.y + icon.height / 2 - (box.y + box.height / 2))).toBeLessThan(1);
  // Abajo y centrado.
  const vp = page.viewportSize()!;
  expect(Math.abs(box.x + box.width / 2 - vp.width / 2)).toBeLessThan(2);
  expect(vp.height - (box.y + box.height)).toBe(12);
  // Al final de la pantalla lo último queda por encima del botón, con aire.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const last = await page.locator(".view").evaluate((view) => {
    const items = [...view.querySelectorAll("*")].filter((el) => !el.closest("a[href^='/casa/']") && el.getBoundingClientRect().height > 0);
    return Math.max(...items.map((el) => el.getBoundingClientRect().bottom));
  });
  // 16 px de aire entre lo último y el botón (el scroll no llega a fracciones de píxel: margen de 1).
  expect(last).toBeLessThan((await ver.boundingBox())!.y - 15);
  await ver.click();
  await expect(page).toHaveURL(new RegExp(`/casa/${active.publicId}$`));
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
  await expect(page.getByTestId("share-url")).toHaveText(`${HOST}/casa/${active.publicId}`);
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

  // Una casa que no está activa no se comparte: su enlace no funcionaría, y la fila no sale (revisión UX 2026-10-29, A4).
  await page.goto(`/propietario/casas/${review.id}`);
  await expect(page.getByText("La estamos revisando")).toBeVisible();
  await expect(page.getByRole("button", { name: /Compartir ficha/ })).toHaveCount(0);
  await expect(page.getByRole("switch")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Editar la ficha/ })).toHaveCount(0);
});

test("«Pausar la casa» responde al instante desde el Calendario y vuelve atrás si la base se niega", async ({ page }) => {
  await page.goto(`/propietario/calendario?casa=${active.id}`);
  const row = page.getByRole("region", { name: "Acciones del calendario" }).getByRole("button", { name: "Pausar la casa", exact: true });
  const closed = page.locator(".cal-action.is-paused");
  const open = page.getByRole("button", { name: "Volver a publicarla" });
  await expect(row).toBeVisible();

  // La respuesta tarda: la fila ya cambió antes de que llegue.
  let release = () => {};
  const held = new Promise<void>((r) => (release = r));
  await page.route("**/rest/v1/rpc/set_listing_available", async (route) => {
    await held;
    await route.continue();
  });
  // Pausar pide la fecha de vuelta opcional en una hoja (ticket 04 de la fase 4); sin fecha, pausada hasta que la vuelva a publicar.
  await row.click();
  await page.getByRole("dialog", { name: "Pausar la casa" }).getByRole("button", { name: "Pausar la casa" }).click();
  await expect(closed).toContainText(/^Pausada\s*No aparece en Explorar ni recibe consultas/);
  release();
  await expect.poll(async () => (await h.anon.getPublic(active.publicId))?.available).toBe(false);
  await page.unroute("**/rest/v1/rpc/set_listing_available");
  // La misma etiqueta en el detalle y en Mis casas: «Pausada», con el color de «Inactiva», no «Pausada por bnbtico» (ticket 04 de la ronda del 2 nov).
  await page.goto(`/propietario/casas/${active.id}`);
  await expect(page.locator(".detail-photo .state")).toHaveText("Pausada");
  await page.goto("/propietario/casas");
  const label = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Casa Cocles" }) }).getByTestId("card-label");
  await expect(label).toHaveText("Pausada");
  await expect(label).toHaveClass(/state-off/);
  await page.goto(`/propietario/calendario?casa=${active.id}`);

  await page.route("**/rest/v1/rpc/set_listing_available", (route) =>
    route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "P0001", message: "Solo puede cambiar la disponibilidad de una casa activa.", details: null, hint: null }) }),
  );
  await open.click();
  await expect(page.locator('.note[role="alert"]')).toHaveText("Solo puede cambiar la disponibilidad de una casa activa.");
  await expect(closed).toBeVisible();
  await page.unroute("**/rest/v1/rpc/set_listing_available");

  await open.click();
  await expect(row).toBeVisible();
  await expect.poll(async () => (await h.anon.getPublic(active.publicId))?.available).toBe(true);
});

test("con cambios pedidos: la nota y «Corregir y reenviar» abre el asistente", async ({ page }) => {
  await page.goto(`/propietario/casas/${changes.id}`);
  await expect(page.getByText("Le pedimos cambios")).toBeVisible();
  await expect(page.getByText("Faltan fotos del baño.")).toBeVisible();
  await page.getByRole("button", { name: "Corregir y reenviar" }).click();
  await expect(page).toHaveURL(new RegExp(`/propietario/publicar/${changes.id}/1$`));
});

test("descartar un borrador nunca enviado, desde Mis casas y desde el detalle: la hoja de la app, nunca el diálogo del navegador", async ({ page }) => {
  const native: string[] = [];
  page.on("dialog", (d) => {
    native.push(d.message());
    void d.dismiss();
  });
  await page.goto("/propietario/casas");
  const sheet = page.getByRole("dialog");
  const discardCard = card(page, "Borrador nuevo").getByRole("button", { name: "Descartar" });

  await discardCard.click();
  await expect(sheet.getByRole("heading", { name: "¿Descartar este borrador?" })).toBeVisible();
  await expect(sheet).toContainText("No se puede deshacer.");
  await expect(sheet.getByRole("button")).toHaveText(["Descartar", "Cancelar"]);
  await expect(sheet.getByRole("button", { name: "Descartar" })).toHaveClass(/btn-outline-bad/);
  await sheet.getByRole("button", { name: "Cancelar" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(discardCard).toBeFocused();
  await expect(card(page, "Borrador nuevo")).toHaveCount(1);

  await discardCard.click();
  await expect(sheet).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(discardCard).toBeFocused();
  await expect(card(page, "Borrador nuevo")).toHaveCount(1);

  await discardCard.click();
  await sheet.getByRole("button", { name: "Descartar" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(card(page, "Borrador nuevo")).toHaveCount(0);
  expect(await h.anon.linkState(draft.publicId)).toBeNull();

  await card(page, "Otro borrador").getByRole("link", { name: "Otro borrador" }).click();
  await page.getByRole("button", { name: "Descartar borrador" }).click();
  await expect(sheet.getByRole("heading", { name: "¿Descartar este borrador?" })).toBeVisible();
  await sheet.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByRole("button", { name: "Descartar borrador" })).toBeFocused();
  await page.getByRole("button", { name: "Descartar borrador" }).click();
  await sheet.getByRole("button", { name: "Descartar" }).click();
  await expect(page).toHaveURL(/\/propietario\/casas$/);
  await expect(card(page, "Otro borrador")).toHaveCount(0);
  await expect.poll(async () => (await h.owner("owner").getOwn(draft2.id)) === null).toBe(true);
  expect(native).toEqual([]);
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

// Auditoría de viajes (2026-11-05): suscripción y actividad se pedían cuando ya había llegado la casa y el JS de su ficha.
test("ficha de una casa activa: la suscripción y la actividad se piden sin esperar a la casa", async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route((u) => u.pathname.endsWith("/rest/v1/listings") && u.searchParams.get("id") === `eq.${active.id}`, async (route) => {
    await held;
    await route.continue();
  });
  const billing = page.waitForRequest((r) => r.url().includes("/rest/v1/rpc/owner_billing"));
  const activity = page.waitForRequest((r) => r.url().includes("/rest/v1/rpc/owner_activity"));
  await page.goto(`/propietario/casas/${active.id}`);
  await Promise.all([billing, activity]);
  release();
  await expect(page.getByRole("heading", { name: "Casa Cocles" }).first()).toBeVisible();
});

// Acuerdo de Mis casas del 2026-11-04: accesos por casa y consultas nuevas, sin confundirlas con mensajes.
test("Mis casas: los accesos filtran la casa correcta y el contador excluye las consultas ya abiertas", async ({ page }) => {
  await h.reset();
  const a = await h.seed({ status: "active", draft: { title: "Casa del Caribe" } });
  const b = await h.seed({ status: "active", draft: { title: "Cabina del bosque" } });
  await h.inquiries("other").create(a.publicId, { arrival: null, departure: null, people: 2, message: "Consulta de la casa del Caribe" });
  const read = await h.inquiries("other").create(b.publicId, { arrival: null, departure: null, people: 2, message: "Consulta ya abierta del bosque" });
  await h.inquiries("owner").markOpened(read.inquiryId);
  await page.goto("/propietario/casas");
  const aCard = card(page, "Casa del Caribe");
  const bCard = card(page, "Cabina del bosque");
  const aInquiries = aCard.getByRole("link", { name: "Consultas, 1 nueva", exact: true });
  await expect(aInquiries).toHaveAttribute("href", "/propietario/actividad?casa=" + a.id);
  await expect(aCard.getByTestId("house-inquiries-count")).toHaveText("1");
  await expect(bCard.getByRole("link", { name: "Consultas", exact: true })).toHaveAttribute("href", "/propietario/actividad?casa=" + b.id);
  await expect(bCard.getByTestId("house-inquiries-count")).toHaveCount(0);
  for (const viewport of [{ width: 375, height: 667 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const calendar = (await aCard.getByRole("link", { name: "Calendario", exact: true }).boundingBox())!;
    const inquiries = (await aInquiries.boundingBox())!;
    expect(Math.min(calendar.width, calendar.height, inquiries.width, inquiries.height)).toBeGreaterThanOrEqual(44);
    expect(inquiries.x - calendar.x - calendar.width).toBeGreaterThanOrEqual(16);
    const summary = (await page.locator(".tiles-row").boundingBox())!;
    const house = (await aCard.boundingBox())!;
    expect(summary.x).toBeCloseTo(house.x, 0);
    expect(summary.x + summary.width).toBeCloseTo(house.x + house.width, 0);
    expect(house.x).toBe(16);
    const calendarDrawing = await aCard.getByRole("link", { name: "Calendario", exact: true }).locator("svg").boundingBox();
    const inquiriesDrawing = await aInquiries.locator("svg").boundingBox();
    expect(Math.min(calendarDrawing!.width, calendarDrawing!.height, inquiriesDrawing!.width, inquiriesDrawing!.height)).toBeGreaterThanOrEqual(28);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  }
  await aInquiries.click();
  await expect(page).toHaveURL("/propietario/actividad?casa=" + a.id);
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("article")).toContainText("Consulta de la casa del Caribe");
  // Filtrar y leer la tarjeta no equivale a abrir WhatsApp: la consulta sigue nueva.
  await page.goto("/propietario/casas");
  await expect(card(page, "Casa del Caribe").getByTestId("house-inquiries-count")).toHaveText("1");
});
