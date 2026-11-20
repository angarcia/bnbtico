import { expect, test, type Page } from "./helpers/test";
import type { Seeded } from "../contract/harness";
import { postgrestHarness } from "../db/postgrest-harness";
import { injectSession } from "./helpers/session";

// Estructura común (historia 07, paso 5), contra Supabase local: el mismo error de carga en Explorar y Favoritos (rojo,
// role=alert y «Reintentar»), la cabecera del asistente mientras carga igual que la real, y los textos de escritorio de Mis
// casas en el DOM con su nombre accesible.
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
const LOAD_ERROR = "No pudimos cargar las casas. Revise su conexión e inténtelo de nuevo.";
let h: Awaited<ReturnType<typeof postgrestHarness>>;
let cocles: Seeded;

test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  h = await postgrestHarness();
  await h.reset();
  cocles = await h.seed({ status: "active", draft: { title: "Casa Cocles" } });
  await h.seed({ status: "active", draft: { title: "Casa Puerto Viejo" } });
});
test.beforeEach(async ({ page }) => {
  await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
  await page.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
});

/** PostgREST caído (500) hasta que se llame a la función que devuelve. */
async function breakRest(page: Page) {
  const fail = (route: Parameters<Parameters<Page["route"]>[1]>[0]) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "caída" }) });
  await page.route("**/rest/v1/**", fail);
  return () => page.unroute("**/rest/v1/**", fail);
}

async function expectLoadError(page: Page) {
  const alert = page.getByRole("alert").filter({ hasText: LOAD_ERROR });
  await expect(alert).toBeVisible({ timeout: 30_000 });
  await expect(alert).toHaveClass(/\bnote\b/);
  await expect(alert).toHaveCSS("background-color", await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.background = "var(--bad-soft)";
    document.body.append(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  }));
  return alert;
}

test("el mismo error de carga en Explorar y en Favoritos: rojo, role=alert y «Reintentar» vuelve a pedir las casas", async ({ page }) => {
  test.setTimeout(120_000);
  const heal = await breakRest(page);
  await page.goto("/explorar");
  const explore = await expectLoadError(page);
  await expect(explore.getByRole("button", { name: "Reintentar" })).toBeVisible();
  await heal();
  await explore.getByRole("button", { name: "Reintentar" }).click();
  await expect(page.getByRole("alert").filter({ hasText: LOAD_ERROR })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Casa Cocles" })).toBeVisible();

  await page.evaluate((id) => localStorage.setItem("3bstays-favoritos", JSON.stringify([{ publicId: id, savedAt: new Date().toISOString() }])), cocles.publicId);
  const healAgain = await breakRest(page);
  await page.goto("/favoritos");
  const favs = await expectLoadError(page);
  await healAgain();
  await favs.getByRole("button", { name: "Reintentar" }).click();
  await expect(page.getByRole("heading", { name: "Casa Cocles" })).toBeVisible();
});

// Decisión de Ana del 2026-11-20: el mismo error rojo con «Reintentar» en toda la app donde falla una consulta.
test("con sesión, Mis casas y Consultas sin red: el error de carga con «Reintentar», que trae los datos al volver la red", async ({ page }) => {
  test.setTimeout(120_000);
  await injectSession(page, "owner");
  const heal = await breakRest(page);
  await page.goto("/propietario/casas");
  const alert = page.getByRole("alert").filter({ has: page.getByRole("button", { name: "Reintentar" }) });
  await expect(alert).toBeVisible({ timeout: 30_000 });
  await expect(alert).toHaveClass(/\bnote\b/);
  await expect(page.getByRole("heading", { name: "Casa Cocles" })).toHaveCount(0);
  await heal();
  await alert.getByRole("button", { name: "Reintentar" }).click();
  await expect(page.getByRole("heading", { name: "Casa Cocles" })).toBeVisible();
  await expect(alert).toHaveCount(0);

  await page.goto("/robots.txt");
  await page.evaluate(() => new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase("3bstays");
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  }));
  const healAgain = await breakRest(page);
  await page.goto("/propietario/actividad");
  await expect(alert).toBeVisible({ timeout: 30_000 });
  await healAgain();
  await alert.getByRole("button", { name: "Reintentar" }).click();
  await expect(alert).toHaveCount(0);
  await expect(page.getByTestId("inquiries-new")).toBeVisible();
});

test("mientras llega el trozo del asistente, la cabecera es la del asistente: título a la izquierda y la ✕ a la derecha, en el mismo sitio", async ({ page }) => {
  // El trozo del asistente se retiene desde el principio (Mis casas lo precarga en reposo).
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(/\/assets\/publicar-[\w-]{8}\.js$/, async (route) => {
    await held;
    await route.continue();
  });
  await injectSession(page, "owner");
  await page.goto("/propietario/casas");
  await expect(page.getByRole("heading", { name: "Casa Cocles" })).toBeVisible();
  await page.getByRole("link", { name: "Nueva casa" }).click();
  const close = page.getByRole("link", { name: "Cerrar y seguir después" });
  await expect(close).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Publicar casa" })).toBeVisible();
  await expect(page.locator('[aria-busy="true"][aria-label="Cargando sus casas"]')).toBeVisible();
  const pending = await close.boundingBox();
  const title = await page.getByRole("heading", { level: 1, name: "Publicar casa" }).boundingBox();
  expect(pending!.x).toBeGreaterThan(title!.x);
  release();
  const real = page.getByRole("button", { name: "Cerrar y seguir después" });
  await expect(real).toBeVisible();
  const now = await real.boundingBox();
  expect(Math.abs(now!.x - pending!.x)).toBeLessThan(1);
  expect(Math.abs(now!.y - pending!.y)).toBeLessThan(1);
  expect(now!.width).toBe(pending!.width);
});

test("escritorio: «Añadir casa», «Calendario» y «Consultas» están en el DOM y el enlace conserva su nombre accesible", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await injectSession(page, "owner");
  await page.goto("/propietario/casas");
  const add = page.getByRole("link", { name: "Nueva casa" });
  await expect(add).toHaveText("Añadir casa");
  await expect(add.getByText("Añadir casa")).toBeVisible();
  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Casa Cocles" }) });
  await expect(card.getByRole("link", { name: "Calendario", exact: true })).toHaveText("Calendario");
  await expect(card.getByRole("link", { name: /^Consultas/ })).toContainText("Consultas");
  // En el teléfono, los mismos enlaces solo con su icono.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.reload();
  await expect(page.getByRole("link", { name: "Nueva casa" }).getByText("Añadir casa")).toBeHidden();
});
