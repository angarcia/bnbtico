import { expect, test, type Page } from "./helpers/test";
import { postgrestHarness } from "../db/postgrest-harness";
import { SUBSCRIPTION_MESSAGES, cardDate, houseSubscription, launchOffer, nextCharge, type BillingHouse } from "../../src/domain/subscription";
import { enterCode, injectSession } from "./helpers/session";

// «Promoción y suscripción» y la parte de la suscripción en Cuenta (fase 5, ticket 05), contra Supabase local y la
// pasarela falsa del worker (PAYMENTS=fake de pnpm dev:vars). Cada prueba vacía la base y crea sus casas; los estados se
// fijan como el servicio (fin de la oferta + trabajo diario, evento de pago) y las cifras de la oferta se comparan con lo
// que dice la base, nunca con un número fijo.
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
const FEE = "₡2 900";
const SCREEN = "/propietario/suscripcion";
let h: Awaited<ReturnType<typeof postgrestHarness>>;
let eventSeq = 0;

test.beforeAll(async () => {
  h = await postgrestHarness();
});

test.beforeEach(async ({ page }) => {
  await h.reset();
  await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
});

const owner = (page: Page) => injectSession(page, "owner");
const house = (page: Page, title: string) => page.getByRole("article").filter({ has: page.getByRole("heading", { name: title }) });
const mine = async (id: string): Promise<BillingHouse> => (await h.billing("owner").overview()).houses.find((x) => x.listingId === id)!;
/** Mis casas deja la interfaz en modo propietario; de ahí a Cuenta por la pestaña. */
async function ownerCuenta(page: Page) {
  await page.goto("/propietario/casas");
  await page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", { name: "Cuenta" }).click();
  await expect(page.getByRole("heading", { name: "Cuenta", level: 1 })).toBeVisible();
}
const statusOf = async (id: string) => (await mine(id)).status;
const addCard = () =>
  h.service.applyPaymentEvent({
    provider: "fake",
    eventId: `evt_e2e_sub_${Date.now()}_${++eventSeq}`,
    type: "setup_completed",
    ownerId: h.ownerId("owner"),
    customerRef: "cus_e2e",
    methodRef: "pm_e2e",
    brand: "visa",
    last4: "4242",
    expMonth: 12,
    expYear: 2030,
  });
const expire = async (id: string) => {
  await h.setDaysLeft(id, -1);
  await h.service.runDay();
};
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

test("cada estado con su línea, aviso y botones; «Añadir método de pago» solo cuando toca; el método y la oferta", async ({ page }) => {
  const lejos = await h.seed({ status: "active", draft: { title: "Casa sin prisa" } });
  await owner(page);
  await page.goto(SCREEN);
  await expect(page.getByRole("heading", { name: "Promoción y suscripción" })).toBeVisible();
  const a = house(page, "Casa sin prisa");
  await expect(a.getByText("Activa", { exact: true })).toBeVisible();
  await expect(a.getByTestId("sub-line")).toHaveText(`Gratis hasta el ${cardDate((await mine(lejos.id)).promoEndsOn!)}`);
  await expect(a.getByText("Avisos por WhatsApp: 90, 30 y 7 días antes y el último día.")).toBeVisible();
  await expect(a.getByRole("button", { name: "Añadir método de pago" })).toHaveCount(0);
  await expect(a.getByRole("button", { name: "Parar suscripción" })).toHaveClass(/btn-ghost/);
  const method = page.getByTestId("method-card");
  await expect(method).toContainText("Ninguno todavía");
  await expect(method).toContainText("Puede añadirlo cuando le avisemos.");
  await expect(method.getByRole("button", { name: "Añadir método de pago" })).toHaveCount(0);
  const offer = launchOffer(await h.anon.offerTaken())!;
  const tiers = page.getByTestId("tiers-card");
  await expect(tiers).toContainText("Primeras 50 casas: 12 meses gratis. Siguientes 50: 6 meses. Siguientes 100: 3 meses.");
  await expect(tiers).toContainText(`Quedan ${offer.remaining} de ${offer.size}`);
  await expect(page.getByTestId("how-it-works")).toContainText("Cómo funciona");

  const cerca = await h.seed({ status: "active", draft: { title: "Casa en la ventana" } });
  await h.setDaysLeft(cerca.id, 30);
  await h.service.runDay(); // encola el aviso de los 30 días
  const debe = await h.seed({ status: "active", draft: { title: "Casa por pagar" } });
  await expire(debe.id);
  const parada = await h.seed({ status: "active", draft: { title: "Casa parada" } });
  await h.billing("owner").stop(parada.id);
  await fresh(page, SCREEN);

  const b = house(page, "Casa en la ventana");
  await expect(b.getByText("Activa", { exact: true })).toBeVisible();
  await expect(b.getByTestId("pay-notice")).toContainText("Su oferta gratuita termina en 30 días");
  await expect(b.getByTestId("pay-notice")).toContainText("También se lo recordamos por WhatsApp.");
  await expect(b).not.toContainText("Hola,"); // nunca el texto del WhatsApp
  await expect(b.getByRole("button", { name: "Añadir método de pago" })).toHaveClass(/btn-sun/);

  const c = house(page, "Casa por pagar");
  await expect(c.getByText("Pendiente de pago", { exact: true }).first()).toBeVisible();
  await expect(c.getByTestId("pay-notice")).toContainText("La ficha está oculta y el enlace no funciona hasta que añada un método de pago.");
  await expect(c.getByRole("button", { name: "Añadir método de pago" })).toBeVisible();
  await expect(c.getByRole("button", { name: "Parar suscripción" })).toBeVisible();

  const d = house(page, "Casa parada");
  await expect(d.getByText("Inactiva", { exact: true })).toBeVisible();
  await expect(d.getByTestId("sub-line")).toHaveText(/^Parada el \d+ \w+.* · no se cobra$/);
  await expect(d.getByRole("button", { name: "Reactivar" })).toHaveClass(/btn-primary/);
  await expect(d.getByRole("button", { name: "Añadir método de pago" })).toHaveCount(0);
  await expect(d.getByRole("button", { name: "Parar suscripción" })).toHaveCount(0);

  await expect(a.getByRole("button", { name: "Añadir método de pago" })).toHaveCount(0);
  await expect(method.getByRole("button", { name: "Añadir método de pago" })).toBeVisible();
  await expect(method).not.toContainText("Puede añadirlo cuando le avisemos.");
  await page.screenshot({ path: "test-results/capturas/suscripcion-estados.png", fullPage: true });

  // Con método: la pendiente pasa al plan de pago y activa; ningún botón de pago; el método con «Cambiar».
  await addCard();
  await fresh(page, SCREEN);
  const today = (await h.billing("owner").overview()).today;
  await expect(c.getByText("Activa", { exact: true })).toBeVisible();
  await expect(c.getByTestId("sub-line")).toHaveText(`Suscripción activa desde el ${cardDate(today)} · ${FEE} al mes`);
  await expect(b.getByTestId("sub-line")).toHaveText(`Gratis hasta el ${cardDate((await mine(cerca.id)).promoEndsOn!)}`);
  await expect(page.getByTestId("pay-notice")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Añadir método de pago" })).toHaveCount(0);
  await expect(method).toContainText("Visa ···· 4242 · vence 12/30");
  await expect(method.getByRole("button", { name: "Cambiar" })).toBeVisible();
  await page.screenshot({ path: "test-results/capturas/suscripcion-con-metodo.png", fullPage: true });
});

test("parar con confirmación y reactivar, optimistas; si la base se niega, vuelve atrás con su mensaje", async ({ page }) => {
  const casa = await h.seed({ status: "active", draft: { title: "Casa Cocles" } });
  const otra = await h.seed({ status: "active", draft: { title: "Casa Uva" } });
  await owner(page);
  await page.goto(SCREEN);
  const a = house(page, "Casa Cocles");
  await expect(a.getByText("Activa", { exact: true })).toBeVisible();

  await a.getByRole("button", { name: "Parar suscripción" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("¿Parar la suscripción de Casa Cocles? La casa deja de verse y no se cobra. Puede reactivarla cuando quiera.");
  await page.screenshot({ path: "test-results/capturas/suscripcion-confirmar.png" });
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialog).toHaveCount(0);
  expect(await statusOf(casa.id)).toBe("active");

  // Optimista: la tarjeta cambia antes de que responda la base (respuesta retenida).
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route("**/rest/v1/rpc/stop_subscription", async (route) => {
    await held;
    await route.continue();
  });
  await a.getByRole("button", { name: "Parar suscripción" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Parar suscripción" }).click();
  await expect(a.getByText("Inactiva", { exact: true })).toBeVisible();
  await expect(a.getByRole("button", { name: "Reactivar" })).toBeVisible();
  release();
  await expect.poll(() => statusOf(casa.id)).toBe("inactive");
  expect(await statusOf(otra.id)).toBe("active"); // las demás casas no cambian
  await expect(house(page, "Casa Uva").getByText("Activa", { exact: true })).toBeVisible();
  await page.unroute("**/rest/v1/rpc/stop_subscription");

  await a.getByRole("button", { name: "Reactivar" }).click();
  await expect(a.getByText("Activa", { exact: true })).toBeVisible();
  await expect.poll(() => statusOf(casa.id)).toBe("active");

  // La base se niega: vuelve a «Activa» y dice por qué.
  await page.route("**/rest/v1/rpc/stop_subscription", async (route) => {
    await new Promise((r) => setTimeout(r, 400));
    await route.fulfill({ status: 400, json: { code: "P0001", message: SUBSCRIPTION_MESSAGES.stop, details: null, hint: null } });
  });
  await a.getByRole("button", { name: "Parar suscripción" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Parar suscripción" }).click();
  await expect(a.getByText("Inactiva", { exact: true })).toBeVisible();
  await expect(a.getByRole("alert")).toHaveText(SUBSCRIPTION_MESSAGES.stop);
  await expect(a.getByText("Activa", { exact: true })).toBeVisible();
  expect(await statusOf(casa.id)).toBe("active");

  // Sin red: lo mismo, con el aviso de conexión.
  await page.unroute("**/rest/v1/rpc/stop_subscription");
  await page.route("**/rest/v1/rpc/resume_subscription", (route) => route.abort("internetdisconnected"));
  await h.billing("owner").stop(casa.id);
  await fresh(page, SCREEN);
  await a.getByRole("button", { name: "Reactivar" }).click();
  await expect(a.getByRole("alert")).toHaveText("Sin conexión. Revise su internet e intente de nuevo.");
  await expect(a.getByText("Inactiva", { exact: true })).toBeVisible();
});

test("#pago=CT-#### con sesión resalta esa casa y la trae a la vista", async ({ page }) => {
  const casas = [];
  for (let i = 1; i <= 5; i++) casas.push(await h.seed({ status: "active", draft: { title: `Casa número ${i}` } }));
  const target = casas[0]!; // la más antigua: la última de la lista
  await h.setDaysLeft(target.id, 7);
  await owner(page);
  await page.goto(`${SCREEN}#pago=${target.publicId}`);
  const card = house(page, "Casa número 1");
  await expect(card).toHaveClass(/is-target/);
  await expect(card).toBeInViewport();
  await expect(card).toBeFocused();
  await expect(house(page, "Casa número 5")).not.toHaveClass(/is-target/);
  await page.screenshot({ path: "test-results/capturas/suscripcion-resaltada.png" });
});

test("#pago=CT-#### sin sesión: Ingresar y de vuelta a la misma casa", async ({ page }) => {
  const casa = await h.seed({ status: "active", draft: { title: "Casa del enlace" } });
  await expire(casa.id);
  await page.goto(`${SCREEN}#pago=${casa.publicId}`);
  await expect(page).toHaveURL(/\/cuenta\?next=/);
  expect(new URL(page.url()).searchParams.get("next")).toBe(`${SCREEN}#pago=${casa.publicId}`);
  await page.getByLabel("Número de WhatsApp").fill("8777 0001");
  await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();
  await enterCode(page);
  await expect(page).toHaveURL(new RegExp(`${SCREEN}#pago=${casa.publicId}$`));
  const card = house(page, "Casa del enlace");
  await expect(card).toHaveClass(/is-target/);
  await expect(card.getByRole("button", { name: "Añadir método de pago" })).toBeVisible();
});

test("ida y vuelta por la pasarela falsa: tarjeta guardada y la casa pendiente pasa a activa", async ({ page, baseURL }) => {
  const casa = await h.seed({ status: "active", draft: { title: "Casa por pagar" } });
  await expire(casa.id);
  await owner(page);
  await page.goto(`${SCREEN}#pago=${casa.publicId}`);
  const card = house(page, "Casa por pagar");

  // Errores al abrir la página de pago: sin red y pagos apagados.
  await page.route("**/api/pago/sesion", (route) => route.abort("internetdisconnected"));
  await card.getByRole("button", { name: "Añadir método de pago" }).click();
  await expect(card.getByRole("alert")).toHaveText("Sin conexión. Revise su internet e intente de nuevo.");
  await page.unroute("**/api/pago/sesion");
  await page.route("**/api/pago/sesion", (route) => route.fulfill({ status: 503, json: { error: "Los pagos no están disponibles en este momento." } }));
  await card.getByRole("button", { name: "Añadir método de pago" }).click();
  await expect(card.getByRole("alert")).toHaveText("Los pagos no están disponibles en este momento.");
  await page.unroute("**/api/pago/sesion");

  const asked = page.waitForRequest((r) => r.url().endsWith("/api/pago/sesion"));
  await card.getByRole("button", { name: "Añadir método de pago" }).click();
  const req = await asked;
  expect(req.headers()["authorization"]).toMatch(/^Bearer ey/);
  expect(req.postDataJSON()).toEqual({ publicId: casa.publicId });
  await expect(page).toHaveURL(new RegExp(`^${baseURL}/_pago-falso/`));
  await page.getByRole("button", { name: "Guardar tarjeta de prueba" }).click();

  await expect(page.getByRole("status").filter({ hasText: "Método de pago guardado. No se cobra nada hasta que termine la oferta." })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${SCREEN}#pago=${casa.publicId}$`)); // sin ?pago=ok
  await expect(card.getByText("Activa", { exact: true })).toBeVisible();
  await expect(card).toHaveClass(/is-target/);
  await expect(page.getByTestId("method-card")).toContainText("Visa ···· 4242");
  await expect(page.getByRole("button", { name: "Añadir método de pago" })).toHaveCount(0);
  await page.screenshot({ path: "test-results/capturas/suscripcion-guardada.png", fullPage: true });
  expect(await statusOf(casa.id)).toBe("active");
});

test("vuelta con ?pago=ok sin que llegue el aviso de la pasarela: «Lo estamos confirmando»", async ({ page }) => {
  test.setTimeout(45_000);
  const casa = await h.seed({ status: "active", draft: { title: "Casa por pagar" } });
  await expire(casa.id);
  await owner(page);
  await page.goto(`${SCREEN}?pago=ok#pago=${casa.publicId}`);
  await expect(page.getByRole("status").filter({ hasText: "Guardando su método de pago…" })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${SCREEN}#pago=${casa.publicId}$`));
  await expect(page.getByRole("status").filter({ hasText: "Lo estamos confirmando; aparecerá en unos minutos." })).toBeVisible({ timeout: 15_000 });
  await expect(house(page, "Casa por pagar").getByText("Pendiente de pago", { exact: true }).first()).toBeVisible();
});

test("Cuenta del propietario: una línea por casa, próximo cobro, «Ver detalle» y la fila del método de pago", async ({ page }) => {
  const gratis = await h.seed({ status: "active", draft: { title: "Crystal Jungle Villa" } });
  const debe = await h.seed({ status: "active", draft: { title: "Rancho Manzanillo" } });
  await expire(debe.id);
  await h.seed({ status: "review", draft: { title: "Cabina Punta Uva" } });
  await owner(page);
  await ownerCuenta(page);
  const sub = page.getByTestId("subscription-card");
  await expect(sub.getByTestId("sub-row")).toHaveText([
    `Rancho ManzanilloPendiente de pago`,
    `Crystal Jungle VillaGratis hasta el ${cardDate((await mine(gratis.id)).promoEndsOn!)}`,
    "Cabina Punta UvaEn revisión · ₡0",
  ]);
  await expect(sub.getByTestId("next-charge")).toHaveText("₡0 · sin método de pago");
  const row = page.getByRole("link", { name: /Método de pago/ });
  await expect(row).toContainText("Ninguno todavía · tarjeta");
  await expect(row).toHaveAttribute("href", SCREEN);
  await page.screenshot({ path: "test-results/capturas/cuenta-suscripcion.png", fullPage: true });
  await sub.getByRole("link", { name: "Ver detalle" }).click();
  await expect(page).toHaveURL(new RegExp(`${SCREEN}$`));
  await expect(page.getByRole("heading", { name: "Promoción y suscripción" })).toBeVisible();
  await page.getByRole("link", { name: "Volver" }).click();
  await expect(page).toHaveURL(/\/cuenta$/);

  await addCard();
  await fresh(page, "/cuenta");
  const o = await h.billing("owner").overview();
  await expect(sub.getByTestId("next-charge")).toHaveText(nextCharge(o.houses.map((x) => houseSubscription(x, o.method)), o.method, o.today));
  await expect(page.getByRole("link", { name: /Método de pago/ })).toContainText("Visa ···· 4242");
});

test("sin owner_billing ni launch_offer_taken (base sin la migración), Cuenta y la pantalla salen sin la suscripción y sin errores", async ({ page }) => {
  await h.seed({ status: "active", draft: { title: "Casa Cocles" } });
  await page.route("**/rest/v1/rpc/owner_billing", (route) => route.fulfill({ status: 404, json: { code: "PGRST202", message: "Could not find the function" } }));
  await page.route("**/rest/v1/rpc/launch_offer_taken", (route) => route.fulfill({ status: 404, json: { code: "PGRST202", message: "Could not find the function" } }));
  await owner(page);
  await ownerCuenta(page);
  await expect(page.getByText("Cuando publique una casa, aquí verá su suscripción.", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: /Método de pago/ })).toHaveCount(0);
  await page.goto(SCREEN);
  await expect(page.getByTestId("tiers-card")).toContainText("Quedan");
  await expect(page.getByTestId("tiers-card")).not.toContainText("Quedan …");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("article")).toHaveCount(0);
});
