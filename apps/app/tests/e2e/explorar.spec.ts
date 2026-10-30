import { expect, test, type Page } from "./helpers/test";
import type { Seeded } from "../contract/harness";
import { sql } from "../db/local";
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

test("Explorar sin barra superior: píldora «Empiece su búsqueda», cuenta, filtros y ₡ | $", async ({ page }) => {
  await page.goto("/explorar");
  await expect(page.getByRole("heading", { level: 1, name: "Explorar casas" })).toBeAttached();
  await expect(page.locator(".topbar")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Empiece su búsqueda" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ingresar" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Moneda de los precios" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Filtros", exact: true })).toBeVisible();
  await expect(results(page)).toHaveText("9 casas en Limón");
  await expect(page.getByRole("link", { name: /Casa Manzanillo/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Cabina Sámara/ })).toHaveCount(0);
  // Una casa por fila, a todo el ancho menos los márgenes; la primera foto (el LCP) sin carga diferida.
  const cards = page.locator(".listing-grid:not(.skeleton) .listing-card");
  await expect(cards).toHaveCount(9);
  await expect(cards.first().locator("img")).toHaveAttribute("loading", "eager");
  await expect(cards.nth(1).locator("img")).toHaveAttribute("loading", "lazy");
  const viewport = page.viewportSize()!.width;
  for (const box of await cards.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width))) expect(Math.abs(box - (viewport - 2 * 16))).toBeLessThanOrEqual(1);
  // La primera es la más nueva (Casa Cocles mensual): nombre, zona, personas y habitaciones, y el precio de la noche.
  await expect(cards.first().locator("h2")).toHaveText("Casa Cocles mensual");
  await expect(cards.first()).toContainText("Cocles2 personas · 1 habitación₡45 000 / noche");
  await expect(cards.first().locator(".pill")).toHaveCount(0);
  // La píldora y la fila de chips se quedan arriba al bajar.
  await page.evaluate(() => window.scrollTo(0, 900));
  await expect.poll(() => page.locator(".explore-top").evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBe(0);
  await expect(page.getByRole("link", { name: "Empiece su búsqueda" })).toBeInViewport();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole("link", { name: "Filtros", exact: true }).click();
  await expect(page).toHaveURL(/\/explorar\/filtros$/);
  await expect(page.getByRole("heading", { level: 1, name: "Filtros" })).toBeVisible();
  const zona = page.getByRole("group", { name: "Zona" });
  await expect(zona.getByRole("button")).toHaveText(["Todas", "Guanacaste", "Limón"]);
  await expect(page.getByRole("button", { name: "Ver 9 casas" })).toBeVisible();
});

test("Filtros cuenta en vivo, no deja un mínimo mayor que el máximo, y «Ver N casas» aplica y vuelve", async ({ page }) => {
  await page.goto("/explorar/filtros");
  const zona = page.getByRole("group", { name: "Zona" });
  await zona.getByRole("button", { name: "Todas" }).click();
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
  await expect(page).toHaveURL(/\/explorar\?prov=Todas&min=44000&max=50000$/);
  await expect(results(page)).toHaveText("4 casas");

  await page.getByRole("link", { name: /^Filtros/ }).click();
  await expect(page.getByLabel("Precio mínimo por noche")).toHaveValue("44000");
  await page.getByRole("link", { name: "Limpiar" }).click();
  await expect(page).toHaveURL(/\/explorar$/);
  await expect(results(page)).toHaveText("9 casas en Limón");

  // Una URL con mínimo > máximo se trata como sin rango.
  await page.goto("/explorar?prov=Todas&min=50000&max=44000");
  await expect(results(page)).toHaveText("10 casas");
});

test("con dólares elegidos, los precios de Filtros se escriben en dólares y se buscan en colones", async ({ page }) => {
  await page.goto("/explorar");
  await page.getByRole("group", { name: "Moneda de los precios" }).getByRole("button", { name: "Dólares" }).click();
  await page.getByRole("link", { name: /^Filtros/ }).click();
  await page.getByRole("group", { name: "Zona" }).getByRole("button", { name: "Todas" }).click();
  await expect(page.getByLabel("Precio mínimo por noche")).toHaveAttribute("placeholder", "$ 0");
  await expect(page.getByText(/≈ ₡510 por US\$1/)).toBeVisible();
  await page.getByLabel("Precio mínimo por noche").fill("86");
  await page.getByLabel("Precio máximo por noche").fill("98");
  await page.getByRole("button", { name: "Ver 4 casas" }).click();
  await expect(page).toHaveURL(/\/explorar\?prov=Todas&min=43860&max=49980$/);
  await page.getByRole("link", { name: /^Filtros/ }).click();
  await expect(page.getByLabel("Precio mínimo por noche")).toHaveValue("86");
  await expect(page.getByLabel("Precio máximo por noche")).toHaveValue("98");
});

test("Solo alquiler mensual: un chip, la línea y los precios por mes; al quitarlo vuelven «/ noche» y el rango", async ({ page }) => {
  const chips = page.locator(".chiprow");
  // Una sola fila, sin scroll lateral, a 360 y a 375 px.
  for (const width of [375, 360]) {
    await page.setViewportSize({ width, height: 740 });
    await page.goto("/explorar");
    await expect(chips.getByRole("button", { name: "Solo alquiler mensual" })).toBeVisible();
    await expect(chips.getByRole("link", { name: "Filtros", exact: true })).toBeVisible();
    await expect(chips.getByRole("group", { name: "Moneda de los precios" })).toBeVisible();
    const [scrollW, clientW, pageW] = await chips.evaluate((el) => [el.scrollWidth, el.clientWidth, document.documentElement.scrollWidth]);
    expect(scrollW, `sin scroll lateral en los chips a ${width} px`).toBeLessThanOrEqual(clientW!);
    expect(pageW, "la página no se ensancha").toBeLessThanOrEqual(width);
    const mids = await chips.locator(":scope > *").evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return Math.round(r.top + r.height / 2); }));
    expect(new Set(mids).size, `el mensual, los filtros y ₡ | $ en una fila a ${width} px`).toBe(1);
  }

  // Con el mensual encendido (negrita y «✓ »), a 360 px: el chip se acorta y los filtros siguen de 44 × 44 sin desbordar.
  for (const width of [360, 375]) {
    await page.setViewportSize({ width, height: 740 });
    await page.goto("/explorar?mensual=1");
    await expect(chips.getByRole("button", { name: "Solo alquiler mensual" })).toHaveAttribute("aria-pressed", "true");
    const filters = (await chips.getByRole("link", { name: /^Filtros/ }).boundingBox())!;
    expect(Math.min(filters.width, filters.height), `filtros de 44 px a ${width} px`).toBeGreaterThanOrEqual(44);
    const currency = (await chips.getByRole("group", { name: "Moneda de los precios" }).boundingBox())!;
    expect(currency.x + currency.width, `₡ | $ dentro de la fila a ${width} px`).toBeLessThanOrEqual(width - 16 + 0.5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }

  // Las nueve casas de Limón cuestan entre ₡40 000 y ₡85 000 la noche.
  await page.goto("/explorar?min=40000&max=90000");
  await expect(results(page)).toHaveText("9 casas en Limón");
  const badge = page.getByRole("link", { name: /^Filtros/ }).locator(".badge");
  await expect(badge).toHaveText("2");
  const pills = page.locator(".listing-card .card-price");
  await expect(pills.first()).toContainText("/ noche");

  const since = sql("select now()::text");
  const chip = page.getByRole("button", { name: "Solo alquiler mensual", exact: true });
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/mensual=1/);
  await expect(page).toHaveURL(/min=40000/);
  await expect(page).toHaveURL(/max=90000/);
  await expect(results(page)).toHaveText("2 casas aceptan alquiler mensual en Limón");
  await expect(page.getByRole("link", { name: /Casa Manzanillo/ }).locator(".card-price")).toHaveText("₡480 000 / mes");
  await expect(page.getByRole("link", { name: /Casa Cocles mensual/ }).locator(".card-price")).toHaveText("Precio a negociar");
  await expect(pills).toHaveCount(2);
  for (const text of await pills.allTextContents()) expect(text).not.toContain("/ noche");
  await expect
    .poll(() => sql(`select name || ' ' || coalesce(listing_public_id, '-') || ' ' || page || ' ' || path from public.events where created_at >= '${since}' and name = 'monthly_filter_tap'`).split("\n").filter(Boolean))
    .toEqual(["monthly_filter_tap - explorar /explorar"]);
  // El rango por noche queda sin efecto: el contador de los filtros no lo cuenta.
  await expect(badge).toHaveCount(0);

  // Revisión UX 2026-10-29: activo, el chip dice «Mensual» (cabe en un SE); «Solo alquiler mensual» ya no se repite en Filtros.
  await expect(chip).toHaveText("Mensual");
  await page.getByRole("link", { name: /^Filtros/ }).click();
  await expect(page.getByLabel("Precio mínimo por noche")).toHaveCount(0);
  const needs = page.locator("section", { has: page.getByText("Qué necesitan", { exact: true }) }).locator(".chip");
  await expect(needs.filter({ hasText: "mensual" })).toHaveCount(0);
  await page.getByRole("link", { name: "Volver" }).click();
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "false");
  await expect(chip).toHaveText("Solo alquiler mensual");
  await page.getByRole("link", { name: /^Filtros/ }).click();
  await expect(page.getByLabel("Precio mínimo por noche")).toHaveValue("40000");
  await expect(page.getByLabel("Precio máximo por noche")).toHaveValue("90000");
  await page.getByRole("button", { name: "Ver 9 casas" }).click();

  await expect(page).toHaveURL(/\/explorar\?min=40000&max=90000$/);
  await expect(results(page)).toHaveText("9 casas en Limón");
  await expect(results(page)).not.toContainText("aceptan");
  await expect(pills).toHaveCount(9);
  for (const text of await pills.allTextContents()) expect(text).toMatch(/\/ noche$/);

  // Las características van en Filtros, con el contador.
  await page.goto("/explorar?prov=Guanacaste&pool=1");
  await expect(results(page)).toHaveText("1 casa en Guanacaste");
  await expect(page.getByRole("link", { name: "Filtros (1 activo)" })).toContainText("1");
  await page.getByRole("link", { name: /^Filtros/ }).click();
  await expect(page.getByRole("button", { name: "Piscina", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("un enlace viejo /explorar?modo=monthly llega con el chip encendido", async ({ page }) => {
  const chip = page.getByRole("button", { name: "Solo alquiler mensual", exact: true });
  await page.goto("/explorar?modo=monthly");
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await expect(results(page)).toHaveText("2 casas aceptan alquiler mensual en Limón");
  await page.goto("/explorar?modo=both");
  await expect(chip).toHaveAttribute("aria-pressed", "false");
  await expect(results(page)).toHaveText("9 casas en Limón");

  // En Filtros, un rango inválido que el mensual oculta no bloquea «Ver N casas».
  await page.goto("/explorar/filtros");
  await page.getByLabel("Precio mínimo por noche").fill("50000");
  await page.getByLabel("Precio máximo por noche").fill("44000");
  await expect(page.getByRole("button", { name: /^Ver/ })).toBeDisabled();
  await page.goto("/explorar/filtros?min=50000&max=44000&mensual=1");
  await expect(page.getByRole("button", { name: "Ver 2 casas" })).toBeEnabled();
  await page.getByRole("button", { name: "Ver 2 casas" }).click();
  await expect(results(page)).toHaveText("2 casas aceptan alquiler mensual en Limón");
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
  await expect(results(page)).toHaveText("9 casas en Limón");
  await page.waitForTimeout(1500); // la caché se guarda en IndexedDB con un pequeño retraso
  await page.route("**/rest/v1/**", (route) => route.abort());
  await page.reload();
  await expect(results(page)).toHaveText("9 casas en Limón");
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
  await expect(results(page)).toHaveText("9 casas en Limón");

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
  await page.getByRole("banner").getByRole("link", { name: "Ingresar" }).click();
  // Sin sesión, «Ingresar» arriba abre Ingresar a pantalla completa; se pinta sin red porque no descarga supabase-js.
  await expect(page.getByRole("heading", { level: 1, name: "Ingresar" })).toBeVisible();
  await expect(nav).toHaveCount(0);
  await page.getByRole("link", { name: "Volver" }).click();
  await expect(results(page)).toHaveText("9 casas en Limón");
});
