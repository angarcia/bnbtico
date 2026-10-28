import { expect, test, type Page } from "./helpers/test";
import type { Seeded, SubscriptionHarness } from "../contract/harness";
import { totp } from "../contract/totp";
import { HOUSE_BADGES, adminHouseLine } from "../../src/domain/admin-houses";
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

  // Solo lectura: la activa abre su ficha pública; las demás, el detalle de revisión.
  await search.fill(tag);
  await row(due).click();
  await expect(page).toHaveURL(new RegExp(`/admin/anuncios/${due.id}$`));
  await expect(page.getByRole("heading", { level: 2, name: `Rancho Por Pagar ${tag}` })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/admin\/casas$/);
  await page.getByRole("searchbox", { name: "Buscar casas" }).fill(tag);
  await row(active).click();
  await expect(page).toHaveURL(new RegExp(`/casa/${active.publicId}$`));
  await expect(page.getByRole("heading", { level: 1, name: `Villa Activa ${tag}` })).toBeVisible();
  await expect(page.getByRole("button", { name: /Pausar/ })).toHaveCount(0);
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
