import { readFileSync } from "node:fs";
import { expect, test, type Page } from "./helpers/test";
import type { Seeded } from "../contract/harness";
import { serviceClient } from "../db/local";
import { postgrestHarness } from "../db/postgrest-harness";

const PHOTO = readFileSync(new URL("../../../../design/pantallas/fotos/beach.jpg", import.meta.url));
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");

function watch(page: Page) {
  const problems: string[] = [];
  const rest: string[] = [];
  page.on("console", (msg) => {
    // El aviso de Playwright por bloquear el service worker (playwright.config.ts) no es de la app.
    if (msg.text().includes("Service Worker registration blocked by Playwright")) return;
    if (msg.type() === "error" || msg.type() === "warning") problems.push(`${msg.type()}: ${msg.text()}`);
  });
  page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
  page.on("request", (req) => req.url().includes("/rest/v1/") && rest.push(req.url()));
  return { problems, rest };
}

let casa: Seeded;
let oculta: Seeded;
let cara: Seeded;
let larga: Seeded;
let negociable: Seeded;

test.beforeAll(async () => {
  const h = await postgrestHarness();
  await h.reset();
  oculta = await h.seed({ status: "reopened" });
  casa = await h.seed({ status: "active", photos: 5, draft: { title: "Casa Playa Negra", zone: "Playa Negra", nightlyPriceCrc: 95000, features: ["wifi", "pool", "parking"], parkingPaid: false } });
  cara = await h.seed({ status: "active", photos: 5, draft: { title: "Villa Punta Uva", zone: "Punta Uva", nightlyPriceCrc: 1250000, acceptsMonthly: true, monthlyPriceCrc: 2500000 } });
  negociable = await h.seed({ status: "active", photos: 5, draft: { title: "Casa Cocles mensual", zone: "Cocles", nightlyPriceCrc: 45000, acceptsMonthly: true, monthlyPriceCrc: null, features: ["wifi"] } });
  larga = await h.seed({ status: "active", draft: { title: "Villa Manzanillo con piscina y rancho frente al mar Caribe", zone: "Manzanillo", nightlyPriceCrc: 185000 } });
  const storage = serviceClient().storage.from("listings");
  for (const path of casa.photoPaths) {
    const { error } = await storage.upload(path, PHOTO, { contentType: "image/jpeg", upsert: true });
    if (error) throw error;
  }
});

test.beforeEach(async ({ page }) => {
  await page.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
});

test("la ficha real llega renderizada del servidor e hidrata sin avisos ni volver a pedir la casa", async ({ page }) => {
  const seen = watch(page);
  const res = await page.goto(`/casa/${casa.publicId}`);
  expect(res?.status()).toBe(200);
  const source = await res!.text();
  expect(source).toContain('<meta property="og:title" content="Casa Playa Negra" />');
  expect(source).toContain(`<link rel="canonical" href="https://bnbtico.com/casa/${casa.publicId}" />`);
  expect(source).toMatch(/<h1[^>]*>Casa Playa Negra<\/h1>/);

  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  await expect(page.getByRole("heading", { level: 1, name: "Casa Playa Negra" })).toBeVisible();
  await expect(page.getByTestId("main-price")).toHaveText("₡95 000 / noche");
  await expect(page.getByTestId("host-line")).toHaveText(/^[A-ZÁÉÍÓÚÑ]{1,2}\s*\p{L}+ · WhatsApp verificado$/u);
  await expect(page.getByTestId("approx-map").locator(".leaflet-tile-loaded").first()).toBeAttached();
  await expect(page.getByText("Parqueo gratis")).toBeVisible();
  // La moneda, compartir y el corazón: en el HTML del servidor solo sus cajas; tras hidratar, botones del mismo tamaño.
  expect(source).toContain('<div class="row gap-8"><span class="currency-switch currency-switch-box overlay" aria-hidden="true"></span><span class="icon-btn" aria-hidden="true"></span><span class="icon-btn" aria-hidden="true"></span></div>');
  expect(source).not.toContain("favoritos");
  const heart = page.getByRole("button", { name: "Guardar en favoritos" });
  await expect(heart).toHaveAttribute("aria-pressed", "false");
  expect(await heart.boundingBox()).toMatchObject({ width: 44, height: 44 });
  expect(seen.rest, "la hidratación no debe pedir datos").toEqual([]);
  expect(seen.problems, seen.problems.join("\n")).toEqual([]);
});

/** Cambia la moneda como lo haría el selector de otra pantalla u otra pestaña del navegador (mismo almacenamiento y aviso). */
const chooseCurrency = (page: Page, currency: "USD" | "CRC") =>
  page.evaluate((c) => {
    localStorage.setItem("bnbtico_currency", c);
    dispatchEvent(new StorageEvent("storage", { key: "bnbtico_currency" }));
  }, currency);

test("una casa con mensual a negociar llega del servidor con la línea y la característica, e hidrata sin avisos", async ({ page }) => {
  const seen = watch(page);
  const res = await page.goto(`/casa/${negociable.publicId}`);
  const source = await res!.text();
  expect(source).toContain("Alquiler mensual");
  expect(source).toContain("Mensual: precio a negociar con el dueño");
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  await expect(page.getByTestId("monthly-line")).toHaveText("Mensual: precio a negociar con el dueño");
  await expect(page.locator(".feature-tiles > div").last()).toHaveText("Alquiler mensual");
  await expect(page.locator(".badge").filter({ hasText: /^(Vacacional|Mensual)/ })).toHaveCount(0);
  expect(seen.problems, seen.problems.join("\n")).toEqual([]);
});

test("una casa con precio al mes lo muestra en la línea mensual, en la moneda elegida", async ({ page }) => {
  await page.goto(`/casa/${cara.publicId}`);
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  await expect(page.getByTestId("main-price")).toHaveText("₡1 250 000 / noche");
  await expect(page.getByTestId("monthly-line")).toHaveText("Mensual: ₡2 500 000 / mes");
  await expect(page.locator(".feature-tiles > div").last()).toHaveText("Alquiler mensual");
  await chooseCurrency(page, "USD");
  await expect(page.getByTestId("monthly-line")).toHaveText(/^Mensual: \$[\d,]+ \/ mes$/);
});

test("la ficha sigue la moneda elegida y muestra la otra como referencia, sin botón", async ({ page }) => {
  const seen = watch(page);
  await page.goto(`/casa/${casa.publicId}`);
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  await expect(page.getByTestId("main-price")).toHaveText("₡95 000 / noche");
  await expect(page.getByTestId("price-reference").locator("span").first()).toHaveText("≈ $186");
  await expect(page.getByRole("button", { name: /Ver en (dólares|colones)/ })).toHaveCount(0);
  await chooseCurrency(page, "USD");
  await expect(page.getByTestId("main-price")).toHaveText("$186 / noche");
  await expect(page.getByTestId("price-reference").locator("span").first()).toHaveText("≈ ₡95 000");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  await expect(page.getByTestId("main-price")).toHaveText("$186 / noche");
  expect(seen.problems, seen.problems.join("\n")).toEqual([]);
});

test("un enlace que no existe responde 404 y uno oculto 410", async ({ page }) => {
  const missing = await page.goto("/casa/CT-999999");
  expect(missing?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "Este enlace no existe" })).toBeVisible();

  const hidden = await page.goto(`/casa/${oculta.publicId}`);
  expect(hidden?.status()).toBe(410);
  await expect(page.getByRole("heading", { level: 1, name: "Este enlace ya no está activo" })).toBeVisible();
});

// Rendimiento (ticket 12): en Slow 4G el JS que hidrata (React y la ficha, ~88 KB gz) le quitaba la mitad del ancho de
// banda a la portada, que es el LCP. La entrada solo pide ese JS cuando la portada ya cargó (o falló, o pasó un tope).
test("la portada de la ficha baja sola: el JS que hidrata se pide cuando ya cargó", async ({ page }) => {
  const seen = watch(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(`**/listings/${casa.photoPaths[0]}*`, async (route) => {
    await held;
    await route.continue();
  });
  const scripts: string[] = [];
  const otherPhotos: string[] = [];
  page.on("request", (req) => {
    if (req.resourceType() === "script") scripts.push(new URL(req.url()).pathname);
    if (casa.photoPaths.slice(1).some((p) => req.url().includes(p))) otherPhotos.push(req.url());
  });

  await page.goto(`/casa/${casa.publicId}`, { waitUntil: "domcontentloaded" });
  // Comprobación negativa: se da un margen para que una petición indebida aparezca.
  await page.waitForTimeout(600);
  expect(await page.locator("html").getAttribute("data-hydrated")).toBeNull();
  const whileHeld = [...scripts];
  expect(whileHeld.length, whileHeld.join(", ")).toBeLessThanOrEqual(2);
  expect(otherPhotos, "las demás fotos del carrusel esperan a la portada").toEqual([]);

  release();
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  expect(scripts.length).toBeGreaterThan(whileHeld.length);
  // Tras hidratar y cargar la página, el carrusel tiene sus cinco fotos (cajas del mismo tamaño mientras tanto).
  await expect(page.locator(".hero .strip img")).toHaveCount(5);
  expect(seen.problems, seen.problems.join("\n")).toEqual([]);
});

test("si la portada no carga, la ficha hidrata igual", async ({ page }) => {
  await page.route(`**/listings/${casa.photoPaths[0]}*`, (route) => route.abort());
  await page.goto(`/casa/${casa.publicId}`);
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  await chooseCurrency(page, "USD");
  await expect(page.getByTestId("main-price")).toHaveText("$186 / noche");
});

const barHeight = (page: Page) => page.evaluate(() => document.querySelector(".cta-bar")!.getBoundingClientRect().height);

// Revisión del movimiento: la ficha hidrata cuando la portada cargó (o a los 3 s). La referencia en la otra moneda nunca es
// un botón (ticket 15) y apila las dos cifras, así que nada se mueve al hidratar ni al cambiar de moneda.
test("ni hidratar ni cambiar de moneda cambian el alto de la barra", async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(`**/listings/${casa.photoPaths[0]}*`, async (route) => {
    await held;
    await route.continue();
  });
  await page.goto(`/casa/${casa.publicId}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("main-price")).toHaveText("₡95 000 / noche");
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  expect(await page.locator("html").getAttribute("data-hydrated")).toBeNull();
  await expect(page.getByRole("button", { name: /Ver en/ })).toHaveCount(0);
  // El botón de contacto tampoco es un botón todavía: una caja apagada del mismo tamaño.
  await expect(page.getByRole("button", { name: "Contactar por WhatsApp" })).toHaveCount(0);
  await expect(page.locator(".cta-bar .btn-wa.is-pending")).toBeVisible();
  const before = await barHeight(page);
  // El selector de moneda, antes de hidratar, es una caja del mismo tamaño.
  await expect(page.getByRole("group", { name: "Moneda de los precios" })).toHaveCount(0);
  const box = await page.locator(".currency-switch-box").boundingBox();

  release();
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  await expect(page.getByTestId("price-reference").locator("span").first()).toHaveText("≈ $186");
  await expect(page.getByRole("button", { name: /Ver en/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Contactar por WhatsApp" })).toBeEnabled();
  expect(await barHeight(page), "al hidratar").toBe(before);
  expect(await page.getByRole("group", { name: "Moneda de los precios" }).boundingBox(), "el selector ocupa su caja").toEqual(box);
  await chooseCurrency(page, "USD");
  await expect(page.getByTestId("main-price")).toHaveText("$186 / noche");
  expect(await barHeight(page), "en dólares").toBe(before);
});

test("a 320 px la barra mide lo mismo en colones y en dólares y no tapa el final de la ficha", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const publicId of [casa.publicId, cara.publicId, negociable.publicId]) {
    await page.goto(`/casa/${publicId}`);
    await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    const first = await barHeight(page);
    await chooseCurrency(page, "USD");
    await expect(page.getByTestId("main-price")).not.toHaveText(/^₡/);
    expect(await barHeight(page), `${publicId} en dólares`).toBe(first);
    await chooseCurrency(page, "CRC");
    await expect(page.getByTestId("main-price")).toHaveText(/^₡/);
    expect(await barHeight(page), `${publicId} de vuelta en colones`).toBe(first);

    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    const [textBottom, barTop] = await page.evaluate(() => [
      [...document.querySelectorAll(".listing-body > p")].at(-1)!.getBoundingClientRect().bottom,
      document.querySelector(".cta-bar")!.getBoundingClientRect().top,
    ]);
    expect(textBottom, "el último párrafo queda por encima de la barra").toBeLessThanOrEqual(barTop!);
  }
});

// Revisión UX C3: en un iPhone SE la barra fija no se come la ficha; sin hacer scroll se ven la zona y las personas.
test("en un iPhone SE la barra cabe en una línea de precio y deja ver la zona y las personas", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  for (const publicId of [casa.publicId, larga.publicId]) {
    await page.goto(`/casa/${publicId}`);
    await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    expect(await barHeight(page), `${publicId}: alto de la barra`).toBeLessThanOrEqual(150);
    await expect(page.locator(".cta-bar")).not.toContainText("el precio final");
    await expect(page.locator(".cta-bar .price-note")).toHaveText(/^≈ \$\d+\s*· orientativo$/, { useInnerText: true });
    const [capacityBottom, barTop] = await page.evaluate(() => [
      document.querySelector('[data-testid="listing-capacity"]')!.getBoundingClientRect().bottom,
      document.querySelector(".cta-bar")!.getBoundingClientRect().top,
    ]);
    expect(capacityBottom, `${publicId}: «N personas» por encima de la barra sin scroll`).toBeLessThanOrEqual(barTop!);
  }
  await expect(page.locator("h1.listing-title")).toHaveClass(/is-long/);
  await expect(page.locator(".listing-body")).toContainText("fechas, precio y pago los acuerda directamente con el propietario");
});

// Revisión UX N5: en un ordenador, dos columnas (fotos y texto a la izquierda, precio y contacto fijos a la derecha).
test("en escritorio la ficha va a dos columnas con el contacto a la derecha; en el móvil, la barra fija de siempre", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/casa/${casa.publicId}`);
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  const [hero, bar] = await page.evaluate(() => [".hero", ".cta-bar"].map((q) => document.querySelector(q)!.getBoundingClientRect().toJSON()));
  expect(bar.left, "el contacto a la derecha de las fotos").toBeGreaterThanOrEqual(hero.right);
  expect(bar.top, "arriba, a la altura de las fotos").toBeLessThan(hero.bottom);
  expect(await page.locator(".cta-bar").evaluate((el) => getComputedStyle(el).position)).toBe("sticky");
  await page.setViewportSize({ width: 375, height: 667 });
  expect(await page.locator(".cta-bar").evaluate((el) => getComputedStyle(el).position)).toBe("fixed");
});

// «Enlace copiado» y el contador del hero se animan al cambiar, no al pintarse por primera vez.
test("compartir y el contador de fotos no se animan al abrir la ficha, solo al cambiar", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => undefined } });
  });
  await page.goto(`/casa/${casa.publicId}`);
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  await expect(page.locator(".hero .strip img")).toHaveCount(5);
  const running = (selector: string) => page.locator(selector).evaluateAll((els) => els.reduce((n, el) => n + el.getAnimations().length, 0));
  expect(await running(".hero-counter .tick")).toBe(0);
  expect(await running(".icon-btn .swap-in")).toBe(0);

  // El cambio se mide en el mismo frame en que aparece: la animación dura 200 ms.
  const animatedAfter = (action: string, selector: string) =>
    page.evaluate(
      async ({ action, selector }) => {
        const was = document.querySelector(selector);
        if (action === "share") document.querySelector<HTMLButtonElement>('button[aria-label="Compartir ficha"]')!.click();
        else document.querySelector(".hero .strip")!.scrollTo({ left: document.querySelector(".hero .strip")!.clientWidth });
        for (let i = 0; i < 60; i++) {
          await new Promise(requestAnimationFrame);
          const now = document.querySelector(selector);
          if (now && now !== was) return now.getAnimations().length;
        }
        return -1;
      },
      { action, selector },
    );
  expect(await animatedAfter("share", ".icon-btn .swap-in"), "«Enlace copiado»").toBeGreaterThan(0);
  expect(await animatedAfter("scroll", ".hero-counter .tick"), "contador 2 / 5").toBeGreaterThan(0);
  await expect(page.locator(".hero-counter")).toHaveText("2 / 5");
});
