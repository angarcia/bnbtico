import { expect, test, type Page } from "./helpers/test";
import type { Seeded } from "../contract/harness";
import { serviceClient, sql, TEST_NAMES, TEST_PHONES } from "../db/local";
import { postgrestHarness } from "../db/postgrest-harness";
import { enterCode, injectSession, signOut } from "./helpers/session";
import { backFromWhatsApp, catchWhatsApp } from "./helpers/whatsapp";

// Navegación simple: una sola barra que crece con las casas (tres pestañas sin casas, cinco con al menos una) con la cuenta
// a la derecha, Mis casas (siempre en lista, también con una sola casa), Consultas (solo las consultas; las cifras de 30 días
// están en el detalle de cada casa) y la vuelta de /propietario y /propietario/consultas. Revisión UX 2026-10-29 (C1, C4).
// Contra Supabase local con las sesiones inyectadas (sin gastar SMS).
test.describe.configure({ mode: "serial" });

const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
let h: Awaited<ReturnType<typeof postgrestHarness>>;
let casa: Seeded;

const nav = (page: Page) => page.getByRole("navigation", { name: "Navegación principal" });
// La cuenta es la pestaña de la derecha.
const accountButton = (page: Page) => nav(page).getByRole("link", { name: "Cuenta", exact: true });
// Con una casa la pestaña dice «Mi casa»; con dos o más, «Mis casas». Favoritos pasa a Cuenta.
const OWNER_TABS = ["Explorar", "Mi casa", "Calendario", /^Consultas\d*$/, "Cuenta"];
const OWNER_TABS_MANY = ["Explorar", "Mis casas", "Calendario", /^Consultas\d*$/, "Cuenta"];

/** Ingresar por la interfaz con un número de prueba que ya tiene cuenta (código 123456). */
async function signInByUi(page: Page, phone: string) {
  await page.evaluate(() => localStorage.clear()); // sin la sesión inyectada
  await page.waitForTimeout(1100); // Supabase admite un código por segundo y número
  await page.goto("/cuenta");
  await page.getByLabel("Número de WhatsApp").fill(phone);
  await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();
  await enterCode(page);
}

/** Cada cambio del número de pestañas de la barra, con la ruta en ese momento, desde el primer pintado (0: aún sin barra). */
const recordTabCounts = (page: Page) =>
  page.addInitScript(() => {
    const w = window as unknown as { __tabCounts: [string, number][] };
    w.__tabCounts = [];
    let last = -1;
    new MutationObserver(() => {
      const n = document.querySelector('nav[aria-label="Navegación principal"]')?.querySelectorAll("a").length ?? 0;
      if (n === last) return;
      last = n;
      w.__tabCounts.push([location.pathname, n]);
    }).observe(document, { childList: true, subtree: true });
  });
const tabCountsAt = (page: Page, prefix: string) =>
  page.evaluate((p) => (window as unknown as { __tabCounts: [string, number][] }).__tabCounts.filter(([path, n]) => n > 0 && path.startsWith(p)).map(([, n]) => n), prefix);
const opened = (publicId: string) => sql(`select count(*) from public.inquiries i join public.listings l on l.id = i.listing_id where l.public_id = '${publicId}' and i.owner_opened_at is not null`);

/** La caché de Query guardada en IndexedDB, como texto. */
const persistedCache = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const req = indexedDB.open("3bstays");
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const get = req.result.transaction("query-cache").objectStore("query-cache").get("3bstays-query");
          get.onsuccess = () => resolve(String(get.result ?? ""));
          get.onerror = () => reject(get.error);
        };
      }),
  );

test.beforeAll(async () => {
  h = await postgrestHarness();
  await h.reset();
});

test.beforeEach(async ({ page }) => {
  await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
  await injectSession(page, "owner");
});

test("6 · /propietario/consultas lleva a Consultas sin quedar en el historial", async ({ page }) => {
  await h.seed({ status: "draft", draft: { title: "Borrador del propietario" } }); // sin casas, la zona lleva a Explorar
  await page.goto("/explorar");
  const before = await page.evaluate(() => history.length);
  await page.goto("/propietario/consultas");
  await expect(page).toHaveURL(/\/propietario\/actividad$/);
  await expect(page.getByRole("heading", { level: 1, name: "Consultas" })).toBeAttached();
  expect(await page.evaluate(() => history.length)).toBe(before + 1);
});

test("/propietario lleva a Mis casas sin quedar en el historial", async ({ page }) => {
  await page.goto("/explorar");
  const before = await page.evaluate(() => history.length);
  await page.goto("/propietario");
  await expect(page).toHaveURL(/\/propietario\/casas$/);
  expect(await page.evaluate(() => history.length)).toBe(before + 1);
});

test("7 · con una casa activa: Consultas solo con las consultas; las cifras, en el detalle de la casa", async ({ page }) => {
  await h.reset();
  casa = await h.seed({ status: "active", photos: 5, draft: { title: "Casa Cocles" } });
  await h.recordViews(casa.publicId, 4);
  await h.recordTaps(casa.publicId, 2);
  await h.inquiries("other").create(casa.publicId, { arrival: null, departure: null, people: 2, message: "Hola, ¿está libre?" });
  await page.goto("/propietario/actividad");
  await expect(page.getByTestId("activity-figures")).toHaveCount(0);
  await expect(page.locator("article.activity-card")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: "Últimas consultas" })).toHaveCount(0);
  const inquiry = page.getByRole("article").filter({ hasText: "Hola, ¿está libre?" });
  await expect(inquiry.getByRole("heading", { name: TEST_NAMES.other })).toBeVisible();
  await expect(inquiry).toContainText("AP");
  await expect(inquiry).toContainText("sin fechas · 2 personas");
  await expect(inquiry.getByTestId("inquiry-house")).toHaveCount(0);
  await expect(page.getByTestId("house-picker-trigger")).toHaveCount(0);
  await expect(page.getByTestId("inquiries-new")).toHaveText("Sin consultas nuevas");
  await expect(nav(page).getByRole("link", { name: "Consultas", exact: true })).toHaveAttribute("aria-current", "page");
  await expect.poll(() => opened(casa.publicId)).toBe("1");
  await page.screenshot({ path: "test-results/consultas-una-casa.png", fullPage: true });

  // «Abrir WhatsApp»: abre el chat con el cliente, sin texto.
  const wa = await catchWhatsApp(page);
  await inquiry.getByRole("button", { name: "Abrir WhatsApp" }).click();
  await expect.poll(() => wa).toEqual([`https://wa.me/${TEST_PHONES.other.replace(/\D/g, "")}`]);
  await expect.poll(() => opened(casa.publicId)).toBe("1");
  await backFromWhatsApp(page);
  await expect(page.getByRole("heading", { level: 1, name: "Consultas" })).toBeAttached();
  await expect(inquiry.getByText("Nueva", { exact: true })).toHaveCount(0);
  await expect(nav(page).getByTestId("inquiries-badge")).toHaveCount(0);
  await expect(nav(page).getByRole("link", { name: "Consultas" })).toBeVisible();

  // Sin red: la pantalla visitada se pinta desde la caché del dispositivo.
  await page.reload();
  await expect(inquiry).toBeVisible();
  await page.waitForTimeout(1500); // la caché se guarda en IndexedDB con un pequeño retraso
  await page.route("**/rest/v1/**", (route) => route.abort());
  await page.reload();
  await expect(page.getByRole("article").filter({ hasText: "Hola, ¿está libre?" })).toBeVisible();
  await page.unroute("**/rest/v1/**");

  // Las cifras de 30 días, en el detalle de la casa, bajo la portada.
  await page.goto(`/propietario/casas/${casa.id}`);
  await expect(page.getByTestId("listing-stats")).toHaveText(/Últimos 30 días.*4\s*visitas.*2\s*toques en WhatsApp.*1\s*consulta/s);
});

test("7a · si las cifras no cargan, Consultas no se entera", async ({ page }) => {
  // P. ej. la app desplegada antes que la migración: la función no existe (404 de PostgREST).
  await page.route("**/rest/v1/rpc/owner_activity*", (route) =>
    route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ code: "PGRST202", message: "Could not find the function public.owner_activity" }) }),
  );
  await page.goto("/propietario/actividad");
  const inquiry = page.getByRole("article").filter({ hasText: "Hola, ¿está libre?" });
  await expect(inquiry.getByRole("button", { name: "Abrir WhatsApp" })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("7b · con dos casas: ninguna tarjeta de casa en Consultas; la que no está activa no aparece", async ({ page }) => {
  await h.seed({ status: "review", draft: { title: "Casa en revisión" } });
  await page.goto("/propietario/actividad");
  await expect(page.getByRole("article").filter({ hasText: "Hola, ¿está libre?" })).toBeVisible();
  await expect(page.locator(".activity-card")).toHaveCount(0);
  await expect(page.getByText("Casa en revisión")).toHaveCount(0);
  await page.screenshot({ path: "test-results/consultas-dos-casas.png", fullPage: true });
});

test("7c · sin consultas: un único mensaje", async ({ page }) => {
  const { data: other } = await serviceClient().from("profiles").select("id").eq("phone", TEST_PHONES.other).single();
  await serviceClient().from("listings").delete().eq("owner_id", other!.id);
  await h.seed({ status: "draft", as: "other", draft: { title: "Borrador de Ana" } });
  await injectSession(page, "other");
  await page.goto("/propietario/actividad");
  await expect(page.getByText("Cuando alguien le escriba por WhatsApp desde la ficha de su casa, aparecerá aquí.")).toBeVisible();
  await expect(page.getByTestId("activity-figures")).toHaveCount(0);
  await expect(page.getByText("Borrador", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: "test-results/consultas-vacia.png" });
});

test("el contador se va con la sesión y la consulta privada sale de la caché del dispositivo", async ({ page }) => {
  await h.inquiries("other").create(casa.publicId, { arrival: null, departure: null, people: null, message: "Otra pregunta" });
  await page.goto("/propietario/casas");
  await expect(nav(page).getByTestId("inquiries-badge")).toHaveText("1");
  // Cuenta es la pestaña de la derecha (C4): la barra sigue a la vista.
  await accountButton(page).click();
  await expect(page).toHaveURL(/\/cuenta$/);
  await expect(accountButton(page)).toHaveAttribute("aria-current", "page");
  await expect.poll(() => persistedCache(page)).toContain('"inquiries"');
  await signOut(page);
  await expect(page.getByRole("button", { name: "Cerrar sesión" })).toHaveCount(0);
  await expect(nav(page).getByRole("link")).toHaveText(["Explorar", "Favoritos", "Ingresar"]);
  await expect
    .poll(
      async () => {
        const c = await persistedCache(page);
        return c.length > 0 && !c.includes('"inquiries"') && !c.includes('"own-activity"');
      },
      { timeout: 5000 },
    )
    .toBe(true);
  await expect(page.getByTestId("inquiries-badge")).toHaveCount(0);
});

test("3 · una casa: la lista con una sola tarjeta; tocarla abre su detalle", async ({ page }) => {
  h = await postgrestHarness(); // la prueba anterior cerró la sesión del propietario también en el servidor
  await h.reset();
  const casa = await h.seed({ status: "active", draft: { title: "Casa Puerto Viejo" } });
  await page.goto("/propietario/casas");
  await expect(page.getByRole("heading", { level: 1, name: "Mis casas" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Volver" })).toHaveCount(0);
  await expect(page.getByRole("article")).toHaveCount(1);
  const only = page.getByRole("article");
  await expect(only.getByTestId("card-label")).toHaveText("Activa");
  // Compartir conserva el verde; con una sola casa se usan las pestañas de Calendario y Consultas.
  await expect(only.getByRole("button", { name: "Compartir ficha" })).toHaveClass(/btn-primary/);
  await expect(only.getByRole("link", { name: "Calendario" })).toHaveCount(0);
  await expect(only.getByRole("link", { name: "Consultas" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Nueva" })).toHaveAttribute("href", "/propietario/publicar");
  await expect(page.getByRole("link", { name: "Añadir otra casa" })).toHaveCount(0);
  await page.screenshot({ path: "test-results/mis-casas-una.png", fullPage: true });
  await only.getByRole("link", { name: "Casa Puerto Viejo" }).click();
  await expect(page).toHaveURL(new RegExp(`/propietario/casas/${casa.id}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Casa Puerto Viejo" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver ficha" })).toHaveAttribute("href", `/casa/${casa.publicId}`);

  await h.seed({ status: "draft", draft: { title: "Casa Cocles" } });
  await page.goto("/propietario/casas");
  await expect(page.getByRole("heading", { level: 1, name: "Mis casas" })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(2);
  await expect(page.getByTestId("resume-card")).toHaveCount(0);
  await expect(page.getByTestId("pay-notice")).toHaveCount(0);
  await page.screenshot({ path: "test-results/mis-casas-lista.png", fullPage: true });
});

test("la casa abierta desde la lista se queda aunque se descarte la otra", async ({ page }) => {
  const { data } = await serviceClient().from("listings").select("id, title, status").eq("owner_id", h.ownerId("owner"));
  const active = data!.find((l) => l.status === "active")!;
  const draft = data!.find((l) => l.status === "draft")!;
  await page.goto("/propietario/casas");
  await page.getByRole("article").filter({ hasText: "Casa Puerto Viejo" }).getByRole("link", { name: "Casa Puerto Viejo" }).click();
  await expect(page).toHaveURL(new RegExp(`/propietario/casas/${active.id}$`));
  await serviceClient().from("listings").delete().eq("id", draft.id);
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/propietario/casas/${active.id}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Casa Puerto Viejo" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Volver" })).toBeVisible();
  await page.getByRole("link", { name: "Volver" }).click();
  await expect(page).toHaveURL(/\/propietario\/casas$/);
  await expect(page.getByRole("heading", { level: 1, name: "Mis casas" })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Volver" })).toHaveCount(0);
});

test("1 · sin sesión: tres pestañas, «Ingresar» a la derecha", async ({ page }) => {
  await page.evaluate(() => localStorage.clear());
  await page.goto("/explorar");
  await expect(nav(page).getByRole("link")).toHaveText(["Explorar", "Favoritos", "Ingresar"]);
  await expect(page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", { name: "Ingresar" })).toBeVisible();
  await page.goto("/favoritos");
  await expect(page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", { name: "Ingresar" })).toBeVisible();
  await page.goto("/propietario/casas");
  await expect(page).toHaveURL(/\/cuenta\?next=%2Fpropietario%2Fcasas$/);
});

test("2 · sin casas: tres pestañas; «¿Quiere publicar su casa gratis?» crea un borrador, cinco pestañas y Mis casas muestra el borrador", async ({ page }) => {
  await h.reset(); // ninguna casa de «other»
  await signInByUi(page, "8888 1234");
  await expect(page).toHaveURL(/\/explorar$/);
  await expect(nav(page).getByRole("link")).toHaveText(["Explorar", "Favoritos", "Cuenta"]);
  // Sin casas, la zona del propietario lleva a Explorar.
  await page.goto("/propietario/casas");
  await expect(page).toHaveURL(/\/explorar$/);
  await accountButton(page).click();
  await expect(page).toHaveURL(/\/cuenta$/);
  await expect(page.locator("main").getByRole("link", { name: /Favoritos/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Buscar una casa/ })).toHaveCount(0);
  await page.getByTestId("publish-promo-row").click();
  await expect(page).toHaveURL(/\/propietario\/publicar\/[0-9a-f-]+\/1$/);
  await page.goto("/propietario/casas");
  await expect(nav(page).getByRole("link")).toHaveText(OWNER_TABS);
  // Una casa borrador: la lista con su tarjeta, que es el único sitio donde sale (sin aviso arriba).
  await expect(page.getByRole("heading", { level: 1, name: "Mis casas" })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("article").getByRole("link", { name: "Seguir publicando" })).toHaveClass(/btn-ghost/);
  await expect(page.getByRole("article").getByRole("button", { name: "Descartar" })).toBeVisible();
  await expect(page.getByTestId("resume-card")).toHaveCount(0);
  await expect(page.getByTestId("pay-notice")).toHaveCount(0);
  await page.goto("/cuenta");
  await expect(page.getByRole("heading", { level: 1, name: "Cuenta" })).toBeAttached();
  await expect(page.getByText("Próximo cobro")).toBeVisible();
  await expect(page.getByTestId("publish-promo-row")).toHaveCount(0);
  // El propietario tiene Favoritos dentro de Cuenta (C4).
  await expect(page.getByTestId("favorites-row")).toBeVisible();
});

test("el propietario entra y la barra no salta; al volver a abrir, cinco desde el primer pintado", async ({ page }) => {
  await h.reset();
  await h.seed({ status: "active", draft: { title: "Casa Cahuita" } });
  await recordTabCounts(page);
  await signInByUi(page, "8777 0001");
  await expect(page).toHaveURL(/\/propietario\/casas$/);
  await expect(nav(page).getByRole("link")).toHaveText(OWNER_TABS);
  expect(await tabCountsAt(page, "/propietario/casas")).toEqual([5]);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Mis casas" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Casa Cahuita" })).toBeVisible();
  expect(await tabCountsAt(page, "/")).toEqual([5]);
});

test("si la lista de casas tarda al ingresar, a los 5 s entra a Explorar y la barra crece cuando llega", async ({ page }) => {
  await h.reset();
  await h.seed({ status: "active", draft: { title: "Casa Cahuita" } });
  let held = false;
  await page.route("**/rest/v1/listings?*", async (route) => {
    if (route.request().method() === "GET" && !held) {
      held = true;
      await new Promise((resolve) => setTimeout(resolve, 9000));
    }
    await route.fallback();
  });
  await signInByUi(page, "8777 0001");
  await expect(page).toHaveURL(/\/explorar$/, { timeout: 7000 });
  await expect(nav(page).getByRole("link")).toHaveText(OWNER_TABS, { timeout: 10_000 });
  await page.unroute("**/rest/v1/listings?*");
});

test("4 · al descartar las dos casas vuelve a dos pestañas y a Explorar", async ({ page }) => {
  await h.reset();
  await h.seed({ status: "draft", draft: { title: "Borrador uno" } });
  await h.seed({ status: "draft", draft: { title: "Borrador dos" } });
  await page.goto("/propietario/casas");
  await expect(nav(page).getByRole("link")).toHaveText(OWNER_TABS_MANY);
  await expect(page.getByRole("article")).toHaveCount(2);
  await page.getByRole("article").filter({ hasText: "Borrador uno" }).getByRole("button", { name: "Descartar" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Descartar" }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Borrador dos" })).toBeVisible();
  await expect(nav(page).getByRole("link")).toHaveText(OWNER_TABS);
  await page.getByRole("article").getByRole("button", { name: "Descartar" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Descartar" }).click();
  await expect(page).toHaveURL(/\/explorar$/);
  await expect(nav(page).getByRole("link")).toHaveText(["Explorar", "Favoritos", "Cuenta"]);
});

test("Cuenta es la pestaña de la derecha; lo que se abre desde ella vuelve a Cuenta", async ({ page }) => {
  await h.reset();
  await h.seed({ status: "active", draft: { title: "Casa Manzanillo" } });
  await page.goto("/propietario/calendario");
  await expect(nav(page).getByRole("link")).toHaveText(OWNER_TABS);
  await accountButton(page).click();
  await expect(page).toHaveURL(/\/cuenta$/);
  await expect(page.getByRole("heading", { level: 1, name: "Cuenta" })).toBeAttached();
  await expect(accountButton(page)).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "Volver" })).toHaveCount(0);
  const volver = () => page.getByRole("link", { name: "Volver" }).click();
  await page.getByRole("link", { name: /Ayuda por WhatsApp/ }).click();
  await expect(page).toHaveURL(/\/ayuda$/);
  await volver();
  await expect(page).toHaveURL(/\/cuenta$/);
  await page.getByTestId("subscription-card").getByRole("link", { name: /Ver suscripciones/ }).click();
  await expect(page).toHaveURL(/\/propietario\/suscripcion$/);
  await volver();
  await expect(page).toHaveURL(/\/cuenta$/);
  // Editar abre los datos a pantalla completa y «Listo» vuelve a la pestaña.
  await page.getByRole("link", { name: "Editar", exact: true }).click();
  await expect(nav(page)).toHaveCount(0);
  await page.getByRole("link", { name: "Listo", exact: true }).click();
  await expect(page).toHaveURL(/\/cuenta$/);
  await expect(accountButton(page)).toHaveAttribute("aria-current", "page");
});

test("5 · ₡ → $ en la fila de chips cambia los precios de Explorar y se mantiene al recargar; la ficha muestra las dos monedas", async ({ page }) => {
  await h.reset();
  await h.seed({ status: "active", draft: { title: "Casa Playa Negra", nightlyPriceCrc: 95000 } });
  await page.goto("/explorar");
  await page.locator(".chiprow").getByRole("button", { name: "Dólares" }).click();
  await expect(page.getByRole("link", { name: /Casa Playa Negra/ })).toContainText("$");
  await page.getByRole("link", { name: /Casa Playa Negra/ }).click();
  await expect(page.getByTestId("main-price")).toHaveText(/^₡/);
  await expect(page.getByTestId("price-usd")).toHaveText(/^≈ \$/);
  await expect(page.getByRole("group", { name: "Moneda de los precios" })).toHaveCount(0);
  await page.goto("/explorar");
  await expect(page.getByRole("link", { name: /Casa Playa Negra/ })).toContainText("$");
  await page.reload();
  await expect(page.locator(".chiprow").getByRole("button", { name: "Dólares" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("link", { name: /Casa Playa Negra/ })).toContainText("$");
});

// Revisión UX 2026-10-29 (C4, T2), y desde el 2026-11-03 tampoco Favoritos: ninguna pestaña lleva barra de arriba con el
// logo. Favoritos pone «₡ | $» en la fila de la cuenta; Mis casas, Calendario, Consultas y Cuenta van sin título visible;
// Explorar trae su cabecera con la búsqueda a todo el ancho.
test("sin barra superior con el logo en ninguna pestaña; Favoritos lleva «₡ | $» junto a la cuenta", async ({ page }) => {
  await h.reset();
  await h.seed({ status: "active", draft: { title: "Casa Puerto Viejo" } });
  const banner = page.getByRole("banner");
  const checkFavorites = async () => {
    await expect(page.getByTestId("favorites-count")).toBeVisible();
    await expect(banner).toHaveCount(0);
    await expect(page.getByRole("link", { name: "3bstays, inicio" })).toHaveCount(0);
    const currency = page.getByRole("group", { name: "Moneda de los precios" });
    await expect(currency).toBeVisible();
    for (const b of await currency.getByRole("button").all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  };
  await page.goto("/explorar");
  await expect(page.locator(".explore-top").getByRole("link", { name: "Cuenta" })).toHaveCount(0);
  await expect(banner).toHaveCount(0);
  const publicId = (await page.locator("a.listing-card").first().getAttribute("href"))!.split("/").pop();
  await page.evaluate((id) => localStorage.setItem("3bstays-favoritos", JSON.stringify([{ publicId: id, savedAt: new Date().toISOString() }])), publicId);
  await page.goto("/favoritos");
  await checkFavorites();
  for (const path of ["/propietario/casas", "/propietario/calendario", "/propietario/actividad", "/cuenta"]) {
    await page.goto(path);
    await expect(page.locator("main h1")).toHaveClass(/sr-only/);
    await expect(banner).toHaveCount(0);
  }
  // Filtros es una pantalla completa con su cabecera: sin barra superior ni selector.
  await page.goto("/explorar/filtros");
  await expect(page.getByRole("heading", { level: 1, name: "Filtros" })).toBeVisible();
  await expect(banner).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Moneda de los precios" })).toHaveCount(0);
});

// La barra de abajo, plana y pegada al borde (Daniel, 2026-11-04, tras probar la píldora de la tanda 1): a todo el ancho, 84 px
// más el área segura, opaca, con la línea fina arriba e iconos de 26 px con su etiqueta; la elegida, en terracota.
test("densidad: márgenes de 16 px y la barra de abajo plana, pegada al borde, con iconos de 26 px y etiquetas", async ({ page }) => {
  await h.reset();
  await h.seed({ status: "active", draft: { title: "Casa Cahuita" } });
  await page.goto("/explorar");
  await expect(nav(page).getByRole("link")).toHaveCount(5);
  const padding = (selector: string) => page.locator(selector).first().evaluate((el) => getComputedStyle(el).paddingLeft);
  expect(await padding("main.view")).toBe("16px");
  for (const svg of await page.locator(".tabbar .nav svg").all()) await expect(svg).toHaveAttribute("width", "26");
  const vp = page.viewportSize()!;
  const bar = (await nav(page).boundingBox())!;
  expect(bar.x).toBe(0);
  expect(bar.width).toBe(Math.min(vp.width, 560));
  expect(bar.height).toBe(84);
  expect(bar.y + bar.height).toBe(vp.height);
  const look = await nav(page).evaluate((el) => {
    const c = getComputedStyle(el);
    return { radius: c.borderTopLeftRadius, blur: c.backdropFilter, border: `${c.borderTopWidth} ${c.borderLeftWidth}`, shadow: c.boxShadow, bg: c.backgroundColor };
  });
  expect(look).toEqual({ radius: "0px", blur: "none", border: "2px 0px", shadow: "none", bg: await page.evaluate(() => getComputedStyle(document.body).backgroundColor) });
  // Cada pestaña con su etiqueta a la vista.
  for (const link of await nav(page).getByRole("link").all()) {
    const [l, label] = [(await link.boundingBox())!, (await link.locator("span").boundingBox())!];
    expect(label.x).toBeGreaterThanOrEqual(l.x - 0.5);
    expect(label.x + label.width).toBeLessThanOrEqual(l.x + l.width + 0.5);
  }
  const active = page.locator('.tabbar .nav[aria-current="page"]');
  await expect(active).toHaveCount(1);
  const on = await active.evaluate((el) => ({ color: getComputedStyle(el).color, icon: getComputedStyle(el.querySelector("svg")!).color }));
  expect(on).toEqual({ color: "rgb(180, 76, 48)", icon: "rgb(214, 92, 60)" });
  // Escondida (html.chrome-away, al bajar; el desplazamiento lo prueban calendario.spec y explorar.spec) sale entera por abajo y
  // no responde; al quitarse, vuelve a su sitio.
  await page.evaluate(() => document.documentElement.classList.add("chrome-away"));
  await expect.poll(async () => (await nav(page).boundingBox())!.y).toBeGreaterThanOrEqual(vp.height - 0.5);
  expect(await nav(page).evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("none");
  await page.evaluate(() => document.documentElement.classList.remove("chrome-away"));
  await expect.poll(async () => (await nav(page).boundingBox())!.y).toBe(vp.height - 84);
  // El icono del filtro queda fuera del nombre accesible y el botón anuncia su estado.
  await page.goto("/explorar/filtros");
  const pool = page.getByRole("button", { name: "Piscina", exact: true });
  await pool.press("Space");
  await expect(pool).toHaveAttribute("aria-pressed", "true");
  await expect(pool.locator("svg").first()).toHaveAttribute("aria-hidden", "true");
  await expect(pool.locator(".feature-check svg")).toBeVisible();
});

// Los avisos se apoyan a 12 px sobre la barra de abajo plana (`--chrome-bottom`) y, si se esconde, a 12 px del borde.
test("el aviso (toast) y el de versión nueva siguen a la barra de abajo", async ({ page }) => {
  await h.reset();
  await h.seed({ status: "active", draft: { title: "Casa Cahuita" } });
  await page.goto("/propietario/casas");
  await expect(nav(page)).toBeVisible();
  const toast = page.locator(".toast");
  await page.evaluate(() => {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = "Guardado.";
    document.body.append(el);
  });
  const vp = page.viewportSize()!;
  const bar = (await nav(page).boundingBox())!;
  expect(Math.round(bar.y - ((await toast.boundingBox())!.y + (await toast.boundingBox())!.height))).toBe(12);
  expect(await toast.evaluate((el) => getComputedStyle(el).borderTopLeftRadius)).toBe("12px");
  await page.evaluate(() => document.documentElement.classList.add("chrome-away"));
  await expect.poll(async () => Math.round(vp.height - ((await toast.boundingBox())!.y + (await toast.boundingBox())!.height))).toBe(12);
  await page.evaluate(() => document.documentElement.classList.remove("chrome-away"));
  expect(await page.evaluate(() => {
    const el = document.createElement("div");
    el.className = "update-banner";
    document.body.append(el);
    const b = getComputedStyle(el).bottom;
    el.remove();
    return b;
  })).toBe(`${vp.height - bar.y + 12}px`);
});

// Cambiar de pestaña no deja rastro en el historial (2026-11-03, Daniel): «Atrás» (gesto del sistema o botón del navegador)
// solo vuelve dentro de la pestaña actual; desde la raíz de una pestaña sale de la app, como antes.
test.describe("«Atrás» y las pestañas", () => {
  // Fuera de la app: la página en blanco o /robots.txt, donde injectSession deja la sesión antes de entrar.
  const leftApp = (page: Page) => expect(page.url()).toMatch(/^about:blank$|\/robots\.txt$/);
  test.beforeAll(async () => {
    h = await postgrestHarness(); // otra prueba pudo cerrar la sesión del propietario en el servidor
    await h.reset();
    casa = await h.seed({ status: "active", draft: { title: "Casa Atrás" } });
  });

  test("Calendario → Explorar con la barra: «Atrás» no vuelve a Calendario y sale de la app", async ({ page }) => {
    await page.goto("/propietario/casas");
    await expect(nav(page).getByRole("link")).toHaveText(OWNER_TABS);
    const before = await page.evaluate(() => history.length);
    await nav(page).getByRole("link", { name: "Calendario" }).click();
    await expect(page).toHaveURL(/\/propietario\/calendario/);
    await nav(page).getByRole("link", { name: "Explorar" }).click();
    await expect(page).toHaveURL(/\/explorar/);
    await expect(nav(page).getByRole("link", { name: "Explorar" })).toHaveAttribute("aria-current", "page");
    expect(await page.evaluate(() => history.length)).toBe(before);
    await page.goBack();
    await expect(page).not.toHaveURL(/\/propietario\//);
    leftApp(page);
  });

  test("Explorar → ficha: «Atrás» vuelve a Explorar, y otro «Atrás» sale (no a la pestaña de antes)", async ({ page }) => {
    await page.goto("/propietario/calendario");
    await nav(page).getByRole("link", { name: "Explorar" }).click();
    await expect(page).toHaveURL(/\/explorar/);
    await page.getByRole("link", { name: /Casa Atrás/ }).first().click();
    await expect(page).toHaveURL(new RegExp(`/casa/${casa.publicId}$`));
    await expect(page.getByRole("heading", { level: 1, name: "Casa Atrás" })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/explorar/);
    await expect(page.getByRole("link", { name: /Casa Atrás/ }).first()).toBeVisible();
    await page.goBack();
    leftApp(page);
  });

  test("Mis casas: el detalle suma historial; «Calendario» de la tarjeta cambia de pestaña sin dejar rastro", async ({ page }) => {
    // El acceso en la tarjeta solo aparece con varias casas; con una se usa la pestaña (caso 3).
    await h.seed({ status: "active", draft: { title: "Segunda casa del Caribe" } });
    await page.goto("/explorar");
    await nav(page).getByRole("link", { name: "Mis casas", exact: true }).click();
    await expect(page).toHaveURL(/\/propietario\/casas$/);
    await expect(page.getByRole("article")).toHaveCount(2);
    const card = page.getByRole("article").filter({ hasText: "Casa Atrás" });
    await card.getByRole("link", { name: "Casa Atrás" }).click();
    await expect(page).toHaveURL(new RegExp(`/propietario/casas/${casa.id}$`));
    await page.goBack();
    await expect(page).toHaveURL(/\/propietario\/casas$/);
    await card.getByRole("link", { name: "Calendario" }).click();
    await expect(page).toHaveURL(new RegExp(`/propietario/calendario\\?casa=${casa.id}`));
    await expect(nav(page).getByRole("link", { name: "Calendario" })).toHaveAttribute("aria-current", "page");
    await page.goBack();
    leftApp(page);
  });

  test("Favoritos vacío → «Explorar casas» cambia de pestaña sin dejar rastro; Favoritos ya no lleva el logo arriba", async ({ page }) => {
    await page.goto("/favoritos");
    // Sin barra superior con el logo, como las demás pestañas (2026-11-03).
    await expect(page.getByRole("link", { name: "3bstays, inicio" })).toHaveCount(0);
    await page.getByRole("link", { name: "Explorar casas" }).click();
    await expect(page).toHaveURL(/\/explorar/);
    await page.goBack();
    leftApp(page);
  });

  // Ids de URL del asistente: 1, 2, 4–9 (el 3 viejo lleva al 2); tras «¿Dónde está su casa?» (2) viene el 4.
  test("publicar: del paso siguiente, «Atrás» vuelve al paso 2 como siempre", async ({ page }) => {
    const draft = await h.seed({ status: "draft", draft: { title: "Borrador Atrás" } });
    const step = (n: number) => new RegExp(`/propietario/publicar/${draft.id}/${n}$`);
    await page.goto(`/propietario/publicar/${draft.id}/2`);
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page).toHaveURL(step(4));
    await page.goBack();
    await expect(page).toHaveURL(step(2));
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page).toHaveURL(step(4));
    await page.getByRole("link", { name: "Atrás" }).click();
    await expect(page).toHaveURL(step(2));
  });
});

test.describe("en un teléfono de 375 px", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("las cinco pestañas de la barra caben con su etiqueta entera", async ({ page }) => {
    await h.reset();
    await h.seed({ status: "active", draft: { title: "Casa Cahuita" } });
    await page.goto("/explorar");
    await expect(nav(page).getByRole("link")).toHaveCount(5);
    const boxes = await nav(page).getByRole("link").evaluateAll((els) => els.map((el) => {
      const [a, s] = [el.getBoundingClientRect(), el.querySelector("span")!];
      return { left: a.left, right: a.right, label: s.getBoundingClientRect().toJSON() as DOMRect, cut: s.scrollWidth > s.clientWidth + 0.5 };
    }));
    for (const [i, b] of boxes.entries()) {
      expect(b.cut).toBe(false);
      expect(b.label.left).toBeGreaterThanOrEqual(b.left - 0.5);
      expect(b.label.right).toBeLessThanOrEqual(b.right + 0.5);
      if (i) expect(b.label.left).toBeGreaterThanOrEqual(boxes[i - 1]!.label.right);
    }
  });

  test("Explorar: la búsqueda a todo el ancho y la fila de Favoritos (cuenta y «₡ | $») caben, con y sin sesión, sin scroll horizontal", async ({ page }) => {
    await h.reset();
    await h.seed({ status: "active", draft: { title: "Casa Cahuita" } });
    const fits = async () => {
      const count = (await page.getByTestId("favorites-count").boundingBox())!;
      const currency = (await page.getByRole("group", { name: "Moneda de los precios" }).boundingBox())!;
      const header = (await page.locator(".header-root").boundingBox())!;
      expect(count.x).toBeGreaterThanOrEqual(0);
      expect(count.x + count.width).toBeLessThanOrEqual(currency.x);
      expect(currency.x + currency.width).toBeCloseTo(header.x + header.width, 0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    };
    const exploreFits = async () => {
      const pill = (await page.locator(".explore-top .search-pill").boundingBox())!;
      // Tarjeta flotante a 12 px de cada borde (tarjetas flotantes, tanda 1).
      expect(pill.x).toBe(12);
      expect(pill.x + pill.width).toBe(375 - 12);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    };
    const saveFirst = async () => {
      await expect(page.locator("a.listing-card").first()).toBeVisible();
      await page.evaluate(() => {
        const id = document.querySelector("a.listing-card")!.getAttribute("href")!.split("/").pop();
        localStorage.setItem("3bstays-favoritos", JSON.stringify([{ publicId: id, savedAt: new Date().toISOString() }]));
      });
    };
    await page.goto("/explorar");
    await exploreFits();
    await saveFirst();
    await page.goto("/favoritos");
    await fits();
    await page.evaluate(() => localStorage.clear());
    await page.goto("/explorar");
    await exploreFits();
    await saveFirst();
    await page.goto("/favoritos");
    await fits();
    await page.screenshot({ path: "test-results/barra-375-sin-sesion.png" });
  });
});
