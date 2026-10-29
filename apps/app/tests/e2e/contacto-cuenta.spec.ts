import { expect, test, type Page } from "./helpers/test";
import type { Seeded } from "../contract/harness";
import { deleteAccount, FREE_PHONE, INTL_PHONE } from "../db/postgrest-auth-harness";
import { sql, TEST_PHONES } from "../db/local";
import { postgrestHarness } from "../db/postgrest-harness";
import { realPhotos } from "./helpers/real-photos";
import { enterCode, injectSession } from "./helpers/session";
import { backFromWhatsApp, catchWhatsApp, waExpected } from "./helpers/whatsapp";

// Fase 3, ticket 03: sin sesión, la hoja guarda lo escrito, pasa por la verificación del WhatsApp y vuelve a la ficha.
// Revisión UX C2: sin sesión el botón dice «Continuar»; la verificación se lee como «Escribirle a <nombre>» (nunca
// «Ingresar»), con la casa arriba y sin enlaces secundarios; tras el código, directo a WhatsApp sin segundo toque y sin
// «¡Listo!». Contra Supabase local con los números de prueba (código 123456).
test.describe.configure({ mode: "serial" });

const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
const TITLE = "Casa Playa Negra";
const SIGNED_OUT = "Para escribirle necesita verificar su WhatsApp con un código. Lo que escribió se guarda.";
/** La tarjeta de la casa arriba de la verificación (revisión UX C2). */
const cardText = () => new RegExp(`${TITLE}\\s*${owner} · WhatsApp verificado`);
let casa: Seeded;
let owner: string;

const day = (days: number) => new Date(Date.now() - 6 * 3_600_000 + days * 86_400_000).toISOString().slice(0, 10);
const sheet = (page: Page) => page.getByRole("dialog", { name: `Escríbale a ${owner}` });
const message = (page: Page) => sheet(page).getByLabel("Su mensaje");
const accountUrl = () => new RegExp(`/cuenta\\?next=%2Fcasa%2F${casa.publicId}%3Fcontacto%3D1$`);
const listingUrl = () => new RegExp(`/casa/${casa.publicId}$`);
const defaultMessage = `Hola, vi ${TITLE} en bnbtico y me interesa. ¿Está disponible? Gracias.`;

test.beforeAll(async () => {
  const h = await postgrestHarness();
  await h.reset();
  casa = await h.seed({ status: "active", photos: 5, draft: { title: TITLE, zone: "Playa Negra", zoneSource: "other", zoneId: null, nightlyPriceCrc: 95000, capacity: 6 } });
  await realPhotos(casa.id); // la tarjeta de vuelta muestra la foto de verdad
  owner = h.ownerName("owner").split(" ")[0]!;
  sql(`update public.profiles set email = null where phone = '${TEST_PHONES.other}'`);
});

test.beforeEach(async ({ page }) => {
  await page.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
});

async function openSsrListing(page: Page) {
  await page.goto(`/casa/${casa.publicId}`);
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  await page.getByRole("button", { name: "Contactar por WhatsApp" }).click();
  await expect(sheet(page)).toBeVisible();
}

test("ficha del servidor sin sesión → Ingresar con 8888 1234 → código → de vuelta con la hoja abierta y lo mismo escrito", async ({ page }) => {
  const supabaseJs: string[] = [];
  page.on("request", (r) => /\/assets\/supabase-data-[^/]+\.js$/.test(r.url()) && supabaseJs.push(r.url()));
  await openSsrListing(page);
  const s = sheet(page);
  await expect(s.getByText(SIGNED_OUT)).toBeVisible();
  const [a, b] = [day(30), day(37)];
  await s.getByLabel("Llegada (opcional)").fill(a);
  await s.getByLabel("Salida (opcional)").fill(b);
  await s.getByLabel("Personas (opcional)").fill("4");
  await message(page).fill("Hola, ¿aceptan perros pequeños?");
  await message(page).blur();
  await expect(s).not.toHaveClass(/\bkb\b/); // sin el sitio del teclado, para la captura
  await page.screenshot({ path: "test-results/contacto-sin-sesion.png" });
  await expect(s.getByRole("button", { name: "Abrir WhatsApp" })).toHaveCount(0);
  await s.getByRole("button", { name: "Continuar" }).click();

  // Navegación completa (la ficha del servidor no tiene router) a la verificación con la vuelta a la hoja.
  await expect(page).toHaveURL(accountUrl());
  // Saber que no hay sesión no descargó supabase-js en la ficha.
  expect(supabaseJs).toEqual([]);
  const card = page.getByTestId("return-card");
  await expect(card).toHaveText(cardText());
  await expect(card.locator("img")).toHaveAttribute("src", /\.jpg/);
  await expect(page.getByRole("link", { name: "Volver" })).toHaveAttribute("href", `/casa/${casa.publicId}`);
  await page.screenshot({ path: "test-results/contacto-ingresar.png" });

  await expect(page.getByRole("heading", { level: 1, name: `Escribirle a ${owner}` })).toBeVisible();
  await expect(page.getByRole("heading", { name: `Un paso y le escribe a ${owner}` })).toBeVisible();
  // La tarjeta va antes del formulario; sin enlaces secundarios ni la palabra «Ingresar».
  expect(await card.evaluate((el) => !!(el.compareDocumentPosition(document.querySelector("form")!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  await expect(page.getByRole("link", { name: "No tengo acceso a mi WhatsApp" })).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText("Ingresar");
  await page.getByLabel("Número de WhatsApp").fill("8888 1234");
  await page.waitForTimeout(1100); // Supabase admite un código por segundo y número
  await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();
  await expect(page).toHaveURL(/\/cuenta\/codigo\?next=/);
  await expect(card).toHaveText(cardText());
  await expect(card.locator("img")).toHaveAttribute("data-loaded", "");
  await expect(page.getByRole("heading", { level: 1, name: `Escribirle a ${owner}` })).toBeVisible();
  await expect(page.locator("main")).not.toContainText("Ingresar");
  await page.screenshot({ path: "test-results/contacto-codigo.png" });
  // Tras el código: de vuelta en la ficha, la hoja reabre con lo escrito y abre WhatsApp sola (sin segundo toque).
  const wa = await catchWhatsApp(page);
  await enterCode(page);
  await expect.poll(() => wa).toEqual([waExpected(TEST_PHONES.owner, "Hola, ¿aceptan perros pequeños?")]);
  // Volver atrás desde WhatsApp: la ficha con la hoja cerrada (el parámetro se quitó con replace y lo escrito se borró).
  await backFromWhatsApp(page);
  await expect(page).toHaveURL(listingUrl());
  await expect(page.getByRole("button", { name: "Contactar por WhatsApp" })).toBeVisible();
  await expect(s).toHaveCount(0);
});

test("ficha de la SPA sin sesión → cuenta nueva con nombre → código → WhatsApp, sin «¡Listo!» por el camino", async ({ page }) => {
  await deleteAccount(FREE_PHONE);
  await page.goto("/explorar");
  await page.getByRole("link", { name: new RegExp(TITLE) }).click();
  await expect(page).toHaveURL(listingUrl());
  await page.getByRole("button", { name: "Contactar por WhatsApp" }).click();
  await expect(sheet(page).getByText(SIGNED_OUT)).toBeVisible();
  await sheet(page).getByLabel("Personas (opcional)").fill("2");
  const twoPeople = `Hola, vi ${TITLE} en bnbtico y me interesa. ¿Está disponible para 2 personas? Gracias.`;
  await expect(message(page)).toHaveValue(twoPeople);
  await sheet(page).getByRole("button", { name: "Continuar" }).click();

  await expect(page).toHaveURL(accountUrl());
  await expect(page.getByRole("heading", { name: `Un paso y le escribe a ${owner}` })).toBeVisible();
  await expect(page.getByTestId("return-card")).toHaveText(cardText());
  await page.getByLabel("Número de WhatsApp").fill("8888 9999");
  await page.waitForTimeout(1100);
  await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();
  await expect(page.getByRole("heading", { name: "Es su primera vez en bnbtico" })).toBeVisible();
  await expect(page.getByTestId("return-card")).toHaveText(cardText());
  await page.getByLabel("Nombre").fill("Ana Nueva");
  await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();
  await expect(page.getByTestId("return-card")).toHaveText(cardText());
  const wa = await catchWhatsApp(page);
  await enterCode(page);

  // Sin «¡Listo! Su cuenta está creada» (la invitación al correo queda en Mi cuenta): directo a WhatsApp.
  await expect.poll(() => wa).toEqual([waExpected(TEST_PHONES.owner, twoPeople)]);
  await deleteAccount(FREE_PHONE);
});

test("WhatsApp de otro país (+1 415 555 0100); con el borrador caducado (más de 30 min) la hoja vuelve con el mensaje por defecto y no se envía sola", async ({ page }) => {
  await deleteAccount(INTL_PHONE);
  await openSsrListing(page);
  await message(page).fill("Hello, is it free?");
  await sheet(page).getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(accountUrl());
  await page.getByLabel("País de su WhatsApp").selectOption({ label: "Estados Unidos / Canadá (+1)" });
  await page.getByLabel("Número de WhatsApp").fill("(415) 555-0100");
  await page.waitForTimeout(1100);
  await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();
  await page.getByLabel("Nombre").fill("John Test");
  await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();
  await expect(page.getByText("+1 415 555 0100")).toBeVisible();
  // Pasan más de 30 minutos en la pantalla del código.
  await page.evaluate((key) => {
    const draft = JSON.parse(sessionStorage.getItem(key)!) as { savedAt: number };
    sessionStorage.setItem(key, JSON.stringify({ ...draft, savedAt: Date.now() - 31 * 60_000 }));
  }, `bnbtico-contacto:${casa.publicId}`);
  const wa = await catchWhatsApp(page);
  await enterCode(page);
  await expect(page).toHaveURL(listingUrl());
  await expect(sheet(page)).toBeVisible();
  await expect(message(page)).toHaveValue(defaultMessage);
  // Lo escrito se perdió: no se manda un mensaje que la persona no confirmó.
  await page.waitForTimeout(800);
  expect(wa).toEqual([]);
  await expect(sheet(page).getByRole("button", { name: "Abrir WhatsApp" })).toBeVisible();
  await deleteAccount(INTL_PHONE);
});

test("sin borrador, `?contacto=1` solo muestra la ficha (y una cuenta con correo salta «¡Listo!» hacia la ficha)", async ({ page }) => {
  await injectSession(page, "other");
  sql(`update public.profiles set email = 'ana@ejemplo.com' where phone = '${TEST_PHONES.other}'`);
  try {
    await page.goto(`/cuenta/lista?next=${encodeURIComponent(`/casa/${casa.publicId}?contacto=1`)}`);
    await expect(page).toHaveURL(listingUrl());
    await expect(page.getByRole("heading", { level: 1, name: TITLE })).toBeVisible();
    await expect(page.getByRole("button", { name: "Contactar por WhatsApp" })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  } finally {
    sql(`update public.profiles set email = null where phone = '${TEST_PHONES.other}'`);
  }
});
