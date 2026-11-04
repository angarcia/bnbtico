import { readFileSync } from "node:fs";
import { expect, test, type Page } from "./helpers/test";
import type { Seeded } from "../contract/harness";
import { serviceClient, sql } from "../db/local";
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
let zonaLarga: Seeded;
let negociable: Seeded;
let descrita: Seeded;
let cuarto: Seeded;
const LARGA = [
  "Cabina de madera frente al parque nacional Cahuita, a cinco minutos a pie de la playa, con hamacas y rancho.",
  "La casa tiene dos habitaciones con abanico y mosquiteros, cocina equipada y una terraza grande con vista al jardín.",
  "Estamos a 300 metros de la playa de Cocles, buena para surfear, y a diez minutos en bici de Puerto Viejo.",
  "Acceso: le damos las llaves en persona y le explicamos todo. Parqueo dentro de la propiedad, con portón.",
].join("\n\n");

test.beforeAll(async () => {
  const h = await postgrestHarness();
  await h.reset();
  oculta = await h.seed({ status: "reopened" });
  casa = await h.seed({ status: "active", photos: 5, draft: { title: "Casa Playa Negra", zone: "Playa Negra", zoneSource: "other", zoneId: null, nightlyPriceCrc: 95000, features: ["wifi", "pool", "parking"], parkingPaid: false } });
  cara = await h.seed({ status: "active", photos: 5, draft: { title: "Villa Punta Uva", zone: "Punta Uva", zoneSource: "other", zoneId: null, nightlyPriceCrc: 1250000, acceptsMonthly: true, monthlyPriceCrc: 2500000 } });
  negociable = await h.seed({ status: "active", photos: 5, draft: { title: "Casa Cocles mensual", zone: "Cocles", zoneSource: "other", zoneId: null, nightlyPriceCrc: 45000, acceptsMonthly: true, monthlyPriceCrc: null, features: ["wifi"] } });
  cuarto = await h.seed({ status: "active", draft: { title: "Cuarto en Cocles", kind: "habitacion", bathroomShared: true, capacity: 2, zone: "Cocles", zoneSource: "other", zoneId: null, nightlyPriceCrc: 25000 } });
  descrita = await h.seed({ status: "active", draft: { title: "Casa Descrita", zone: "Cocles", zoneSource: "other", zoneId: null, nightlyPriceCrc: 60000, description: LARGA } });
  larga = await h.seed({ status: "active", draft: { title: "Villa Manzanillo", zone: "Manzanillo", zoneSource: "other", zoneId: null, nightlyPriceCrc: 185000 } });
  // Una zona «Otra…» larga (hasta 60 caracteres): «Playa Negra de Puerto Viejo de Talamanca, Talamanca» no cabe en un renglón a 375 px.
  zonaLarga = await h.seed({ status: "active", photos: 3, draft: { title: "Casa Zona Larga", zone: "Playa Negra de Puerto Viejo de Talamanca", zoneSource: "other", zoneId: null, nightlyPriceCrc: 70000 } });
  // Un nombre largo de antes del tope de 32 caracteres (publicar v2): las casas ya publicadas lo conservan.
  sql(`begin; set local app.allow_status = 'on'; update public.listings set title = 'Villa Manzanillo con piscina y rancho frente al mar Caribe' where id = '${larga.id}'; commit;`);
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
  // Cabecera como en Airbnb: nombre, zona y personas; una línea; la persona en su fila (nombre y debajo «Anfitrión · WhatsApp verificado»); otra línea; la descripción.
  await expect(page.getByTestId("host-line")).toHaveText(/^[A-ZÁÉÍÓÚÑ]{1,2}\s*\p{L}+\s*Anfitrión · WhatsApp verificado$/u);
  // La zona sola, sin « · ubicación aproximada» (el aviso queda bajo el mapa). El cantón de las casas sembradas es Talamanca.
  await expect(page.getByTestId("listing-zone")).toHaveText("Playa Negra, Talamanca");
  expect(
    await page.evaluate(() => {
      const host = document.querySelector('[data-testid="host-line"]')!;
      return [host.previousElementSibling?.tagName, host.nextElementSibling?.tagName, host.nextElementSibling?.nextElementSibling?.className];
    }),
  ).toEqual(["HR", "HR", "stack description-block"]);
  expect(await page.getByTestId("listing-capacity").evaluate((el) => getComputedStyle(el).fontSize)).toBe("17px");
  await expect(page.getByTestId("approx-map").locator(".leaflet-tile-loaded").first()).toBeAttached();
  await expect(page.getByText("Parqueo gratis")).toBeVisible();
  // Compartir y el corazón: en el HTML del servidor solo sus cajas; tras hidratar, botones del mismo tamaño. Sin «₡ | $».
  expect(source).toContain('<div class="row gap-8"><span class="icon-btn" aria-hidden="true"></span><span class="icon-btn" aria-hidden="true"></span></div>');
  expect(source).not.toContain("currency-switch");
  expect(source).not.toContain("favoritos");
  const heart = page.getByRole("button", { name: "Guardar en favoritos" });
  await expect(heart).toHaveAttribute("aria-pressed", "false");
  expect(await heart.boundingBox()).toMatchObject({ width: 44, height: 44 });
  expect(seen.rest, "la hidratación no debe pedir datos").toEqual([]);
  expect(seen.problems, seen.problems.join("\n")).toEqual([]);
});

/** Pin y primera letra de la zona, y cuántos renglones ocupa: el pin va en línea, pegado a la primera palabra. */
const zoneGeometry = (page: Page) =>
  page.evaluate(() => {
    const zone = document.querySelector('[data-testid="listing-zone"]')!;
    const pin = zone.querySelector("svg")!.getBoundingClientRect();
    const text = [...zone.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim())!;
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 1);
    const first = range.getBoundingClientRect();
    const box = zone.getBoundingClientRect();
    return {
      lines: Math.round(box.height / parseFloat(getComputedStyle(zone).lineHeight)),
      pinTop: pin.top,
      pinCenter: (pin.top + pin.bottom) / 2,
      pinRight: pin.right,
      firstTop: first.top,
      firstCenter: (first.top + first.bottom) / 2,
      firstLeft: first.left,
      boxCenter: (box.left + box.right) / 2,
      viewportCenter: innerWidth / 2,
    };
  });

// Ronda de Ana 2026-11-02 (01): el pin va justo antes de la primera palabra y a la altura del primer renglón, con uno o dos renglones.
test("a 375 px el pin queda pegado a la primera palabra y en el primer renglón, con la zona en uno o en dos renglones", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  for (const [publicId, lines] of [[casa.publicId, 1], [zonaLarga.publicId, 2]] as const) {
    await page.goto(`/casa/${publicId}`);
    await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    const m = await zoneGeometry(page);
    expect(m.lines, `${publicId}: renglones de la zona`).toBe(lines);
    expect(Math.abs(m.pinTop - m.firstTop), `${publicId}: el pin a la altura del primer renglón`).toBeLessThanOrEqual(3);
    expect(Math.abs(m.pinCenter - m.firstCenter), `${publicId}: el pin centrado en el primer renglón`).toBeLessThanOrEqual(1.5);
    expect(m.firstLeft - m.pinRight, `${publicId}: el pin pegado al texto`).toBeGreaterThanOrEqual(0);
    expect(m.firstLeft - m.pinRight, `${publicId}: el pin pegado al texto`).toBeLessThanOrEqual(8);
    expect(Math.abs(m.boxCenter - m.viewportCenter), `${publicId}: la línea centrada`).toBeLessThanOrEqual(1);
  }
});

// Densidad y tarjetas (2026-10-29): en el teléfono la foto es el producto: de borde a borde y pegada arriba
// (detrás del notch, como el diseño); solo los botones se apartan del área segura. En 5:4 desde la ronda de Ana 2026-11-02 (antes cuadrada).
test("a 375 px la foto es 5:4, a todo el ancho y pegada arriba, e hidrata sin avisos", async ({ page }) => {
  const seen = watch(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/casa/${casa.publicId}`);
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  const hero = (await page.locator(".hero").boundingBox())!;
  expect(hero.x).toBeCloseTo(0, 0);
  expect(hero.y).toBeCloseTo(0, 0);
  expect(Math.abs(hero.width - 375)).toBeLessThanOrEqual(1);
  expect(Math.abs(hero.height - 300)).toBeLessThanOrEqual(1);
  expect((await page.locator(".hero .top").boundingBox())!.y).toBeGreaterThanOrEqual(12);
  await expect(page.locator(".hero-counter")).toHaveText("1 / 5");
  // En un Pixel 7 (412 px), el mismo 5:4: el alto sale del CSS, sin esperar a la imagen.
  await page.setViewportSize({ width: 412, height: 915 });
  const wide = (await page.locator(".hero").boundingBox())!;
  expect(Math.abs(wide.width - 412)).toBeLessThanOrEqual(1);
  expect(Math.abs(wide.height - 329.6)).toBeLessThanOrEqual(1);
  expect(seen.problems, seen.problems.join("\n")).toEqual([]);
});

/** Cambia la moneda como lo haría el selector de otra pantalla u otra pestaña del navegador (mismo almacenamiento y aviso). */
const chooseCurrency = (page: Page, currency: "USD" | "CRC") =>
  page.evaluate((c) => {
    localStorage.setItem("bnbtico_currency", c);
    dispatchEvent(new StorageEvent("storage", { key: "bnbtico_currency" }));
  }, currency);

// Ronda de Ana del 2 nov, ticket 08: sin fechas la barra lleva solo el precio por noche («Mensual» va con 30 noches o más, en
// ficha-calendario.spec.ts) y el mensual se ve en la casilla «Alquiler mensual», la primera, con su precio debajo.
test("una casa con mensual a negociar llega del servidor con «Alquiler mensual · A negociar» la primera de las características y sin «Mensual» en la barra, e hidrata sin avisos", async ({ page }) => {
  const seen = watch(page);
  const res = await page.goto(`/casa/${negociable.publicId}`);
  const source = await res!.text();
  expect(source).toContain("<span>Alquiler mensual</span><small>A negociar</small>");
  expect(source).not.toContain("Mensual: precio a negociar");
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  await expect(page.getByTestId("monthly-line")).toHaveCount(0);
  await expect(page.locator(".feature-tiles > div").first()).toHaveText("Alquiler mensualA negociar");
  await expect(page.locator(".feature-tiles > .tile-wide")).toHaveCount(1);
  await expect(page.locator(".badge").filter({ hasText: /^(Vacacional|Mensual)/ })).toHaveCount(0);
  expect(seen.problems, seen.problems.join("\n")).toEqual([]);
});

test("una casa con precio al mes lo muestra en la casilla «Alquiler mensual», en colones y en un renglón aparte, la primera y a dos columnas", async ({ page }) => {
  await page.goto(`/casa/${cara.publicId}`);
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  await expect(page.getByTestId("main-price")).toHaveText("₡1 250 000 / noche");
  await expect(page.getByTestId("monthly-line")).toHaveCount(0);
  await expect(page.getByTestId("monthly-usd")).toHaveCount(0);
  const tile = page.locator(".feature-tiles > div").first();
  await expect(tile).toHaveText("Alquiler mensual₡2 500 000 / mes");
  await expect(tile.locator("small")).toHaveText("₡2 500 000 / mes");
  const [wide, grid] = await Promise.all([tile.boundingBox(), page.locator(".feature-tiles").boundingBox()]);
  expect(wide!.width, "ocupa dos de las tres columnas").toBeGreaterThan(grid!.width / 2);
  await chooseCurrency(page, "USD");
  await expect(tile.locator("small")).toHaveText("₡2 500 000 / mes");
});

// Densidad y tarjetas (Daniel, 2026-10-29): la ficha no lleva «₡ | $»; la barra muestra las dos monedas, elija la que elija.
test("la ficha muestra las dos monedas, sin selector", async ({ page }) => {
  const seen = watch(page);
  await page.addInitScript(() => localStorage.setItem("bnbtico_currency", "USD"));
  await page.goto(`/casa/${casa.publicId}`);
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  await expect(page.getByTestId("main-price")).toHaveText("₡95 000 / noche");
  await expect(page.getByTestId("price-usd")).toHaveText("≈ $186 / noche");
  await expect(page.getByTestId("price-note")).toHaveText("Precios orientativos: el precio final lo acuerda con el anfitrión.");
  await expect(page.locator(".listing-view .currency-switch")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Ver en (dólares|colones)/ })).toHaveCount(0);
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
  await expect(page.getByTestId("main-price")).toHaveText("₡95 000 / noche");
  await expect(page.getByTestId("price-usd")).toHaveText("≈ $186 / noche");
});

const barHeight = (page: Page) => page.evaluate(() => document.querySelector(".cta-bar")!.getBoundingClientRect().height);

// Revisión del movimiento: la ficha hidrata cuando la portada cargó (o a los 3 s). La barra lleva las dos monedas y no
// depende de la elegida, así que nada se mueve al hidratar ni al cambiar de moneda en otra pantalla.
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
  const text = await page.locator(".cta-prices").innerText();

  release();
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  await expect(page.getByTestId("price-usd")).toHaveText("≈ $186 / noche");
  await expect(page.getByRole("button", { name: /Ver en/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Contactar por WhatsApp" })).toBeEnabled();
  expect(await barHeight(page), "al hidratar").toBe(before);
  await chooseCurrency(page, "USD");
  // Comprobación negativa: un margen para que un cambio indebido se pinte.
  await page.waitForTimeout(100);
  await expect(page.getByTestId("main-price")).toHaveText("₡95 000 / noche");
  expect(await page.locator(".cta-prices").innerText(), "el texto no cambia con la moneda").toBe(text);
  expect(await barHeight(page), "en dólares").toBe(before);
});

/** La barra no se desborda a lo ancho: las dos columnas de precio caben, también con ₡1 250 000 y su mensual. */
const barOverflows = (page: Page) =>
  page.evaluate(() => [".cta-bar", ".cta-prices"].some((q) => {
    const el = document.querySelector(q)!;
    return el.scrollWidth > el.clientWidth;
  }));

test("a 320 px la barra cabe a lo ancho, mide lo mismo en cualquier moneda y no tapa el final de la ficha", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const publicId of [casa.publicId, cara.publicId, negociable.publicId]) {
    await page.goto(`/casa/${publicId}`);
    await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    expect(await barOverflows(page), `${publicId}: la barra se desborda`).toBe(false);
    const [zoneBottom, top] = await page.evaluate(() => [
      document.querySelector('[data-testid="listing-capacity"]')!.previousElementSibling!.getBoundingClientRect().bottom,
      document.querySelector(".cta-bar")!.getBoundingClientRect().top,
    ]);
    expect(zoneBottom, `${publicId}: la zona por encima de la barra sin scroll`).toBeLessThanOrEqual(top!);
    const first = await barHeight(page);
    await chooseCurrency(page, "USD");
    await expect(page.getByTestId("main-price")).toHaveText(/^₡/);
    expect(await barHeight(page), `${publicId} en dólares`).toBe(first);

    // Se vuelve a bajar en cada intento: el espaciador se ajusta a la barra tras medirla (ResizeObserver).
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            scrollTo(0, document.documentElement.scrollHeight);
            const text = [...document.querySelectorAll(".listing-body > p")].at(-1)!.getBoundingClientRect().bottom;
            return text - document.querySelector(".cta-bar")!.getBoundingClientRect().top;
          }),
        { message: `${publicId}: el último párrafo queda por encima de la barra` },
      )
      .toBeLessThanOrEqual(0.5);
  }
});

// Revisión UX C3: en un iPhone SE la barra fija no se come la ficha; sin hacer scroll se ven la zona y las personas.
test("en un iPhone SE la barra cabe a lo ancho y deja ver la zona y las personas", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  for (const publicId of [casa.publicId, larga.publicId]) {
    await page.goto(`/casa/${publicId}`);
    await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    expect(await barHeight(page), `${publicId}: alto de la barra`).toBeLessThanOrEqual(150);
    expect(await barOverflows(page), `${publicId}: la barra se desborda`).toBe(false);
    await expect(page.getByTestId("price-usd")).toHaveText(/^≈ \$\d+ \/ noche$/);
    await expect(page.getByTestId("price-note")).toHaveText("Precios orientativos: el precio final lo acuerda con el anfitrión.");
    const [capacityBottom, barTop] = await page.evaluate(() => [
      document.querySelector('[data-testid="listing-capacity"]')!.getBoundingClientRect().bottom,
      document.querySelector(".cta-bar")!.getBoundingClientRect().top,
    ]);
    expect(capacityBottom, `${publicId}: «N personas» por encima de la barra sin scroll`).toBeLessThanOrEqual(barTop!);
  }
  await expect(page.locator("h1.listing-title")).toHaveClass(/is-long/);
  await expect(page.locator(".listing-body")).toContainText("fechas, precio y pago los acuerda directamente con el anfitrión");
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

// Como en Airbnb: párrafos separados y, si es larga, 8 líneas con «Ver más», que abre la descripción entera a pantalla completa.
test("descripción larga: párrafos, «Ver más» a pantalla completa y atrás la cierra sin salir de la ficha", async ({ page }) => {
  const res = await page.goto(`/casa/${descrita.publicId}`);
  const source = await res!.text();
  expect(source).toContain('<div class="listing-description is-clamped" data-testid="listing-description"><p>Cabina de madera');
  expect(source).toContain('<span class="btn btn-soft btn-more is-pending" aria-hidden="true">Ver más</span>');
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  const text = page.getByTestId("listing-description");
  await expect(text.locator("p")).toHaveCount(4);
  const [shown, full] = await text.evaluate((el) => [el.clientHeight, el.scrollHeight]);
  expect(shown, "recortada").toBeLessThan(full);
  expect(shown).toBeCloseTo(8 * 18 * 1.45, -1);

  const more = page.getByRole("button", { name: "Ver más" });
  await more.click();
  const screen = page.getByRole("dialog", { name: "Descripción" });
  await expect(screen).toBeVisible();
  await expect(screen.locator("p")).toHaveCount(4);
  await expect(screen.getByText("Acceso: le damos las llaves en persona")).toBeVisible();
  // El botón atrás del teléfono cierra la descripción y deja la ficha.
  await page.goBack();
  await expect(screen).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/casa/${descrita.publicId}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Casa Descrita" })).toBeVisible();

  // La flecha también, y el foco vuelve a «Ver más»; Escape igual.
  await more.click();
  await screen.getByRole("button", { name: "Cerrar" }).click();
  await expect(screen).toHaveCount(0);
  await expect(more).toBeFocused();
  await more.click();
  await page.keyboard.press("Escape");
  await expect(screen).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/casa/${descrita.publicId}$`));

  // En la ficha de la SPA (desde Explorar), atrás cierra la descripción y un segundo atrás vuelve a Explorar.
  await page.goto("/explorar");
  await page.getByRole("link", { name: /Casa Descrita/ }).first().click();
  await expect(page).toHaveURL(new RegExp(`/casa/${descrita.publicId}`));
  await page.getByRole("button", { name: "Ver más" }).click();
  await expect(screen).toBeVisible();
  await page.goBack();
  await expect(screen).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/casa/${descrita.publicId}`));
  await page.goBack();
  await expect(page).toHaveURL(/\/explorar/);
});

test("la línea de capacidad: un completo cuenta los baños; una Habitación dice el tipo de baño, ya desde el servidor", async ({ page }) => {
  await page.goto(`/casa/${casa.publicId}`);
  await expect(page.getByTestId("listing-capacity")).toHaveText("2 personas · 1 habitación · 1 baño");
  const response = await page.goto(`/casa/${cuarto.publicId}`);
  expect(await response!.text()).toContain("2 personas · 1 habitación · baño compartido");
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  await expect(page.getByTestId("listing-capacity")).toHaveText("2 personas · 1 habitación · baño compartido");
  // La etiqueta de arriba no repite el baño (Daniel, 2026-11-03): solo «Habitación».
  await expect(page.locator(".listing-view .badge").filter({ hasText: "Habitación" })).toHaveText("Habitación");
});

test("descripción corta: entera, sin «Ver más»; cabecera centrada", async ({ page }) => {
  await page.goto(`/casa/${casa.publicId}`);
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  await expect(page.getByTestId("listing-description")).not.toHaveClass(/is-clamped/);
  await expect(page.getByRole("button", { name: "Ver más" })).toHaveCount(0);
  expect(await page.locator(".listing-head").evaluate((el) => getComputedStyle(el).textAlign)).toBe("center");
});
