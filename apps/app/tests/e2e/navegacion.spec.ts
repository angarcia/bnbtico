import { expect, test, type Page } from "./helpers/test";
import type { Seeded } from "../contract/harness";
import { serviceClient, sql, TEST_NAMES, TEST_PHONES } from "../db/local";
import { postgrestHarness } from "../db/postgrest-harness";
import { enterCode, injectSession, signOut } from "./helpers/session";
import { backFromWhatsApp, catchWhatsApp } from "./helpers/whatsapp";

// Navegación simple: una sola barra que crece con las casas (dos pestañas sin casas, cinco con al menos una), Cuenta a
// pantalla completa, Mis casas (siempre en lista, también con una sola casa), Actividad (cifras de 30 días por casa y últimas
// consultas) y la vuelta de /propietario y /propietario/consultas.
// Contra Supabase local con las sesiones inyectadas (sin gastar SMS).
test.describe.configure({ mode: "serial" });

const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
let h: Awaited<ReturnType<typeof postgrestHarness>>;
let casa: Seeded;

const nav = (page: Page) => page.getByRole("navigation", { name: "Navegación principal" });
// Arriba a la derecha: en la barra superior o, en Explorar (sin barra), en su cabecera.
const accountButton = (page: Page) => page.getByRole("link", { name: "Cuenta", exact: true });
// Con una casa la pestaña dice «Mi casa»; con dos o más, «Mis casas».
const OWNER_TABS = ["Explorar", "Favoritos", "Mi casa", "Calendario", /^Actividad\d*$/];
const OWNER_TABS_MANY = ["Explorar", "Favoritos", "Mis casas", "Calendario", /^Actividad\d*$/];

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

test("6 · /propietario/consultas lleva a Actividad sin quedar en el historial", async ({ page }) => {
  await h.seed({ status: "draft", draft: { title: "Borrador del propietario" } }); // sin casas, la zona lleva a Explorar
  await page.goto("/explorar");
  const before = await page.evaluate(() => history.length);
  await page.goto("/propietario/consultas");
  await expect(page).toHaveURL(/\/propietario\/actividad$/);
  await expect(page.getByRole("heading", { level: 1, name: "Actividad" })).toBeVisible();
  expect(await page.evaluate(() => history.length)).toBe(before + 1);
});

test("/propietario lleva a Mis casas sin quedar en el historial", async ({ page }) => {
  await page.goto("/explorar");
  const before = await page.evaluate(() => history.length);
  await page.goto("/propietario");
  await expect(page).toHaveURL(/\/propietario\/casas$/);
  expect(await page.evaluate(() => history.length)).toBe(before + 1);
});

test("7 · con una casa activa: las tres cifras en grande y las últimas consultas", async ({ page }) => {
  await h.reset();
  casa = await h.seed({ status: "active", photos: 5, draft: { title: "Casa Cocles" } });
  await h.recordViews(casa.publicId, 4);
  await h.recordTaps(casa.publicId, 2);
  await h.inquiries("other").create(casa.publicId, { arrival: null, departure: null, people: 2, message: "Hola, ¿está libre?" });
  await page.goto("/propietario/actividad");
  await expect(page.getByText("Últimos 30 días")).toBeVisible();
  await expect(page.getByTestId("activity-figures")).toHaveText(/4\s*visitas.*2\s*toques en WhatsApp.*1\s*consulta/s);
  const own = page.locator("article.activity-card");
  await expect(own).toHaveCount(1);
  await expect(own.getByTestId("card-label")).toHaveText("Activa");
  const box = await own.locator(".house-photo").boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(page.viewportSize()!.width * 0.85); // toda la fila menos 16 px de margen y 12 de relleno por lado
  await expect(page.getByTestId("activity-figures")).toHaveClass(/\blg\b/);
  await expect(page.getByRole("heading", { level: 2, name: "Últimas consultas" })).toBeVisible();
  const inquiry = page.getByRole("article").filter({ hasText: "Hola, ¿está libre?" });
  await expect(inquiry.getByRole("heading", { name: TEST_NAMES.other })).toBeVisible();
  await expect(inquiry).toContainText("AP");
  await expect(inquiry).toContainText("sin fechas · 2 personas");
  await expect(inquiry.getByTestId("inquiry-house")).toHaveText("Casa Cocles");
  await expect(inquiry.getByText("Nueva", { exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "Filtrar por casa" })).toHaveCount(0);
  await expect(nav(page).getByTestId("inquiries-badge")).toHaveText("1");
  await expect(nav(page).getByRole("link", { name: "Actividad, 1 nueva" })).toHaveAttribute("aria-current", "page");
  await page.screenshot({ path: "test-results/actividad-una-casa.png", fullPage: true });

  // «Abrir WhatsApp»: el chat con el cliente, sin texto; la consulta deja de ser nueva y el contador de la pestaña se va.
  const wa = await catchWhatsApp(page);
  await inquiry.getByRole("button", { name: "Abrir WhatsApp" }).click();
  await expect.poll(() => wa).toEqual([`https://wa.me/${TEST_PHONES.other.replace(/\D/g, "")}`]);
  await expect.poll(() => opened(casa.publicId)).toBe("1");
  await backFromWhatsApp(page);
  await expect(page.getByRole("heading", { level: 1, name: "Actividad" })).toBeVisible();
  await expect(inquiry.getByText("Nueva", { exact: true })).toHaveCount(0);
  await expect(nav(page).getByTestId("inquiries-badge")).toHaveCount(0);
  await expect(nav(page).getByRole("link", { name: "Actividad" })).toBeVisible();

  // Sin red: la pantalla visitada se pinta desde la caché del dispositivo.
  await page.reload();
  await expect(page.getByTestId("activity-figures")).toHaveText(/4\s*visitas/);
  await page.waitForTimeout(1500); // la caché se guarda en IndexedDB con un pequeño retraso
  await page.route("**/rest/v1/**", (route) => route.abort());
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Actividad" })).toBeVisible();
  await expect(page.getByTestId("activity-figures")).toHaveText(/4\s*visitas.*2\s*toques en WhatsApp.*1\s*consulta/s);
  await expect(page.getByRole("article").filter({ hasText: "Hola, ¿está libre?" })).toBeVisible();
  await page.unroute("**/rest/v1/**");
});

test("7a · si las cifras no cargan, las últimas consultas y «Abrir WhatsApp» siguen", async ({ page }) => {
  // P. ej. la app desplegada antes que la migración: la función no existe (404 de PostgREST).
  await page.route("**/rest/v1/rpc/owner_activity*", (route) =>
    route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ code: "PGRST202", message: "Could not find the function public.owner_activity" }) }),
  );
  await page.goto("/propietario/actividad");
  const inquiry = page.getByRole("article").filter({ hasText: "Hola, ¿está libre?" });
  await expect(page.getByRole("heading", { level: 2, name: "Últimas consultas" })).toBeVisible();
  await expect(inquiry.getByRole("button", { name: "Abrir WhatsApp" })).toBeVisible();
  await expect(page.getByText("No pudimos cargar las cifras. Intente de nuevo.")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("activity-figures")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: "Últimas consultas" })).toBeVisible();
  await expect(inquiry.getByRole("button", { name: "Abrir WhatsApp" })).toBeVisible();
});

test("7b · con dos casas: una tarjeta por casa; la que no está activa muestra solo su estado", async ({ page }) => {
  await h.seed({ status: "review", draft: { title: "Casa en revisión" } });
  await page.goto("/propietario/actividad");
  const cards = page.locator(".activity-card");
  await expect(cards).toHaveCount(2);
  const active = cards.filter({ hasText: "Casa Cocles" });
  await expect(active.getByTestId("card-label")).toHaveText("Activa");
  await expect(active.getByTestId("activity-figures")).toHaveText(/4\s*visitas.*2\s*toques en WhatsApp.*1\s*consulta/s);
  await expect(active.locator(".house-photo img")).toHaveCount(1);
  const review = cards.filter({ hasText: "Casa en revisión" });
  await expect(review.getByTestId("card-label")).toHaveText("En revisión");
  const [b1, b2] = [await active.boundingBox(), await review.boundingBox()];
  expect(Math.abs(b1!.y - b2!.y)).toBeLessThan(2);
  expect(b1!.x).not.toBe(b2!.x);
  await expect(review.getByTestId("activity-figures")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: "Últimas consultas" })).toBeVisible();
  await page.screenshot({ path: "test-results/actividad-dos-casas.png", fullPage: true });
});

test("7c · sin casa activa ni consultas: un único mensaje", async ({ page }) => {
  const { data: other } = await serviceClient().from("profiles").select("id").eq("phone", TEST_PHONES.other).single();
  await serviceClient().from("listings").delete().eq("owner_id", other!.id);
  await h.seed({ status: "draft", as: "other", draft: { title: "Borrador de Ana" } });
  await injectSession(page, "other");
  await page.goto("/propietario/actividad");
  await expect(page.getByText("Cuando su casa esté activa verá aquí cuántas personas la visitan y le escriben")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Últimas consultas" })).toHaveCount(0);
  await expect(page.getByTestId("activity-figures")).toHaveCount(0);
  await expect(page.getByText("Borrador", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: "test-results/actividad-vacia.png" });
});

test("el contador se va con la sesión y la consulta privada sale de la caché del dispositivo", async ({ page }) => {
  await h.inquiries("other").create(casa.publicId, { arrival: null, departure: null, people: null, message: "Otra pregunta" });
  await page.goto("/propietario/actividad");
  await expect(nav(page).getByTestId("inquiries-badge")).toHaveText("1");
  // Cuenta se abre a pantalla completa desde arriba, sin barra inferior.
  await accountButton(page).click();
  await expect(page).toHaveURL(/\/cuenta$/);
  await expect(nav(page)).toHaveCount(0);
  await expect.poll(() => persistedCache(page)).toContain('"inquiries"');
  await signOut(page);
  await expect(page.getByRole("button", { name: "Cerrar sesión" })).toHaveCount(0);
  await page.getByRole("link", { name: "Volver" }).click();
  await expect(nav(page).getByRole("link")).toHaveText(["Explorar", "Favoritos"]);
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

test("1 · sin sesión: dos pestañas e «Ingresar» arriba", async ({ page }) => {
  await page.evaluate(() => localStorage.clear());
  await page.goto("/explorar");
  await expect(nav(page).getByRole("link")).toHaveText(["Explorar", "Favoritos"]);
  await expect(page.locator(".explore-top").getByRole("link", { name: "Ingresar" })).toBeVisible();
  await page.goto("/favoritos");
  await expect(page.getByRole("banner").getByRole("link", { name: "Ingresar" })).toBeVisible();
  await page.goto("/propietario/casas");
  await expect(page).toHaveURL(/\/cuenta\?next=%2Fpropietario%2Fcasas$/);
});

test("2 · sin casas: dos pestañas; «Publicar mi casa» crea un borrador, cinco pestañas y Mis casas muestra el borrador", async ({ page }) => {
  await h.reset(); // ninguna casa de «other»
  await signInByUi(page, "8888 1234");
  await expect(page).toHaveURL(/\/explorar$/);
  await expect(nav(page).getByRole("link")).toHaveText(["Explorar", "Favoritos"]);
  // Sin casas, la zona del propietario lleva a Explorar.
  await page.goto("/propietario/casas");
  await expect(page).toHaveURL(/\/explorar$/);
  await accountButton(page).click();
  await expect(page).toHaveURL(/\/cuenta$/);
  await expect(page.getByRole("link", { name: /Favoritos/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Buscar una casa/ })).toHaveCount(0);
  await page.getByRole("link", { name: /Publicar mi casa/ }).click();
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
  await expect(page.getByRole("heading", { level: 1, name: "Cuenta" })).toBeVisible();
  await expect(page.getByText("Próximo cobro")).toBeVisible();
  await expect(page.getByRole("link", { name: /Publicar mi casa/ })).toHaveCount(0);
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
  await expect(nav(page).getByRole("link")).toHaveText(["Explorar", "Favoritos"]);
});

test("Cuenta se abre a pantalla completa, sin barra inferior, y la flecha vuelve adonde estaba", async ({ page }) => {
  await h.reset();
  await h.seed({ status: "active", draft: { title: "Casa Manzanillo" } });
  await page.goto("/propietario/calendario");
  await expect(nav(page).getByRole("link")).toHaveText(OWNER_TABS);
  await accountButton(page).click();
  await expect(page).toHaveURL(/\/cuenta$/);
  await expect(page.getByRole("heading", { level: 1, name: "Cuenta" })).toBeVisible();
  await expect(nav(page)).toHaveCount(0);
  await page.getByRole("link", { name: "Volver" }).click();
  await expect(page).toHaveURL(/\/propietario\/calendario$/);
  // Las pantallas que se abren desde Cuenta vuelven atrás: dos «Volver» llevan a la pestaña, sin rebotar con Cuenta.
  const volver = () => page.getByRole("link", { name: "Volver" }).click();
  await accountButton(page).click();
  await page.getByRole("link", { name: /Ayuda por WhatsApp/ }).click();
  await expect(page).toHaveURL(/\/ayuda$/);
  await volver();
  await expect(page).toHaveURL(/\/cuenta$/);
  await volver();
  await expect(page).toHaveURL(/\/propietario\/calendario$/);
  await accountButton(page).click();
  await page.getByTestId("subscription-card").getByRole("link", { name: "Ver detalle" }).click();
  await expect(page).toHaveURL(/\/propietario\/suscripcion$/);
  await volver();
  await expect(page).toHaveURL(/\/cuenta$/);
  await volver();
  await expect(page).toHaveURL(/\/propietario\/calendario$/);
  // Editar y Listo no apilan Cuenta.
  await accountButton(page).click();
  await page.getByRole("link", { name: "Editar", exact: true }).click();
  await page.getByRole("link", { name: "Listo", exact: true }).click();
  await expect(page).toHaveURL(/\/cuenta$/);
  await volver();
  await expect(page).toHaveURL(/\/propietario\/calendario$/);
  // Abierta directamente (sin historial en la app), la flecha lleva a Mis casas.
  await page.goto("/cuenta");
  await page.getByRole("link", { name: "Volver" }).click();
  await expect(page).toHaveURL(/\/propietario\/casas$/);
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

test("la barra superior: 56 px más el área segura, y los botones de al menos 44 px; Explorar no la lleva", async ({ page }) => {
  await h.reset();
  await h.seed({ status: "active", draft: { title: "Casa Puerto Viejo" } });
  const banner = page.getByRole("banner");
  const checkBar = async () => {
    await expect(banner).toHaveCount(1);
    expect((await banner.boundingBox())?.height).toBe(56);
    await expect(banner.getByRole("img", { name: "bnbtico" })).toBeVisible();
    for (const b of await banner.getByRole("button").all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    for (const l of await banner.getByRole("link").all()) {
      const box = (await l.boundingBox())!;
      expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
    }
  };
  // Explorar trae su propia cabecera: la cuenta junto a la píldora y «₡ | $» en la fila de chips.
  await page.goto("/explorar");
  await expect(page.locator(".explore-top").getByRole("link", { name: "Cuenta" })).toHaveText(/^[A-ZÁÉÍÓÚÑ]{1,2}$/);
  await expect(page.locator(".topbar")).toHaveCount(0);
  await expect(banner).toHaveCount(0);
  // Las otras cuatro pestañas la llevan; Cuenta (pantalla de flujo), no.
  for (const path of ["/favoritos", "/propietario/casas", "/propietario/calendario", "/propietario/actividad"]) {
    await page.goto(path);
    await expect(banner.getByRole("group", { name: "Moneda de los precios" })).toBeVisible();
    await checkBar();
  }
  await page.goto("/cuenta");
  await expect(page.getByRole("heading", { level: 1, name: "Cuenta" })).toBeVisible();
  await expect(banner).toHaveCount(0);
  // Filtros es una pantalla completa con su cabecera: sin barra superior ni selector.
  await page.goto("/explorar/filtros");
  await expect(page.getByRole("heading", { level: 1, name: "Filtros" })).toBeVisible();
  await expect(banner).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Moneda de los precios" })).toHaveCount(0);
  // Sin sesión, «Ingresar».
  await page.evaluate(() => localStorage.clear());
  await page.goto("/favoritos");
  await expect(banner.getByRole("link", { name: "Ingresar" })).toBeVisible();
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

  test("la barra superior cabe entera, con y sin sesión, sin scroll horizontal", async ({ page }) => {
    const banner = page.getByRole("banner");
    const fits = async (account: RegExp | string) => {
      const logo = (await banner.getByRole("img", { name: "bnbtico" }).boundingBox())!;
      const currency = (await banner.getByRole("group", { name: "Moneda de los precios" }).boundingBox())!;
      const last = (await banner.getByRole("link", { name: account }).boundingBox())!;
      expect(logo.x).toBeGreaterThanOrEqual(0);
      expect(logo.x + logo.width).toBeLessThanOrEqual(currency.x);
      expect(currency.x + currency.width).toBeLessThanOrEqual(last.x);
      expect(last.x + last.width).toBeLessThanOrEqual(375);
      expect(Math.min(last.width, last.height)).toBeGreaterThanOrEqual(44);
      for (const b of await banner.getByRole("button").all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    };
    // La cabecera de Explorar: la píldora y la cuenta en una fila, dentro de los 375 px.
    const exploreFits = async (account: string) => {
      const top = page.locator(".explore-top");
      const pill = (await top.locator(".search-pill").boundingBox())!;
      const last = (await top.getByRole("link", { name: account }).boundingBox())!;
      expect(pill.x).toBeGreaterThanOrEqual(16);
      expect(pill.x + pill.width).toBeLessThanOrEqual(last.x);
      expect(last.x + last.width).toBeLessThanOrEqual(375 - 16);
      expect(Math.min(last.width, last.height)).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    };
    await page.goto("/explorar");
    await expect(page.locator(".explore-top").getByRole("link", { name: "Cuenta" })).toBeVisible();
    await exploreFits("Cuenta");
    await page.goto("/favoritos");
    await expect(banner.getByRole("link", { name: "Cuenta" })).toBeVisible();
    await fits("Cuenta");
    await page.evaluate(() => localStorage.clear());
    await page.goto("/explorar");
    await expect(page.locator(".explore-top").getByRole("link", { name: "Ingresar" })).toBeVisible();
    await exploreFits("Ingresar");
    await page.goto("/favoritos");
    await expect(banner.getByRole("link", { name: "Ingresar" })).toBeVisible();
    await fits("Ingresar");
    await page.screenshot({ path: "test-results/barra-375-sin-sesion.png" });
  });
});
