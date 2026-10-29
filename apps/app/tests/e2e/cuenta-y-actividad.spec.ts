import { expect, test, type Page } from "./helpers/test";
import { postgrestHarness } from "../db/postgrest-harness";
import type { BillingHouse } from "../../src/domain/subscription";
import { injectSession } from "./helpers/session";

// Cuenta y actividad (plan F+G), contra Supabase local y la pasarela falsa del worker (PAYMENTS=fake de pnpm dev:vars).
// Suscripción de una sola casa (`?casa=CT-####`): desde cualquier entrada de una casa se ve solo esa casa y su método de
// pago; «Ver todas sus casas» vuelve a «Promoción y suscripción». Cada prueba vacía la base y crea sus casas.
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
const SCREEN = "/propietario/suscripcion";
let h: Awaited<ReturnType<typeof postgrestHarness>>;

test.beforeAll(async () => {
  h = await postgrestHarness();
});

test.beforeEach(async ({ page }) => {
  await h.reset();
  await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
});

const owner = (page: Page) => injectSession(page, "owner");
const houses = (page: Page) => page.locator("[data-house]");
const mine = async (id: string): Promise<BillingHouse> => (await h.billing("owner").overview()).houses.find((x) => x.listingId === id)!;
const statusOf = async (id: string) => (await mine(id)).status;
const expire = async (id: string) => {
  await h.setDaysLeft(id, -1);
  await h.service.runDay();
};
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** La caché de Query vive en IndexedDB (fresca 30 s): tras cambiar algo como el servicio, se abre la pantalla sin ella. */
async function fresh(page: Page, path: string) {
  await page.goto("/robots.txt");
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase("bnbtico");
        req.onsuccess = req.onerror = req.onblocked = () => resolve();
      }),
  );
  await page.goto(path);
}

test.describe("Suscripción de una casa", () => {
  test("Flujo 1: desde la fila Suscripción de una casa, solo esa casa y Método de pago; «Ver todas sus casas» muestra las dos", async ({ page }) => {
    const cocles = await h.seed({ status: "active", draft: { title: "Casa Cocles" } });
    await h.seed({ status: "active", draft: { title: "Cabina Punta Uva" } });
    await owner(page);
    await page.goto(`/propietario/casas/${cocles.id}`);
    await page.getByTestId("subscription-card").getByRole("link").click();
    await expect(page).toHaveURL(new RegExp(`${SCREEN}\\?casa=${cocles.publicId}#pago=${cocles.publicId}$`));
    await expect(page.getByRole("heading", { level: 1, name: "Suscripción" })).toBeVisible();
    await expect(page.getByTestId("sub-scope")).toHaveText("Casa Cocles");
    await expect(houses(page)).toHaveCount(1);
    await expect(houses(page)).toHaveAttribute("data-house", cocles.publicId);
    await expect(page.getByTestId("method-card")).toBeVisible();
    await expect(page.getByTestId("tiers-card")).toHaveCount(0);
    await expect(page.getByTestId("how-it-works")).toBeVisible();
    await page.screenshot({ path: "test-results/capturas/suscripcion-una-casa.png", fullPage: true });

    await page.getByRole("link", { name: "Ver todas sus casas" }).click();
    await expect(page).toHaveURL(new RegExp(`${SCREEN}$`));
    await expect(page.getByRole("heading", { level: 1, name: "Promoción y suscripción" })).toBeVisible();
    await expect(houses(page)).toHaveCount(2);
  });

  test("Flujo 2: una casa parada: «Activar suscripción» en ocre y la reactiva", async ({ page }) => {
    const casa = await h.seed({ status: "active", draft: { title: "Casa Cocles" } });
    await h.billing("owner").stop(casa.id);
    await owner(page);
    await fresh(page, `${SCREEN}?casa=${casa.publicId}`);
    const activate = page.getByRole("button", { name: "Activar suscripción" });
    await expect(activate).toHaveClass(/btn-sun/);
    await expect(page.getByRole("button", { name: "Reactivar" })).toHaveCount(0);
    await activate.click();
    await expect(houses(page).getByText("Activa", { exact: true })).toBeVisible();
    await expect.poll(() => statusOf(casa.id)).toBe("active");
  });

  test("Flujo 3: el enlace de un aviso #pago=CT-… sigue resaltando la casa", async ({ page }) => {
    const a = await h.seed({ status: "active", draft: { title: "Casa Cocles" } });
    await h.seed({ status: "active", draft: { title: "Cabina Punta Uva" } });
    await h.setDaysLeft(a.id, 7);
    await owner(page);
    await page.goto(`${SCREEN}#pago=${a.publicId}`);
    await expect(page.getByRole("heading", { level: 1, name: "Promoción y suscripción" })).toBeVisible();
    const card = page.locator(`[data-house="${a.publicId}"]`);
    await expect(card).toHaveClass(/is-target/);
    await expect(card).toBeFocused();
    await expect(houses(page)).toHaveCount(2);
  });

  test("casa desconocida u otra: todas las casas y la URL sin casa", async ({ page }) => {
    await h.seed({ status: "active", draft: { title: "Casa Cocles" } });
    await h.seed({ status: "active", draft: { title: "Cabina Punta Uva" } });
    await owner(page);
    await page.goto(`${SCREEN}?casa=CT-9999`);
    await expect(page).toHaveURL(new RegExp(`${SCREEN}$`));
    await expect(page.getByRole("heading", { level: 1, name: "Promoción y suscripción" })).toBeVisible();
    await expect(houses(page)).toHaveCount(2);
  });

  test("caché vieja sin la casa nueva: espera a la base antes de quitar casa", async ({ page }) => {
    await h.seed({ status: "active", draft: { title: "Casa Cocles" } });
    await owner(page);
    await page.goto(SCREEN);
    await expect(houses(page)).toHaveCount(1);
    await page.waitForTimeout(1500); // la caché se guarda en IndexedDB con A sola
    const b = await h.seed({ status: "active", draft: { title: "Cabina Punta Uva" } });
    await page.goto(`${SCREEN}?casa=${b.publicId}`);
    await expect(houses(page)).toHaveAttribute("data-house", b.publicId);
    await expect(houses(page)).toHaveCount(1);
    await expect(page).toHaveURL(new RegExp(`\\?casa=${b.publicId}$`));
  });

  test("caché fresca sin la casa, dentro de la app: vuelve a leer antes de quitar casa", async ({ page }) => {
    await h.seed({ status: "active", draft: { title: "Casa Cocles" } });
    const b = await h.seed({ status: "active", draft: { title: "Cabina Punta Uva" } });
    await h.billing("owner").stop(b.id);
    // La primera lectura de owner_billing aún no trae la casa B (como si la hubieran aprobado un momento después).
    await page.route("**/rest/v1/rpc/owner_billing", async (route) => {
      const res = await route.fetch();
      const body = (await res.json()) as { houses: { public_id: string }[] };
      await route.fulfill({ response: res, json: { ...body, houses: body.houses.filter((x) => x.public_id !== b.publicId) } });
    });
    await owner(page);
    await page.goto(`/propietario/casas/${b.id}`);
    const activate = page.getByTestId("stopped-notice").getByRole("link", { name: "Activar suscripción" });
    await expect(activate).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.unroute("**/rest/v1/rpc/owner_billing");
    await activate.click(); // sin recargar: la caché (fresca 30 s) no tiene la casa B
    await expect(houses(page)).toHaveAttribute("data-house", b.publicId);
    await expect(houses(page)).toHaveCount(1);
    await expect(page).toHaveURL(new RegExp(`\\?casa=${b.publicId}#pago=${b.publicId}$`));
  });

  test("ida y vuelta por la pasarela falsa desde la casa: vuelve a la misma casa", async ({ page, baseURL }) => {
    const casa = await h.seed({ status: "active", draft: { title: "Casa Cocles" } });
    await h.seed({ status: "active", draft: { title: "Cabina Punta Uva" } });
    await expire(casa.id);
    await owner(page);
    await page.goto(`${SCREEN}?casa=${casa.publicId}`);
    await houses(page).getByRole("button", { name: "Añadir método de pago" }).click();
    await expect(page).toHaveURL(new RegExp(`^${esc(baseURL!)}/_pago-falso/`));
    await page.getByRole("button", { name: "Guardar tarjeta de prueba" }).click();
    await expect(page).toHaveURL(new RegExp(`${SCREEN}\\?casa=${casa.publicId}#pago=${casa.publicId}$`)); // sin pago=ok
    await expect(page.getByRole("status").filter({ hasText: "Método de pago guardado. No se cobra nada hasta que termine la oferta." })).toBeVisible();
    await expect(houses(page)).toHaveCount(1);
    await expect(page.getByTestId("method-card")).toContainText("Visa ···· 4242");
  });
});
