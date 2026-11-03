import { expect, test, type Page } from "./helpers/test";
import type { Seeded, SubscriptionHarness } from "../contract/harness";
import { totp } from "../contract/totp";
import { HOUSE_BADGES, adminHouseLine } from "../../src/domain/admin-houses";
import { FIELD_TITLES } from "../../src/domain/edit";
import { costaRicaToday } from "../../src/domain/inquiry";
import type { ListingStatus } from "../../src/domain/listing";
import { TEST_PHONES, serviceClient, totpSecretOf } from "../db/local";
import { postgrestHarness } from "../db/postgrest-harness";
import { injectSession } from "./helpers/session";

// Casas del admin (fase 5, ticket 07, diseño 23) contra Supabase local con el admin de prueba (8899 0001, TOTP). Sin vaciar
// la base: cada prueba crea sus casas con un sufijo propio y las busca por él; los recuentos se comprueban por diferencia.
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
let h: SubscriptionHarness;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  h = await postgrestHarness();
});

test.beforeEach(async ({ page }) => {
  await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
});

const userIdOf = async (phone: string) => (await serviceClient().from("profiles").select("id").eq("phone", phone).single()).data!.id;

async function adminCode() {
  const factors = (await serviceClient().auth.admin.mfa.listFactors({ userId: await userIdOf(TEST_PHONES.admin) })).data?.factors ?? [];
  return totp(totpSecretOf(factors.find((f) => f.status === "verified")!.id));
}

/** Entra en /admin/casas con el segundo código. */
async function openCasas(page: Page) {
  await injectSession(page, "admin");
  await page.goto("/admin/casas");
  await expect(page).toHaveURL(/\/admin\/codigo/);
  await page.getByLabel("Código de 6 dígitos").fill(await adminCode());
  await page.getByRole("button", { name: "Verificar y entrar" }).click();
  await expect(page).toHaveURL(/\/admin\/casas$/);
  await expect(page.getByRole("heading", { level: 1, name: "Casas" })).toBeVisible();
}

/** La línea que debe mostrar la fila, calculada con los datos que guardó la base. */
async function expectedLine(s: Seeded, status: ListingStatus) {
  const { data } = await serviceClient().from("subscriptions").select("plan, promo_ends_on, paid_since, stopped_at, monthly_price_crc").eq("listing_id", s.id).single();
  const today = costaRicaToday(Date.now());
  return adminHouseLine(
    {
      status,
      plan: data!.plan === "paid" ? "paid" : "promo",
      promoEndsOn: data!.promo_ends_on,
      paidSince: data!.paid_since,
      stoppedOn: data!.stopped_at ? costaRicaToday(Date.parse(data!.stopped_at)) : null,
      monthlyPriceCrc: data!.monthly_price_crc,
      hasMethod: false,
    },
    today,
  );
}

const chip = (page: Page, label: string) => page.getByRole("navigation", { name: "Filtrar casas" }).getByRole("link", { name: new RegExp(`^${label} · \\d+$`) });
const countOf = async (page: Page, label: string) => Number((await chip(page, label).textContent())!.split(" · ")[1]);

test("el admin ve sus casas por estado con su línea de suscripción, filtra por chip y busca por nombre, CT o propietario", async ({ page }) => {
  const tag = `T${Date.now().toString(36)}`;
  // Sin método de pago en las cuentas de prueba (es de la cuenta y decide entre pendiente de pago y plan de pago).
  await serviceClient().from("payment_methods").delete().in("owner_id", [h.ownerId("owner"), h.ownerId("other")]);
  const active = await h.seed({ status: "active", draft: { title: `Villa Activa ${tag}`, zone: "Cocles", zoneSource: "other", zoneId: null } });
  const due = await h.seed({ status: "active", as: "other", draft: { title: `Rancho Por Pagar ${tag}`, zone: "Manzanillo", zoneSource: "other", zoneId: null } });
  const stopped = await h.seed({ status: "active", draft: { title: `Cabina Parada ${tag}`, zone: "Punta Uva", zoneSource: "other", zoneId: null } });
  await h.seed({ status: "review", draft: { title: `Nunca publicada ${tag}` } });
  await h.setDaysLeft(due.id, -1);
  await h.service.runDay(costaRicaToday(Date.now()));
  await h.billing("owner").stop(stopped.id);

  await openCasas(page);
  await expect(page.getByRole("searchbox", { name: "Buscar casas" })).toHaveAttribute("placeholder", "Nombre, CT-#### o propietario");
  await expect(chip(page, "Todas")).toHaveAttribute("aria-current", "page");
  const before = { todas: await countOf(page, "Todas"), activas: await countOf(page, "Activas"), pagar: await countOf(page, "Por pagar"), inactivas: await countOf(page, "Inactivas") };
  expect(before.todas).toBeGreaterThanOrEqual(3);
  expect(before.activas + before.pagar + before.inactivas).toBeLessThanOrEqual(before.todas);

  const rows = page.locator(".house-row");
  await page.getByRole("searchbox", { name: "Buscar casas" }).fill(tag.toLowerCase());
  await expect(rows).toHaveCount(3);
  // Los recuentos son de todas las casas, no de la búsqueda.
  expect(await countOf(page, "Todas")).toBe(before.todas);

  const row = (s: Seeded) => rows.filter({ hasText: s.publicId });
  await expect(row(active)).toContainText(`Villa Activa ${tag}`);
  await expect(row(active)).toContainText(`${active.publicId} · Yorleny Prueba · Cocles`);
  await expect(row(active)).toContainText(await expectedLine(active, "active"));
  await expect(row(active)).toContainText(/Gratis hasta \d{1,2} [a-z]{3} \d{4}/);
  await expect(row(active).locator(".badge")).toHaveText(HOUSE_BADGES.active.label);
  await expect(row(due)).toContainText(`${due.publicId} · Ana Prueba · Manzanillo`);
  await expect(row(due)).toContainText(await expectedLine(due, "payment_due"));
  await expect(row(due)).toContainText(/Oferta vencida el \d{1,2} [a-z]{3}.* · sin método de pago/);
  await expect(row(due).locator(".badge")).toHaveText("Por pagar");
  await expect(row(due).locator(".badge")).toHaveCSS("background-color", "rgb(251, 232, 194)");
  await expect(row(stopped)).toContainText(await expectedLine(stopped, "inactive"));
  await expect(row(stopped)).toContainText(/Parada por el propietario el \d{1,2} [a-z]{3}/);
  await expect(row(stopped).locator(".badge")).toHaveText("Inactiva");
  await page.screenshot({ path: "test-results/admin-casas-todas.png" });

  await chip(page, "Por pagar").click();
  await expect(page).toHaveURL(/\/admin\/casas\?ver=por-pagar$/);
  await expect(chip(page, "Por pagar")).toHaveAttribute("aria-current", "page");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText(due.publicId);
  await chip(page, "Inactivas").click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText(stopped.publicId);
  await chip(page, "Activas").click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText(active.publicId);

  // Buscar por CT-#### y por propietario, en Todas.
  await chip(page, "Todas").click();
  const search = page.getByRole("searchbox", { name: "Buscar casas" });
  await search.fill(due.publicId.toLowerCase());
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText(due.publicId);
  await search.fill("zzz-ninguna");
  await expect(page.getByText("Ninguna casa coincide con la búsqueda.")).toBeVisible();
  await search.fill(`ana prueba`);
  await expect(row(due)).toHaveCount(1);
  await expect(row(active)).toHaveCount(0);

  // Un toque abre el detalle de la casa: sus datos, la ficha pública si se ve y el detalle del anuncio.
  await search.fill(tag);
  await row(due).click();
  const sheet = page.getByRole("dialog", { name: `Rancho Por Pagar ${tag}` });
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText(`${due.publicId} · Ana Prueba · Manzanillo`);
  await expect(sheet.getByRole("link", { name: "Ver ficha pública" })).toHaveCount(0);
  await sheet.getByRole("link", { name: "Ver datos del anuncio" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/anuncios/${due.id}$`));
  await expect(page.getByRole("heading", { level: 2, name: `Rancho Por Pagar ${tag}` })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/admin\/casas$/);
  await page.getByRole("searchbox", { name: "Buscar casas" }).fill(tag);
  await row(active).click();
  const activeSheet = page.getByRole("dialog", { name: `Villa Activa ${tag}` });
  await expect(activeSheet.getByRole("button", { name: "Pausar", exact: true })).toBeVisible();
  await expect(activeSheet.getByRole("button", { name: "Bloquear", exact: true })).toBeVisible();
  await expect(activeSheet.getByRole("button", { name: "Eliminar casa" })).toBeVisible();
  await activeSheet.getByRole("link", { name: "Ver ficha pública" }).click();
  await expect(page).toHaveURL(new RegExp(`/casa/${active.publicId}$`));
  await expect(page.getByRole("heading", { level: 1, name: `Villa Activa ${tag}` })).toBeVisible();
});

test("una casa recién aprobada aparece en Activas y el recuento sube; quien no es admin no ve la lista", async ({ page }) => {
  await openCasas(page);
  const activas = await countOf(page, "Activas");
  const todas = await countOf(page, "Todas");
  const tag = `N${Date.now().toString(36)}`;
  const fresh = await h.seed({ status: "active", draft: { title: `Casa Nueva ${tag}` } });
  await page.reload();
  await expect(chip(page, "Activas")).toHaveText(`Activas · ${activas + 1}`);
  await expect(chip(page, "Todas")).toHaveText(`Todas · ${todas + 1}`);
  await chip(page, "Activas").click();
  await page.getByRole("searchbox", { name: "Buscar casas" }).fill(tag);
  await expect(page.locator(".house-row")).toHaveCount(1);
  await expect(page.locator(".house-row")).toContainText(fresh.publicId);

  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  await injectSession(page, "owner");
  await page.goto("/admin/casas");
  await expect(page.getByRole("heading", { name: "Esta sección es solo para el equipo de bnbtico" })).toBeVisible();
  await expect(page.locator(".house-row")).toHaveCount(0);
});

// ---------- Pausar, bloquear y eliminar (spec .scratch/admin-casas-acciones) ----------
const cleanIndexedDb = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase("bnbtico");
        req.onsuccess = req.onerror = req.onblocked = () => resolve();
      }),
  );

/** Abre una pantalla sin la caché de Query persistida (vive en IndexedDB): lo que el servicio cambió se ve ahora. */
async function fresh(page: Page, path: string) {
  await page.goto("/robots.txt");
  await cleanIndexedDb(page);
  await page.goto(path);
}

/** Cambia de sesión en el mismo navegador: el admin con su segundo código o un propietario. */
async function asOwner(page: Page) {
  await page.context().clearCookies();
  await page.goto("/robots.txt");
  await page.evaluate(() => localStorage.clear());
  await injectSession(page, "owner");
}

/** Abre la hoja de una casa en Casas (buscándola por su nombre) y devuelve la hoja. */
async function openSheet(page: Page, title: string) {
  await page.getByRole("searchbox", { name: "Buscar casas" }).fill(title);
  await page.locator(".house-row").filter({ hasText: title }).click();
  const sheet = page.getByRole("dialog", { name: title });
  await expect(sheet).toBeVisible();
  return sheet;
}

test("pausar: el enlace da 410 y sale de Explorar; el propietario ve «Pausada por bnbtico» con el motivo y la sigue editando; el admin la reanuda", async ({ page, request }) => {
  const tag = `P${Date.now().toString(36)}`;
  const title = `Casa Pausable ${tag}`;
  const house = await h.seed({ status: "active", draft: { title } });
  const reason = "Las fotos no son de la casa.";

  // Explorar la muestra antes de pausarla.
  await fresh(page, "/explorar");
  await expect(page.locator(".listing-card", { hasText: title })).toBeVisible();

  await openCasas(page);
  const pausadas = await countOf(page, "Pausadas");
  const sheet = await openSheet(page, title);
  await sheet.getByRole("button", { name: "Pausar", exact: true }).click();
  await expect(sheet.getByRole("heading", { name: "Pausar casa" })).toBeVisible();
  // El motivo es obligatorio.
  await sheet.getByRole("button", { name: "Pausar casa" }).click();
  await expect(sheet.getByRole("alert")).toHaveText("Escriba el motivo (hasta 2000 caracteres).");
  await sheet.getByLabel("Motivo (lo verá el propietario)").fill(reason);
  await sheet.getByRole("button", { name: "Pausar casa" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Casa pausada" })).toBeVisible();
  // La hoja sigue abierta con el botón para avisar al propietario por WhatsApp (sin abrirlo: se comprueba el enlace).
  await expect(sheet.getByTestId("hold-note")).toContainText(reason);
  const notice = sheet.getByTestId("notice-link");
  await expect(notice).toHaveText("Avisar a Yorleny por WhatsApp");
  const text = `Hola, Yorleny. Le escribimos de bnbtico: su casa «${title}» está pausada en bnbtico: ${reason.replace(/\.$/, "")}. Puede seguir editándola desde Mis casas; cuando todo esté en orden, la reanudamos.`;
  await expect(notice).toHaveAttribute("href", `https://wa.me/50687770001?text=${encodeURIComponent(text)}`);
  await sheet.getByRole("button", { name: "Cerrar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(chip(page, "Pausadas")).toHaveText(`Pausadas · ${pausadas + 1}`);
  const rowEl = page.locator(".house-row").filter({ hasText: house.publicId });
  await expect(rowEl.locator(".badge")).toHaveText("Pausada");
  await page.screenshot({ path: "test-results/admin-casa-pausada.png" });
  await chip(page, "Pausadas").click();
  await expect(page).toHaveURL(/\/admin\/casas\?ver=pausadas$/);
  await expect(page.locator(".house-row").filter({ hasText: house.publicId })).toHaveCount(1);

  // El público: el enlace ya no está activo, ni en Explorar ni en el sitemap.
  const res = await request.get(`/casa/${house.publicId}`);
  expect(res.status()).toBe(410);
  expect(await res.text()).toContain("Este enlace ya no está activo");
  expect(await (await request.get("/sitemap.xml")).text()).not.toContain(house.publicId);
  await fresh(page, "/explorar");
  await expect(page.locator(".listing-card").first()).toBeVisible();
  await expect(page.locator(".listing-card", { hasText: title })).toHaveCount(0);

  // El propietario la sigue viendo, con el motivo, y la edita.
  await asOwner(page);
  await fresh(page, "/propietario/casas");
  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: title }) });
  await expect(card.getByTestId("card-label")).toHaveText("Pausada por bnbtico");
  await expect(card.getByTestId("hold-note")).toContainText(reason);
  await card.getByRole("link", { name: title }).click();
  await expect(page.getByTestId("hold-notice")).toContainText("Pausada por bnbtico");
  await expect(page.getByTestId("hold-reason")).toHaveText(reason);
  await expect(page.getByRole("link", { name: "Escribir a bnbtico" })).toHaveCount(0);
  await page.screenshot({ path: "test-results/propietario-casa-pausada.png", fullPage: true });
  await page.goto(`/propietario/casas/${house.id}/editar/capacidad`);
  await expect(page).toHaveURL(new RegExp(`/editar/capacidad$`));
  await expect(page.getByRole("heading", { level: 1, name: FIELD_TITLES.capacidad })).toBeVisible();
  expect((await h.owner("owner").getOwn(house.id))?.adminHold).toEqual({ kind: "paused", reason });

  // El admin la reanuda.
  await page.goto("/robots.txt");
  await page.evaluate(() => localStorage.clear());
  await openCasas(page);
  const again = await openSheet(page, title);
  await expect(again.getByTestId("hold-note")).toContainText(reason);
  await again.getByRole("button", { name: "Reanudar" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Casa reanudada" })).toBeVisible();
  await expect(page.locator(".house-row").filter({ hasText: house.publicId }).locator(".badge")).toHaveText("Activa");
  expect(await h.anon.getPublic(house.publicId)).not.toBeNull();
  expect((await h.owner("owner").getOwn(house.id))?.adminHold).toBeNull();
});

test("bloquear: el propietario ve «Bloqueada por bnbtico» con el motivo y «Escribir a bnbtico», no puede editarla y su suscripción se para", async ({ page, request }) => {
  const tag = `B${Date.now().toString(36)}`;
  const title = `Casa Bloqueable ${tag}`;
  const house = await h.seed({ status: "active", draft: { title } });
  const reason = "Publica un teléfono dentro de las fotos.";

  await openCasas(page);
  const bloqueadas = await countOf(page, "Bloqueadas");
  const sheet = await openSheet(page, title);
  await sheet.getByRole("button", { name: "Bloquear", exact: true }).click();
  await expect(sheet.getByText("su suscripción se para")).toBeVisible();
  await sheet.getByLabel("Motivo (lo verá el propietario)").fill(reason);
  await sheet.getByRole("button", { name: "Bloquear casa" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Casa bloqueada" })).toBeVisible();
  await expect(sheet.getByTestId("notice-link")).toHaveAttribute("href", /^https:\/\/wa\.me\/50687770001\?text=.*bloqueada%20en%20bnbtico/);
  await sheet.getByRole("button", { name: "Cerrar" }).click();
  await expect(chip(page, "Bloqueadas")).toHaveText(`Bloqueadas · ${bloqueadas + 1}`);
  const rowEl = page.locator(".house-row").filter({ hasText: house.publicId });
  await expect(rowEl.locator(".badge")).toHaveText("Bloqueada");
  await expect(rowEl).toContainText("Suscripción parada mientras esté bloqueada");
  expect((await request.get(`/casa/${house.publicId}`)).status()).toBe(410);

  await asOwner(page);
  await fresh(page, "/propietario/casas");
  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: title }) });
  await expect(card.getByTestId("card-label")).toHaveText("Bloqueada por bnbtico");
  await expect(card.getByTestId("hold-note")).toContainText(reason);
  await expect(card.getByRole("link", { name: "Compartir ficha" })).toHaveCount(0);
  await card.getByRole("link", { name: title }).click();
  await expect(page.getByTestId("hold-notice")).toContainText("Bloqueada por bnbtico");
  await expect(page.getByTestId("hold-reason")).toHaveText(reason);
  const write = page.getByTestId("hold-notice").getByRole("link", { name: "Escribir a bnbtico" });
  await expect(write).toHaveAttribute("href", /^https:\/\/wa\.me\/.*text=.*CT-/);
  // Solo lectura: ningún dato abre su pantalla, y el enlace directo vuelve a la ficha.
  await expect(page.getByTestId("field-rows").getByRole("link")).toHaveCount(0);
  await expect(page.getByText("Toque un dato para cambiarlo.")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Compartir ficha" })).toHaveCount(0);
  await page.screenshot({ path: "test-results/propietario-casa-bloqueada.png", fullPage: true });
  await page.goto(`/propietario/casas/${house.id}/editar/capacidad`);
  await expect(page).toHaveURL(new RegExp(`/propietario/casas/${house.id}$`));
  // Su suscripción: parada, sin botones de pago ni de parar.
  await page.goto(`/propietario/suscripcion?casa=${house.publicId}`);
  const sub = page.locator(`[data-house="${house.publicId}"]`);
  await expect(sub.locator(".badge").first()).toHaveText("Bloqueada");
  await expect(sub.getByTestId("sub-line")).toContainText("Parada mientras la casa esté bloqueada · no se cobra");
  await expect(sub.getByRole("button", { name: "Parar suscripción" })).toHaveCount(0);
  await expect(sub.getByRole("link", { name: "Añadir método de pago" })).toHaveCount(0);

  // El admin la desbloquea.
  await page.goto("/robots.txt");
  await page.evaluate(() => localStorage.clear());
  await openCasas(page);
  const again = await openSheet(page, title);
  await expect(again.getByRole("button", { name: "Pausar", exact: true })).toHaveCount(0);
  await again.getByRole("button", { name: "Desbloquear" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Casa desbloqueada" })).toBeVisible();
  await expect(page.locator(".house-row").filter({ hasText: house.publicId }).locator(".badge")).toHaveText("Activa");
  expect(await h.anon.getPublic(house.publicId)).not.toBeNull();
});

test("eliminar: pide escribir el CT-####; la casa desaparece para el propietario y para el público", async ({ page, request }) => {
  const tag = `E${Date.now().toString(36)}`;
  const title = `Casa Eliminable ${tag}`;
  const house = await h.seed({ status: "active", draft: { title } });
  const keep = await h.seed({ status: "active", draft: { title: `Casa Que Se Queda ${tag}` } });

  await openCasas(page);
  const todas = await countOf(page, "Todas");
  const sheet = await openSheet(page, title);
  await sheet.getByRole("button", { name: "Eliminar casa" }).click();
  const confirm = sheet.getByRole("button", { name: "Eliminar casa" });
  await expect(sheet.getByText(`Para confirmar, escriba ${house.publicId}`)).toBeVisible();
  await expect(confirm).toBeDisabled();
  await sheet.getByLabel("Motivo (queda en el registro)").fill("Anuncio duplicado.");
  await sheet.getByLabel(/Para confirmar, escriba/).fill("CT-0000");
  await expect(confirm).toBeDisabled();
  await sheet.getByLabel(/Para confirmar, escriba/).fill(house.publicId.toLowerCase());
  await expect(confirm).toBeEnabled();
  await page.screenshot({ path: "test-results/admin-eliminar-casa.png" });
  await confirm.click();
  await expect(page.getByRole("status").filter({ hasText: "Casa eliminada" })).toBeVisible();
  await expect(chip(page, "Todas")).toHaveText(`Todas · ${todas - 1}`);
  await page.getByRole("searchbox", { name: "Buscar casas" }).fill(tag);
  await expect(page.locator(".house-row")).toHaveCount(1);
  await expect(page.locator(".house-row").filter({ hasText: keep.publicId })).toHaveCount(1);

  // El público: ni ficha ni sitemap.
  expect((await request.get(`/casa/${house.publicId}`)).status()).toBe(404);
  expect(await (await request.get("/sitemap.xml")).text()).not.toContain(house.publicId);
  expect(await h.anon.getPublic(house.publicId)).toBeNull();

  // El propietario: ni en Mis casas ni por su enlace.
  await asOwner(page);
  await fresh(page, "/propietario/casas");
  await expect(page.getByRole("article").filter({ has: page.getByRole("heading", { name: `Casa Que Se Queda ${tag}` }) })).toBeVisible();
  await expect(page.getByRole("heading", { name: title })).toHaveCount(0);
  await page.goto(`/propietario/casas/${house.id}`);
  await expect(page.getByRole("heading", { name: "No encontramos esta casa" })).toBeVisible();
  // Los datos siguen en la base, ocultos.
  const kept = await serviceClient().from("listings").select("deleted_reason, title").eq("id", house.id).single();
  expect(kept.data).toEqual({ deleted_reason: "Anuncio duplicado.", title });
});
