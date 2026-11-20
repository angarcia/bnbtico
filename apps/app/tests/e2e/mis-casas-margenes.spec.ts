import { expect, test, type Page } from "./helpers/test";
import { postgrestHarness } from "../db/postgrest-harness";
import { injectSession } from "./helpers/session";

// Revisión de la app 2026-11-17, historia 04: la fila de arriba de Mis casas (contadores y «+») va con el mismo aire a la
// izquierda que el que ya tenía a la derecha; el de la derecha no cambia.
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
let h: Awaited<ReturnType<typeof postgrestHarness>>;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  h = await postgrestHarness();
  await h.reset();
  // Tres contadores (activa, en revisión, borrador) y la lista, no la gestión de una sola casa.
  await h.seed({ status: "active", draft: { title: "Casa Cocles" } });
  await h.seed({ status: "review", draft: { title: "Casa en revisión" } });
  await h.seed({ status: "draft", draft: { title: "Borrador del Caribe" } });
});

test.beforeEach(async ({ page }) => {
  await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
  await injectSession(page, "owner");
});

const summary = (page: Page) => page.locator(".my-houses-summary");
/** El aire entre el contenido de la fila (primer contador y «+») y los bordes de la propia fila (en el teléfono, de borde a
 *  borde de la pantalla; en escritorio, la columna de la lista). */
async function gaps(page: Page) {
  const row = (await summary(page).boundingBox())!;
  const first = (await summary(page).locator(".tile").first().boundingBox())!;
  const plus = (await page.getByRole("link", { name: "Nueva casa" }).boundingBox())!;
  return { left: first.x - row.x, right: row.x + row.width - (plus.x + plus.width) };
}

for (const [name, viewport, right] of [
  ["móvil 375", { width: 375, height: 812 }, 4],
  ["móvil 320", { width: 320, height: 640 }, 4],
  ["escritorio", { width: 1280, height: 800 }, 0],
] as const) {
  test(`${name}: el aire de la izquierda es el de la derecha, que no cambia; nada se sale ni se recorta`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/propietario/casas");
    await expect(page.getByRole("heading", { level: 1, name: "Mis casas" })).toBeVisible();
    await expect(summary(page).locator(".tile")).toHaveCount(3);
    const g = await gaps(page);
    expect(Math.round(g.right)).toBe(right);
    expect(Math.round(g.left)).toBe(Math.round(g.right));
    // Sin desbordar ni recortar cifras, y el «+» con su área de toque.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    for (const tile of await summary(page).locator(".tile").all()) {
      expect(await tile.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    }
    if (viewport.width >= 1024) {
      // La barra de arriba cabe con holgura: en el Linux de CI la letra sale ~20 px más ancha que en el Mac (2026-11-19).
      const free = await page.locator(".desktop-nav").evaluate((nav) => {
        const last = [...nav.children].reduce((r, el) => Math.max(r, el.getBoundingClientRect().right), 0);
        const cuenta = [...nav.querySelectorAll("a.nav")].find((a) => a.textContent?.includes("Cuenta"))!.getBoundingClientRect();
        const next = nav.querySelector(".desktop-currency")!.getBoundingClientRect();
        return { gap: next.x - cuenta.right, fits: last <= nav.getBoundingClientRect().right };
      });
      expect(free.fits).toBe(true);
      expect(free.gap).toBeGreaterThanOrEqual(48);
    }
    const plus = (await page.getByRole("link", { name: "Nueva casa" }).boundingBox())!;
    expect(plus.width).toBeGreaterThanOrEqual(44);
    expect(plus.height).toBeGreaterThanOrEqual(44);
    await page.getByRole("link", { name: "Nueva casa" }).click();
    await expect(page).toHaveURL(/\/propietario\/publicar/);
  });
}
