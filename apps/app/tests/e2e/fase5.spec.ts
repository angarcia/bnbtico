import { mkdirSync, readFileSync } from "node:fs";
import { devices, type APIRequestContext, type Browser, type TestInfo } from "@playwright/test";
import { expect, test, type Page } from "./helpers/test";
import type { SubscriptionHarness } from "../contract/harness";
import { totp } from "../contract/totp";
import { serviceClient, sql, TEST_PHONES, totpSecretOf } from "../db/local";
import { postgrestHarness } from "../db/postgrest-harness";
import { injectSession } from "./helpers/session";
import { cardDate, payLink, reminderCard, reminderWhatsApp, type BillingHouse, type ReminderDays } from "../../src/domain/subscription";

// Cierre de la fase 5 (ticket 08): una casa recorre todos los estados de la suscripción con el reloj de pruebas local
// (POST /_pruebas/oferta/CT-#### del worker en vite preview, remitente falso de WhatsApp y pasarela falsa de pnpm dev:vars),
// cada actor en su teléfono (contexto Pixel 7 propio): la propietaria la envía → el admin (aal2) la aprueba → Activa con
// oferta → avisos a 90/30/7/0 días (texto exacto de reminderWhatsApp con #pago=, guardado como enviado; la tarjeta en la
// app; repetir la llamada no reenvía nada) → −1: Pendiente de pago, 410 «regularice» y fuera de Explorar → «Añadir método
// de pago» por la pasarela falsa → Activa y la ficha vuelve → «Parar suscripción» → Inactiva y 410 «paró» → «Activar suscripción»
// → Activa con el contacto de vuelta.
// El secreto de Vault bnbtico_test_clock (sin él, test_set_offer_days_left se niega) se crea en beforeAll y se borra
// SIEMPRE en afterAll. No depende de pg_net: la copia de la ficha guardada en la caché del worker se borra llamando a
// /_purge/CT-#### desde la prueba (lo que en pruebas hace pg_net tras cada cambio de estado), así que corre también en CI.
test.describe.configure({ mode: "serial" });

const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
const TITLE = "Casa Suscripción Puerto Viejo";
const SCREEN = "/propietario/suscripcion";
const SHOTS = "test-results/capturas-fase5";
const FEE = "₡2 900";
const devVar = (name: string) => {
  const value = new RegExp(`^${name}=(.+)$`, "m").exec(readFileSync(new URL("../../.dev.vars", import.meta.url), "utf8"))?.[1];
  if (!value) throw new Error(`Falta ${name} en .dev.vars: pnpm dev:vars (y reiniciar vite preview)`);
  return value;
};

let h: SubscriptionHarness;
let listingId: string | undefined;
let shot = 0;

async function stubImages(page: Page) {
  await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
  await page.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
}

async function capture(page: Page, name: string) {
  await page.screenshot({ path: `${SHOTS}/${String(++shot).padStart(2, "0")}-${name}.png`, fullPage: true });
}

/** Un teléfono de la propietaria o del admin (contexto nuevo, sesión inyectada). */
async function phone(browser: Browser, info: TestInfo, who: "owner" | "admin") {
  const context = await browser.newContext({ ...devices["Pixel 7"], baseURL: info.project.use.baseURL, serviceWorkers: "block" });
  const page = await context.newPage();
  await stubImages(page);
  await injectSession(page, who);
  return page;
}

/** La caché de Query vive en IndexedDB (fresca 30 s): tras un cambio hecho por el servicio, la pantalla se abre sin ella. */
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

const house = (page: Page) => page.getByRole("article").filter({ has: page.getByRole("heading", { name: TITLE }) });

test.beforeAll(async () => {
  mkdirSync(SHOTS, { recursive: true });
  h = await postgrestHarness(); // marca al admin y le deja un factor TOTP verificado
  await h.reset();
  // Quita el método de pago que otra prueba pudiera haber dejado en la cuenta de la propietaria.
  await serviceClient().from("payment_methods").delete().eq("owner_id", h.ownerId("owner"));
  await h.setTestClock(true);
});

test.afterAll(async () => {
  // También si algo falló: el secreto no puede quedarse en la base local.
  await h?.setTestClock(false);
  expect(sql("select count(*) from vault.secrets where name = 'bnbtico_test_clock'")).toBe("0");
  if (listingId) await serviceClient().from("listings").delete().eq("id", listingId);
  if (h) await serviceClient().from("payment_methods").delete().eq("owner_id", h.ownerId("owner"));
});

test("enviar → aprobar con oferta → avisos 90/30/7/0 → pendiente de pago y 410 → método de pago → parar y 410 → reactivar", async ({ browser, request, baseURL }, info) => {
  test.setTimeout(240_000);
  const clockSecret = devVar("TEST_CLOCK_SECRET");
  const purgeSecret = devVar("PURGE_SECRET");
  const ownerName = sql(`select coalesce(full_name, '') from public.profiles where phone = '${TEST_PHONES.owner}'`) || null;

  /** El reloj de pruebas, como los curl del plan manual: deja la casa con n días de oferta, corre el día y un lote. */
  async function clock(publicId: string, diasRestantes: number) {
    const res = await request.post(`/_pruebas/oferta/${publicId}`, { headers: { authorization: `Bearer ${clockSecret}` }, data: { diasRestantes } });
    expect(res.status(), await res.text()).toBe(200);
    return (await res.json()) as {
      promoEndsOn: string;
      day: { paid: number; paymentDue: number; queued: number };
      reminders: { claimed: number; sent: number; outcomes: { publicId: string; daysBefore: number; outcome: string; providerRef?: string; body?: string }[] };
    };
  }
  /** Lo que pg_net hace en pruebas tras cada cambio de estado: borrar la copia de la ficha de la caché del worker. */
  async function purge(req: APIRequestContext, publicId: string) {
    expect((await req.post(`/_purge/${publicId}`, { headers: { authorization: `Bearer ${purgeSecret}` } })).status()).toBe(200);
  }
  /** El cliente anónimo: cada visita es un teléfono nuevo, sin caché del navegador ni sesión. */
  async function client(path: string) {
    const context = await browser.newContext({ ...devices["Pixel 7"], baseURL: info.project.use.baseURL, serviceWorkers: "block" });
    const page = await context.newPage();
    await stubImages(page);
    const res = await page.goto(path);
    return { page, status: res?.status() };
  }
  async function expectListing(publicId: string, name: string) {
    await purge(request, publicId);
    const { page, status } = await client(`/casa/${publicId}`);
    expect(status).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
    await expect(page.getByRole("heading", { level: 1, name: TITLE })).toBeVisible();
    await expect(page.getByRole("button", { name: "Contactar por WhatsApp", exact: true })).toBeVisible();
    await capture(page, name);
    await page.context().close();
  }
  async function expectBlocked(publicId: string, reason: string, name: string) {
    await purge(request, publicId);
    const { page, status } = await client(`/casa/${publicId}`);
    expect(status).toBe(410);
    await expect(page.getByRole("heading", { level: 1, name: "Este enlace ya no está activo" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
    await expect(page.getByText(reason, { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: /Contactar/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Ver otras casas en el Caribe" })).toBeVisible();
    await capture(page, name);
    await page.context().close();
  }
  async function inExplorar(): Promise<boolean> {
    const { page } = await client("/explorar");
    await expect(page.locator(".listing-cell").first()).toBeVisible();
    const found = (await page.locator(".listing-cell", { hasText: TITLE }).count()) > 0;
    await page.context().close();
    return found;
  }
  const mine = async (): Promise<BillingHouse> => (await h.billing("owner").overview()).houses.find((x) => x.listingId === listingId)!;

  // Otra casa activa en el catálogo, para que Explorar nunca quede vacío cuando la nuestra sale de él.
  await h.seed({ status: "active", as: "other", draft: { title: "Casa de otra propietaria" } });

  // 1. La propietaria envía su casa (borrador completo con fotos sembradas; el asistente entero está en fase3.spec.ts).
  const draft = await h.seed({ status: "draft", photos: 5, draft: { title: TITLE, nightlyPriceCrc: 95000 } });
  listingId = draft.id;
  const publicId = draft.publicId;
  const owner = await phone(browser, info, "owner");
  await owner.goto(`/propietario/publicar/${draft.id}/9`);
  await owner.getByRole("button", { name: "Enviar a revisión" }).click();
  await expect(owner.getByRole("heading", { name: "¡Listo! Su casa está en revisión" })).toBeVisible();
  await capture(owner, "enviada");
  expect(await h.anon.blockedReason(publicId)).toBe("other");

  // 2. El admin la aprueba con el segundo factor (aal2): toma la siguiente plaza de la oferta.
  const admin = await phone(browser, info, "admin");
  await admin.goto(`/admin/anuncios/${draft.id}`);
  await expect(admin).toHaveURL(/\/admin\/codigo/);
  const { data: user } = await serviceClient().from("profiles").select("id").eq("phone", TEST_PHONES.admin).single();
  const factor = (await serviceClient().auth.admin.mfa.listFactors({ userId: user!.id })).data!.factors.find((f) => f.status === "verified")!;
  await admin.getByLabel("Código de 6 dígitos").fill(totp(totpSecretOf(factor.id)));
  await admin.getByRole("button", { name: "Verificar y entrar" }).click();
  await expect(admin.getByRole("heading", { level: 2, name: TITLE })).toBeVisible();
  await admin.getByRole("button", { name: "Aprobar y publicar" }).click();
  await expect(admin.getByRole("status")).toContainText(`«${TITLE}»: Aprobada y publicada.`);
  await capture(admin, "aprobada");
  await admin.context().close();

  // 3. Activa con oferta: «Gratis hasta…» en Mis casas y en «Promoción y suscripción»; la ficha y Explorar la muestran.
  await expect.poll(async () => (await mine())?.status).toBe("active");
  const approved = await mine();
  expect(approved).toMatchObject({ plan: "promo", promoMonths: 12 });
  expect(approved.promoSlot).toBeGreaterThan(0);
  await fresh(owner, "/propietario/casas");
  // Una sola casa: Mis casas es la lista con su tarjeta; la fila «Suscripción» está en el detalle.
  await expect(owner.getByRole("article").getByTestId("card-label")).toHaveText("Activa");
  await owner.getByRole("article").getByRole("link", { name: TITLE }).click();
  await expect(owner.getByRole("heading", { level: 1, name: TITLE })).toBeVisible();
  await expect(owner.getByTestId("subscription-row")).toHaveText(`Gratis hasta el ${cardDate(approved.promoEndsOn!)}`);
  await capture(owner, "mis-casas-activa");
  await owner.goto(SCREEN);
  await expect(house(owner).getByText("Activa", { exact: true })).toBeVisible();
  await expect(house(owner).getByTestId("sub-line")).toHaveText(`Gratis hasta el ${cardDate(approved.promoEndsOn!)}`);
  await expect(house(owner).getByTestId("pay-notice")).toHaveCount(0);
  await expect(house(owner).getByRole("button", { name: "Añadir método de pago" })).toHaveCount(0);
  await capture(owner, "suscripcion-activa");
  await expectListing(publicId, "ficha-activa");
  expect(await inExplorar()).toBe(true);

  // 4. Avisos a 90, 30, 7 y 0 días: uno por umbral, con el texto exacto y el enlace #pago=; repetir no reenvía nada.
  const link = payLink(baseURL!, publicId);
  const sentRefs: string[] = [];
  for (const days of [90, 30, 7, 0] as ReminderDays[]) {
    const res = await clock(publicId, days);
    const body = reminderWhatsApp({ name: ownerName, title: TITLE, endsOn: res.promoEndsOn, link, daysBefore: days });
    expect(body).toContain(`#pago=${publicId}`);
    expect(res.day.queued).toBe(1);
    expect(res.reminders).toMatchObject({ claimed: 1, sent: 1 });
    expect(res.reminders.outcomes).toEqual([expect.objectContaining({ publicId, daysBefore: days, outcome: "sent", body })]);
    const stored = (await h.reminders(draft.id)).find((r) => r.daysBefore === days)!;
    expect(stored).toMatchObject({ status: "sent", body, toPhone: h.phone("owner"), providerRef: expect.stringMatching(/^fake-/) });
    expect(stored.sentAt).not.toBeNull();
    sentRefs.push(stored.providerRef!);

    const again = await clock(publicId, days);
    expect(again.day.queued).toBe(0);
    expect(again.reminders).toMatchObject({ claimed: 0, sent: 0, outcomes: [] });
    expect((await h.reminders(draft.id)).filter((r) => r.status === "sent").map((r) => r.providerRef)).toEqual(sentRefs);

    await fresh(owner, `${SCREEN}#pago=${publicId}`);
    const card = house(owner);
    await expect(card).toHaveClass(/is-target/);
    await expect(card.getByText("Activa", { exact: true })).toBeVisible();
    const notice = card.getByTestId("pay-notice");
    await expect(notice).toContainText(reminderCard(days)!.title);
    await expect(notice).toContainText("También se lo recordamos por WhatsApp.");
    await expect(card).not.toContainText("Hola,"); // nunca el texto del WhatsApp
    await expect(card.getByRole("button", { name: "Añadir método de pago" })).toHaveClass(/btn-sun/);
    await capture(owner, `aviso-${days}`);
  }
  expect((await h.reminders(draft.id)).map((r) => [r.daysBefore, r.status])).toEqual([
    [90, "sent"],
    [30, "sent"],
    [7, "sent"],
    [0, "sent"],
  ]);
  // La ficha sigue activa el último día gratis.
  await expectListing(publicId, "ficha-dia-0");

  // 5. Un día después del último día gratis, sin método: Pendiente de pago, 410 «regularice» y fuera de Explorar.
  const expired = await clock(publicId, -1);
  expect(expired.day.paymentDue).toBe(1);
  expect(expired.reminders.claimed).toBe(0);
  expect((await mine()).status).toBe("payment_due");
  await expectBlocked(publicId, "Este anuncio está fuera del catálogo hasta que el anfitrión regularice su suscripción.", "410-pago");
  expect(await inExplorar()).toBe(false);
  await fresh(owner, `${SCREEN}#pago=${publicId}`);
  const due = house(owner);
  await expect(due.getByText("Pendiente de pago", { exact: true })).toHaveCount(1);
  await expect(due.getByTestId("sub-line")).toHaveCount(0);
  await expect(due.getByTestId("pay-notice")).toContainText("La ficha está oculta y el enlace no funciona hasta que añada un método de pago.");
  await capture(owner, "pendiente-de-pago");

  // 6. «Añadir método de pago» por la pasarela falsa: Activa (plan de pago desde hoy) y la ficha vuelve.
  await due.getByRole("button", { name: "Añadir método de pago" }).click();
  await expect(owner).toHaveURL(new RegExp(`^${baseURL}/_pago-falso/`));
  await expect(owner.getByRole("heading", { name: "Pasarela de prueba" })).toBeVisible();
  await capture(owner, "pasarela-falsa");
  await owner.getByRole("button", { name: "Guardar tarjeta de prueba" }).click();
  await expect(owner.getByRole("status").filter({ hasText: "Método de pago guardado. No se cobra nada hasta que termine la oferta." })).toBeVisible();
  await expect(owner).toHaveURL(new RegExp(`${SCREEN}\\?casa=${publicId}#pago=${publicId}$`));
  const paid = house(owner);
  await expect(paid.getByText("Activa", { exact: true })).toBeVisible();
  const today = (await h.billing("owner").overview()).today;
  await expect(paid.getByTestId("sub-line")).toHaveText(`Suscripción activa desde el ${cardDate(today)} · ${FEE} al mes`);
  await expect(owner.getByTestId("method-card")).toContainText("Visa ···· 4242");
  await expect(owner.getByRole("button", { name: "Añadir método de pago" })).toHaveCount(0);
  await capture(owner, "metodo-guardado");
  expect(await mine()).toMatchObject({ status: "active", plan: "paid", paidSince: today });
  await expectListing(publicId, "ficha-de-vuelta");
  expect(await inExplorar()).toBe(true);

  // 7. «Parar suscripción» (con confirmación): Inactiva y 410 «paró la suscripción».
  await paid.getByRole("button", { name: "Parar suscripción" }).click();
  const dialog = owner.getByRole("dialog");
  await expect(dialog).toContainText(`¿Parar la suscripción de ${TITLE}? La casa deja de verse y no se cobra. Puede reactivarla cuando quiera.`);
  await dialog.getByRole("button", { name: "Parar suscripción" }).click();
  await expect(paid.getByText("Inactiva", { exact: true })).toBeVisible();
  await expect(paid.getByRole("button", { name: "Activar suscripción" })).toBeVisible();
  await expect(owner.getByText("Método de pago guardado. No se cobra nada hasta que termine la oferta.")).toHaveCount(0);
  await expect.poll(async () => (await mine()).status).toBe("inactive");
  await capture(owner, "parada");
  await expectBlocked(publicId, "El anfitrión paró la suscripción de este anuncio", "410-parada");
  expect(await inExplorar()).toBe(false);

  // 8. «Activar suscripción»: Activa (ya tiene método) y el contacto de vuelta con el mismo enlace.
  await paid.getByRole("button", { name: "Activar suscripción" }).click();
  await expect(paid.getByText("Activa", { exact: true })).toBeVisible();
  await expect.poll(async () => (await mine()).status).toBe("active");
  await capture(owner, "reactivada");
  await expectListing(publicId, "ficha-reactivada");
  expect(await inExplorar()).toBe(true);

  // Ningún aviso más en todo el recorrido: los cuatro de antes y nada después de tener método.
  expect((await h.reminders(draft.id)).map((r) => r.providerRef)).toEqual(sentRefs);
  await owner.context().close();
});
