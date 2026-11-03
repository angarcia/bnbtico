import { expect, test, type Page } from "./helpers/test";
import type { Seeded } from "../contract/harness";
import { addDays, costaRicaToday } from "../../src/domain/dates";
import { postgrestHarness } from "../db/postgrest-harness";

// Explorar y Filtros en el navegador (pantallas 01 y 02), contra Supabase local.
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
let manzanillo: Seeded;
let ultima: Seeded;
const today = costaRicaToday(Date.now());
const day = (n: number) => addDays(today, n);

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const h = await postgrestHarness();
  await h.reset();
  await h.seed({ status: "draft", draft: { province: "Cartago", canton: "Turrialba", zone: "Turrialba", zoneSource: "other", zoneId: null, lat: 9.9, lng: -83.68 } });
  await h.seed({ status: "active", draft: { title: "Cabina Sámara", province: "Guanacaste", canton: "Nicoya", zone: "Sámara", zoneSource: "other", zoneId: null, lat: 9.88, lng: -85.53, capacity: 2, features: ["pool"], nightlyPriceCrc: 60000 } });
  ultima = await h.seed({ status: "active", draft: { title: "Casa Cocles 7", zone: "Cocles", zoneSource: "other", zoneId: null, capacity: 2, nightlyPriceCrc: 40000 } });
  // Un precio especial en una noche de la búsqueda de 4 noches: el total lo cuenta.
  await h.putDay(ultima.id, { day: day(21), available: true, specialPriceCrc: 100000 });
  for (let i = 6; i >= 1; i--) await h.seed({ status: "active", draft: { title: `Casa Cocles ${i}`, zone: "Cocles", zoneSource: "other", zoneId: null, capacity: 2, nightlyPriceCrc: 40000 + i * 1000 } });
  manzanillo = await h.seed({ status: "active", draft: { title: "Casa Manzanillo", zone: "Manzanillo", zoneSource: "other", zoneId: null, capacity: 5, acceptsMonthly: true, monthlyPriceCrc: 480000, nightlyPriceCrc: 85000, features: ["wifi", "beachfront"] } });
  await h.seed({ status: "active", draft: { title: "Casa Cocles mensual", zone: "Cocles", zoneSource: "other", zoneId: null, capacity: 2, nightlyPriceCrc: 45000, acceptsMonthly: true, monthlyPriceCrc: null } });
});

test.beforeEach(async ({ page }) => {
  await page.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
  await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
});

const results = (page: Page) => page.getByTestId("results-count");

test("Tarjeta: fotos deslizables con contador, cargadas al deslizar, y botón de WhatsApp que abre la hoja", async ({ page }) => {
  await page.goto("/explorar");
  const cards = page.locator(".listing-grid:not(.skeleton) .listing-card");
  await expect(cards).toHaveCount(10);
  const card = cards.nth(1);
  const strip = card.locator(".card-strip");
  // Antes de deslizar solo se pide la primera foto de cada tarjeta; el contador marca «1 / 5».
  await expect(card.locator("img")).toHaveCount(1);
  await expect(card.locator(".hero-counter")).toHaveText("1 / 5");
  const requested: string[] = [];
  page.on("request", (r) => /foto-\d\.jpg/.test(r.url()) && requested.push(r.url().match(/foto-\d/)![0]));
  await card.scrollIntoViewIfNeeded();
  await strip.evaluate((el) => el.scrollTo({ left: el.clientWidth, behavior: "instant" }));
  await expect(card.locator(".hero-counter")).toHaveText("2 / 5");
  // La foto 2 se pide al deslizar, y la 3 (la siguiente) ya está montada; las demás siguen sin existir.
  await expect.poll(() => requested.some((u) => u.endsWith("foto-1"))).toBe(true);
  await expect(card.locator("img")).toHaveCount(3);
  // Tocar la foto abre la ficha; deslizar no navegó.
  await expect(page).toHaveURL(/\/explorar/);
  // El botón de WhatsApp va fuera del enlace, con el nombre del anfitrión, y abre la hoja de contacto sobre Explorar.
  const wa = card.locator("xpath=..").getByRole("button", { name: /^Contactar por WhatsApp a / });
  await expect(wa).toBeVisible();
  expect(await card.locator("button").count()).toBe(0);
  await wa.click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("heading", { name: /^Escríbale a / })).toBeVisible();
  await expect(sheet).toContainText((await card.locator("h2").textContent())!);
  await expect(page).toHaveURL(/\/explorar/);
  await sheet.getByRole("button", { name: "Cerrar" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(wa).toBeFocused();
});

// Ticket 08 (ronda del 2 nov): con fechas que traen noches ocupadas, la hoja no envía; tampoco mientras se leen los días.
test("Tarjeta: la hoja queda bloqueada mientras cargan los días de la casa y, si las fechas traen una noche ocupada, sigue bloqueada con el aviso", async ({ page }) => {
  const h = await postgrestHarness();
  const [a, b] = [day(20), day(24)];
  await page.goto(`/explorar?llegada=${a}&salida=${b}`);
  const cards = page.locator(".listing-grid:not(.skeleton) .listing-card");
  await expect(cards.first()).toBeVisible();
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route("**/rest/v1/rpc/public_listing_days*", async (route) => {
    await held;
    await route.continue();
  });
  const openSheet = async (title: string) => {
    const card = cards.filter({ hasText: title });
    await card.getByText(title).first().scrollIntoViewIfNeeded();
    await card.locator("xpath=..").getByRole("button", { name: /^Contactar por WhatsApp a / }).click();
    return page.getByRole("dialog");
  };
  // Una casa libre: bloqueada mientras llegan los días, y se habilita al llegar.
  let sheet = await openSheet("Casa Manzanillo");
  await expect(sheet.getByRole("button", { name: "Continuar" })).toBeDisabled();
  await page.setViewportSize({ width: 375, height: 667 });
  await page.screenshot({ path: "../../.scratch/ronda-ana-2026-11-02/capturas/08-7c-hoja-cargando-dias.png" });
  release();
  await expect(sheet.getByRole("button", { name: "Continuar" })).toBeEnabled();
  await sheet.getByRole("button", { name: "Cerrar" }).click();
  // Una casa con una noche ocupada dentro de las fechas (después de buscar): bloqueada con el aviso.
  await h.putDay(ultima.id, { day: day(22), available: false, specialPriceCrc: null });
  sheet = await openSheet("Casa Cocles 7");
  await expect(sheet.getByTestId("stay-total")).toHaveText("Hay noches ocupadas entre esas fechas.");
  await expect(sheet.getByRole("button", { name: "Continuar" })).toBeDisabled();
  await page.screenshot({ path: "../../.scratch/ronda-ana-2026-11-02/capturas/08-7b-hoja-tarjeta-noches-ocupadas.png" });
  await h.putDay(ultima.id, { day: day(22), available: true, specialPriceCrc: null });
});

test("Explorar sin barra superior: píldora «Empiece su búsqueda», cuenta, filtros y ₡ | $", async ({ page }) => {
  await page.goto("/explorar");
  await expect(page.getByRole("heading", { level: 1, name: "Explorar casas" })).toBeAttached();
  await expect(page.locator(".topbar")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Empiece su búsqueda" })).toBeVisible();
  // La cuenta es una pestaña (C4): en la cabecera de Explorar ya no hay «Ingresar».
  await expect(page.locator(".explore-top").getByRole("link", { name: "Ingresar" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", { name: "Ingresar" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Moneda de los precios" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Filtros", exact: true })).toBeVisible();
  await expect(results(page)).toHaveText("10 casas");
  await expect(page.getByRole("link", { name: /Casa Manzanillo/ })).toBeVisible();
  // Sin zona, todo el país: la de Guanacaste sale, pero la última (las de Limón van primero aunque ella sea más vieja).
  await expect(page.getByRole("link", { name: /Cabina Sámara/ })).toBeVisible();
  // Una casa por fila, a todo el ancho de la pantalla (sin márgenes laterales, ticket 09 de la ronda del 2 nov); la primera foto
  // (el LCP) sin carga diferida y con prioridad alta; las fotos 2+ de cada tarjeta no existen hasta deslizarla.
  const cards = page.locator(".listing-grid:not(.skeleton) .listing-card");
  await expect(cards).toHaveCount(10);
  await expect(cards.last().locator("h2")).toHaveText("Cabina Sámara");
  await expect(cards.first().locator("img")).toHaveCount(1);
  await expect(cards.first().locator("img")).toHaveAttribute("loading", "eager");
  await expect(cards.first().locator("img")).toHaveAttribute("fetchpriority", "high");
  await expect(cards.nth(1).locator("img")).toHaveCount(1);
  await expect(cards.nth(1).locator("img")).toHaveAttribute("loading", "lazy");
  const viewport = page.viewportSize()!.width;
  for (const box of await cards.evaluateAll((els) => els.map((el) => el.getBoundingClientRect()))) {
    expect(Math.abs(box.width - viewport)).toBeLessThanOrEqual(1);
    expect(Math.abs(box.left)).toBeLessThanOrEqual(1);
  }
  // La foto es 5:4.
  const photo = await cards.first().locator(".photo").boundingBox();
  expect(Math.abs(photo!.width / photo!.height - 5 / 4)).toBeLessThan(0.02);
  // La primera es la más nueva (Casa Cocles mensual): nombre, zona, personas y habitaciones, y el precio de la noche.
  await expect(cards.first().locator("h2")).toHaveText("Casa Cocles mensual");
  await expect(cards.first()).toContainText("Cocles2 personas · 1 habitación₡45 000 / noche");
  await expect(cards.first().locator(".pill:not(.hero-counter)")).toHaveCount(0);
  // La píldora y la fila de chips se quedan arriba al bajar.
  await page.evaluate(() => window.scrollTo(0, 900));
  await expect.poll(() => page.locator(".explore-top").evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBe(0);
  await expect(page.getByRole("link", { name: "Empiece su búsqueda" })).toBeInViewport();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole("link", { name: "Filtros", exact: true }).click();
  await expect(page).toHaveURL(/\/explorar\/filtros$/);
  await expect(page.getByRole("heading", { level: 1, name: "Filtros" })).toBeVisible();
  // Sin chips de provincia (ticket 06): la fila «Zona» de «Su búsqueda» dice «Todas las provincias».
  await expect(page.getByRole("group", { name: "Zona", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Guanacaste" })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Su búsqueda" }).getByRole("link").first()).toHaveText(/^Zona\s*Todas las provincias$/);
  await expect(page.getByRole("button", { name: "Ver 10 casas" })).toBeVisible();
});

test("Filtros cuenta en vivo, no deja un mínimo mayor que el máximo, y «Ver N casas» aplica y vuelve", async ({ page }) => {
  await page.goto("/explorar/filtros");
  await expect(page.getByRole("button", { name: "Ver 10 casas" })).toBeVisible();
  await page.getByRole("button", { name: "Piscina", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ver 1 casa" })).toBeVisible();
  await page.getByRole("button", { name: "Piscina", exact: true }).click();
  // Las personas se eligen en la búsqueda (tarea 8); aquí llegan en la URL.
  await page.goto("/explorar/filtros?prov=Todas&ppl=4");
  await expect(page.getByRole("button", { name: "Ver 1 casa" })).toBeVisible();
  await page.goto("/explorar/filtros?prov=Todas");
  await page.getByLabel("Precio mínimo por noche").fill("50.000");
  await page.getByLabel("Precio máximo por noche").fill("44000");
  // Ticket 15: no se intercambian; aviso y el botón desactivado hasta corregirlo.
  await expect(page.getByRole("alert")).toHaveText("El precio mínimo no puede ser mayor que el máximo.");
  await expect(page.getByRole("button", { name: /^Ver/ })).toBeDisabled();
  await page.getByLabel("Precio máximo por noche").press("Enter");
  await expect(page).toHaveURL(/\/explorar\/filtros/);
  await page.getByLabel("Precio mínimo por noche").fill("44000");
  await page.getByLabel("Precio máximo por noche").fill("50.000");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ver 4 casas" })).toBeVisible();
  await page.getByRole("button", { name: "Ver 4 casas" }).click();
  await expect(page).toHaveURL(/\/explorar\?min=44000&max=50000$/);
  await expect(results(page)).toHaveText("4 casas");

  await page.getByRole("link", { name: /^Filtros/ }).click();
  await expect(page.getByLabel("Precio mínimo por noche")).toHaveValue("44000");
  await page.getByRole("link", { name: "Limpiar" }).click();
  await expect(page).toHaveURL(/\/explorar$/);
  await expect(results(page)).toHaveText("10 casas");

  // Una URL con mínimo > máximo se trata como sin rango.
  await page.goto("/explorar?prov=Todas&min=50000&max=44000");
  await expect(results(page)).toHaveText("10 casas");
});

test("Filtros: el deslizador de precio (histograma y dos tiradores) se sincroniza con los campos, con el conteo y con la URL", async ({ page }) => {
  await page.goto("/explorar/filtros");
  await expect(page.getByRole("button", { name: "Ver 10 casas" })).toBeVisible();
  // Precios de la prueba: de ₡40 000 a ₡85 000; los topes se redondean al paso (₡2 000): ₡40 000 – ₡86 000+.
  const range = page.locator(".price-slider-range");
  await expect(range).toHaveText("₡40 000 – ₡86 000+");
  await expect(page.locator(".price-slider-bars rect.in").first()).toBeVisible();
  const min = page.getByRole("slider", { name: "Rango de precio, límite inferior por noche" });
  const max = page.getByRole("slider", { name: "Rango de precio, límite superior por noche" });
  await expect(min).toHaveAttribute("aria-valuetext", /^₡40\s000,\ssin\smínimo$/);
  await expect(max).toHaveAttribute("aria-valuetext", /^₡86\s000\so\smás,\ssin\smáximo$/);
  // Con el teclado: tres pasos de ₡2 000 → mínimo ₡46 000; el campo «Mínimo» y el conteo lo siguen (46 000, 60 000 y 85 000).
  await min.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByLabel("Precio mínimo por noche")).toHaveValue("46000");
  await expect(range).toHaveText("₡46 000 – ₡86 000+");
  await expect(max).toHaveAttribute("aria-valuetext", /^₡86\s000\so\smás,\ssin\smáximo$/);
  await expect(page.getByRole("button", { name: "Ver 3 casas" })).toBeVisible();
  // Escribir en el campo mueve el tirador.
  await page.getByLabel("Precio máximo por noche").fill("60000");
  await expect(max).toHaveValue("60000");
  await expect(page.getByRole("button", { name: "Ver 2 casas" })).toBeVisible();
  await page.getByLabel("Precio máximo por noche").fill("");
  await expect(max).toHaveValue("86000");
  // Arrastrando el tirador de abajo hasta la mitad: el mínimo pasa de ₡60 000 y solo queda la de ₡85 000.
  const box = (await min.boundingBox())!;
  const y = box.y + box.height / 2;
  const thumbX = box.x + 14 + ((box.width - 28) * (46000 - 40000)) / (86000 - 40000);
  await page.mouse.move(thumbX, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, y, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByLabel("Precio mínimo por noche")).toHaveValue(/^6\d{4}$/);
  await expect(page.getByRole("button", { name: "Ver 1 casa" })).toBeVisible();
  await page.getByRole("button", { name: "Ver 1 casa" }).click();
  await expect(page).toHaveURL(/\/explorar\?min=6\d{4}$/);
  await expect(results(page)).toHaveText("1 casa");
  // «Sin máximo» no deja `max` en la URL y el tope de abajo tampoco deja `min`.
  await page.getByRole("link", { name: /^Filtros/ }).click();
  await page.getByRole("slider", { name: "Rango de precio, límite inferior por noche" }).press("Home");
  await expect(page.getByLabel("Precio mínimo por noche")).toHaveValue("");
  await expect(page.getByRole("button", { name: "Ver 10 casas" })).toBeVisible();
});

test("Filtros: baños y tipo de alojamiento cuentan en vivo, entran en la URL y en el contador, y «Limpiar» los quita", async ({ page }) => {
  await page.goto("/explorar/filtros");
  const baths = page.getByLabel("Baños");
  await expect(baths).toHaveValue("0");
  await expect(baths.locator("option")).toHaveText(["Cualquiera", "1+", "2+", "3+"]);
  const tipo = page.getByRole("group", { name: "Tipo de alojamiento" });
  await expect(tipo.getByRole("button")).toHaveText(["Cualquiera", "Alojamiento completo", "Habitación"]);
  await expect(tipo.getByRole("button", { name: "Cualquiera" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Ver 10 casas" })).toBeVisible();
  // Todas las casas de la prueba tienen un baño y son alojamientos completos.
  await baths.selectOption("2");
  await expect(page.getByRole("button", { name: "Ver 0 casas" })).toBeVisible();
  await baths.selectOption("1");
  await expect(page.getByRole("button", { name: "Ver 10 casas" })).toBeVisible();
  await tipo.getByRole("button", { name: "Habitación" }).click();
  await expect(page.getByRole("button", { name: "Ver 0 casas" })).toBeVisible();
  await tipo.getByRole("button", { name: "Alojamiento completo" }).click();
  await expect(page.getByRole("button", { name: "Ver 10 casas" })).toBeVisible();
  await page.getByRole("button", { name: "Ver 10 casas" }).click();
  await expect(page).toHaveURL(/\/explorar\?banos=1&tipo=completo$/);
  await expect(page.getByRole("link", { name: "Filtros (2 activos)" })).toBeVisible();
  await page.getByRole("link", { name: /^Filtros/ }).click();
  await expect(page.getByLabel("Baños")).toHaveValue("1");
  await expect(page.getByRole("group", { name: "Tipo de alojamiento" }).getByRole("button", { name: "Alojamiento completo" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "Limpiar" }).click();
  await expect(page).toHaveURL(/\/explorar$/);
  await expect(page.getByRole("link", { name: "Filtros", exact: true })).toBeVisible();
});

test("sin zona la lista enseña todo el país con Limón primero, y el mapa a pantalla completa enseña las mismas casas", async ({ page }) => {
  await page.goto("/explorar");
  await expect(results(page)).toHaveText("10 casas");
  const cards = page.locator(".listing-grid:not(.skeleton) .listing-card");
  await expect(cards.last().locator("h2")).toHaveText("Cabina Sámara");
  await expect(cards.last()).toContainText("Sámara");
  // Un enlace viejo con ?prov= sigue filtrando por esa provincia.
  await page.goto("/explorar?prov=Guanacaste");
  await expect(results(page)).toHaveText("1 casa en Guanacaste");
  await page.goto("/explorar?mapa=1");
  await expect(page.getByRole("button", { name: "10 casas", exact: true })).toBeVisible();
  await expect(page.locator(".map-full .map-price").first()).toBeVisible();
});

test("con dólares elegidos, los precios de Filtros se escriben en dólares y se buscan en colones", async ({ page }) => {
  await page.goto("/explorar");
  await page.getByRole("group", { name: "Moneda de los precios" }).getByRole("button", { name: "Dólares" }).click();
  await page.getByRole("link", { name: /^Filtros/ }).click();
  await expect(page.getByLabel("Precio mínimo por noche")).toHaveAttribute("placeholder", "$ 0");
  await expect(page.getByText(/≈ ₡510 por US\$1/)).toBeVisible();
  await page.getByLabel("Precio mínimo por noche").fill("86");
  await page.getByLabel("Precio máximo por noche").fill("98");
  await page.getByRole("button", { name: "Ver 4 casas" }).click();
  await expect(page).toHaveURL(/\/explorar\?min=43860&max=49980$/);
  await page.getByRole("link", { name: /^Filtros/ }).click();
  await expect(page.getByLabel("Precio mínimo por noche")).toHaveValue("86");
  await expect(page.getByLabel("Precio máximo por noche")).toHaveValue("98");
});

test("la cabecera ya no tiene el chip mensual: filtros y ₡ | $ en una fila, y el rango de precio siempre disponible", async ({ page }) => {
  const chips = page.locator(".chiprow");
  // Una sola fila, sin scroll lateral, a 360 y a 375 px.
  for (const width of [375, 360]) {
    await page.setViewportSize({ width, height: 740 });
    await page.goto("/explorar");
    await expect(page.getByRole("button", { name: /mensual/i })).toHaveCount(0);
    await expect(chips.getByRole("link", { name: "Filtros", exact: true })).toBeVisible();
    await expect(chips.getByRole("group", { name: "Moneda de los precios" })).toBeVisible();
    const [scrollW, clientW, pageW] = await chips.evaluate((el) => [el.scrollWidth, el.clientWidth, document.documentElement.scrollWidth]);
    expect(scrollW, `sin scroll lateral en los chips a ${width} px`).toBeLessThanOrEqual(clientW!);
    expect(pageW, "la página no se ensancha").toBeLessThanOrEqual(width);
    const mids = await chips.locator(":scope > *").evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return Math.round(r.top + r.height / 2); }));
    expect(new Set(mids).size, `los filtros y ₡ | $ en una fila a ${width} px`).toBe(1);
    const filters = (await chips.getByRole("link", { name: /^Filtros/ }).boundingBox())!;
    expect(Math.min(filters.width, filters.height), `filtros de 44 px a ${width} px`).toBeGreaterThanOrEqual(44);
  }

  // Las diez casas cuestan entre ₡40 000 y ₡85 000 la noche.
  await page.goto("/explorar?min=40000&max=90000");
  await expect(results(page)).toHaveText("10 casas");
  const badge = page.getByRole("link", { name: /^Filtros/ }).locator(".badge");
  await expect(badge).toHaveText("2");
  const pills = page.locator(".listing-card .card-price");
  await expect(pills).toHaveCount(10);
  for (const text of await pills.allTextContents()) expect(text).toMatch(/\/ noche$/);
  // Sin modo mensual, el rango por noche no se oculta nunca.
  await page.getByRole("link", { name: /^Filtros/ }).click();
  await expect(page.getByLabel("Precio mínimo por noche")).toHaveValue("40000");
  await expect(page.getByLabel("Precio máximo por noche")).toHaveValue("90000");
  const needs = page.locator("section", { has: page.getByText("Qué necesitan", { exact: true }) }).locator(".chip");
  await expect(needs.filter({ hasText: "mensual" })).toHaveCount(0);
  await page.getByRole("button", { name: "Ver 10 casas" }).click();
  await expect(page).toHaveURL(/\/explorar\?min=40000&max=90000$/);

  // Las características van en Filtros, con el contador.
  await page.goto("/explorar?prov=Guanacaste&pool=1");
  await expect(results(page)).toHaveText("1 casa en Guanacaste");
  await expect(page.getByRole("link", { name: "Filtros (1 activo)" })).toContainText("1");
  await page.getByRole("link", { name: /^Filtros/ }).click();
  await expect(page.getByRole("button", { name: "Piscina", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("con llegada y salida, la tarjeta y el marcador del mapa enseñan el total orientativo (con precios especiales) y no «/ noche»", async ({ page }) => {
  await page.goto(`/explorar?llegada=${day(20)}&salida=${day(24)}`);
  await expect(results(page)).toContainText("10 casas");
  const price = (title: RegExp) => page.getByRole("link", { name: title }).locator(".card-price");
  // 4 noches a ₡40 000 + la noche especial de ₡100 000 (en vez de ₡40 000).
  await expect(price(/Casa Cocles 7/)).toHaveText("≈ ₡220 000 por 4 noches");
  await expect(price(/Casa Manzanillo/)).toHaveText("≈ ₡340 000 por 4 noches");
  for (const text of await page.locator(".listing-card .card-price").allTextContents()) {
    expect(text).toMatch(/^≈ ₡[\d\u00a0]+ por 4 noches$/);
    expect(text).not.toContain("/ noche");
    expect(text.toLowerCase()).not.toContain("total a pagar");
  }
  // En dólares, redondeado como el resto.
  await page.getByRole("group", { name: "Moneda de los precios" }).getByRole("button", { name: "Dólares" }).click();
  await expect(price(/Casa Manzanillo/)).toHaveText(/^≈ \$[\d\u00a0]+ por 4 noches$/);
  await page.getByRole("group", { name: "Moneda de los precios" }).getByRole("button", { name: "Colones" }).click();
  // El marcador del mapa enseña la misma cifra, sin «por N noches».
  await page.goto(`/explorar?llegada=${day(20)}&salida=${day(24)}&mapa=1`);
  // (Las casas de Limón comparten punto y se agrupan en un solo marcador «N casas»; la de Sámara va suelta: 4 × ₡60 000.)
  const pins = page.locator(".map-full .map-price");
  await expect(pins.filter({ hasText: /^₡240\u00a0000$/ })).toHaveCount(1);
  await expect(pins.filter({ hasText: /^₡60\u00a0000$/ })).toHaveCount(0);
  for (const text of await pins.allTextContents()) expect(text).not.toContain("noche");
  // Sin fechas, el precio por noche, como siempre.
  await page.goto("/explorar");
  await expect(price(/Casa Cocles 7/)).toContainText("₡40 000 / noche");
});

test("con 35 noches, la casa con precio al mes enseña el mensual prorrateado y la que no lo tiene, el total por noches", async ({ page }) => {
  await page.goto(`/explorar?llegada=${day(20)}&salida=${day(55)}`);
  await expect(results(page)).toContainText("10 casas");
  const price = (title: RegExp) => page.getByRole("link", { name: title }).locator(".card-price");
  // ₡480 000 al mes × 35 / 30 (la noche suelta de ₡85 000 saldría ₡2 975 000).
  await expect(price(/Casa Manzanillo/)).toHaveText("≈ ₡560 000 por 35 noches");
  // Acepta mensual pero sin precio al mes: 35 × ₡45 000.
  await expect(price(/Casa Cocles mensual/)).toHaveText("≈ ₡1 575 000 por 35 noches");
  // Sin llegada y salida elegidas no hay modo mensual: con 29 noches, por noches aunque tenga precio al mes.
  await page.goto(`/explorar?llegada=${day(20)}&salida=${day(49)}`);
  await expect(price(/Casa Manzanillo/)).toHaveText("≈ ₡2 465 000 por 29 noches");
});

test("los enlaces viejos ?mensual=1, ?modo=monthly y ?desde= abren Explorar normal, sin error y sin chip", async ({ page }) => {
  for (const query of ["mensual=1", "modo=monthly", `desde=${day(10)}`, `mensual=1&desde=${day(10)}&modo=monthly`]) {
    await page.goto(`/explorar?${query}`);
    await expect(results(page)).toHaveText("10 casas");
    await expect(page.getByRole("button", { name: /mensual/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Filtros", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /Casa Cocles mensual/ }).locator(".card-price")).toContainText("/ noche");
  }
  // Filtros con un rango inválido sigue bloqueando «Ver», con o sin el parámetro viejo.
  await page.goto("/explorar/filtros?min=50000&max=44000&mensual=1");
  await expect(page.getByRole("button", { name: /^Ver/ })).toBeDisabled();
});

// Revisión UX N5: en un ordenador, la rejilla de Explorar usa el ancho (3 columnas desde 900 px, 4 desde 1200 px); en el
// móvil, una casa por fila.
test("Explorar en escritorio: 3 y 4 columnas; en el móvil, 1", async ({ page }) => {
  const grid = page.locator(".listing-grid:not(.skeleton)");
  const columns = () => grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/explorar");
  await expect(grid.locator(".listing-card").first()).toBeVisible();
  expect(await columns()).toBe(4);
  await page.setViewportSize({ width: 1000, height: 800 });
  expect(await columns()).toBe(3);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await columns()).toBe(1);
});

test("la moneda cambia al instante en Explorar y la ficha muestra las dos", async ({ page }) => {
  await page.goto("/explorar");
  await expect(page.getByRole("link", { name: /Casa Manzanillo/ })).toContainText("₡85 000");
  const moneda = page.getByRole("group", { name: "Moneda de los precios" });
  await expect(moneda.getByRole("button", { name: "Colones" })).toHaveAttribute("aria-pressed", "true");
  await moneda.getByRole("button", { name: "Dólares" }).click();
  await expect(page.getByRole("link", { name: /Casa Manzanillo/ })).toContainText("$167");
  await page.getByRole("link", { name: /Casa Manzanillo/ }).click();
  await expect(page).toHaveURL(new RegExp(`/casa/${manzanillo.publicId}$`));
  // La ficha no sigue la moneda: colones a la izquierda y dólares a la derecha, nunca un botón «Ver en…».
  await expect(page.getByTestId("main-price")).toHaveText("₡85 000 / noche");
  await expect(page.getByTestId("price-usd")).toHaveText("≈ $167 / noche");
  await expect(page.getByRole("button", { name: /Ver en (colones|dólares)/ })).toHaveCount(0);
  await page.goto("/explorar");
  await expect(page.getByRole("link", { name: /Casa Manzanillo/ })).toContainText("$167");
});

test("volver de una ficha deja Explorar en el mismo punto del scroll", async ({ page }) => {
  await page.goto("/explorar");
  const card = page.getByRole("link", { name: /Casa Cocles 7/ });
  await card.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => window.scrollY);
  expect(before).toBeGreaterThan(200);
  await card.click();
  await expect(page).toHaveURL(new RegExp(`/casa/${ultima.publicId}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Casa Cocles 7" })).toBeVisible();
  await page.goBack();
  await expect(card).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before - 40);
});

// Revisión del movimiento (View Transitions reales de Chrome): el router restaura el scroll dentro de la actualización de la
// transición, así que la captura del estado nuevo ya ve Explorar en su sitio y nada salta al terminar. La foto vuela solo
// hacia la tarjeta de la casa de la que se vuelve.
test("Explorar ↔ ficha con View Transition: al volver, el scroll ya está restaurado cuando se captura y no salta después", async ({ page }) => {
  await page.addInitScript(() => {
    type Rec = { types: string[]; namedAtStart: string | null; namedAtUpdate: string | null; atUpdate: number; atFinish: number; after: number[] };
    const w = window as unknown as { vt: Rec[] };
    w.vt = [];
    const original = document.startViewTransition?.bind(document);
    if (!original) return;
    const named = () => [...document.querySelectorAll<HTMLElement>(".listing-card .photo")].find((el) => el.style.viewTransitionName === "listing-photo")?.closest("a")?.getAttribute("href") ?? null;
    document.startViewTransition = ((arg: StartViewTransitionOptions) => {
      const rec: Rec = { types: [...((typeof arg === "object" && arg?.types) || [])], namedAtStart: named(), namedAtUpdate: null, atUpdate: -1, atFinish: -1, after: [] };
      w.vt.push(rec);
      const t = original(arg);
      void t.updateCallbackDone.then(() => {
        rec.atUpdate = scrollY;
        rec.namedAtUpdate = named();
      });
      void t.finished.then(async () => {
        rec.atFinish = scrollY;
        for (let i = 0; i < 20; i++) {
          await new Promise(requestAnimationFrame);
          rec.after.push(scrollY);
        }
      });
      return t;
    }) as typeof document.startViewTransition;
  });
  const vt = () => page.evaluate(() => (window as unknown as { vt: { types: string[]; namedAtStart: string | null; namedAtUpdate: string | null; atUpdate: number; atFinish: number; after: number[] }[] }).vt);

  await page.goto("/explorar");
  const card = page.getByRole("link", { name: /Casa Cocles 7/ });
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => window.scrollY);
  const top = () => card.evaluate((el) => Math.round(el.getBoundingClientRect().top));
  const cardTop = await top();
  expect(before).toBeGreaterThan(200);

  await card.click();
  await expect(page.getByRole("heading", { level: 1, name: "Casa Cocles 7" })).toBeVisible();
  await expect.poll(async () => (await vt())[0]?.atFinish ?? -1).toBeGreaterThanOrEqual(0);
  const open = (await vt())[0]!;
  expect(open.types).toEqual(["listing-open"]);
  expect(open.namedAtStart, "al abrir vuela la foto de la tarjeta tocada").toBe(`/casa/${ultima.publicId}`);

  await page.getByRole("link", { name: "Volver a Explorar" }).click();
  await expect(card).toBeVisible();
  await expect.poll(async () => (await vt())[1]?.after.length ?? 0).toBe(20);
  const close = (await vt())[1]!;
  expect(close.types).toEqual(["listing-close"]);
  expect(close.namedAtUpdate, "la foto vuelve a su tarjeta").toBe(`/casa/${ultima.publicId}`);
  expect(Math.abs(close.atUpdate - before), `scroll al capturar ${close.atUpdate}, antes ${before}`).toBeLessThanOrEqual(1);
  expect(close.atFinish).toBe(close.atUpdate);
  expect(new Set(close.after), "sin saltos después de la transición").toEqual(new Set([close.atUpdate]));
  expect(Math.abs((await top()) - cardTop)).toBeLessThanOrEqual(1);

  // Otra casa: solo su tarjeta lleva el nombre al abrir; la de antes ya no.
  const other = page.getByRole("link", { name: /Casa Cocles 6/ });
  await other.click();
  await expect(page.getByRole("heading", { level: 1, name: "Casa Cocles 6" })).toBeVisible();
  await expect.poll(async () => (await vt()).length).toBe(3);
  expect((await vt())[2]!.namedAtStart).not.toBe(`/casa/${ultima.publicId}`);
  expect((await vt())[2]!.namedAtStart).toMatch(/^\/casa\/CT-/);
});

test("la segunda visita pinta desde la caché sin red, y la ficha se pinta desde la tarjeta", async ({ page }) => {
  await page.goto("/explorar");
  await expect(results(page)).toHaveText("10 casas");
  await page.waitForTimeout(1500); // la caché se guarda en IndexedDB con un pequeño retraso
  await page.route("**/rest/v1/**", (route) => route.abort());
  await page.reload();
  await expect(results(page)).toHaveText("10 casas");
  await page.getByRole("link", { name: /Casa Manzanillo/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Casa Manzanillo" })).toBeVisible();
  await expect(page.getByTestId("main-price")).toHaveText("₡85 000 / noche");
});

test("sin resultados lo dice, y las pestañas cambian sin red", async ({ page }) => {
  await page.goto("/explorar/filtros?ppl=6");
  await expect(page.getByRole("button", { name: "Ver 0 casas" })).toBeVisible();
  await page.getByRole("button", { name: "Ver 0 casas" }).click();
  await expect(page).toHaveURL(/\/explorar\?ppl=6$/);
  await expect(page.getByRole("heading", { name: "No hay casas con esos filtros" })).toBeVisible();
  await page.goto("/explorar");
  await expect(results(page)).toHaveText("10 casas");

  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  // Favoritos y Cuenta son trozos diferidos: los trae la precarga (en reposo o al apuntar a la pestaña; instalada, el
  // service worker) antes de quedarse sin red. Puede que ya estén descargados al llegar aquí, así que se mira lo cargado.
  await nav.getByRole("link", { name: "Favoritos" }).hover();
  await page.waitForFunction(() => {
    const names = performance.getEntriesByType("resource").map((e) => e.name);
    return ["favoritos-", "cuenta-"].every((chunk) => names.some((n) => n.includes(`/assets/${chunk}`) && n.endsWith(".js")));
  });
  await page.route("**/*", (route) => route.abort());
  await nav.getByRole("link", { name: "Favoritos" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Favoritos" })).toBeVisible();
  await nav.getByRole("link", { name: "Ingresar" }).click();
  // Sin sesión, la pestaña «Ingresar» (C4) se pinta sin red porque no descarga supabase-js.
  await expect(page.getByRole("heading", { level: 1, name: "Ingresar" })).toBeAttached();
  await expect(page.getByLabel("Número de WhatsApp")).toBeVisible();
  await nav.getByRole("link", { name: "Explorar" }).click();
  await expect(results(page)).toHaveText("10 casas");
});
