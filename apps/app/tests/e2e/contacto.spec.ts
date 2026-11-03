import { expect, test, type Page } from "./helpers/test";
import type { Seeded } from "../contract/harness";
import { sql, TEST_PHONES } from "../db/local";
import { postgrestHarness } from "../db/postgrest-harness";
import { composeInquiryMessage } from "../../src/domain/inquiry";
import { monthTitle } from "../../src/domain/calendar";
import { injectSession } from "./helpers/session";
import { catchWhatsApp, waExpected } from "./helpers/whatsapp";
import { boxText, dateBox, messagePreview, pickDates } from "./helpers/contact-sheet";

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
const message = (page: Page) => messagePreview(sheet(page));

test("ficha del servidor: la hoja redacta el mensaje con fechas y personas y valida", async ({ page }) => {
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
  await expect(message(page)).toHaveText(`Hola, vi ${TITLE} en bnbtico y me interesa. ¿Está disponible? Gracias.`);
  // Revisión UX 2026-10-29 (N2): el mensaje es una vista previa, sin caja de texto; las fechas, casillas «Elegir fecha».
  await expect(s.getByRole("textbox")).toHaveCount(0);
  await expect(s.getByText("Podrá añadir lo que quiera en WhatsApp antes de enviarlo.")).toBeVisible();
  await expect(dateBox(s, "Llegada")).toHaveText(boxText("Llegada", null));
  await expect(dateBox(s, "Salida")).toHaveText(boxText("Salida", null));
  await expect(s.locator('input[type="date"]')).toHaveCount(0);
  await expect(s.getByText(`${owner} verá su nombre y su WhatsApp.`)).toBeVisible();
  await expect(s.getByText(/Para escribirle necesita verificar/)).toHaveCount(0); // con sesión
  await expect(s.getByText("Por su seguridad, nunca envíe dinero antes de confirmar la casa. bnbtico no procesa ni pide pagos.")).toBeVisible();
  await expect(page.locator("html")).toHaveClass(/sheet-open/);

  // Las fechas, en el calendario de «¿Cuándo?»: al elegir la salida se cierra. El mensaje sigue a fechas y personas.
  const [a, b] = [day(30), day(37)];
  await pickDates(s, a, b);
  await expect(s.locator(".contact-calendar")).toHaveCount(0);
  await expect(dateBox(s, "Llegada")).toHaveText(boxText("Llegada", a));
  await expect(dateBox(s, "Salida")).toHaveText(boxText("Salida", b));
  await s.getByLabel("Personas (opcional)").fill("4");
  await expect(message(page)).toHaveText(`Hola, vi ${TITLE} en bnbtico y me interesa. ¿Está disponible ${expectedRange(a, b)} para 4 personas? Gracias.`);
  // Captura en reposo (sin teclado): sin campo enfocado la hoja pierde el sitio extra.
  await s.getByLabel("Personas (opcional)").blur();
  await expect(s).not.toHaveClass(/\bkb\b/);
  await page.screenshot({ path: "test-results/contacto-hoja.png" });

  // Solo una fecha: el mensaje de la base, en la hoja, y nada se abre.
  await dateBox(s, "Llegada").click();
  // Con fechas elegidas, el calendario abre en el mes de la llegada.
  await expect(s.locator(".contact-calendar .range-end").first()).toBeInViewport();
  await expect(s.locator(".contact-calendar").getByRole("heading", { name: monthTitle(a.slice(0, 7)) })).toBeInViewport();
  await page.screenshot({ path: "test-results/contacto-calendario.png" });
  await s.getByRole("button", { name: "Quitar fechas" }).click();
  await pickDates(s, a);
  await s.getByRole("button", { name: "Listo" }).click();
  await expect(dateBox(s, "Salida")).toHaveText(boxText("Salida", null));
  await s.getByRole("button", { name: "Abrir WhatsApp" }).click();
  await expect(s.locator('.note[role="alert"]')).toHaveText("Indique la llegada y la salida, o deje las dos vacías.");
  await expect(dateBox(s, "Salida")).toHaveAttribute("aria-invalid", "true");
  await page.screenshot({ path: "test-results/contacto-error.png" });

  // Al corregir, el aviso se va.
  await pickDates(s, b);
  await expect(s.locator('.note[role="alert"]')).toHaveCount(0);
  await s.getByLabel("Personas (opcional)").fill("3");

  // Escape cierra y el foco vuelve al botón; al volver a abrir, lo elegido sigue.
  await page.keyboard.press("Escape");
  await expect(s).toHaveCount(0);
  await expect(cta).toBeFocused();
  await expect(page.locator("html")).not.toHaveClass(/sheet-open/);
  await cta.click();
  await expect(message(page)).toHaveText(composeInquiryMessage(TITLE, { arrival: a, departure: b, people: 3 }));
  await expect(s.getByLabel("Personas (opcional)")).toHaveValue("3");

  // También tras recargar (sessionStorage, 30 min).
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  await page.getByRole("button", { name: "Contactar por WhatsApp" }).click();
  await expect(message(page)).toHaveText(composeInquiryMessage(TITLE, { arrival: a, departure: b, people: 3 }));
  await expect(dateBox(s, "Llegada")).toHaveText(boxText("Llegada", a));

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
  await expect(message(page)).toHaveText(composeInquiryMessage(TITLE, { arrival: null, departure: null, people: 4 }));
  await more.click();
  await more.click();
  await expect(people).toHaveValue("6");
  await expect(more).toBeDisabled(); // capacidad de la casa: 6
  await s.getByRole("button", { name: "Una persona menos" }).click();
  await expect(people).toHaveValue("5");
  await expect(message(page)).toHaveText(composeInquiryMessage(TITLE, { arrival: null, departure: null, people: 5 }));
  // Escribir más que la capacidad no deja seguir.
  await people.fill("9");
  await s.getByRole("button", { name: "Continuar" }).click();
  await expect(s.getByRole("alert")).toHaveText("Esta casa es para 6 personas como máximo.");
});

// Explorar al estilo Airbnb: las fechas de la búsqueda viajan a la hoja por la pestaña (`bnbtico-fechas`).
test("fechas: la hoja arranca con las de la búsqueda, también las de una estancia larga; un enlace viejo del mensual no deja «Desde»", async ({ page }) => {
  const [A, S] = [day(20), day(24)];
  await page.goto(`/explorar?prov=Todas&llegada=${A}&salida=${S}&ppl=2`);
  await page.getByRole("link", { name: new RegExp(TITLE) }).first().click();
  await page.getByRole("button", { name: "Contactar por WhatsApp" }).click();
  let s = sheet(page);
  await expect(dateBox(s, "Llegada")).toHaveText(boxText("Llegada", A));
  await expect(dateBox(s, "Salida")).toHaveText(boxText("Salida", S));
  await expect(message(page)).toHaveText(composeInquiryMessage(TITLE, { arrival: A, departure: S, people: 2 }));

  // 35 noches en una casa que acepta mensual con precio: la hoja lleva llegada y salida, como cualquier otra.
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(`/explorar?prov=Todas&llegada=${day(10)}&salida=${day(45)}`);
  await page.getByRole("link", { name: new RegExp(MONTHLY_TITLE) }).first().click();
  await page.getByRole("button", { name: "Contactar por WhatsApp" }).click();
  s = sheet(page);
  await expect(dateBox(s, "Llegada")).toHaveText(boxText("Llegada", day(10)));
  await expect(dateBox(s, "Salida")).toHaveText(boxText("Salida", day(45)));
  await expect(message(page)).toHaveText(composeInquiryMessage(MONTHLY_TITLE, { arrival: day(10), departure: day(45) }));
  await expect(message(page)).not.toContainText("por meses");

  // Un enlace viejo del modo mensual: la hoja arranca sin fechas y sin casilla «Desde».
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(`/explorar?prov=Todas&mensual=1&desde=${day(10)}`);
  await page.getByRole("link", { name: new RegExp(MONTHLY_TITLE) }).first().click();
  await page.getByRole("button", { name: "Contactar por WhatsApp" }).click();
  s = sheet(page);
  await expect(s.getByRole("button", { name: /^Desde/ })).toHaveCount(0);
  await expect(dateBox(s, "Llegada")).toHaveText(boxText("Llegada", null));
  await expect(dateBox(s, "Salida")).toHaveText(boxText("Salida", null));
  await expect(message(page)).toHaveText(composeInquiryMessage(MONTHLY_TITLE, {}));
  await pickDates(s, day(12), day(15));
  await expect(message(page)).toHaveText(composeInquiryMessage(MONTHLY_TITLE, { arrival: day(12), departure: day(15) }));
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

test("con el teclado abierto la hoja gana sitio abajo y el campo de personas sube", async ({ page }) => {
  await openListing(page, casa.publicId);
  await page.getByRole("button", { name: "Contactar por WhatsApp" }).click();
  const s = sheet(page);
  const before = await s.evaluate((el) => el.getBoundingClientRect().height);
  // Sin caja de mensaje (N2), el único campo con teclado es el de personas.
  const people = s.getByLabel("Personas (opcional)");
  await people.focus();
  await expect(s).toHaveClass(/\bkb\b/);
  await expect.poll(() => s.evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThan(before);
  // El campo queda en la mitad de arriba de la pantalla (por encima de donde estaría el teclado) cuando la hoja termina
  // de entrar: durante la animación de entrada (280 ms, translateY) la hoja aún está más abajo. Con la CPU lenta del
  // runner (o con la CPU a 4× en local) el foco llega antes de que termine y medir entonces daba el campo a ~494 px; ya
  // asentada, la hoja lo deja a ~149 px. No es un fallo de la hoja: la prueba medía a mitad de la animación.
  await s.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  const top = await people.evaluate((el) => el.getBoundingClientRect().top);
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
  await expect(message(page)).toHaveText(`Hola, vi ${TITLE} en bnbtico y me interesa. ¿Está disponible? Gracias.`);
  await sheet(page).getByLabel("Personas (opcional)").fill("2");
  await expect(message(page)).toHaveText(`Hola, vi ${TITLE} en bnbtico y me interesa. ¿Está disponible para 2 personas? Gracias.`);
  await page.screenshot({ path: "test-results/contacto-spa.png" });
  const wa = await catchWhatsApp(page);
  await sheet(page).getByRole("button", { name: "Abrir WhatsApp" }).click();
  await expect.poll(() => wa).toEqual([waExpected(TEST_PHONES.owner, `Hola, vi ${TITLE} en bnbtico y me interesa. ¿Está disponible para 2 personas? Gracias.`)]);
});
