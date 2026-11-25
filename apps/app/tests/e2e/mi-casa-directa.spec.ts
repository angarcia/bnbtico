import { expect, test, type Page } from "./helpers/test";
import { sql } from "../db/local";
import { postgrestHarness } from "../db/postgrest-harness";
import { injectSession } from "./helpers/session";

// Revisión de la app 2026-11-17, historia 01: con una sola casa, «Mi casa» abre su gestión en la propia pestaña (con la barra
// de abajo y el «+» de «Nueva casa» junto al título), sin la lista de un elemento; con dos o más, «Mis casas» es la lista.
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
let h: Awaited<ReturnType<typeof postgrestHarness>>;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  h = await postgrestHarness();
});

test.beforeEach(async ({ page }) => {
  await h.reset();
  await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
});

const nav = (page: Page) => page.getByRole("navigation", { name: "Navegación principal" });
const houseTab = (page: Page, name: "Mi casa" | "Mis casas") => nav(page).getByRole("link", { name, exact: true });
const myHouses = (page: Page) => page.getByRole("heading", { level: 1, name: "Mis casas" });
const newHouse = (page: Page) => page.getByRole("link", { name: "Nueva casa" });
const addOnPhoto = (page: Page) => page.getByRole("link", { name: "Añadir otra casa" });
/** La caché de Query vive en IndexedDB (fresca 30 s): tras cambiar algo por detrás, se abre la app sin ella. */
async function fresh(page: Page, path: string) {
  await page.goto("/robots.txt");
  await page.evaluate(() => new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase("3bstays");
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  }));
  await page.goto(path);
}
const setStatus = (id: string, status: string) =>
  sql(`begin; select set_config('app.allow_status','on',true); update public.listings set status = '${status}' where id = '${id}'; commit;`);

for (const desktop of [false, true]) {
  test(`${desktop ? "escritorio" : "móvil"}: con una casa activa, «Mi casa» abre su gestión sin lista, con la barra y «Nueva casa»`, async ({ page }) => {
    await h.seed({ status: "active", draft: { title: "Casa Cocles" } });
    if (desktop) await page.setViewportSize({ width: 1280, height: 800 });
    await injectSession(page, "owner");
    await page.goto("/explorar");
    await houseTab(page, "Mi casa").click();
    await expect(page).toHaveURL(/\/propietario\/casas$/);
    await expect(page.getByRole("heading", { level: 1, name: "Casa Cocles" })).toBeVisible();
    // La gestión de la casa publicada (su ficha editable), no la tarjeta de la lista.
    await expect(page.getByRole("link", { name: "Ver ficha" })).toBeVisible();
    await expect(myHouses(page)).toHaveCount(0);
    await expect(page.getByRole("article")).toHaveCount(0);
    await expect(houseTab(page, "Mi casa")).toHaveAttribute("aria-current", "page");
    // En el teléfono, «＋ Añadir otra casa» sobre la foto (historia #92); en escritorio, el «+» de la cabecera.
    if (desktop) {
      await expect(newHouse(page)).toHaveAttribute("href", "/propietario/publicar");
      await expect(addOnPhoto(page)).toHaveCount(0);
    } else {
      await expect(page.locator(".detail-photo").getByRole("link", { name: "Añadir otra casa" })).toHaveAttribute("href", "/propietario/publicar");
      await expect(newHouse(page)).toHaveCount(0);
    }
    // La misma maqueta que su detalle: en escritorio, la foto a la izquierda y los datos a la derecha.
    const photo = (await page.locator(".detail-photo").boundingBox())!;
    const fields = (await page.getByTestId("field-rows").boundingBox())!;
    if (desktop) expect(fields.x).toBeGreaterThanOrEqual(photo.x + photo.width);
    else expect(fields.y).toBeGreaterThan(photo.y + photo.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  });
}

// Historia #92 (2026-11-25): en el teléfono, con una sola casa publicada, la foto empieza arriba (sin franja) y lleva
// «＋ Añadir otra casa» arriba a la izquierda, Compartir arriba a la derecha, el estado abajo a la izquierda y las fotos abajo
// a la derecha; las cifras, justo debajo.
test("móvil: una casa publicada, sobre la foto «Añadir otra casa», Compartir, el estado y las fotos; nada en el detalle de una lista", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  const casa = await h.seed({ status: "active", photos: 2, draft: { title: "Casa Cocles" } });
  await page.addInitScript(() => {
    const w = window as unknown as { shared: unknown[] };
    w.shared = [];
    Object.defineProperty(navigator, "share", { configurable: true, value: async (data: unknown) => void w.shared.push(data) });
  });
  await injectSession(page, "owner");
  await page.goto("/propietario/casas");
  const photo = page.locator(".detail-photo");
  const add = photo.getByRole("link", { name: "Añadir otra casa" });
  const share = photo.getByRole("button", { name: "Compartir casa" });
  const tag = photo.locator(".state");
  const pill = photo.locator(".photo-pill");
  await expect(add).toBeVisible();
  const box = async (x: ReturnType<Page["locator"]>) => (await x.boundingBox())!;
  const [p, a, s, t, c, stats] = await Promise.all([box(photo), box(add), box(share), box(tag), box(pill), box(page.getByTestId("listing-stats"))]);
  expect(p.y).toBeLessThan(40); // sin franja vacía arriba
  expect(a.x - p.x).toBeLessThan(20);
  expect(a.y - p.y).toBeLessThan(20);
  expect(a.height).toBeGreaterThanOrEqual(44);
  expect(p.x + p.width - (s.x + s.width)).toBeLessThan(20);
  expect(s.y - p.y).toBeLessThan(20);
  expect(t.x - p.x).toBeLessThan(20);
  expect(p.y + p.height - (t.y + t.height)).toBeLessThan(20); // el estado, abajo a la izquierda
  expect(p.y + p.height - (c.y + c.height)).toBeLessThan(20); // las fotos, abajo a la derecha
  expect(t.x + t.width).toBeLessThan(c.x);
  expect(stats.y - (p.y + p.height)).toBeLessThan(24); // las cifras, justo debajo
  // Compartir: el mismo flujo que la ficha.
  await share.click();
  expect(await page.evaluate(() => (window as unknown as { shared: { url: string }[] }).shared)).toEqual([expect.objectContaining({ url: expect.stringContaining(`/casa/${casa.publicId}`) })]);
  // Añadir: el mismo recorrido que el «+».
  await add.click();
  await expect(page).toHaveURL(/\/propietario\/publicar/);

  // Con dos casas, el detalle de una de ellas no lleva el botón de añadir (el «+» sigue en la lista).
  await h.seed({ status: "draft", draft: { title: "Borrador del Caribe" } });
  await fresh(page, "/propietario/casas");
  await expect(myHouses(page)).toBeVisible();
  await expect(newHouse(page)).toBeVisible();
  await page.getByRole("article").filter({ hasText: "Casa Cocles" }).getByRole("link", { name: "Casa Cocles" }).click();
  await expect(page).toHaveURL(new RegExp(`/propietario/casas/${casa.id}$`));
  await expect(page.locator(".detail-photo").getByRole("button", { name: "Compartir casa" })).toBeVisible();
  await expect(addOnPhoto(page)).toHaveCount(0);
});

test("con dos casas, una de ellas borrador, «Mis casas» abre la lista con las dos", async ({ page }) => {
  await h.seed({ status: "active", draft: { title: "Casa Cocles" } });
  await h.seed({ status: "draft", draft: { title: "Borrador del Caribe" } });
  await injectSession(page, "owner");
  await page.goto("/explorar");
  await houseTab(page, "Mis casas").click();
  await expect(myHouses(page)).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "Casa Cocles" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Borrador del Caribe" })).toBeVisible();
});

test("una sola casa en cada estado llega a su gestión con sus acciones (Seguir publicando, Corregir, pago, activar)", async ({ page }) => {
  await injectSession(page, "owner");
  // Una rechazada no cuenta como casa (la lista propia las deja fuera): sola, la cuenta no tiene pestaña de casas.
  const cases: [string, () => Promise<void>, (p: Page) => Promise<void>][] = [
    ["draft", async () => void (await h.seed({ status: "draft", draft: { title: "Casa Cocles" } })), (p) => expect(p.getByRole("link", { name: "Seguir publicando" })).toBeVisible()],
    ["review", async () => void (await h.seed({ status: "review", draft: { title: "Casa Cocles" } })), (p) => expect(p.getByText("En revisión").first()).toBeVisible()],
    ["changes", async () => void (await h.seed({ status: "changes", draft: { title: "Casa Cocles" } })), (p) => expect(p.getByRole("button", { name: "Corregir y reenviar" })).toBeVisible()],
    [
      "payment_due",
      async () => {
        const casa = await h.seed({ status: "active", draft: { title: "Casa Cocles" } });
        await h.setDaysLeft(casa.id, -1);
        await h.service.runDay();
      },
      (p) => expect(p.getByTestId("pay-notice").getByRole("link", { name: "Añadir método de pago" })).toBeVisible(),
    ],
    [
      "inactive",
      async () => void setStatus((await h.seed({ status: "active", draft: { title: "Casa Cocles" } })).id, "inactive"),
      (p) => expect(p.getByTestId("stopped-notice").getByRole("link", { name: /Activar/ })).toBeVisible(),
    ],
  ];
  for (const [status, seed, check] of cases) {
    await test.step(status, async () => {
      await h.reset();
      await seed();
      await fresh(page, "/explorar");
      await houseTab(page, "Mi casa").click();
      await expect(page.getByRole("heading", { level: 1, name: "Casa Cocles" })).toBeVisible();
      await expect(myHouses(page)).toHaveCount(0);
      await check(page);
    });
  }
});

test("de una casa a dos y de dos a una: la etiqueta y el destino siguen la cantidad, y Atrás no rebota", async ({ page }) => {
  await h.seed({ status: "active", draft: { title: "Casa Cocles" } });
  await injectSession(page, "owner");
  await page.goto("/explorar");
  await houseTab(page, "Mi casa").click();
  await expect(page.getByRole("heading", { level: 1, name: "Casa Cocles" })).toBeVisible();
  // Desde la gestión a la ficha pública y Atrás: vuelve a la gestión y se queda ahí.
  await page.getByRole("link", { name: "Ver ficha" }).click();
  await expect(page).toHaveURL(/\/casa\/CT-/);
  await page.goBack();
  await expect(page).toHaveURL(/\/propietario\/casas$/);
  await expect(page.getByRole("heading", { level: 1, name: "Casa Cocles" })).toBeVisible();
  // Un dato abierto desde la gestión vuelve con su flecha a la pestaña.
  await page.getByTestId("field-rows").getByRole("link").first().click();
  await expect(page).toHaveURL(/\/editar\//);
  await page.getByRole("link", { name: "Volver" }).click();
  await expect(page).toHaveURL(/\/propietario\/casas$/);
  await expect(page.getByRole("heading", { level: 1, name: "Casa Cocles" })).toBeVisible();
  // El detalle de flujo (p. ej. desde un enlace) vuelve con su flecha a la gestión, sin redirigir otra vez.
  const id = sql(`select id from public.listings where title = 'Casa Cocles'`);
  await page.goto(`/propietario/casas/${id}`);
  await page.getByRole("link", { name: "Volver" }).click();
  await expect(page).toHaveURL(/\/propietario\/casas$/);
  await expect(page.getByRole("heading", { level: 1, name: "Casa Cocles" })).toBeVisible();

  const second = await h.seed({ status: "draft", draft: { title: "Borrador del Caribe" } });
  await fresh(page, "/explorar");
  await houseTab(page, "Mis casas").click();
  await expect(myHouses(page)).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(2);

  sql(`delete from public.listings where id = '${second.id}'`);
  await fresh(page, "/explorar");
  await houseTab(page, "Mi casa").click();
  await expect(page.getByRole("heading", { level: 1, name: "Casa Cocles" })).toBeVisible();
  await expect(myHouses(page)).toHaveCount(0);
});

test("abierta por URL sin caché: mientras llega, el esqueleto; sin red, sigue cargando; nunca una casa inventada", async ({ page }) => {
  await h.seed({ status: "active", draft: { title: "Casa Cocles" } });
  await injectSession(page, "owner");
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route("**/rest/v1/listings?*", async (route) => {
    if (route.request().method() === "GET") await held;
    await route.fallback();
  });
  await fresh(page, "/propietario/casas");
  await expect(page.getByLabel("Cargando sus casas")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Casa Cocles" })).toHaveCount(0);
  release();
  await expect(page.getByRole("heading", { level: 1, name: "Casa Cocles" })).toBeVisible();

  await page.unroute("**/rest/v1/listings?*");
  await page.route("**/rest/v1/listings?*", (route) => (route.request().method() === "GET" ? route.abort() : route.fallback()));
  await fresh(page, "/propietario/casas");
  // Sin red, el estado de carga de siempre (se sigue reintentando) y ninguna casa elegida.
  await expect(page.getByLabel("Cargando sus casas")).toBeVisible();
  await page.waitForTimeout(3000);
  await expect(page.getByLabel("Cargando sus casas")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Casa Cocles" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Nueva casa" })).toHaveCount(0);
});
