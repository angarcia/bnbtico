import { expect, test, type Page } from "./helpers/test";
import type { Seeded } from "../contract/harness";
import { addDays } from "../../src/domain/dates";
import { costaRicaToday } from "../../src/domain/inquiry";
import { postgrestHarness } from "../db/postgrest-harness";

// Explorar y Filtros en el navegador (pantallas 01 y 02), contra Supabase local.
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
let manzanillo: Seeded;
let ultima: Seeded;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const h = await postgrestHarness();
  await h.reset();
  await h.seed({ status: "draft", draft: { province: "Cartago", canton: "Turrialba", zone: "Turrialba", zoneSource: "other", zoneId: null, lat: 9.9, lng: -83.68 } });
  await h.seed({ status: "active", draft: { title: "Cabina Sámara", province: "Guanacaste", canton: "Nicoya", zone: "Sámara", zoneSource: "other", zoneId: null, lat: 9.88, lng: -85.53, capacity: 2, features: ["pool"], nightlyPriceCrc: 60000 } });
  ultima = await h.seed({ status: "active", draft: { title: "Casa Cocles 7", zone: "Cocles", zoneSource: "other", zoneId: null, capacity: 2, nightlyPriceCrc: 40000 } });
  for (let i = 6; i >= 1; i--) await h.seed({ status: "active", draft: { title: `Casa Cocles ${i}`, zone: "Cocles", zoneSource: "other", zoneId: null, capacity: 2, nightlyPriceCrc: 40000 + i * 1000 } });
  manzanillo = await h.seed({ status: "active", draft: { title: "Casa Manzanillo", zone: "Manzanillo", zoneSource: "other", zoneId: null, capacity: 5, acceptsMonthly: true, monthlyPriceCrc: 480000, nightlyPriceCrc: 85000, features: ["wifi", "beachfront"] } });
  await h.seed({ status: "active", draft: { title: "Casa Cocles mensual", zone: "Cocles", zoneSource: "other", zoneId: null, capacity: 2, nightlyPriceCrc: 45000, acceptsMonthly: true, monthlyPriceCrc: null } });
});

test.beforeEach(async ({ page }) => {
  await page.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
  await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
});

const results = (page: Page) => page.getByTestId("results-count");

test("Tarjeta: de borde a borde, foto 3:2 deslizable con puntitos, pedida al deslizar, y botón de WhatsApp que abre la hoja sobre Explorar", async ({ page }) => {
  await page.goto("/explorar");
  const cards = page.locator(".listing-grid:not(.skeleton) .listing-card");
  await expect(cards).toHaveCount(10);
  const card = cards.nth(1);
  const cell = page.locator(".listing-grid .listing-cell").nth(1);
  // En el teléfono (2026-11-03): de borde a borde, foto 3:2, con puntitos en lugar del «1 / N».
  const photo = (await card.locator(".photo").boundingBox())!;
  expect(Math.abs(photo.width / photo.height - 3 / 2)).toBeLessThan(0.02);
  const dots = card.locator(".photo-dots i");
  // Antes de deslizar solo existe la primera foto; el primer puntito marcado y el corazón sigue arriba a la derecha.
  await expect(card.locator("img")).toHaveCount(1);
  await expect(dots).toHaveCount(5);
  await expect(dots.nth(0)).toHaveClass(/\bon\b/);
  const heart = (await cell.locator(".heart-card").boundingBox())!;
  expect(heart.y - photo.y).toBeLessThan(20);
  expect(photo.x + photo.width - (heart.x + heart.width)).toBeLessThan(20);
  const requested: string[] = [];
  page.on("request", (r) => r.url().includes("/storage/v1/object/public/") && requested.push(r.url()));
  await card.scrollIntoViewIfNeeded();
  const before = requested.length;
  await card.locator(".card-strip").evaluate((el) => el.scrollTo({ left: el.clientWidth, behavior: "instant" }));
  await expect(dots.nth(1)).toHaveClass(/\bon\b/);
  await expect(dots.nth(0)).not.toHaveClass(/\bon\b/);
  // Al deslizar se montan la foto 2 y la 3 (la que viene) y se piden; las demás siguen sin existir. Deslizar no navega.
  await expect(card.locator("img")).toHaveCount(3);
  await expect.poll(() => requested.length - before).toBeGreaterThanOrEqual(2);
  await expect(page).toHaveURL(/\/explorar/);
  // El botón de WhatsApp va fuera del enlace, con el nombre del anfitrión, y abre la misma hoja sobre Explorar.
  const wa = cell.getByRole("button", { name: /^Contactar por WhatsApp a / });
  await expect(wa).toBeVisible();
  expect(await card.locator("button").count()).toBe(0);
  const name = (await card.locator("h2").textContent())!;
  await wa.click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("heading", { name: /^Escríbale a / })).toBeVisible();
  await expect(sheet).toContainText(name);
  await expect(page).toHaveURL(/\/explorar/);
  await sheet.getByRole("button", { name: "Cerrar" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(wa).toBeFocused();
  // Tocar la foto abre la ficha.
  await card.locator(".photo").click();
  await expect(page).toHaveURL(/\/casa\/CT-/);
});

// Auditoría de viajes (2026-11-05): la búsqueda esperaba a las provincias (un viaje entero de más en la primera visita).
// Ahora sale a la vez, con la provincia de la URL o Limón, y la lista la aprovecha al llegar las provincias.
test("en frío, la búsqueda sale sin esperar a las provincias y no se repite al llegar ellas", async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route("**/rest/v1/provinces_with_listings**", async (route) => {
    await held;
    await route.continue();
  });
  const searches: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/rest/v1/rpc/search_listings")) searches.push(r.postData() ?? "");
  });
  await page.goto("/explorar");
  await expect.poll(() => searches.length).toBe(1);
  release();
  await expect(results(page)).toContainText("casas");
  await expect(page.getByText("Casa Manzanillo")).toBeVisible();
  expect(searches).toHaveLength(1);
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
  // Sin zona: todo el país, con el Caribe primero (ticket 06): las nueve de Limón y, al final, la de Guanacaste.
  await expect(results(page)).toHaveText("10 casas");
  await expect(page.getByRole("link", { name: /Casa Manzanillo/ })).toBeVisible();
  await expect(page.locator(".listing-grid:not(.skeleton) .listing-card").last()).toContainText("Cabina Sámara");
  // Una casa por fila, a todo el ancho menos los márgenes; la primera foto (el LCP) sin carga diferida y con prioridad alta,
  // las de las demás tarjetas diferidas; las fotos 2+ de cada tarjeta no existen hasta deslizarla (ticket 09 de la ronda del 2 nov).
  const cards = page.locator(".listing-grid:not(.skeleton) .listing-card");
  await expect(cards).toHaveCount(10);
  await expect(cards.first().locator("img")).toHaveCount(1);
  await expect(cards.first().locator("img")).toHaveAttribute("loading", "eager");
  await expect(cards.first().locator("img")).toHaveAttribute("fetchpriority", "high");
  await expect(cards.nth(1).locator("img")).toHaveCount(1);
  await expect(cards.nth(1).locator("img")).toHaveAttribute("loading", "lazy");
  const viewport = page.viewportSize()!.width;
  for (const box of await cards.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width))) expect(Math.abs(box - viewport)).toBeLessThanOrEqual(1);
  // La primera es la más nueva (Casa Cocles mensual): nombre, zona, personas y habitaciones, y el precio de la noche.
  await expect(cards.first().locator("h2")).toHaveText("Casa Cocles mensual");
  await expect(cards.first()).toContainText("Cocles2 personas · 1 dormitorio · 1 baño₡45 000 / noche");
  await expect(cards.first().locator(".pill")).toHaveCount(0);
  await expect(cards.first().locator(".card-capacity svg")).toHaveCount(3);
  const beachHouse = cards.filter({ hasText: "Casa Manzanillo" });
  await expect(beachHouse.getByRole("img", { name: "Wifi", exact: true })).toBeVisible();
  await expect(beachHouse.getByRole("img", { name: "Frente al mar", exact: true })).toBeVisible();
  await expect(beachHouse.getByRole("img", { name: "Piscina", exact: true })).toHaveCount(0);
  // Tarjetas flotantes, tanda 1 (Daniel, 2026-11-04): el mapa arriba a todo el ancho y, encima, la búsqueda, los filtros y
  // «₡ | $» como tarjetas translúcidas a 12 px de los bordes; al bajar se esconden con la barra de abajo y al subir vuelven.
  const vp = page.viewportSize()!;
  const top = page.locator(".explore-top");
  const pill = (await page.locator(".explore-top .search-pill").boundingBox())!;
  expect(pill).toMatchObject({ x: 12, y: 12, width: vp.width - 24 });
  const map = (await page.getByTestId("explore-map").boundingBox())!;
  expect(map).toMatchObject({ x: 0, y: 0, width: vp.width });
  expect(pill.y + pill.height).toBeLessThan(map.y + map.height);
  for (const card of [page.locator(".explore-top .search-pill"), page.getByRole("link", { name: "Filtros", exact: true }), page.getByRole("group", { name: "Moneda de los precios" })]) {
    const look = await card.evaluate((el) => ({ blur: getComputedStyle(el).backdropFilter, radius: getComputedStyle(el).borderTopLeftRadius }));
    expect(look).toEqual({ blur: "blur(16px) saturate(1.2)", radius: "12px" });
  }
  const shown = () => top.evaluate((el) => getComputedStyle(el).opacity === "1" && el.getBoundingClientRect().top >= 0);
  // Como el dedo, en varios pasos: el escondido ve cada desplazamiento.
  const scrollTo = async (y: number) => {
    const from = await page.evaluate(() => scrollY);
    for (let i = 1; i <= 5; i++) {
      await page.evaluate((v) => window.scrollTo(0, v), Math.round(from + ((y - from) * i) / 5));
      await page.waitForTimeout(30);
    }
  };
  await scrollTo(900);
  await expect.poll(shown).toBe(false);
  await expect(page.locator("html")).toHaveClass(/chrome-away/);
  await expect(page.getByRole("link", { name: "Empiece su búsqueda" })).not.toBeInViewport();
  await scrollTo(700);
  await expect.poll(shown).toBe(true);
  await expect(page.getByRole("link", { name: "Empiece su búsqueda" })).toBeInViewport();
  // Exactamente 12 px, cuando acaba la vuelta: la opacidad llega a 1 antes que el transform (en CI se medía 11,9997).
  await expect.poll(async () => (await page.locator(".explore-top .search-pill").boundingBox())!.y).toBe(12);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole("link", { name: "Filtros", exact: true }).click();
  await expect(page).toHaveURL(/\/explorar\/filtros$/);
  await expect(page.getByRole("heading", { level: 1, name: "Filtros" })).toBeVisible();
  // Sin pastillas de provincia (ticket 06): sin zona son todas las casas del país.
  await expect(page.getByRole("group", { name: "Zona", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ver 10 casas" })).toBeVisible();
});

// Escondida al bajar, la cabecera de Explorar no responde al toque (tampoco a medio salir ni, con movimiento reducido, fundida
// en su sitio): lo que hay debajo (la lista) lo recibe; con el foco del teclado dentro, se queda a la vista y responde.
test("la cabecera escondida de Explorar no responde al toque, salvo con el foco del teclado", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/explorar");
  await expect(results(page)).toBeVisible();
  const pill = page.locator(".explore-top .search-pill");
  const filters = page.getByRole("link", { name: "Filtros", exact: true });
  const spots = async () => {
    const boxes = [(await pill.boundingBox())!, (await filters.boundingBox())!, (await page.getByRole("group", { name: "Moneda de los precios" }).boundingBox())!];
    return boxes.map((b) => ({ x: b.x + b.width / 2, y: Math.max(1, b.y + b.height / 2) }));
  };
  const at = await spots();
  const hit = () => page.evaluate((pts) => pts.map(({ x, y }) => !!document.elementFromPoint(x, y)?.closest(".explore-top")), at);
  expect(await hit()).toEqual([true, true, true]);
  for (let i = 1; i <= 6; i++) {
    await page.evaluate((v) => window.scrollTo(0, v), i * 150);
    await page.waitForTimeout(30);
  }
  await expect(page.locator("html")).toHaveClass(/chrome-away/);
  await expect.poll(hit).toEqual([false, false, false]);
  for (const el of [pill, filters]) expect(await el.evaluate((e) => getComputedStyle(e).pointerEvents)).toBe("none");
  // Con movimiento reducido solo se funde y se queda en su sitio, invisible: tampoco ahí recibe el toque.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => page.locator(".explore-top").evaluate((e) => getComputedStyle(e).opacity)).toBe("0");
  expect(await hit()).toEqual([false, false, false]);
  // Con el teclado: el foco en «Filtros» la deja a la vista y responde.
  await filters.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect.poll(() => page.locator(".explore-top").evaluate((e) => getComputedStyle(e).opacity)).toBe("1");
  expect(await filters.evaluate((e) => getComputedStyle(e).pointerEvents)).toBe("auto");
});

test("Filtros cuenta en vivo, no deja un mínimo mayor que el máximo, y «Ver N casas» aplica y vuelve", async ({ page }) => {
  await page.goto("/explorar/filtros");
  // Sin zona es todo el país (ticket 06): sin pastillas de provincia aunque haya casas en Limón y en Guanacaste.
  await expect(page.getByRole("group", { name: "Zona", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Zona Todas las provincias" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ver 10 casas" })).toBeVisible();
  await page.getByRole("button", { name: "Piscina", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ver 1 casa" })).toBeVisible();
  await page.getByRole("button", { name: "Piscina", exact: true }).click();
  // El número de personas también se recupera de un enlace directo.
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
  await page.getByRole("button", { name: "Limpiar", exact: true }).click();
  await expect(page).toHaveURL(/\/explorar\/filtros/);
  await expect(page.getByLabel("Precio mínimo por noche")).toHaveValue("");
  await expect(page.getByLabel("Precio máximo por noche")).toHaveValue("");
  await expect(page.getByRole("button", { name: "Ver 10 casas", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ver 10 casas", exact: true }).click();
  await expect(page).toHaveURL(/\/explorar$/);
  await expect(results(page)).toHaveText("10 casas");

  // Una URL con mínimo > máximo se trata como sin rango.
  await page.goto("/explorar?prov=Todas&min=50000&max=44000");
  await expect(results(page)).toHaveText("10 casas");
});

test("Filtros: tipo de alojamiento de una sola opción, en la URL y en el contador (ticket 06)", async ({ page }) => {
  await page.goto("/explorar/filtros");
  const tipo = page.getByRole("group", { name: "Tipo de alojamiento" });
  await expect(tipo.getByRole("button")).toHaveText(["Cualquiera", "Completo", "Habitación"]);
  await expect(tipo.getByRole("button", { name: "Cualquiera" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Más dormitorios" })).toHaveCount(0);
  await tipo.getByRole("button", { name: "Alojamiento completo" }).click();
  // Todas las casas sembradas son alojamientos completos.
  await page.getByRole("button", { name: "Más dormitorios" }).click();
  await page.getByRole("button", { name: "Más dormitorios" }).click();
  await tipo.getByRole("button", { name: "Habitación" }).click();
  await expect(page.getByRole("button", { name: "Más dormitorios" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Más personas" })).toBeVisible();
  await expect(tipo.getByRole("button", { name: "Habitación" })).toHaveAttribute("aria-pressed", "true");
  await expect(tipo.getByRole("button", { name: "Alojamiento completo" })).toHaveAttribute("aria-pressed", "false");
  await expect(tipo.getByRole("button", { name: "Cualquiera" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: "Ver 0 casas" })).toBeVisible();
  await tipo.getByRole("button", { name: "Alojamiento completo" }).click();
  await expect(page.getByRole("button", { name: "Menos dormitorios" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Ver 10 casas" })).toBeVisible();
  await page.getByRole("button", { name: "Ver 10 casas" }).click();
  await expect(page).toHaveURL(/\/explorar\?tipo=completo$/);
  await expect(page.getByRole("link", { name: "Filtros (1 activo)" })).toBeVisible();
  await page.getByRole("link", { name: /^Filtros/ }).click();
  await expect(tipo.getByRole("button", { name: "Alojamiento completo" })).toHaveAttribute("aria-pressed", "true");
  await tipo.getByRole("button", { name: "Cualquiera" }).click();
  await expect(page.getByRole("button", { name: "Más dormitorios" })).toHaveCount(0);
  await expect(tipo.locator('[aria-pressed="true"]')).toHaveCount(1);
  await page.getByRole("button", { name: "Ver 10 casas" }).click();
  await expect(page).toHaveURL(/\/explorar$/);
  await page.goto("/explorar/filtros?tipo=habitacion&beds=3");
  await expect(page.getByRole("button", { name: "Más dormitorios" })).toHaveCount(0);
  await page.getByRole("button", { name: "Limpiar", exact: true }).click();
  await expect(tipo.getByRole("button", { name: "Cualquiera" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Más dormitorios" })).toHaveCount(0);
});

test("con dólares elegidos, los precios de Filtros se escriben en dólares y se buscan en colones", async ({ page }) => {
  await page.goto("/explorar");
  await page.getByRole("group", { name: "Moneda de los precios" }).getByRole("button", { name: "Dólares" }).click();
  await page.getByRole("link", { name: /^Filtros/ }).click();
  await expect(page.getByLabel("Precio mínimo por noche")).toHaveAttribute("placeholder", "$ 0");
  await expect(page.getByText(/tipo de referencia/)).toHaveCount(0);
  await page.getByLabel("Precio mínimo por noche").fill("86");
  await page.getByLabel("Precio máximo por noche").fill("98");
  await page.getByRole("button", { name: "Ver 4 casas" }).click();
  await expect(page).toHaveURL(/\/explorar\?min=43860&max=49980$/);
  await page.getByRole("link", { name: /^Filtros/ }).click();
  await expect(page.getByLabel("Precio mínimo por noche")).toHaveValue("86");
  await expect(page.getByLabel("Precio máximo por noche")).toHaveValue("98");
});

test("cabecera sin el chip mensual: los filtros y ₡ | $ en una fila; el rango por noche cuenta y se ve siempre", async ({ page }) => {
  const chips = page.locator(".chiprow");
  // Una sola fila, sin scroll lateral, a 360 y a 375 px; ya no hay «Solo alquiler mensual» (fin del modo mensual, 2026-11-02).
  for (const width of [375, 360]) {
    await page.setViewportSize({ width, height: 740 });
    await page.goto("/explorar");
    await expect(chips.getByRole("link", { name: "Filtros", exact: true })).toBeVisible();
    await expect(chips.getByRole("group", { name: "Moneda de los precios" })).toBeVisible();
    await expect(page.getByRole("button", { name: /mensual/i })).toHaveCount(0);
    await expect(chips).not.toContainText("ensual");
    const [scrollW, clientW, pageW] = await chips.evaluate((el) => [el.scrollWidth, el.clientWidth, document.documentElement.scrollWidth]);
    expect(scrollW, `sin scroll lateral en los chips a ${width} px`).toBeLessThanOrEqual(clientW!);
    expect(pageW, "la página no se ensancha").toBeLessThanOrEqual(width);
    const mids = await chips.locator(":scope > *").evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return Math.round(r.top + r.height / 2); }));
    expect(new Set(mids).size, `los filtros y ₡ | $ en una fila a ${width} px`).toBe(1);
    const filters = (await chips.getByRole("link", { name: /^Filtros/ }).boundingBox())!;
    expect(Math.min(filters.width, filters.height), `filtros de 44 px a ${width} px`).toBeGreaterThanOrEqual(44);
  }

  // Las diez casas cuestan entre ₡40 000 y ₡85 000 la noche: el rango cuenta en el contador y se ve en Filtros.
  await page.goto("/explorar?min=40000&max=90000");
  await expect(results(page)).toHaveText("10 casas");
  await expect(page.getByRole("link", { name: /^Filtros/ }).locator(".badge")).toHaveText("2");
  const pills = page.locator(".listing-card .card-price");
  await expect(pills).toHaveCount(10);
  for (const text of await pills.allTextContents()) expect(text).toMatch(/\/ noche$/);
  // Una casa que acepta mensual (con o sin precio al mes) sigue con su precio por noche sin fechas.
  await expect(page.getByRole("link", { name: /Casa Manzanillo/ }).locator(".card-price")).toHaveText("₡85 000 / noche");
  await expect(page.getByRole("link", { name: /Casa Cocles mensual/ }).locator(".card-price")).toHaveText("₡45 000 / noche");
  await page.getByRole("link", { name: /^Filtros/ }).click();
  await expect(page.getByLabel("Precio mínimo por noche")).toHaveValue("40000");
  await expect(page.getByLabel("Precio máximo por noche")).toHaveValue("90000");
  await expect(page.getByText(/mensual/i)).toHaveCount(0);

  // Las características van en Filtros, con el contador.
  await page.goto("/explorar?prov=Guanacaste&pool=1");
  await expect(results(page)).toHaveText("1 casa en Guanacaste");
  await expect(page.getByRole("link", { name: "Filtros (1 activo)" })).toContainText("1");
  await page.getByRole("link", { name: /^Filtros/ }).click();
  await expect(page.getByRole("button", { name: "Piscina", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("enlaces viejos del modo mensual (?mensual=1, ?modo=monthly, ?desde=) abren Explorar normal, sin error", async ({ page }) => {
  const desde = addDays(costaRicaToday(Date.now()), 10);
  for (const old of ["?mensual=1", "?modo=monthly", `?desde=${desde}`, `?mensual=1&desde=${desde}&modo=monthly`]) {
    await page.goto(`/explorar${old}`);
    await expect(results(page)).toHaveText("10 casas");
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.locator(".listing-card .card-price").first()).toHaveText(/\/ noche$/);
  }
  // En Filtros, un rango inválido bloquea «Ver N casas» también con «mensual» en el enlace (antes el mensual lo ocultaba).
  await page.goto("/explorar/filtros?min=50000&max=44000&mensual=1");
  await expect(page.getByRole("alert")).toHaveText("El precio mínimo no puede ser mayor que el máximo.");
  await expect(page.getByRole("button", { name: /^Ver/ })).toBeDisabled();
});

test("con llegada y salida, cada tarjeta dice el total orientativo de esas noches; con 30 o más y precio al mes, el mes prorrateado", async ({ page }) => {
  const h = await postgrestHarness();
  const today = costaRicaToday(Date.now());
  const day = (n: number) => addDays(today, n);
  // Un precio especial en la segunda noche de Casa Cocles 7 (₡40 000 la noche).
  await h.putDay(ultima.id, { day: day(21), available: true, specialPriceCrc: 50000 });
  const price = (title: RegExp) => page.getByRole("link", { name: title }).locator(".card-price");

  await page.goto(`/explorar?llegada=${day(20)}&salida=${day(24)}`);
  await expect(results(page)).toContainText("10 casas · ");
  await expect(price(/Casa Cocles 7/)).toHaveText("≈ ₡170 000 por 4 noches");
  await expect(price(/Casa Cocles 1/)).toHaveText("≈ ₡164 000 por 4 noches");
  // 4 noches: aunque acepte mensual con precio, por noches.
  await expect(price(/Casa Manzanillo/)).toHaveText("≈ ₡340 000 por 4 noches");
  await expect(price(/Casa Manzanillo/).locator("b")).toHaveText("≈ ₡340 000");
  await expect(page.locator(".listing-grid")).not.toContainText(/total|pagar|\/ noche/i);
  // En dólares, redondeado como el resto (₡510 por US$1 en local).
  await page.getByRole("group", { name: "Moneda de los precios" }).getByRole("button", { name: "Dólares" }).click();
  await expect(price(/Casa Manzanillo/)).toHaveText("≈ $667 por 4 noches");
  await page.getByRole("group", { name: "Moneda de los precios" }).getByRole("button", { name: "Colones" }).click();

  // 35 noches: con precio al mes (₡480 000), 480 000 × 35 / 30; sin él (mensual a negociar), por noches.
  await page.goto(`/explorar?llegada=${day(20)}&salida=${day(55)}`);
  await expect(price(/Casa Manzanillo/)).toHaveText("≈ ₡560 000 por 35 noches");
  await expect(price(/Casa Cocles mensual/)).toHaveText("≈ ₡1 575 000 por 35 noches");
  await expect(price(/Casa Cocles 7/)).toHaveText("≈ ₡1 410 000 por 35 noches");

  // Sin fechas, otra vez el precio de la noche.
  await page.goto("/explorar");
  await expect(price(/Casa Manzanillo/)).toHaveText("₡85 000 / noche");
  await h.putDay(ultima.id, { day: day(21), available: true, specialPriceCrc: null });
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
