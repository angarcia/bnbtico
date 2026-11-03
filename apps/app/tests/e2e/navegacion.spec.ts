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
        const req = indexedDB.open("bnbtico");
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const get = req.result.transaction("query-cache").objectStore("query-cache").get("bnbtico-query");
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
  await expect(page.getByTestId("inquiries-new")).toHaveText("1 consulta nueva");
  await expect(page.getByTestId("activity-figures")).toHaveCount(0);
  await expect(page.locator("article.activity-card")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: "Últimas consultas" })).toHaveCount(0);
  const inquiry = page.getByRole("article").filter({ hasText: "Hola, ¿está libre?" });
  await expect(inquiry.getByRole("heading", { name: TEST_NAMES.other })).toBeVisible();
  await expect(inquiry).toContainText("AP");
  await expect(inquiry).toContainText("sin fechas · 2 personas");
  await expect(inquiry.getByTestId("inquiry-house")).toHaveText("Casa Cocles");
  await expect(inquiry.getByText("Nueva", { exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "Filtrar por casa" })).toHaveCount(0);
  await expect(nav(page).getByTestId("inquiries-badge")).toHaveText("1");
  await expect(nav(page).getByRole("link", { name: "Consultas, 1 nueva" })).toHaveAttribute("aria-current", "page");
  await page.screenshot({ path: "test-results/consultas-una-casa.png", fullPage: true });

  // «Abrir WhatsApp»: el chat con el cliente, sin texto; la consulta deja de ser nueva y el contador de la pestaña se va.
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
  await page.goto("/propietario/actividad");
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
  await expect(only.getByRole("button", { name: "Compartir ficha" })).toHaveClass(/btn-primary/);
  await expect(only.getByRole("link", { name: "Calendario" })).toHaveClass(/btn-ghost/);
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
  page.on("dialog", (d) => void d.accept());
  await page.goto("/propietario/casas");
  await expect(nav(page).getByRole("link")).toHaveText(OWNER_TABS_MANY);
  await expect(page.getByRole("article")).toHaveCount(2);
  await page.getByRole("article").filter({ hasText: "Borrador uno" }).getByRole("button", { name: "Descartar" }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Borrador dos" })).toBeVisible();
  await expect(nav(page).getByRole("link")).toHaveText(OWNER_TABS);
  await page.getByRole("article").getByRole("button", { name: "Descartar" }).click();
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
  await page.getByTestId("subscription-card").getByRole("link", { name: "Ver detalle" }).click();
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

// Revisión UX 2026-10-29 (C4, T2): solo Favoritos lleva la barra de arriba (logo y «₡ | $»); Mis casas, Calendario, Consultas
// y Cuenta van sin ella ni título visible; Explorar trae su cabecera con la búsqueda a todo el ancho.
test("la barra superior: solo en Favoritos, 56 px más el área segura, con el logo y «₡ | $»", async ({ page }) => {
  await h.reset();
  await h.seed({ status: "active", draft: { title: "Casa Puerto Viejo" } });
  const banner = page.getByRole("banner");
  const checkBar = async () => {
    await expect(banner).toHaveCount(1);
    expect((await banner.boundingBox())?.height).toBe(56);
    await expect(banner.getByRole("img", { name: "bnbtico" })).toBeVisible();
    await expect(banner.getByRole("group", { name: "Moneda de los precios" })).toBeVisible();
    for (const b of await banner.getByRole("button").all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  };
  await page.goto("/explorar");
  await expect(page.locator(".explore-top").getByRole("link", { name: "Cuenta" })).toHaveCount(0);
  await expect(banner).toHaveCount(0);
  await page.goto("/favoritos");
  await checkBar();
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
  // Sin sesión, la misma barra en Favoritos (la cuenta va abajo).
  await page.evaluate(() => localStorage.clear());
  await page.goto("/favoritos");
  await checkBar();
});

test("densidad: márgenes de 16 px e iconos de 26 px en la barra", async ({ page }) => {
  await h.reset();
  await h.seed({ status: "active", draft: { title: "Casa Cahuita" } });
  await page.goto("/explorar");
  await expect(nav(page).getByRole("link")).toHaveCount(5);
  const padding = (selector: string) => page.locator(selector).first().evaluate((el) => getComputedStyle(el).paddingLeft);
  expect(await padding("main.view")).toBe("16px");
  expect(await padding(".explore-top")).toBe("16px");
  for (const svg of await page.locator(".tabbar .nav svg").all()) await expect(svg).toHaveAttribute("width", "26");
  await page.goto("/favoritos");
  expect(await padding(".topbar")).toBe("16px");
  await page.goto("/explorar");
  const active = page.locator('.tabbar .nav[aria-current="page"]');
  await expect(active).toHaveCount(1);
  expect(await active.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(180, 76, 48)");
  const monthly = page.getByRole("button", { name: "Solo alquiler mensual" });
  await monthly.click();
  await expect(monthly).toHaveAttribute("aria-pressed", "true");
  // El ✓ se ve pero no entra en el nombre accesible (texto alternativo vacío).
  expect(await monthly.evaluate((el) => getComputedStyle(el, "::before").content)).toMatch(/^"✓ "/);
  await expect(page.getByRole("button", { name: "Solo alquiler mensual", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test.describe("en un teléfono de 375 px", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("Explorar: la búsqueda a todo el ancho y la barra de Favoritos caben, con y sin sesión, sin scroll horizontal", async ({ page }) => {
    const banner = page.getByRole("banner");
    const fits = async () => {
      const logo = (await banner.getByRole("img", { name: "bnbtico" }).boundingBox())!;
      const currency = (await banner.getByRole("group", { name: "Moneda de los precios" }).boundingBox())!;
      expect(logo.x).toBeGreaterThanOrEqual(0);
      expect(logo.x + logo.width).toBeLessThanOrEqual(currency.x);
      expect(currency.x + currency.width).toBeLessThanOrEqual(375);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    };
    const exploreFits = async () => {
      const pill = (await page.locator(".explore-top .search-pill").boundingBox())!;
      expect(pill.x).toBeGreaterThanOrEqual(16);
      expect(pill.x + pill.width).toBeGreaterThan(375 - 16 - 2);
      expect(pill.x + pill.width).toBeLessThanOrEqual(375 - 16 + 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    };
    await page.goto("/explorar");
    await exploreFits();
    await page.goto("/favoritos");
    await fits();
    await page.evaluate(() => localStorage.clear());
    await page.goto("/explorar");
    await exploreFits();
    await page.goto("/favoritos");
    await fits();
    await page.screenshot({ path: "test-results/barra-375-sin-sesion.png" });
  });
});
