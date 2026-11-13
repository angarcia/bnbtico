import { expect, test, type Page } from "./helpers/test";
import { postgrestHarness } from "../db/postgrest-harness";
import type { BillingHouse } from "../../src/domain/subscription";
import { injectSession, signOut } from "./helpers/session";

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
let eventSeq = 0;
const addCard = () =>
  h.service.applyPaymentEvent({
    provider: "fake",
    eventId: `evt_e2e_cya_${Date.now()}_${++eventSeq}`,
    type: "setup_completed",
    ownerId: h.ownerId("owner"),
    customerRef: "cus_e2e",
    methodRef: "pm_e2e",
    brand: "visa",
    last4: "4242",
    expMonth: 12,
    expYear: 2030,
  });
/** De Mis casas a Cuenta por el botón de arriba. */
async function ownerCuenta(page: Page) {
  await page.goto("/propietario/casas");
  // La cuenta es la pestaña de la derecha (revisión UX 2026-10-29, C4).
  await page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", { name: "Cuenta" }).click();
  await expect(page.getByRole("heading", { name: "Cuenta", level: 1 })).toBeAttached();
}
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** La caché de Query vive en IndexedDB (fresca 30 s): tras cambiar algo como el servicio, se abre la pantalla sin ella. */
async function fresh(page: Page, path: string) {
  await page.goto("/robots.txt");
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase("3bstays");
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

  test("sin red, con ?casa= de una casa que no está en la caché: conserva casa y no enseña las demás", async ({ page }) => {
    await h.seed({ status: "active", draft: { title: "Casa Cocles" } });
    await owner(page);
    await page.goto(SCREEN);
    await expect(houses(page)).toHaveCount(1);
    await page.waitForTimeout(1500); // la caché se guarda en IndexedDB con A sola
    const b = await h.seed({ status: "active", draft: { title: "Cabina Punta Uva" } });
    let hits = 0;
    await page.route("**/rest/v1/rpc/owner_billing", (route) => {
      hits++;
      return route.abort("internetdisconnected");
    });
    await page.goto(`${SCREEN}?casa=${b.publicId}`);
    await expect.poll(() => hits, { timeout: 10_000 }).toBeGreaterThanOrEqual(2); // la lectura y su reintento fallan
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(new RegExp(`\\?casa=${b.publicId}$`));
    await expect(page.getByRole("heading", { level: 1, name: "Suscripción" })).toBeVisible();
    await expect(houses(page)).toHaveCount(0);
    await expect(page.locator('.note[role="alert"]')).toHaveText("Sin conexión. Revise su internet e intente de nuevo.");
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

test.describe("Cuenta", () => {
  test("Flujo 4: Cuenta sin método de pago: la fila en ocre; con método, no", async ({ page }) => {
    const a = await h.seed({ status: "active", draft: { title: "Casa Cocles" } });
    await expire(a.id);
    const b = await h.seed({ status: "active", draft: { title: "Crystal Jungle Villa" } });
    await h.seed({ status: "review", draft: { title: "Cabina Punta Uva" } });
    await owner(page);
    await ownerCuenta(page);
    const pay = page.getByTestId("payment-row");
    await expect(pay).toHaveClass(/list-item-sun/);
    await expect(pay).toContainText("Falta · añádalo antes de que termine su oferta");
    await expect(pay).toHaveAttribute("href", SCREEN);
    const rows = page.getByTestId("sub-row");
    const rowA = rows.filter({ hasText: "Casa Cocles" });
    await expect(rowA).toHaveAttribute("data-ocre", "1");
    await expect(rowA.locator(".badge.badge-sun")).toHaveText("Pendiente de pago");
    const rowB = rows.filter({ hasText: "Crystal Jungle Villa" });
    await expect(rowB).toHaveCount(0);
    await expect(page.getByTestId("subscription-counts")).toHaveText("2 casas");
    const rowC = rows.filter({ hasText: "Cabina Punta Uva" });
    await expect(rowC.locator("a")).toHaveCount(0);
    expect(await rowC.evaluate((e) => e.tagName)).toBe("DIV");
    await page.screenshot({ path: "test-results/capturas/cuenta-metodo-ocre.png", fullPage: true });
    await page.getByTestId("subscriptions-link").click();
    await expect(page).toHaveURL(new RegExp(`${SCREEN}$`));
    await expect(houses(page)).toHaveCount(2);
    await expect(page.locator(`[data-house="${b.publicId}"]`)).toBeVisible();

    await addCard();
    await fresh(page, "/cuenta");
    // Revisión UX 2026-10-29 (C5): con método, la fila no sale; el método se ve en «Ver detalle».
    await expect(page.getByTestId("sub-row").first()).toBeVisible();
    await expect(page.getByTestId("payment-row")).toHaveCount(0);
  });

  // Revisión UX 2026-10-29 (C5, Ana): la fila solo sale cuando falta el método y toca avisar, en ocre.
  test("la fila del método de pago solo sale, en ocre, cuando toca avisar", async ({ page }) => {
    const pay = page.getByTestId("payment-row");
    const neutral = async () => {
      await expect(page.getByRole("link", { name: /Ayuda por WhatsApp/ })).toBeVisible();
      await expect(pay).toHaveCount(0);
    };
    // Solo un borrador: nada que pagar todavía.
    await h.seed({ status: "draft", draft: { title: "Borrador" } });
    await owner(page);
    await ownerCuenta(page);
    await neutral();
    // Una casa en su oferta gratuita, lejos del final.
    const a = await h.seed({ status: "active", draft: { title: "Casa Cocles" } });
    await fresh(page, "/cuenta");
    await expect(page.getByTestId("sub-row").filter({ hasText: "Casa Cocles" })).toHaveCount(0);
    await expect(page.getByTestId("subscription-counts")).toHaveText("1 casa");
    await neutral();
    // Toca el aviso de los 7 días: ya sale «Añadir método de pago» en la casa, y la fila en ocre.
    await h.setDaysLeft(a.id, 7);
    await fresh(page, "/cuenta");
    await expect(pay).toHaveClass(/list-item-sun/);
    await expect(pay).toContainText("Falta · añádalo antes de que termine su oferta");
  });

  test("una casa parada: su línea de la suscripción en ocre con «Inactiva»", async ({ page }) => {
    const a = await h.seed({ status: "active", draft: { title: "Casa Cocles" } });
    await h.billing("owner").stop(a.id);
    await owner(page);
    await fresh(page, "/cuenta");
    const row = page.getByTestId("sub-row").filter({ hasText: "Casa Cocles" });
    await expect(row).toHaveAttribute("data-ocre", "1");
    await expect(row.locator(".sun-ink")).toHaveText("Casa Cocles");
    await expect(row.locator(".badge.badge-sun")).toHaveText("Inactiva");
    await expect(row).toHaveAttribute("href", `${SCREEN}?casa=${a.publicId}`);
  });

  test("Cerrar sesión: el enlace mide al menos 44 px de alto", async ({ page }) => {
    await owner(page);
    await page.goto("/cuenta");
    const box = (await page.getByRole("button", { name: "Cerrar sesión" }).boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
  });

  test("Cerrar sesión falla: aviso, el botón vuelve y el foco va al título", async ({ page }) => {
    await owner(page);
    await page.goto("/cuenta");
    await expect(page.getByRole("heading", { name: h.ownerName("owner") })).toBeVisible();
    // Sin red para revocarla en el servidor y sin poder borrarla del teléfono: la sesión no se cierra.
    await page.route("**/auth/v1/logout*", (route) => route.abort("internetdisconnected"));
    await page.evaluate(() => {
      const remove = Storage.prototype.removeItem;
      Storage.prototype.removeItem = function (this: Storage, key: string) {
        if (key === "3bstays-auth") throw new Error("storage");
        return remove.call(this, key);
      };
    });
    await signOut(page);
    await expect(page.locator('.note[role="alert"]')).toHaveText("No pudimos cerrar la sesión. Intente de nuevo.");
    await expect(page.getByRole("button", { name: "Cerrar sesión" })).toBeEnabled();
    await expect(page.getByRole("heading", { level: 1, name: "Cuenta" })).toBeFocused();
    expect(await page.evaluate(() => localStorage.getItem("3bstays-auth"))).not.toBeNull();
  });

  test("Flujo 5: Cuenta: la línea de identidad bajo WhatsApp verificado", async ({ page }) => {
    const check = async () => {
      await page.goto("/cuenta");
      const line = page.getByTestId("identity-soon");
      await expect(line).toHaveText("Pronto podrá verificar también su identidad (opcional).", { useInnerText: true });
      await expect(page.getByRole("link", { name: /identidad/ })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /identidad/ })).toHaveCount(0);
      const verified = await page.getByText("WhatsApp verificado", { exact: false }).boundingBox();
      expect((await line.boundingBox())!.y).toBeGreaterThan(verified!.y);
      await expect(page.getByText(/identidad/)).toHaveCount(1);
    };
    await injectSession(page, "other");
    await check();
    await h.seed({ status: "active", draft: { title: "Casa Cocles" } });
    await owner(page);
    await check();
    await expect(page.getByTestId("subscription-card")).toBeVisible();
    await expect(page.getByText(/identidad/)).toHaveCount(1);
  });

  test("Flujo 6: Cerrar sesión: lo último de la pantalla, con confirmación", async ({ page }) => {
    await h.seed({ status: "active", draft: { title: "Casa Cocles" } });
    await owner(page);
    await page.goto("/cuenta");
    await expect(page.getByTestId("subscription-card")).toBeVisible();
    await expect(page.getByRole("link", { name: /Ayuda por WhatsApp/ })).toBeVisible();
    const lowest = () =>
      page.evaluate(() => {
        const els = [...document.querySelectorAll("main *")].filter((e) => e.getClientRects().length && !e.children.length);
        return els.sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0]?.textContent;
      });
    expect(await lowest()).toBe("Cerrar sesión");
    const logout = page.getByRole("button", { name: "Cerrar sesión" });
    expect((await logout.boundingBox())!.y).toBeGreaterThan((await page.getByText("Términos y privacidad").boundingBox())!.y);
    const dialog = page.getByRole("dialog");

    await logout.click();
    await expect(dialog.getByRole("heading", { name: "¿Cerrar sesión?" })).toBeVisible();
    await expect(dialog).toContainText("Tendrá que recibir un código nuevo para volver a entrar.");
    await page.screenshot({ path: "test-results/capturas/cuenta-cerrar-sesion.png" });
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(logout).toBeFocused();
    await page.getByRole("link", { name: "Editar", exact: true }).click(); // #root ya no está inerte
    await expect(page).toHaveURL(/\/cuenta\?editar=1$/);
    await page.goto("/cuenta");

    await logout.click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(logout).toBeFocused();

    await logout.click();
    await expect(dialog).toBeVisible();
    await page.locator(".sheet-backdrop").click({ position: { x: 20, y: 20 } });
    await expect(dialog).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole("heading", { name: h.ownerName("owner") })).toBeVisible();

    await signOut(page);
    await expect(page.getByRole("heading", { name: "Entre con su WhatsApp" })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("3bstays-auth"))).toBeNull();
  });
});

test.describe("Actividad por casa", () => {
  // «Cerrar sesión» (Flujo 6) cierra también la sesión del arnés para ese propietario: un arnés nuevo, con sesiones nuevas.
  test.beforeAll(async () => {
    h = await postgrestHarness();
  });

  /** Una consulta nueva del cliente «other»; la base junta las de 7 días a la misma casa, así que se atrasa cada una. */
  async function inquiry(publicId: string, days: number) {
    const { inquiryId } = await h.inquiries("other").create(publicId, { people: 2, arrival: null, departure: null });
    await h.backdateInquiry(inquiryId, days);
    return inquiryId;
  }
  const inquiryCards = (page: Page) => page.locator("article.inquiry-card");
  const picker = (page: Page) => page.getByTestId("house-picker-trigger");
  const options = (page: Page) => page.getByRole("listbox", { name: "Elegir casa" });
  async function choose(page: Page, name: string) {
    await picker(page).click();
    await options(page).getByRole("option", { name, exact: true }).click();
  }

  test("Flujo 7: Consultas con dos casas: nombre discreto y selector que conserva la casa en la URL", async ({ page }) => {
    // El selector sigue el orden de Mis casas (la más nueva primero): Cabina se crea antes que Cocles.
    await h.seed({ status: "draft", draft: { title: "Borrador" } });
    const cabina = await h.seed({ status: "active", photos: 5, draft: { title: "Cabina Punta Uva" } });
    const cocles = await h.seed({ status: "active", photos: 5, draft: { title: "Casa Cocles" } });
    // La de Cabina es la más vieja: con 21 de Cocles más recientes, quedaría fuera de las 20 últimas si se filtrara después.
    await inquiry(cabina.publicId, 400);
    for (let n = 0; n < 21; n++) await inquiry(cocles.publicId, 8 * (21 - n));
    await owner(page);
    await page.goto("/propietario/actividad");

    await expect(inquiryCards(page)).toHaveCount(20);
    for (const card of await inquiryCards(page).all()) {
      const tag = card.getByTestId("inquiry-house");
      await expect(tag.locator("img")).toHaveCount(0);
      await expect(tag).toHaveText("Casa Cocles");
    }
    const first = inquiryCards(page).first();
    await expect(first).toContainText("sin fechas · 2 personas");
    await expect(first).not.toContainText("Casa Cocles ·");

    const fresh_ = page.getByTestId("inquiries-new");
    await expect(fresh_).toHaveText(/^\d+ consultas nuevas$/);
    await expect(picker(page)).toHaveText("Todas las casas");
    expect((await picker(page).boundingBox())!.y).toBeGreaterThan((await fresh_.boundingBox())!.y);
    const figures = page.locator("article.activity-card");
    await expect(figures).toHaveCount(0);
    await picker(page).click();
    const sheet = page.getByRole("dialog", { name: "Filtrar por casa" });
    await expect(sheet).toBeFocused();
    await expect(options(page).getByRole("option")).toHaveText(["Todas las casas", "Casa Cocles", "Cabina Punta Uva"]);
    await expect(options(page).getByRole("option", { name: "Todas las casas", exact: true })).toHaveAttribute("aria-selected", "true");
    await options(page).getByRole("option", { name: "Cabina Punta Uva", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/propietario/actividad\\?casa=${cabina.id}$`));
    await expect(inquiryCards(page)).toHaveCount(1);
    await expect(inquiryCards(page)).toContainText("sin fechas · 2 personas");
    await expect(inquiryCards(page).getByTestId("inquiry-house")).toHaveCount(0);
    await expect(figures).toHaveCount(0);
    await page.reload();
    await expect(inquiryCards(page)).toHaveCount(1);
    await expect(picker(page)).toHaveText("Cabina Punta Uva");
    await picker(page).click();
    await expect(options(page).getByRole("option", { name: "Cabina Punta Uva", exact: true })).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Escape");
    await expect(picker(page)).toBeFocused();

    await page.goto("/propietario/actividad?casa=00000000-0000-4000-8000-000000000000");
    await expect(page).toHaveURL(/\/propietario\/actividad$/);
    await expect(picker(page)).toHaveText("Todas las casas");

    const vacia = await h.seed({ status: "active", photos: 5, draft: { title: "Casa Vacía" } });
    await fresh(page, "/propietario/actividad");
    await choose(page, "Casa Vacía");
    await expect(page).toHaveURL(new RegExp(`\\?casa=${vacia.id}$`));
    await expect(page.getByText("Todavía no hay consultas de esta casa.")).toBeVisible();
    await expect(inquiryCards(page)).toHaveCount(0);
  });

  test("marca como vistas solo las consultas que aparecen en pantalla, sin reordenarlas", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const cocles = await h.seed({ status: "active", draft: { title: "Casa Cocles" } });
    const cabina = await h.seed({ status: "active", draft: { title: "Cabina Punta Uva" } });
    const otherId = await inquiry(cabina.publicId, 0);
    const ids: string[] = [];
    for (let n = 0; n < 8; n++) ids.push(await inquiry(cocles.publicId, 8 * (7 - n)));
    const firstId = ids[7]!;
    const lastId = ids[0]!;
    const seen = async (id: string) => (await h.inquiries("owner").listForOwner()).find((i) => i.id === id)?.openedAt ?? null;

    await owner(page);
    await page.goto(`/propietario/actividad?casa=${cocles.id}`);
    const cards = inquiryCards(page);
    const first = cards.filter({ has: page.locator(`[id="inquiry-${firstId}"]`) });
    const last = cards.filter({ has: page.locator(`[id="inquiry-${lastId}"]`) });
    await expect(first).toBeInViewport();
    await expect(last).not.toBeInViewport();
    await expect.poll(() => seen(firstId)).not.toBeNull();
    await expect(first.getByText("Nueva", { exact: true })).toHaveCount(0);
    await expect(cards.first()).toHaveAttribute("aria-labelledby", `inquiry-${firstId}`);
    expect(await seen(lastId)).toBeNull();
    expect(await seen(otherId)).toBeNull();

    await last.scrollIntoViewIfNeeded();
    await expect.poll(() => seen(lastId)).not.toBeNull();
    await expect(last.getByText("Nueva", { exact: true })).toHaveCount(0);
    expect(await seen(otherId)).toBeNull();
  });

  test("sin red, con ?casa= de una casa que no está en la caché: conserva casa y enseña sus consultas", async ({ page }) => {
    const cabina = await h.seed({ status: "active", photos: 5, draft: { title: "Cabina Punta Uva" } });
    await h.seed({ status: "active", photos: 5, draft: { title: "Casa Cocles" } });
    await inquiry(cabina.publicId, 1);
    await owner(page);
    await page.goto("/propietario/actividad");
    await picker(page).click();
    await expect(options(page).getByRole("option")).toHaveCount(3);
    await page.getByRole("dialog", { name: "Filtrar por casa" }).getByRole("button", { name: "Cerrar", exact: true }).click();
    await page.waitForTimeout(1500); // la caché se guarda en IndexedDB sin la casa nueva
    const nueva = await h.seed({ status: "active", photos: 5, draft: { title: "Casa Nueva" } });
    await inquiry(nueva.publicId, 0);
    let hits = 0;
    await page.route("**/rest/v1/listings?**", (route) => {
      hits++;
      return route.abort("internetdisconnected");
    });
    await page.goto(`/propietario/actividad?casa=${nueva.id}`);
    await expect.poll(() => hits, { timeout: 15_000 }).toBeGreaterThanOrEqual(4); // la lectura y sus tres reintentos fallan
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(new RegExp(`\\?casa=${nueva.id}$`));
    await expect(inquiryCards(page)).toHaveCount(1);
    await expect(inquiryCards(page)).toContainText("sin fechas · 2 personas");
  });

  test("con una sola casa: sin selector ni nombre de casa duplicado", async ({ page }) => {
    const cocles = await h.seed({ status: "active", photos: 5, draft: { title: "Casa Cocles" } });
    await inquiry(cocles.publicId, 0);
    await owner(page);
    await page.goto("/propietario/actividad");
    await expect(inquiryCards(page).getByTestId("inquiry-house")).toHaveCount(0);
    await expect(picker(page)).toHaveCount(0);
  });

  test("selector compartido: nombres completos, lista larga, teclado y mismo acabado en Calendario", async ({ page }) => {
    const legacy = await h.seed({ status: "active", draft: { title: "Casa Manzanillo" } });
    const longName = "Casa Manzanillo frente al mar con jardín y acceso al parque nacional";
    await h.setLegacyTitle(legacy.id, longName);
    let last = legacy;
    for (let n = 1; n <= 10; n++) last = await h.seed({ status: "active", draft: { title: `Casa selector ${n}` } });
    await owner(page);
    await page.goto("/propietario/actividad");
    // El selector también está disponible antes de recibir la primera consulta.
    await expect(picker(page)).toHaveText("Todas las casas");
    const background = await picker(page).evaluate((el) => getComputedStyle(el).backgroundColor);
    for (const viewport of [{ width: 375, height: 667 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await picker(page).click();
      const sheet = page.getByRole("dialog", { name: "Filtrar por casa", exact: true });
      const list = options(page);
      await expect(list.getByRole("option", { name: longName, exact: true })).toHaveText(longName);
      await expect(page.locator("#root")).toHaveJSProperty("inert", true);
      await page.keyboard.press("Shift+Tab");
      await expect(list.getByRole("option", { name: "Todas las casas", exact: true })).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(sheet.getByRole("button", { name: "Cerrar", exact: true })).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(list.getByRole("option", { name: "Todas las casas", exact: true })).toBeFocused();
      expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
      const box = (await sheet.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(0);
      await expect.poll(async () => {
        const settled = (await sheet.boundingBox())!;
        return settled.y + settled.height;
      }).toBeLessThanOrEqual(viewport.height + 1);
      // 52 px de alto táctil, con medio píxel de margen: el runner mide a veces 51,99998 por el redondeo de subpíxel.
      for (const row of await list.getByRole("option").all()) expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(51.5);
      await sheet.getByRole("button", { name: "Cerrar", exact: true }).click();
      await expect(picker(page)).toBeFocused();
      await expect(page.locator("#root")).toHaveJSProperty("inert", false);
    }
    await picker(page).press("ArrowDown");
    const all = options(page).getByRole("option", { name: "Todas las casas", exact: true });
    await all.focus();
    await all.press("ArrowDown");
    const newest = options(page).getByRole("option", { name: "Casa selector 10", exact: true });
    await expect(newest).toBeFocused();
    await newest.press("Enter");
    await expect(page).toHaveURL("/propietario/actividad?casa=" + last.id);
    await expect(picker(page)).toHaveText("Casa selector 10");
    await page.goto("/propietario/calendario?casa=" + last.id);
    await expect(picker(page)).toHaveText("Casa selector 10");
    expect(await picker(page).evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(background);
    await picker(page).click();
    await expect(options(page).getByRole("option", { name: "Todas las casas", exact: true })).toHaveCount(0);
    await options(page).getByRole("option", { name: longName, exact: true }).click();
    await expect(page).toHaveURL("/propietario/calendario?casa=" + legacy.id);
    await expect(picker(page)).toHaveText(longName);
    await picker(page).click();
    await page.keyboard.press("Escape");
    await expect(picker(page)).toBeFocused();
  });
});

for (const actor of ["owner", "other"] as const) {
  test(`Perfil de ${actor}: un único Editar abre y cierra el formulario sin cambios`, async ({ page }) => {
    if (actor === "owner") await h.seed({ status: "active", draft: { title: "Casa perfil" } });
    await injectSession(page, actor);
    await page.goto("/cuenta");
    const edit=page.getByRole("link", { name: "Editar", exact: true });
    await expect(edit).toBeVisible();
    await expect(page.getByRole("link", { name: /Mi perfil/ })).toHaveCount(0);
    const editBox=(await edit.boundingBox())!;
    expect(editBox.height).toBeGreaterThanOrEqual(44);
    expect(editBox.width).toBeGreaterThanOrEqual(44);
    await edit.click();
    await expect(page.getByRole("heading", { name: "Mi perfil", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Guardar cambios", exact: true })).toBeDisabled();
    const done=page.getByRole("link", { name: "Listo", exact: true });
    const doneBox=(await done.boundingBox())!;
    expect(doneBox.height).toBeGreaterThanOrEqual(44);
    expect(doneBox.width).toBeGreaterThanOrEqual(44);
    await done.click();
    await expect(page.getByRole("heading", { name: "Mi perfil", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Editar", exact: true })).toBeVisible();
  });
}
