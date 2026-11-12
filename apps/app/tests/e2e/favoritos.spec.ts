import { devices } from "@playwright/test";
import { expect, test, type Page } from "./helpers/test";
import type { Seeded } from "../contract/harness";
import { serviceClient, signIn } from "../db/local";
import { postgrestHarness } from "../db/postgrest-harness";
import { enterCode, injectSession } from "./helpers/session";

// Favoritos (fase 3, ticket 06): corazón en Explorar y en la ficha SSR, pantalla Favoritos, sin cuenta en el teléfono y,
// al ingresar, en la cuenta (sigue al usuario a otro teléfono).
test.describe.configure({ mode: "serial" });

const KEY = "3bstays-favoritos";
let cocles: Seeded;
let negra: Seeded;
let oculta: Seeded;
let clientId: string;

async function accountFavorites(): Promise<string[]> {
  const { data, error } = await serviceClient().from("favorites").select("listings(public_id)").eq("user_id", clientId);
  if (error) throw error;
  return data.map((r) => r.listings.public_id).sort();
}

const card = (page: Page, title: string) => page.locator(".listing-cell", { hasText: title });
const stored = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "[]").map((f: { publicId: string }) => f.publicId), KEY);

test.beforeAll(async () => {
  const h = await postgrestHarness();
  await h.reset();
  oculta = await h.seed({ status: "reopened" });
  cocles = await h.seed({ status: "active", draft: { title: "Casa Cocles", zone: "Cocles", zoneSource: "other", zoneId: null, nightlyPriceCrc: 68000, features: ["pets", "bbq", "parking", "wifi"], parkingPaid: false } });
  negra = await h.seed({ status: "active", draft: { title: "Casa Playa Negra", zone: "Playa Negra", zoneSource: "other", zoneId: null, nightlyPriceCrc: 95000, features: ["ac", "wifi"] } });
  const client = await signIn("other");
  clientId = (await client.auth.getUser()).data.user!.id;
  await serviceClient().from("favorites").delete().eq("user_id", clientId);
});

test.beforeEach(async ({ page }) => {
  await page.route("**/storage/v1/object/**", (route) => route.abort());
  await page.route("https://tile.openstreetmap.org/**", (route) => route.abort());
});

test("sin cuenta: guardar en Explorar y en la ficha SSR, Favoritos, quitar, ingresar y la cuenta los guarda", async ({ page }) => {
  const rest: string[] = [];
  page.on("request", (req) => /\/rest\/v1\/favorites|\/auth\/v1\//.test(req.url()) && rest.push(req.url()));

  await page.goto("/explorar");
  const heart = card(page, "Casa Cocles").getByRole("button", { name: "Guardar en favoritos" });
  await expect(heart).toHaveAttribute("aria-pressed", "false");
  // El toque responde en el mismo evento (< 50 ms) y no abre la ficha.
  const tap = await heart.evaluate(async (el) => {
    const t = performance.now();
    (el as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 0)); // React aplica la actualización de un toque en una microtarea
    return { ms: performance.now() - t, pressed: el.getAttribute("aria-pressed"), label: el.getAttribute("aria-label") };
  });
  expect(tap).toMatchObject({ pressed: "true", label: "Quitar de favoritos" });
  expect(tap.ms).toBeLessThan(50);
  await expect(page).toHaveURL(/\/explorar$/);
  expect(await stored(page)).toEqual([cocles.publicId]);

  // Ficha desde el enlace (SSR): el corazón aparece al hidratar y lee el teléfono.
  await page.goto(`/casa/${negra.publicId}`);
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  await page.getByRole("button", { name: "Guardar en favoritos" }).click();
  await expect(page.getByRole("button", { name: "Quitar de favoritos" })).toHaveAttribute("aria-pressed", "true");
  await page.goto(`/casa/${cocles.publicId}`);
  await expect(page.getByRole("button", { name: "Quitar de favoritos" })).toHaveAttribute("aria-pressed", "true");

  await page.goto("/explorar");
  await page.reload();
  await expect(card(page, "Casa Playa Negra").getByRole("button", { name: "Quitar de favoritos" })).toBeVisible();
  await page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", { name: "Favoritos" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Favoritos" })).toBeVisible();
  await expect(page.getByTestId("favorites-count")).toHaveText("2 casas · guardadas en este teléfono");
  // La misma tarjeta que Explorar (2026-11-03).
  await expect(page.locator(".listing-card h2")).toHaveText(["Casa Playa Negra", "Casa Cocles"]);
  const firstCard = page.locator(".listing-card").first();
  await expect(firstCard.locator(".card-zone")).toHaveText("Playa Negra");
  for (const label of ["2 personas", "1 dormitorio", "1 baño"]) {
    await expect(firstCard.locator(".card-capacity").getByTitle(label, { exact: true })).toBeVisible();
  }
  await expect(page.locator(".listing-card").first()).toContainText("₡95 000 / noche");
  await expect(page.getByText("Compare y escriba directo")).toBeVisible();
  // Sin barra superior ni logo (2026-11-03): «₡ | $» va en la fila de la cuenta, y la elección es la de toda la app.
  await expect(page.getByRole("link", { name: "3bstays, inicio" })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Moneda de los precios" })).toHaveCount(1);
  await expect(page.getByRole("group", { name: "Moneda de los precios" })).toBeVisible();
  await page.evaluate(() => localStorage.setItem("3bstays_currency", "USD"));
  await page.reload();
  await expect(page.locator(".listing-card").first()).toContainText("$186 / noche");
  await page.evaluate(() => localStorage.removeItem("3bstays_currency"));
  await page.reload();

  await card(page, "Casa Cocles").getByRole("button", { name: "Quitar de favoritos" }).click();
  await expect(page.locator(".listing-card h2")).toHaveText(["Casa Playa Negra"]);
  await expect(page.getByTestId("favorites-count")).toHaveText("1 casa · guardada en este teléfono");
  expect(rest, "sin cuenta no se toca la red de la cuenta").toEqual([]);

  // Ingresar en el mismo teléfono: vuelve a Favoritos y la lista pasa a la cuenta.
  await page.getByRole("link", { name: "Ingresar" }).click();
  await page.getByLabel("Número de WhatsApp").fill("8888 1234");
  await page.waitForTimeout(1100); // Supabase admite un código por segundo y número
  await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();
  await enterCode(page);
  await expect(page).toHaveURL(/\/favoritos$/);
  await expect(page.getByTestId("favorites-count")).toHaveText("1 casa guardada");
  await expect.poll(accountFavorites).toEqual([negra.publicId]);

  // Cerrar sesión no borra la lista del teléfono.
  await page.evaluate(() => localStorage.removeItem("3bstays-auth"));
  await page.reload();
  await expect(page.getByTestId("favorites-count")).toHaveText("1 casa · guardada en este teléfono");
});

// Revisión UX N6: un favorito es intención. Desde el 2026-11-03 la tarjeta es la de Explorar: su botón de WhatsApp abre la
// hoja de contacto aquí mismo, sin ir a la ficha y sin enviar nada solo.
test("el botón de WhatsApp de un favorito abre la hoja de contacto en Favoritos, y la nota lo dice", async ({ page }) => {
  await page.goto("/robots.txt");
  await page.evaluate(([key, id]) => localStorage.setItem(key!, JSON.stringify([{ publicId: id, savedAt: new Date().toISOString() }])), [KEY, negra.publicId]);
  await page.goto("/favoritos");
  await expect(page.getByText("Escriba directo desde aquí.", { exact: false })).toBeVisible();
  const wa: string[] = [];
  await page.route("https://wa.me/**", (r) => (wa.push(r.request().url()), r.abort()));
  await expect(page.getByRole("link", { name: "Enviar WhatsApp", exact: true })).toHaveCount(0);
  const send = card(page, "Casa Playa Negra").getByRole("button", { name: /^Contactar por WhatsApp a / });
  await send.click();
  const sheet = page.getByRole("dialog", { name: /Escríbale a/ });
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText("Casa Playa Negra");
  await expect(page).toHaveURL(/\/favoritos$/);
  await page.waitForTimeout(500);
  expect(wa).toEqual([]);
  await sheet.getByRole("button", { name: "Cerrar" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(send).toBeFocused();
});

test("casas que ya no están publicadas se quitan solas; vacío con «Explorar casas»", async ({ page }) => {
  await page.goto("/robots.txt");
  await page.evaluate(
    ([key, ids]) => localStorage.setItem(key!, JSON.stringify(ids!.split(",").map((publicId, i) => ({ publicId, savedAt: new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString() })))),
    [KEY, [oculta.publicId, "CT-999999", cocles.publicId].join(",")],
  );
  await page.goto("/favoritos");
  await expect(page.locator(".listing-card h2")).toHaveText(["Casa Cocles"]);
  await expect.poll(() => stored(page)).toEqual([cocles.publicId]);
  await expect(page.getByTestId("favorites-count")).toHaveText("1 casa · guardada en este teléfono");

  await page.getByRole("button", { name: "Quitar de favoritos" }).click();
  await expect(page.getByText("Toque el corazón de una casa para guardarla aquí.")).toBeVisible();
  await expect(page.getByTestId("favorites-count")).toHaveCount(0);
  await page.getByRole("link", { name: "Explorar casas" }).click();
  await expect(page).toHaveURL(/\/explorar/);
});

test("otro teléfono con la misma cuenta los ve; con sesión se escribe en la cuenta y, si falla, vuelve atrás", async ({ browser }, info) => {
  const context = await browser.newContext({ ...devices["Pixel 7"], baseURL: info.project.use.baseURL, serviceWorkers: "block" });
  const page = await context.newPage();
  await page.route("**/storage/v1/object/**", (route) => route.abort());
  await injectSession(page, "other");
  await page.goto("/favoritos");
  await expect(page.locator(".listing-card h2")).toHaveText(["Casa Playa Negra"]);
  await expect(page.getByTestId("favorites-count")).toHaveText("1 casa guardada");

  await page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", { name: "Explorar" }).click();
  await expect(card(page, "Casa Playa Negra").getByRole("button", { name: "Quitar de favoritos" })).toBeVisible();
  await card(page, "Casa Cocles").getByRole("button", { name: "Guardar en favoritos" }).click();
  await expect.poll(accountFavorites).toEqual([cocles.publicId, negra.publicId].sort());
  await card(page, "Casa Playa Negra").getByRole("button", { name: "Quitar de favoritos" }).click();
  await expect.poll(accountFavorites).toEqual([cocles.publicId]);

  // Sin red para la cuenta: el corazón vuelve a como estaba y se avisa.
  await page.route("**/rest/v1/favorites**", (route) => route.abort());
  await card(page, "Casa Playa Negra").getByRole("button", { name: "Guardar en favoritos" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Sin conexión. Revise su internet e intente de nuevo." })).toBeVisible();
  await expect(card(page, "Casa Playa Negra").getByRole("button", { name: "Guardar en favoritos" })).toHaveAttribute("aria-pressed", "false");
  expect(await accountFavorites()).toEqual([cocles.publicId]);
  await context.close();
});
