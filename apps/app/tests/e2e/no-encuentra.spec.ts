import { expect, test, type Page } from "./helpers/test";
import { sql } from "../db/local";
import { postgrestHarness } from "../db/postgrest-harness";

// Fase 6, ticket 01: «¿No encuentra lo que busca?» en Explorar, al WhatsApp de atención a clientes con la búsqueda redactada.
// El build de las pruebas lleva el número de prueba de `pnpm dev:vars` (VITE_WA_GUESTS = +506 6000 0000); sin número la nota
// no sale (tests/unit/search-help-note.test.tsx, sin un build aparte). wa.me se intercepta: nada sale a internet.
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
const SUPPORT = "50660000000";
const SHOTS = "test-results/capturas-no-encuentra";
const TITLE = `Casa Ayuda ${Date.now().toString(36)}`;
let since: string;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  // Sin reset: la prueba solo cuenta con su casa (en Limón, la zona por defecto) y con filtros que nada cumple (máximo ₡1).
  const h = await postgrestHarness();
  await h.seed({ status: "active", draft: { title: TITLE, zone: "Cocles", zoneSource: "other", zoneId: null, capacity: 2, nightlyPriceCrc: 45000 } });
});

test.beforeEach(async ({ page, context }) => {
  since = sql("select now()::text");
  await page.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
  await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
  await context.route("https://wa.me/**", (route) => route.fulfill({ body: "<title>WhatsApp</title>", contentType: "text/html" }));
});

const helpButton = (page: Page) => page.getByRole("link", { name: "Escribir a bnbtico por WhatsApp" });

/** Toca el botón y devuelve el texto del enlace de WhatsApp que abre (en otra pestaña, como Ayuda). */
async function tapHelp(page: Page): Promise<string | null> {
  const [popup] = await Promise.all([page.waitForEvent("popup"), helpButton(page).click()]);
  await popup.waitForLoadState();
  const url = new URL(popup.url());
  expect(`${url.origin}${url.pathname}`).toBe(`https://wa.me/${SUPPORT}`);
  await popup.close();
  return url.searchParams.get("text");
}

const helpEvents = () =>
  sql(`select name || ' ' || coalesce(listing_public_id, '-') || ' ' || page || ' ' || path from public.events where created_at >= '${since}' and name = 'search_help_tap'`)
    .split("\n")
    .filter(Boolean);

test("sin resultados: «No hay casas con esos filtros», WhatsApp con la búsqueda y «Quitar filtros»", async ({ page }) => {
  await page.goto("/explorar?ppl=12&pool=1&mensual=1&max=1");
  const empty = page.locator("section.card", { has: page.getByRole("heading", { name: "No hay casas con esos filtros" }) });
  await expect(empty.getByRole("heading", { name: "No hay casas con esos filtros" })).toBeVisible();
  await expect(empty).toContainText("¿No encuentra lo que busca? Cuéntenos qué necesita por WhatsApp y le ayudamos a encontrar casa.");
  await expect(page.getByText("Sin resultados con esos filtros.")).toHaveCount(0);
  // Un solo botón relleno por pantalla: este va en contorno, y no en verde WhatsApp.
  await expect(helpButton(page)).toHaveClass(/btn-outline/);
  await expect(helpButton(page)).not.toHaveClass(/btn-wa/);
  await page.screenshot({ path: `${SHOTS}/vacio-412.png` });
  await page.setViewportSize({ width: 360, height: 800 });
  // Tras cambiar el tamaño, un par de fotogramas antes de capturar (si no, Chrome devuelve la capa vieja en mosaico).
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await empty.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/vacio-360.png` });

  // `mensual=1` de un enlace viejo ya no cuenta (fin del modo mensual): el mensaje lleva el precio por noche y no «Busca alquiler mensual».
  expect(await tapHelp(page)).toBe("Hola, estoy buscando casa en bnbtico.\nZona: Limón.\nPersonas: 12.\nNecesito: Piscina.\nPrecio por noche: hasta ₡1.\nFechas: ");
  // La baliza: solo nombre, página y ruta (sin la búsqueda ni el mensaje).
  await expect.poll(helpEvents).toEqual(["search_help_tap - explorar /explorar"]);

  await empty.getByRole("button", { name: "Quitar filtros" }).click();
  await expect(page).toHaveURL(/\/explorar$/);
  await expect(page.getByRole("link", { name: new RegExp(TITLE) })).toBeVisible();
  await expect(page.getByRole("heading", { name: "No hay casas con esos filtros" })).toHaveCount(0);
});

test("con resultados: la nota al final de la rejilla, con la zona en el mensaje", async ({ page }) => {
  await page.goto("/explorar");
  const card = page.getByRole("link", { name: new RegExp(TITLE) });
  await expect(card).toBeVisible();
  const note = page.locator(".note", { hasText: "¿No encuentra lo que busca?" });
  await expect(note).toHaveText(/^¿No encuentra lo que busca\? Cuéntenos qué necesita por WhatsApp y le ayudamos a encontrar casa\./);
  // Después de la rejilla y de la tarjeta para publicar (revisión UX 2026-10-29, A8; llega en su trozo), al final de todo.
  await expect(page.getByTestId("publish-promo")).toBeVisible();
  expect(await note.evaluate((el) => (el.previousElementSibling as HTMLElement | null)?.dataset.testid)).toBe("publish-promo");
  expect(await page.getByTestId("publish-promo").evaluate((el) => !!el.parentElement?.querySelector(".listing-grid"))).toBe(true);
  await note.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/resultados-412.png` });
  await page.setViewportSize({ width: 360, height: 800 });
  await note.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/resultados-360.png` });

  expect(await tapHelp(page)).toBe("Hola, estoy buscando casa en bnbtico.\nZona: Limón.\nFechas: ");
  await expect.poll(helpEvents).toEqual(["search_help_tap - explorar /explorar"]);
  // Sin filtros puestos, la rejilla no ofrece «Quitar filtros».
  await expect(page.getByRole("button", { name: "Quitar filtros" })).toHaveCount(0);
});
