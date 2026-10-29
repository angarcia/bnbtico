import { expect, test, type Page } from "./helpers/test";
import { sql } from "../db/local";
import { postgrestHarness } from "../db/postgrest-harness";
import { cardDate, launchOffer, type BillingHouse } from "../../src/domain/subscription";
import { injectSession } from "./helpers/session";

// Estados de la suscripción en Mis casas, el detalle, el asistente y la ficha 410 (fase 5, ticket 06), contra
// Supabase local. Cada prueba vacía la base y crea sus casas; los estados se fijan como el servicio (fin de la oferta,
// trabajo diario, evento de pago) y las cifras de la oferta se comparan con lo que dice la base, nunca con un número fijo.
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
const FEE = "₡2 900";
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
const card = (page: Page, title: string) => page.getByRole("article").filter({ has: page.getByRole("heading", { name: title }) });
const payLink = (publicId: string) => `/propietario/suscripcion#pago=${publicId}`;
const mine = async (id: string): Promise<BillingHouse> => (await h.billing("owner").overview()).houses.find((x) => x.listingId === id)!;
const today = async () => (await h.billing("owner").overview()).today;
/** «26 oct» si es de este año (como el detalle). */
const dayOf = (date: string, now: string) => (date.slice(0, 4) === now.slice(0, 4) ? cardDate(date).slice(0, -5) : cardDate(date));
const addCard = () =>
  h.service.applyPaymentEvent({
    provider: "fake",
    eventId: `evt_e2e_${Date.now()}_${++eventSeq}`,
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
  await page.evaluate(() => new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase("bnbtico");
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  }));
  await page.goto(path);
}

test("Mis casas: arriba solo el pago (la pendiente antes que la ventana de 90 días); el borrador sale una sola vez, en su tarjeta", async ({ page }) => {
  const casa = await h.seed({ status: "active", draft: { title: "Casa Cocles" } });
  await h.seed({ status: "draft", draft: { title: "Borrador del Caribe" } });

  await owner(page);
  await page.goto("/propietario/casas");
  await expect(card(page, "Borrador del Caribe").getByRole("link", { name: "Seguir publicando" })).toBeVisible();
  await expect(page.getByTestId("resume-card")).toHaveCount(0);
  await expect(page.getByTestId("pay-notice")).toHaveCount(0);
  await expect(page.locator(".offer-card")).toHaveCount(0); // sin tarjeta de la oferta de lanzamiento (spec)

  await h.setDaysLeft(casa.id, 30);
  await fresh(page, "/propietario/casas");
  const notice = page.getByTestId("pay-notice");
  await expect(notice).toContainText("Casa Cocles");
  await expect(notice).toContainText("Su oferta gratuita termina en 30 días");
  await expect(notice).toContainText(`No se le cobrará nada hasta entonces. Añada un método de pago antes de esa fecha para que su casa siga saliendo en bnbtico; después, ${FEE} al mes por casa, sin permanencia. También se lo recordamos por WhatsApp.`);
  await expect(notice).not.toContainText("Hola,"); // nunca el texto del WhatsApp
  await expect(page.locator("[data-testid=pay-notice], [data-testid=resume-card]")).toHaveCount(1);
  await expect(card(page, "Borrador del Caribe").getByRole("link", { name: "Seguir publicando" })).toBeVisible();
  // La casa de la ventana no repite el botón de pago en su tarjeta: lo lleva el aviso de arriba.
  await expect(card(page, "Casa Cocles").getByRole("link", { name: "Añadir método de pago" })).toHaveCount(0);
  await page.screenshot({ path: "test-results/capturas/mis-casas-aviso.png", fullPage: true });
  const pay = notice.getByRole("link", { name: "Añadir método de pago" });
  await expect(pay).toHaveClass(/btn-sun/);
  await expect(pay).toHaveAttribute("href", payLink(casa.publicId));

  // La casa ya oculta por falta de método va antes que la que está en la ventana.
  const debe = await h.seed({ status: "active", draft: { title: "Casa por pagar" } });
  await expire(debe.id);
  await fresh(page, "/propietario/casas");
  await expect(page.getByTestId("pay-notice")).toHaveCount(1);
  await expect(page.getByTestId("pay-notice")).toContainText("Casa por pagar");
  await expect(page.getByTestId("pay-notice").getByRole("link", { name: "Añadir método de pago" })).toHaveAttribute("href", payLink(debe.publicId));
  await page.getByTestId("pay-notice").getByRole("link", { name: "Añadir método de pago" }).click();
  await expect(page).toHaveURL(new RegExp(`/propietario/suscripcion#pago=${debe.publicId}$`));

  await addCard();
  await fresh(page, "/propietario/casas");
  await expect(page.getByTestId("pay-notice")).toHaveCount(0);
  await expect(card(page, "Borrador del Caribe").getByRole("link", { name: "Seguir publicando" })).toBeVisible();
});

test("una sola casa: el aviso de pago arriba de su tarjeta y no dentro de ella; el detalle lo dice sin el nombre", async ({ page }) => {
  const casa = await h.seed({ status: "active", draft: { title: "Casa Cocles" } });
  await h.setDaysLeft(casa.id, 30);
  await owner(page);
  await page.goto("/propietario/casas");
  await expect(page.getByRole("heading", { level: 1, name: "Mis casas" })).toBeVisible();
  await expect(page.getByTestId("pay-notice")).toHaveCount(1);
  await expect(page.getByTestId("pay-notice")).toContainText("Casa Cocles");
  const only = card(page, "Casa Cocles");
  await expect(only.getByTestId("pay-notice")).toHaveCount(0);
  await expect(only.getByRole("link", { name: "Añadir método de pago" })).toHaveCount(0);
  expect((await page.getByTestId("pay-notice").boundingBox())!.y).toBeLessThan((await only.boundingBox())!.y);
  await expect(page.getByTestId("subscription-row")).toHaveCount(0); // la línea de la suscripción va en el detalle
  await page.goto(`/propietario/casas/${casa.id}`);
  await expect(page.getByTestId("subscription-row")).toBeVisible();
  await expect(page.getByTestId("pay-notice")).toHaveCount(1);
  await expect(page.getByTestId("pay-notice")).not.toContainText("Casa Cocles");
});

test("Mis casas: casillas, etiqueta y botones de cada estado y su línea en el detalle; con método, el botón ocre desaparece y la pendiente vuelve", async ({ page }) => {
  const lejos = await h.seed({ status: "active", draft: { title: "Casa sin prisa" } });
  const cerca = await h.seed({ status: "active", draft: { title: "Casa en la ventana" } });
  await h.setDaysLeft(cerca.id, 30);
  const debe = await h.seed({ status: "active", draft: { title: "Casa por pagar" } });
  await expire(debe.id);
  const parada = await h.seed({ status: "active", draft: { title: "Casa parada" } });
  await h.billing("owner").stop(parada.id);
  const review = await h.seed({ status: "review", draft: { title: "Casa en revisión" } });
  const [subLejos, subCerca] = [await mine(lejos.id), await mine(cerca.id)];
  expect((await mine(debe.id)).status).toBe("payment_due");

  await owner(page);
  await page.goto("/propietario/casas");
  await expect(page.locator(".tile")).toHaveText(["2activas", "1por pagar", "1en revisión"]);

  // Solo la etiqueta y los botones en la tarjeta; las líneas de la suscripción, en el detalle.
  const a = card(page, "Casa sin prisa");
  await expect(a.getByTestId("card-label")).toHaveText("Activa");
  await expect(a.getByTestId("card-line")).toHaveCount(0);
  await expect(a.getByRole("button", { name: "Compartir ficha" })).toBeVisible();
  await expect(a.getByRole("link", { name: "Calendario" })).toBeVisible();
  await expect(a.getByRole("link", { name: "Añadir método de pago" })).toHaveCount(0);

  const b = card(page, "Casa en la ventana");
  await expect(b.getByTestId("card-label")).toHaveText("Activa");
  await expect(b.getByRole("button", { name: "Compartir ficha" })).toBeVisible();
  await expect(b.getByRole("link", { name: "Calendario" })).toBeVisible();
  await expect(b.getByRole("link", { name: "Añadir método de pago" })).toHaveCount(0); // lo cubre el aviso de arriba

  const c = card(page, "Casa por pagar");
  await expect(c.getByTestId("card-label")).toHaveText("Pendiente de pago");
  await expect(c.getByRole("link", { name: "Añadir método de pago" })).toHaveAttribute("href", payLink(debe.publicId));
  await expect(c.getByRole("link", { name: "Añadir método de pago" })).toHaveClass(/btn-sun/);
  await expect(c.getByRole("button")).toHaveCount(0);
  await expect(c.getByRole("link", { name: "Calendario" })).toHaveCount(0);

  const d = card(page, "Casa parada");
  await expect(d.getByTestId("card-label")).toHaveText("Inactiva");
  await expect(d.getByRole("link", { name: "Activar suscripción" })).toHaveAttribute("href", payLink(parada.publicId));
  await expect(d.getByRole("link", { name: "Activar suscripción" })).toHaveClass(/btn-sun/);
  await expect(d.getByRole("link", { name: "Añadir método de pago" })).toHaveCount(0);
  await expect(d.getByRole("button")).toHaveCount(0);

  const r = card(page, "Casa en revisión");
  await expect(r.getByTestId("card-label")).toHaveText("En revisión");
  await expect(r.locator(".btn")).toHaveCount(0);
  // Como mucho un botón relleno por tarjeta (revisión UX N1): el ocre es del dinero y cuenta como relleno.
  for (const article of await page.getByRole("article").all()) expect(await article.locator(".btn-primary, .btn-sun").count()).toBeLessThanOrEqual(1);
  await page.screenshot({ path: "test-results/capturas/mis-casas-estados.png", fullPage: true });

  const row = async (id: string) => {
    await page.goto(`/propietario/casas/${id}`);
    return page.getByTestId("subscription-row");
  };
  await expect(await row(lejos.id)).toHaveText(`Gratis hasta el ${cardDate(subLejos.promoEndsOn!)}`);
  await expect(await row(cerca.id)).toHaveText(`Gratis hasta el ${cardDate(subCerca.promoEndsOn!)}`);
  await expect(await row(debe.id)).toHaveText("Pendiente de pago");
  await expect(await row(parada.id)).toHaveText(`Parada el ${dayOf(await today(), await today())} · no se cobra`);
  await page.goto(`/propietario/casas/${review.id}`);
  await expect(page.getByText("La estamos revisando")).toBeVisible();

  await addCard();
  const now = await today();
  await fresh(page, "/propietario/casas");
  await expect(page.locator(".tile")).toHaveText(["3activas", "1en revisión"]);
  await expect(card(page, "Casa por pagar").getByTestId("card-label")).toHaveText("Activa");
  await expect(page.getByRole("link", { name: "Añadir método de pago" })).toHaveCount(0);
  await expect(await row(debe.id)).toHaveText(`Suscripción activa desde el ${cardDate(now)} · ${FEE} al mes`);
  await expect(await row(cerca.id)).toHaveText(`Gratis hasta el ${cardDate(subCerca.promoEndsOn!)}`);
});

test("detalle: la tarjeta ocre de la pendiente y de la que está en la ventana, compartir apagado y la fila «Suscripción»", async ({ page }) => {
  const debe = await h.seed({ status: "active", draft: { title: "Rancho Manzanillo" } });
  await expire(debe.id);
  const cerca = await h.seed({ status: "active", draft: { title: "Casa en la ventana" } });
  await h.setDaysLeft(cerca.id, 1);
  const parada = await h.seed({ status: "active", draft: { title: "Casa parada" } });
  await h.billing("owner").stop(parada.id);
  const now = await today();
  const [subDebe, subCerca] = [await mine(debe.id), await mine(cerca.id)];

  await owner(page);
  await page.goto(`/propietario/casas/${debe.id}`);
  const notice = page.getByTestId("pay-notice");
  await expect(notice).toContainText(`Su oferta gratuita terminó el ${dayOf(subDebe.promoEndsOn!, now)}`);
  await expect(notice).toContainText(`La ficha está oculta y el enlace no funciona hasta que añada un método de pago. ${FEE} al mes, sin permanencia; puede parar cuando quiera.`);
  await expect(notice.getByRole("link", { name: "Añadir método de pago" })).toHaveAttribute("href", payLink(debe.publicId));
  const share = page.getByRole("button", { name: /Compartir ficha/ });
  await expect(share).toBeDisabled();
  await expect(share).toContainText("Disponible cuando la casa vuelva a estar activa");
  await expect(page.getByRole("link", { name: "Ver ficha" })).toHaveCount(0);
  const row = page.getByRole("link", { name: /^Suscripción/ });
  await expect(row).toHaveAttribute("href", payLink(debe.publicId));
  await expect(page.getByTestId("subscription-row")).toHaveText("Pendiente de pago");
  await page.screenshot({ path: "test-results/capturas/detalle-pendiente.png", fullPage: true });

  await page.goto(`/propietario/casas/${cerca.id}`);
  await expect(page.getByTestId("pay-notice")).toContainText("Su oferta gratuita termina mañana");
  await page.screenshot({ path: "test-results/capturas/detalle-ventana.png", fullPage: true });
  await expect(page.getByRole("button", { name: /Compartir ficha/ })).toBeEnabled();
  await expect(page.getByTestId("subscription-row")).toHaveText(`Gratis hasta el ${cardDate(subCerca.promoEndsOn!)}`);
  // «Anuncio visible» no depende de la suscripción.
  await expect(page.getByRole("switch", { name: /Anuncio visible/ })).toHaveAttribute("aria-checked", "true");

  await page.goto(`/propietario/casas/${parada.id}`);
  await expect(page.getByTestId("pay-notice")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Compartir ficha/ })).toContainText("Disponible cuando la casa vuelva a estar activa");
  await expect(page.getByTestId("subscription-row")).toHaveText(`Parada el ${dayOf(now, now)} · no se cobra`);
});

test("sin owner_billing ni launch_offer_taken (despliegue antes de la migración) las pantallas salen como antes", async ({ page }) => {
  await h.seed({ status: "active", draft: { title: "Casa Cocles" } });
  const debe = await h.seed({ status: "active", draft: { title: "Casa por pagar" } });
  await expire(debe.id);
  const asked: string[] = [];
  const missing = (fn: string) => ({ status: 404, contentType: "application/json", body: JSON.stringify({ code: "PGRST202", message: `Could not find the function public.${fn} without parameters in the schema cache`, details: null, hint: null }) });
  for (const fn of ["owner_billing", "launch_offer_taken"]) {
    await page.route(`**/rest/v1/rpc/${fn}*`, (route) => {
      asked.push(fn);
      return route.fulfill(missing(fn));
    });
  }

  await owner(page);
  await page.goto("/propietario/casas");
  await expect(page.getByTestId("pay-notice")).toHaveCount(0);
  await expect(page.locator(".tile")).toHaveText(["1activa", "1por pagar"]);
  await expect(card(page, "Casa Cocles").getByTestId("card-label")).toHaveText("Activa");
  await expect(card(page, "Casa por pagar").getByTestId("card-label")).toHaveText("Pendiente de pago");
  await expect(page.getByRole("link", { name: "Añadir método de pago" })).toHaveCount(0);

  await card(page, "Casa por pagar").getByRole("link", { name: "Casa por pagar" }).click();
  await expect(page.locator(".note-sun")).toHaveText("La ficha vuelve a verse al pagar.");
  await expect(page.getByTestId("subscription-row")).toHaveCount(0);
  await expect(page.locator('.note[role="alert"]')).toHaveCount(0);
  expect(asked).toEqual(expect.arrayContaining(["owner_billing"])); // launch_offer_taken ya no se pide aquí (sin tarjeta de la oferta)
});

test("el asistente (paso 9) y «enviada» dicen el tramo de la próxima plaza asignada", async ({ page }) => {
  const parada = await h.seed({ status: "active" });
  await h.billing("owner").stop(parada.id);
  const draft = await h.seed({ status: "draft", photos: 5 });
  const review = await h.seed({ status: "review" });
  const offer = launchOffer(await h.anon.offerTaken())!;

  await owner(page);
  await page.goto(`/propietario/publicar/${draft.id}/9`);
  await expect(page.locator(".offer-line")).toContainText(`Si está entre las próximas ${offer.remaining} casas. Después, ${FEE} al mes. Sin tarjeta.`);
  await expect(page.locator(".offer-line")).toContainText(`₡0 · ${offer.months} meses`);

  await page.goto(`/propietario/casas/${review.id}/enviada`);
  await expect(page.getByText(`Publicada y gratis ${offer.months} meses`)).toBeVisible();
});

test.describe("ficha 410 con su motivo", () => {
  function watch(page: Page) {
    const problems: string[] = [];
    page.on("console", (msg) => {
      if (msg.text().includes("Service Worker registration blocked by Playwright")) return;
      // El propio documento responde 410 a propósito: Chrome lo anota en la consola.
      if (msg.text().includes("the server responded with a status of 410")) return;
      if (msg.type() === "error" || msg.type() === "warning") problems.push(`${msg.type()}: ${msg.text()}`);
    });
    page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
    return problems;
  }

  async function open410(page: Page, publicId: string) {
    const res = await page.goto(`/casa/${publicId}`);
    expect(res?.status()).toBe(410);
    await expect(page.getByRole("heading", { level: 1, name: "Este enlace ya no está activo" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
    await expect(page.getByText("Si ya habló con el propietario por WhatsApp, puede seguir esa conversación por su cuenta.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver otras casas en el Caribe" })).toHaveAttribute("href", "/explorar");
    await expect(page.getByRole("button", { name: /Contactar/ })).toHaveCount(0);
  }

  test("parada, pendiente de pago y en edición, sin avisos de hidratación; si el motivo falla, la de siempre", async ({ page }) => {
    const problems = watch(page);
    const parada = await h.seed({ status: "active" });
    await h.billing("owner").stop(parada.id);
    const debe = await h.seed({ status: "active" });
    await expire(debe.id);
    const editada = await h.seed({ status: "reopened" });

    await open410(page, parada.publicId);
    await expect(page.getByText("El propietario paró la suscripción de este anuncio, así que el enlace ya no muestra la ficha ni permite contactarlo desde bnbtico.")).toBeVisible();
    await page.screenshot({ path: "test-results/capturas/410-parada.png", fullPage: true });

    await open410(page, debe.publicId);
    await expect(page.getByText("Este anuncio está fuera del catálogo hasta que el propietario regularice su suscripción.")).toBeVisible();
    await page.screenshot({ path: "test-results/capturas/410-pago.png", fullPage: true });

    await open410(page, editada.publicId);
    await expect(page.getByText("Este anuncio no está disponible en este momento.")).toBeVisible();
    const usual = await page.locator("#root").innerHTML();

    // Una base sin la RPC del motivo (o que falla): el worker sirve el 410 de siempre, igual al de una casa en edición.
    sql("revoke execute on function public.listing_blocked_reason(text) from anon, authenticated;");
    try {
      await open410(page, parada.publicId);
      await expect(page.getByText("Este anuncio no está disponible en este momento.")).toBeVisible();
      expect(await page.locator("#root").innerHTML()).toBe(usual);
    } finally {
      sql("grant execute on function public.listing_blocked_reason(text) to anon, authenticated;");
    }
    expect(problems, problems.join("\n")).toEqual([]);

    // Reactivada, la ficha vuelve con el mismo enlace y el botón de contacto.
    await h.billing("owner").resume(parada.id);
    expect((await page.goto(`/casa/${parada.publicId}`))?.status()).toBe(200);
    await expect(page.getByRole("button", { name: /Contactar por WhatsApp/ })).toBeVisible();
  });
});
