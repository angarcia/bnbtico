import { expect, test, type Page } from "./helpers/test";
import type { Seeded } from "../contract/harness";
import { sql, TEST_PHONES } from "../db/local";
import { postgrestHarness } from "../db/postgrest-harness";
import { composeInquiryMessage } from "../../src/domain/inquiry";
import { injectSession } from "./helpers/session";
import { catchWhatsApp, waExpected } from "./helpers/whatsapp";

// Hoja de contacto (fase 3, ticket 02) en la ficha del servidor y en la de la SPA. «Abrir WhatsApp» valida y guarda; con
// sesión registra la consulta y abre WhatsApp (contacto-whatsapp.spec.ts); sin sesión lleva a Ingresar (contacto-cuenta.spec.ts).
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
const TITLE = "Casa Playa Negra";
let casa: Seeded;
let cerrada: Seeded;
const MONTHLY_TITLE = "Casa Mensual Contacto";
let owner: string;

/** Una fecha `YYYY-MM-DD` a `days` días de hoy (Costa Rica, UTC−6). */
const day = (days: number) => new Date(Date.now() - 6 * 3_600_000 + days * 86_400_000).toISOString().slice(0, 10);
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const spoken = (iso: string) => ({ d: Number(iso.slice(8, 10)), m: MONTHS[Number(iso.slice(5, 7)) - 1]! });
function expectedRange(a: string, b: string) {
  const [x, y] = [spoken(a), spoken(b)];
  return x.m === y.m && a.slice(0, 4) === b.slice(0, 4) ? `del ${x.d} al ${y.d} de ${x.m}` : `del ${x.d} de ${x.m} al ${y.d} de ${y.m}`;
}

test.beforeAll(async () => {
  const h = await postgrestHarness();
  await h.reset();
  casa = await h.seed({ status: "active", photos: 5, draft: { title: TITLE, zone: "Playa Negra", zoneSource: "other", zoneId: null, nightlyPriceCrc: 95000, capacity: 6 } });
  cerrada = await h.seed({ status: "active", photos: 5, draft: { title: "Cabina cerrada", zone: "Cocles", zoneSource: "other", zoneId: null } });
  await h.owner("owner").setAvailable(cerrada.id, false);
  await h.seed({ status: "active", photos: 5, draft: { title: MONTHLY_TITLE, zone: "Cocles", zoneSource: "other", zoneId: null, capacity: 4, acceptsMonthly: true, monthlyPriceCrc: 450000 } });
  owner = h.ownerName("owner").split(" ")[0]!;
});

test.beforeEach(async ({ page }) => {
  await page.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
});

async function openListing(page: Page, publicId: string) {
  await page.goto(`/casa/${publicId}`);
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
}

const sheet = (page: Page) => page.getByRole("dialog", { name: `Escríbale a ${owner}` });
const message = (page: Page) => sheet(page).getByLabel("Su mensaje");

test("ficha del servidor: la hoja redacta el mensaje con fechas y personas, respeta lo editado y valida", async ({ page }) => {
  const since = sql("select now()::text");
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.text().includes("Service Worker registration blocked by Playwright")) return;
    if (m.type() === "error" || m.type() === "warning") problems.push(m.text());
  });
  await injectSession(page, "other");
  await openListing(page, casa.publicId);
  const cta = page.getByRole("button", { name: "Contactar por WhatsApp" });
  await expect(cta).toBeEnabled();
  await cta.click();

  const s = sheet(page);
  await expect(s).toBeVisible();
  await expect(s).toHaveAttribute("aria-modal", "true");
  await expect(s.getByText(`Propietario de ${TITLE} · WhatsApp verificado`)).toBeVisible();
  await expect(message(page)).toHaveValue(`Hola, vi ${TITLE} en bnbtico y me interesa. ¿Está disponible? Gracias.`);
  await expect(s.getByText(`${owner} verá su nombre y su WhatsApp.`)).toBeVisible();
  await expect(s.getByText(/Para escribirle necesita verificar/)).toHaveCount(0); // con sesión
  await expect(s.getByText("Por su seguridad, nunca envíe dinero antes de confirmar la casa. bnbtico no procesa ni pide pagos.")).toBeVisible();
  await expect(page.locator("html")).toHaveClass(/sheet-open/);

  // El mensaje sigue a fechas y personas.
  const [a, b] = [day(30), day(37)];
  await s.getByLabel("Llegada (opcional)").fill(a);
  await s.getByLabel("Salida (opcional)").fill(b);
  await s.getByLabel("Personas (opcional)").fill("4");
  await expect(message(page)).toHaveValue(`Hola, vi ${TITLE} en bnbtico y me interesa. ¿Está disponible ${expectedRange(a, b)} para 4 personas? Gracias.`);
  // Captura en reposo (sin teclado): sin campo enfocado la hoja pierde el sitio extra.
  await s.getByLabel("Personas (opcional)").blur();
  await expect(s).not.toHaveClass(/\bkb\b/);
  await page.screenshot({ path: "test-results/contacto-hoja.png" });

  // Editado a mano, se queda aunque cambien las personas.
  await message(page).fill("Hola, ¿aceptan perros pequeños?");
  await s.getByLabel("Personas (opcional)").fill("3");
  await expect(message(page)).toHaveValue("Hola, ¿aceptan perros pequeños?");

  // Fechas al revés: el mensaje de la base, en la hoja, y nada se abre.
  await s.getByLabel("Salida (opcional)").fill(day(20));
  await s.getByRole("button", { name: "Abrir WhatsApp" }).click();
  await expect(s.locator('.note[role="alert"]')).toHaveText("La salida tiene que ser después de la llegada.");
  await expect(s.getByLabel("Salida (opcional)")).toHaveAttribute("aria-invalid", "true");
  await expect(s).not.toHaveClass(/\bkb\b/);
  await page.screenshot({ path: "test-results/contacto-error.png" });

  // Solo una fecha.
  await s.getByLabel("Salida (opcional)").fill("");
  await s.getByRole("button", { name: "Abrir WhatsApp" }).click();
  await expect(s.locator('.note[role="alert"]')).toHaveText("Indique la llegada y la salida, o deje las dos vacías.");

  // Al corregir, el aviso se va.
  await s.getByLabel("Salida (opcional)").fill(b);
  await expect(s.locator('.note[role="alert"]')).toHaveCount(0);

  // Escape cierra y el foco vuelve al botón; al volver a abrir, lo escrito sigue.
  await page.keyboard.press("Escape");
  await expect(s).toHaveCount(0);
  await expect(cta).toBeFocused();
  await expect(page.locator("html")).not.toHaveClass(/sheet-open/);
  await cta.click();
  await expect(message(page)).toHaveValue("Hola, ¿aceptan perros pequeños?");
  await expect(s.getByLabel("Personas (opcional)")).toHaveValue("3");

  // También tras recargar (sessionStorage, 30 min).
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  await page.getByRole("button", { name: "Contactar por WhatsApp" }).click();
  await expect(message(page)).toHaveValue("Hola, ¿aceptan perros pequeños?");
  await expect(s.getByLabel("Llegada (opcional)")).toHaveValue(a);

  // El fondo cierra.
  await page.getByTestId("sheet-backdrop").click({ position: { x: 20, y: 20 } });
  await expect(s).toHaveCount(0);

  // Baliza whatsapp_tap por cada toque (tres), sin datos personales.
  await expect
    .poll(() => sql(`select count(*) from public.events where created_at >= '${since}' and name = 'whatsapp_tap' and listing_public_id = '${casa.publicId}'`))
    .toBe("3");
  expect(problems, problems.join("\n")).toEqual([]);
});

// Revisión UX A3 (puntos 4–5): personas con − / +, desde el filtro «Personas» de Explorar y con tope en la capacidad.
test("personas: arranca con el filtro de Explorar, − / + cambian el mensaje y «+» se detiene en la capacidad", async ({ page }) => {
  await page.goto("/explorar?ppl=4");
  await page.getByRole("link", { name: new RegExp(TITLE) }).first().click();
  await page.getByRole("button", { name: "Contactar por WhatsApp" }).click();
  const s = sheet(page);
  const people = s.getByLabel("Personas (opcional)");
  const more = s.getByRole("button", { name: "Una persona más" });
  await expect(people).toHaveValue("4");
  await expect(s.getByLabel("Su mensaje")).toHaveValue(composeInquiryMessage(TITLE, { arrival: null, departure: null, people: 4 }));
  await more.click();
  await more.click();
  await expect(people).toHaveValue("6");
  await expect(more).toBeDisabled(); // capacidad de la casa: 6
  await s.getByRole("button", { name: "Una persona menos" }).click();
  await expect(people).toHaveValue("5");
  await expect(s.getByLabel("Su mensaje")).toHaveValue(composeInquiryMessage(TITLE, { arrival: null, departure: null, people: 5 }));
  // Escribir más que la capacidad no deja seguir.
  await people.fill("9");
  await s.getByRole("button", { name: "Continuar" }).click();
  await expect(s.getByRole("alert")).toHaveText("Esta casa es para 6 personas como máximo.");
});

// Explorar al estilo Airbnb: las fechas de la búsqueda viajan a la hoja por la pestaña (`bnbtico-fechas`).
test("fechas: la hoja arranca con las de la búsqueda y el mensual escribe «desde el…»", async ({ page }) => {
  const [A, S] = [day(20), day(24)];
  await page.goto(`/explorar?prov=Todas&llegada=${A}&salida=${S}&ppl=2`);
  await page.getByRole("link", { name: new RegExp(TITLE) }).first().click();
  await page.getByRole("button", { name: "Contactar por WhatsApp" }).click();
  let s = sheet(page);
  await expect(s.getByLabel("Llegada (opcional)")).toHaveValue(A);
  await expect(s.getByLabel("Salida (opcional)")).toHaveValue(S);
  await expect(s.getByLabel("Su mensaje")).toHaveValue(composeInquiryMessage(TITLE, { arrival: A, departure: S, people: 2 }));

  await page.evaluate(() => sessionStorage.clear());
  await page.goto(`/explorar?prov=Todas&mensual=1&desde=${day(10)}`);
  await page.getByRole("link", { name: new RegExp(MONTHLY_TITLE) }).first().click();
  await page.getByRole("button", { name: "Contactar por WhatsApp" }).click();
  s = sheet(page);
  await expect(s.getByLabel("Llegada (opcional)")).toHaveValue("");
  await expect(s.getByLabel("Su mensaje")).toHaveValue(composeInquiryMessage(MONTHLY_TITLE, { monthlyFrom: day(10) }));
});

test("modal: el foco no sale de la hoja, el resto de la página queda inerte y «Cerrar» cierra", async ({ page }) => {
  await openListing(page, casa.publicId);
  await page.getByRole("button", { name: "Contactar por WhatsApp" }).click();
  const s = sheet(page);
  await expect(s).toBeFocused();
  expect(await page.locator("#root").evaluate((el) => (el as HTMLElement).inert)).toBe(true);
  // Desde el último control, Tab vuelve al primero («Cerrar»); Mayús+Tab desde el primero, al último.
  // Sin sesión el último control es «Continuar» (todavía no abre WhatsApp, revisión UX C2).
  await s.getByRole("button", { name: "Continuar" }).focus();
  await page.keyboard.press("Tab");
  await expect(s.getByRole("button", { name: "Cerrar" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(s.getByRole("button", { name: "Continuar" })).toBeFocused();
  await s.getByRole("button", { name: "Cerrar" }).click();
  await expect(s).toHaveCount(0);
  expect(await page.locator("#root").evaluate((el) => (el as HTMLElement).inert)).toBe(false);
});

test("con el teclado abierto la hoja gana sitio abajo y el mensaje sube", async ({ page }) => {
  await openListing(page, casa.publicId);
  await page.getByRole("button", { name: "Contactar por WhatsApp" }).click();
  const s = sheet(page);
  const before = await s.evaluate((el) => el.getBoundingClientRect().height);
  await message(page).focus();
  await expect(s).toHaveClass(/\bkb\b/);
  await expect.poll(() => s.evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThan(before);
  // El campo queda en la mitad de arriba de la pantalla (por encima de donde estaría el teclado) cuando la hoja termina
  // de entrar: durante la animación de entrada (280 ms, translateY) la hoja aún está más abajo. Con la CPU lenta del
  // runner (o con la CPU a 4× en local) el foco llega antes de que termine y medir entonces daba el campo a ~494 px; ya
  // asentada, la hoja lo deja a ~149 px. No es un fallo de la hoja: la prueba medía a mitad de la animación.
  await s.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  const top = await message(page).evaluate((el) => el.getBoundingClientRect().top);
  expect(top).toBeLessThan((page.viewportSize()!.height) / 2);
  await s.getByRole("button", { name: "Cerrar" }).focus();
  await expect(s).not.toHaveClass(/\bkb\b/);
});

test("la hoja se precarga en reposo tras hidratar: tocar no espera a la red", async ({ page }) => {
  const chunks: string[] = [];
  page.on("request", (r) => /\/assets\/contact-sheet-[^/]+\.js$/.test(r.url()) && chunks.push(r.url()));
  await openListing(page, casa.publicId);
  await expect.poll(() => chunks.length).toBe(1);
  await page.context().setOffline(true);
  await page.getByRole("button", { name: "Contactar por WhatsApp" }).click();
  await expect(sheet(page)).toBeVisible();
  await page.context().setOffline(false);
});

test("una casa que no recibe consultas muestra el botón deshabilitado", async ({ page }) => {
  await openListing(page, cerrada.publicId);
  await expect(page.getByRole("button", { name: "No disponible por ahora" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Contactar por WhatsApp" })).toHaveCount(0);
  await page.screenshot({ path: "test-results/contacto-no-disponible.png" });
});

test("ficha de la SPA (desde Explorar): la misma hoja", async ({ page }) => {
  await injectSession(page, "other");
  await page.goto("/explorar");
  await page.getByRole("link", { name: new RegExp(TITLE) }).click();
  await expect(page).toHaveURL(new RegExp(`/casa/${casa.publicId}$`));
  await page.getByRole("button", { name: "Contactar por WhatsApp" }).click();
  await expect(message(page)).toHaveValue(`Hola, vi ${TITLE} en bnbtico y me interesa. ¿Está disponible? Gracias.`);
  await sheet(page).getByLabel("Personas (opcional)").fill("2");
  await expect(message(page)).toHaveValue(`Hola, vi ${TITLE} en bnbtico y me interesa. ¿Está disponible para 2 personas? Gracias.`);
  await page.screenshot({ path: "test-results/contacto-spa.png" });
  const wa = await catchWhatsApp(page);
  await sheet(page).getByRole("button", { name: "Abrir WhatsApp" }).click();
  await expect.poll(() => wa).toEqual([waExpected(TEST_PHONES.owner, `Hola, vi ${TITLE} en bnbtico y me interesa. ¿Está disponible para 2 personas? Gracias.`)]);
});
