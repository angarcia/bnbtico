import { devices, type Browser, type TestInfo } from "@playwright/test";
import { expect, test, type Page } from "./helpers/test";
import type { ListingsHarness } from "../contract/harness";
import { totp } from "../contract/totp";
import { serviceClient, TEST_PHONES, totpSecretOf } from "../db/local";
import { deleteAccount, FREE_PHONE } from "../db/postgrest-auth-harness";
import { postgrestHarness } from "../db/postgrest-harness";
import { composeInquiryMessage } from "../../src/domain/inquiry";
import { enterCode, injectSession } from "./helpers/session";
import { catchWhatsApp, waExpected } from "./helpers/whatsapp";

// Cierre de la fase 3 (ticket 08): el recorrido entero, cada actor en su teléfono (contexto propio). El propietario
// publica por el asistente → el admin (aal2, código de su app de autenticación) aprueba → un cliente sin cuenta guarda la
// casa en favoritos y la contacta: crea su cuenta con un número de prueba recién borrado (el único código por SMS del
// recorrido; las demás sesiones se inyectan) y vuelve a la hoja con lo escrito → «Abrir WhatsApp» con la URL exacta →
// el propietario ve «Nueva» en Mis consultas, abre WhatsApp con el cliente y el contador desaparece.
test.describe.configure({ mode: "serial" });

const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
const TITLE = "Casa Punta Mona";
const CLIENT = "Marta Cliente";
let h: ListingsHarness;

const day = (days: number) => new Date(Date.now() - 6 * 3_600_000 + days * 86_400_000).toISOString().slice(0, 10);
const nav = (page: Page) => page.getByRole("navigation", { name: "Navegación principal" });

async function phone(browser: Browser, info: TestInfo) {
  const context = await browser.newContext({ ...devices["Pixel 7"], baseURL: info.project.use.baseURL, serviceWorkers: "block" });
  const page = await context.newPage();
  await stubImages(page);
  return page;
}

async function stubImages(page: Page) {
  await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
  await page.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
}

async function clientFavorites(): Promise<string[]> {
  const { data: user } = await serviceClient().from("profiles").select("id").eq("phone", FREE_PHONE).maybeSingle();
  if (!user) return [];
  const { data, error } = await serviceClient().from("favorites").select("listings(public_id)").eq("user_id", user.id);
  if (error) throw error;
  return data.map((r) => r.listings.public_id);
}

test.beforeAll(async () => {
  h = await postgrestHarness(); // marca al admin y le deja un factor TOTP verificado
  await h.reset();
  await deleteAccount(FREE_PHONE);
});

test.afterAll(async () => {
  await deleteAccount(FREE_PHONE);
});

test("publicar → aprobar → favorito y contacto sin cuenta → WhatsApp → Mis consultas → responder", async ({ page, browser }, info) => {
  test.setTimeout(180_000);

  // 1. El propietario publica por el asistente (las fotos se siembran en la base; la subida real está en fotos.spec.ts).
  const owner = await phone(browser, info);
  await injectSession(owner, "owner");
  await owner.goto("/propietario");
  await owner.getByRole("link", { name: "Publicar casa" }).click();
  await expect(owner).toHaveURL(/\/propietario\/publicar\/[0-9a-f-]+\/1$/);
  const id = /\/publicar\/([0-9a-f-]{36})\//.exec(owner.url())![1]!;
  const continuar = () => owner.getByRole("button", { name: "Continuar" }).click();
  await owner.getByText("Alojamiento completo", { exact: true }).click();
  await owner.getByText("Vacacional", { exact: true }).click();
  await continuar();
  await expect(owner).toHaveURL(/\/2$/);
  await owner.getByLabel("Cantón").selectOption("Talamanca");
  await owner.getByLabel("Zona, playa o barrio").fill("Punta Mona");
  await continuar();
  await expect(owner).toHaveURL(/\/3$/);
  await owner.locator(".leaflet-container").click({ position: { x: 150, y: 120 } });
  await expect(owner.locator('input[name="lat"]')).not.toHaveValue("");
  await continuar();
  await expect(owner).toHaveURL(/\/4$/);
  for (const [label, n] of [["personas", 4], ["habitaciones", 2], ["baños", 1]] as const) {
    for (let i = 0; i < n; i++) await owner.getByRole("button", { name: `Más ${label}` }).click();
  }
  await continuar();
  await expect(owner).toHaveURL(/\/5$/);
  await owner.getByText("Frente al mar", { exact: true }).click();
  await owner.getByText("Wifi", { exact: true }).click();
  await continuar();
  await expect(owner).toHaveURL(/\/6$/);
  await owner.getByLabel("Nombre de la casa").fill(TITLE);
  await owner.getByLabel("Descripción").fill("Cabina de madera entre la selva y el mar, con hamacas, rancho y un sendero corto hasta la playa.");
  await continuar();
  await expect(owner).toHaveURL(/\/7$/);
  await h.addPhotos(id, 5);
  await owner.reload();
  await expect(owner.getByRole("status")).toHaveText("5 de 5–15");
  await continuar();
  await expect(owner).toHaveURL(/\/8$/);
  await owner.getByLabel("Por noche").fill("75.000");
  await continuar();
  await expect(owner).toHaveURL(/\/9$/);
  await expect(owner.getByText("+506 8777 0001")).toBeVisible();
  await owner.getByRole("button", { name: "Enviar a revisión" }).click();
  await expect(owner.getByRole("heading", { name: "¡Listo! Su casa está en revisión" })).toBeVisible();
  await owner.context().close();

  // 2. El admin la aprueba con el segundo factor (aal2).
  const admin = await phone(browser, info);
  await injectSession(admin, "admin");
  await admin.goto(`/admin/anuncios/${id}`);
  await expect(admin).toHaveURL(/\/admin\/codigo/);
  const { data: user } = await serviceClient().from("profiles").select("id").eq("phone", TEST_PHONES.admin).single();
  const factor = (await serviceClient().auth.admin.mfa.listFactors({ userId: user!.id })).data!.factors.find((f) => f.status === "verified")!;
  await admin.getByLabel("Código de 6 dígitos").fill(totp(totpSecretOf(factor.id)));
  await admin.getByRole("button", { name: "Verificar y entrar" }).click();
  await expect(admin.getByRole("heading", { level: 2, name: TITLE })).toBeVisible();
  await admin.getByRole("button", { name: "Aprobar y publicar" }).click();
  await expect(admin.getByRole("status")).toContainText(`«${TITLE}»: Aprobada y publicada.`);
  await expect.poll(async () => (await h.owner("owner").getOwn(id))?.status).toBe("active");
  const publicId = (await h.owner("owner").getOwn(id))!.publicId;
  await admin.context().close();

  // 3. Un cliente sin cuenta la encuentra en Explorar y la guarda en favoritos (en el teléfono, sin red de la cuenta).
  await stubImages(page);
  await page.goto("/explorar");
  const cell = page.locator(".listing-cell", { hasText: TITLE });
  await cell.getByRole("button", { name: "Guardar en favoritos" }).click();
  await expect(cell.getByRole("button", { name: "Quitar de favoritos" })).toHaveAttribute("aria-pressed", "true");
  await nav(page).getByRole("link", { name: "Favoritos" }).click();
  await expect(page.getByTestId("favorites-count")).toHaveText("1 casa · guardada en este teléfono");
  await expect(page.locator(".fav-card h2")).toHaveText([TITLE]);

  // 4. Abre la ficha y escribe: fechas y personas redactan el mensaje.
  await page.locator(".fav-card", { hasText: TITLE }).getByRole("link", { name: TITLE }).click();
  await expect(page).toHaveURL(new RegExp(`/casa/${publicId}$`));
  await page.getByRole("button", { name: "Contactar por WhatsApp" }).click();
  const sheet = page.getByRole("dialog", { name: "Escríbale a Yorleny" });
  await expect(sheet).toBeVisible();
  const [arrival, departure] = [day(40), day(45)];
  await sheet.getByLabel("Llegada (opcional)").fill(arrival);
  await sheet.getByLabel("Salida (opcional)").fill(departure);
  await sheet.getByLabel("Personas (opcional)").fill("3");
  const message = composeInquiryMessage(TITLE, { arrival, departure, people: 3 });
  await expect(sheet.getByLabel("Su mensaje")).toHaveValue(message);
  await sheet.getByLabel("Personas (opcional)").blur();
  await expect(sheet).not.toHaveClass(/\bkb\b/);
  await sheet.getByRole("button", { name: "Continuar" }).click();

  // 5. Sin cuenta: la crea con su WhatsApp (código de prueba) y, sin «¡Listo!» ni segundo toque, WhatsApp se abre con el
  //    número de la casa y el mensaje exactos (revisión UX C2).
  await expect(page).toHaveURL(new RegExp(`/cuenta\\?next=%2Fcasa%2F${publicId}%3Fcontacto%3D1$`));
  await page.getByLabel("Número de WhatsApp").fill("8888 9999");
  await page.waitForTimeout(1100); // Supabase admite un código por segundo y número
  await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();
  await page.getByLabel("Nombre").fill(CLIENT);
  await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();
  const wa = await catchWhatsApp(page);
  await enterCode(page);
  await expect.poll(() => wa).toEqual([waExpected(TEST_PHONES.owner, message)]);
  // 6. El favorito guardado sin cuenta pasó a la cuenta al verificar.
  await expect.poll(clientFavorites).toEqual([publicId]);
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/casa/${publicId}$`));
  await expect(page.getByRole("button", { name: "Contactar por WhatsApp" })).toBeVisible();
  await expect(sheet).toHaveCount(0);

  // 7. El propietario (más tarde, desde su teléfono) ve «Nueva» y abre WhatsApp con el cliente; el contador desaparece.
  const later = await phone(browser, info);
  await injectSession(later, "owner");
  await later.goto("/propietario");
  await expect(later.getByTestId("inquiries-title")).toHaveText("1 consulta nueva");
  await expect(nav(later).getByTestId("inquiries-badge")).toHaveText("1");
  await nav(later).getByRole("link", { name: "Consultas, 1 nueva" }).click();
  await expect(later.getByRole("heading", { level: 1, name: "Mis consultas" })).toBeVisible();
  const card = later.getByRole("article");
  await expect(card).toHaveCount(1);
  await expect(card.getByRole("heading", { name: CLIENT })).toBeVisible();
  await expect(card).toContainText(`${TITLE} · `);
  await expect(card).toContainText("3 personas");
  await expect(card).toContainText(`“${message}”`);
  await expect(card.getByText("Nueva", { exact: true })).toBeVisible();
  const waOwner = await catchWhatsApp(later);
  await card.getByRole("button", { name: "Abrir WhatsApp" }).click();
  await expect.poll(() => waOwner).toEqual([`https://wa.me/${FREE_PHONE.replace(/\D/g, "")}`]);
  await later.goBack();
  await expect(later.getByRole("heading", { level: 1, name: "Mis consultas" })).toBeVisible();
  await expect(card.getByText("Nueva", { exact: true })).toHaveCount(0);
  await expect(nav(later).getByTestId("inquiries-badge")).toHaveCount(0);
  await expect(nav(later).getByRole("link", { name: "Consultas" })).toBeVisible();
  await later.context().close();
});
