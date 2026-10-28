import { expect, test, type Page, type Route } from "./helpers/test";
import type { ListingsHarness, Seeded } from "../contract/harness";
import { totp } from "../contract/totp";
import { TEST_PHONES, serviceClient } from "../db/local";
import { postgrestHarness } from "../db/postgrest-harness";
import { factorsOf, secondCode, userIdOf } from "./helpers/admin";
import { injectSession } from "./helpers/session";

// Zona del admin (pantallas 21 y 22) contra Supabase local: el admin de prueba (8899 0001) ingresa con su sesión normal
// (aal1, inyectada por localStorage), confirma el segundo código de su app de autenticación (TOTP, calculado aquí con el
// secreto) y revisa.
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
let h: ListingsHarness;
let first: Seeded;
let second: Seeded;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  h = await postgrestHarness(); // marca al admin con seed_admin y le deja un factor TOTP verificado
  await h.reset();
  first = await h.seed({
    status: "review",
    draft: { title: "Cabina Punta Uva", zone: "Punta Uva", zoneSource: "other", zoneId: null, capacity: 4, acceptsMonthly: true, monthlyPriceCrc: 480000, nightlyPriceCrc: 52000, features: ["wifi", "beachfront"] },
  });
  second = await h.seed({ status: "review", as: "other", draft: { title: "Loft Cocles", zone: "Cocles", zoneSource: "other", zoneId: null }, photos: 6 });
  await h.seed({ status: "active", draft: { title: "Casa activa" } });
});

test.beforeEach(async ({ page }) => {
  await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
});

const nav = (page: Page) => page.getByRole("navigation", { name: "Navegación principal" });

test("la primera vez el admin vincula su app con el QR, ve la cola y aprueba: la casa sale de la cola al instante y se publica", async ({ page }) => {
  const adminId = await userIdOf(TEST_PHONES.admin);
  for (const f of await factorsOf(TEST_PHONES.admin)) await serviceClient().auth.admin.mfa.deleteFactor({ userId: adminId, id: f.id });
  await injectSession(page, "admin");
  await page.goto("/cuenta");
  await page.getByRole("link", { name: /Revisión de anuncios · admin/ }).click();

  await expect(page).toHaveURL(/\/admin\/codigo/);
  await expect(page.getByRole("heading", { name: "Vincule su app de autenticación" })).toBeVisible();
  const qr = page.getByRole("img", { name: "Código QR para su app de autenticación" });
  await expect(qr).toBeVisible();
  expect(await qr.getAttribute("src")).toMatch(/^data:image\/svg\+xml/);
  expect(await qr.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  const secret = (await page.getByLabel("Clave para la app de autenticación").textContent())!.replace(/\s/g, "");
  expect(secret).toMatch(/^[A-Z2-7]{16,}$/);
  await expect(page.getByRole("button", { name: "Verificar y entrar" })).toBeEnabled();
  const right = totp(secret);
  await page.getByLabel("Código de 6 dígitos").fill(right === "000000" ? "111111" : "000000");
  await page.getByRole("button", { name: "Verificar y entrar" }).click();
  await expect(page.locator('.field-error[role="alert"]')).toHaveText("Ese código no es correcto o caducó.");
  await page.getByLabel("Código de 6 dígitos").fill(totp(secret));
  await page.getByRole("button", { name: "Verificar y entrar" }).click();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { level: 1, name: "Anuncios" })).toBeVisible();
  await expect(page.getByText("Admin", { exact: true })).toBeVisible();
  await expect(nav(page).getByRole("link")).toHaveText(["Anuncios2", "Casas", "Usuarios", "Cuenta"]);
  await expect(page.locator(".tile")).toHaveText(["2por revisar", "0con cambios", "1activas"]);
  await expect(page.getByRole("link", { name: "Por revisar · 2" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "Cambios pedidos" })).not.toHaveAttribute("aria-current");
  const cards = page.locator(".queue-card");
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toContainText("Cabina Punta Uva");
  await expect(cards.first()).toContainText(`${first.publicId} · hoy`);
  await expect(cards.first()).toContainText("Nueva");
  await expect(cards.first()).toContainText("Yorleny Prueba · WhatsApp verificado");
  await expect(cards.first()).toContainText("Punta Uva · 4 personas · 5 fotos · ₡52 000");

  await cards.first().click();
  await expect(page).toHaveURL(new RegExp(`/admin/anuncios/${first.id}$`));
  await expect(page.getByRole("heading", { level: 2, name: "Cabina Punta Uva" })).toBeVisible();
  await expect(page.getByText("Alquiler mensual · Alojamiento completo", { exact: false })).toBeVisible();
  await expect(page.getByText("· mensual ₡480 000")).toBeVisible();
  await expect(page.getByText("5 fotos")).toBeVisible();
  await expect(page.getByText("Frente al mar")).toBeVisible();
  await expect(page.getByText("+506 8777 0001")).toBeVisible();
  await expect(page.getByText("Identidad")).toHaveCount(0);
  await expect(page.getByRole("checkbox")).toHaveCount(3);

  await page.getByRole("button", { name: "Pedir cambios" }).click();
  await expect(page.locator('.field-error[role="alert"]')).toHaveText("Escriba un motivo de hasta 2000 caracteres para pedir cambios o rechazar.");
  await expect(page).toHaveURL(new RegExp(`/admin/anuncios/${first.id}$`));

  // La respuesta de la base se retiene: la cola ya no la muestra antes de que llegue.
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route("**/rest/v1/rpc/review_listing", async (route: Route) => {
    await held;
    await route.continue();
  });
  await page.getByRole("button", { name: "Aprobar y publicar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("Loft Cocles");
  await expect(page.locator(".tile")).toHaveText(["1por revisar", "0con cambios", "2activas"]);
  await expect(page.getByRole("status")).toContainText("«Cabina Punta Uva»: Aprobada y publicada.");
  release();
  await expect
    .poll(async () => (await serviceClient().from("listings").select("status").eq("id", first.id).single()).data?.status)
    .toBe("active");
  await page.unroute("**/rest/v1/rpc/review_listing");

  await page.goto(`/casa/${first.publicId}`);
  await expect(page.getByRole("heading", { level: 1, name: "Cabina Punta Uva" })).toBeVisible();
});

test("si la base rechaza la decisión, la casa vuelve a la cola con su mensaje", async ({ page }) => {
  await injectSession(page, "admin");
  await page.goto(`/admin/anuncios/${second.id}`);
  await secondCode(page);
  await expect(page).toHaveURL(new RegExp(`/admin/anuncios/${second.id}$`));
  await expect(page.getByRole("heading", { level: 2, name: "Loft Cocles" })).toBeVisible();

  await page.route("**/rest/v1/rpc/review_listing", (route) =>
    route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "P0001", message: "Este anuncio ya tiene una decisión.", details: null, hint: null }) }),
  );
  await page.getByLabel(/Mensaje para el propietario/).fill("No es un alojamiento.");
  await page.getByRole("button", { name: "Rechazar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("alert")).toHaveText("No se guardó la decisión sobre «Loft Cocles»: Este anuncio ya tiene una decisión.");
  await expect(page.locator(".queue-card")).toHaveCount(1);
  await expect(page.locator(".queue-card")).toContainText("Loft Cocles");
  await page.unroute("**/rest/v1/rpc/review_listing");

  // Pedir cambios de verdad: pasa a «Cambios pedidos» y el propietario ve el motivo.
  await page.locator(".queue-card").click();
  await page.getByLabel(/Mensaje para el propietario/).fill("Necesitamos una foto de la cocina.");
  await page.getByRole("button", { name: "Pedir cambios" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText("No hay anuncios pendientes.")).toBeVisible();
  await page.getByRole("link", { name: "Cambios pedidos" }).click();
  await expect(page.locator(".queue-card")).toContainText("Loft Cocles");
  await expect(page.locator(".queue-card")).toContainText("Cambios pedidos");
  await expect.poll(async () => (await h.owner("other").getOwn(second.id))?.reviewNote).toBe("Necesitamos una foto de la cocina.");

  await page.locator(".queue-card").click();
  await expect(page.getByRole("status")).toContainText("Cambios pedidos");
  await expect(page.getByRole("status")).toContainText("Necesitamos una foto de la cocina.");
  await expect(page.getByRole("button", { name: "Aprobar y publicar" })).toHaveCount(0);

  // La barra del admin solo dentro de /admin: su pestaña «Cuenta» abre Cuenta a pantalla completa y la flecha vuelve a
  // /admin; fuera, la barra que le dan sus casas (aquí una: cinco pestañas).
  const adminId = await userIdOf(TEST_PHONES.admin);
  const own = await serviceClient()
    .from("listings")
    .insert({ owner_id: adminId, title: "Casa del admin", description: "", province: "Limón", whatsapp_phone: TEST_PHONES.admin })
    .select("id")
    .single();
  expect(own.error).toBeNull();
  await page.goto("/admin");
  await expect(nav(page).getByRole("link")).toHaveText(["Anuncios", "Casas", "Usuarios", "Cuenta"]);
  await nav(page).getByRole("link", { name: "Cuenta" }).click();
  await expect(page).toHaveURL(/\/cuenta$/);
  await expect(page.getByRole("heading", { level: 1, name: "Cuenta" })).toBeVisible();
  await expect(nav(page)).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Revisión de anuncios · admin/ })).toBeVisible();
  await page.getByRole("link", { name: "Volver" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(nav(page).getByRole("link")).toHaveText(["Anuncios", "Casas", "Usuarios", "Cuenta"]);
  await page.goto("/explorar");
  await expect(nav(page).getByRole("link")).toHaveText(["Explorar", "Favoritos", "Mi casa", "Calendario", /^Actividad\d*$/]);
  await serviceClient().from("listings").delete().eq("id", own.data!.id);
});

test("quien no es admin no entra: no se le pide código ni se le inscribe ningún factor", async ({ page }) => {
  await injectSession(page, "owner");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/codigo/);
  await expect(page.getByRole("heading", { name: "Esta sección es solo para el equipo de bnbtico" })).toBeVisible();
  await expect(page.getByLabel("Código de 6 dígitos")).toHaveCount(0);
  expect(await factorsOf(TEST_PHONES.owner)).toEqual([]);
  await page.goto("/cuenta");
  await expect(page.getByRole("link", { name: /Revisión de anuncios/ })).toHaveCount(0);
});
