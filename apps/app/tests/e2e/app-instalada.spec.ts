import { expect, test, type BrowserContext, type Page } from "./helpers/test";
import { readFileSync, writeFileSync } from "node:fs";
import type { ListingsHarness, Seeded } from "../contract/harness";
import { postgrestHarness } from "../db/postgrest-harness";
import { injectSession } from "./helpers/session";

// App instalada: service worker, manifiesto, sin conexión y aviso de versión nueva. Contra `vite preview` (el build).
test.use({ serviceWorkers: "allow" });
test.describe.configure({ mode: "serial" });

const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
const SW_FILE = new URL("../../dist/client/sw.js", import.meta.url);
let h: ListingsHarness;
let active: Seeded;

test.beforeAll(async () => {
  h = await postgrestHarness();
  await h.reset();
  active = await h.seed({ status: "active", draft: { title: "Casa Cocles", zone: "Cocles", zoneSource: "other", zoneId: null, nightlyPriceCrc: 55000 } });
  await h.seed({ status: "active", draft: { title: "Casa Manzanillo", zone: "Manzanillo", zoneSource: "other", zoneId: null, nightlyPriceCrc: 85000 } });
});

test.beforeEach(async ({ context }) => {
  // Las peticiones del SW no pasan por page.route: las fotos y teselas se sirven desde el contexto.
  await context.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
  await context.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
});

/** Espera a que el SW esté activo y controle la página (la primera visita la reclama con clients.claim). */
async function controlled(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
}

async function goOffline(context: BrowserContext, page: Page) {
  await context.setOffline(true);
  // Comprobación de que de verdad no hay red: robots.txt no está precacheado y el SW lo deja pasar.
  expect(await page.evaluate(() => fetch("/robots.txt").then(() => "red", () => "sin red"))).toBe("sin red");
}

const results = (page: Page) => page.getByTestId("results-count");

test("segunda apertura sin red: el shell sale del service worker y Explorar visitado se pinta", async ({ page, context }) => {
  await page.goto("/explorar");
  await expect(results(page)).toHaveText("2 casas");
  await controlled(page);
  await page.waitForTimeout(1500); // la caché de Query se guarda en IndexedDB con un pequeño retraso

  await goOffline(context, page);
  const response = await page.goto("/explorar");
  expect(response?.fromServiceWorker()).toBe(true);
  await expect(page.getByRole("heading", { level: 1, name: "Explorar casas" })).toBeVisible();
  await expect(results(page)).toHaveText("2 casas");
  await page.getByRole("link", { name: /Casa Manzanillo/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Casa Manzanillo" })).toBeVisible();

  // Otra ruta de la SPA abierta en frío sin red también recibe el shell.
  const cuenta = await page.goto("/cuenta");
  expect(cuenta?.fromServiceWorker()).toBe(true);
  await expect(page.getByRole("heading", { level: 1, name: "Ingresar" })).toBeVisible();
  await context.setOffline(false);
});

test("la ficha pública va a la red primero y, sin red, sale la copia guardada", async ({ page, context }) => {
  await page.goto("/explorar");
  await controlled(page);
  const online = await page.goto(`/casa/${active.publicId}`);
  expect(online?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Casa Cocles" })).toBeVisible();
  // El HTML de la ficha viene del servidor (SSR) aunque pase por el SW.
  expect(await online?.text()).toContain('id="ssr-data"');

  await goOffline(context, page);
  await page.goto(`/casa/${active.publicId}`);
  await expect(page.getByRole("heading", { level: 1, name: "Casa Cocles" })).toBeVisible();
  await context.setOffline(false);
});

test("una escritura sin red muestra «Sin conexión», vuelve atrás y no se encola", async ({ page, context }) => {
  await injectSession(page, "owner");
  await page.goto(`/propietario/calendario?casa=${active.id}`);
  const row = page.getByRole("region", { name: "Acciones del calendario" }).getByRole("button", { name: "Pausar la casa", exact: true });
  await expect(row).toBeVisible();
  await controlled(page);

  await goOffline(context, page);
  await row.click();
  await page.getByRole("dialog", { name: "Pausar la casa" }).getByRole("button", { name: "Pausar la casa" }).click();
  await expect(page.locator('.note[role="alert"]')).toHaveText("Sin conexión. Revise su internet e intente de nuevo.");
  await expect(row).toBeVisible();

  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.waitForTimeout(1500);
  expect((await h.anon.getPublic(active.publicId))?.available).toBe(true);
});

test("manifiesto, iconos y cabeceras: instalable, abre en /explorar sin redirección", async ({ page, request }) => {
  await page.goto("/explorar");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", "/icons/apple-touch-icon.png");

  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  const m = (await manifest.json()) as { start_url: string; display: string; orientation: string; icons: { src: string; purpose: string; sizes: string }[]; theme_color: string; background_color: string };
  // Solo en vertical en el teléfono (decisión 2026-11-03): instalada, el sistema no la gira.
  expect(m).toMatchObject({ start_url: "/explorar", display: "standalone", orientation: "portrait", theme_color: "#FFFBF2", background_color: "#FFFBF2" });
  expect(m.icons.map((i) => `${i.sizes} ${i.purpose}`)).toEqual(["192x192 any", "512x512 any", "192x192 maskable", "512x512 maskable"]);
  for (const icon of [...m.icons.map((i) => i.src), "/icons/apple-touch-icon.png"]) {
    const res = await request.get(icon);
    expect(res.status(), icon).toBe(200);
    expect(res.headers()["content-type"], icon).toBe("image/png");
  }

  const start = await request.get("/explorar", { maxRedirects: 0 });
  expect(start.status()).toBe(200);
  expect(await start.text()).toContain('<div id="root">');

  const sw = await request.get("/sw.js");
  expect(sw.status()).toBe(200);
  expect(sw.headers()["content-type"]).toMatch(/javascript/);
  expect(sw.headers()["cache-control"]).toBe("no-cache");
});

test("versión nueva: espera, avisa al volver a la app, no se ofrece dentro del asistente y «Actualizar» recarga", async ({ page }) => {
  await injectSession(page, "owner");
  await page.goto("/explorar");
  await controlled(page);
  await page.waitForTimeout(500); // el registro va después de load
  await expect(page.getByText("Hay una versión nueva")).toHaveCount(0);

  // Un despliegue nuevo: /sw.js cambia de contenido (vite preview lo lee del disco en cada petición).
  const original = readFileSync(SW_FILE, "utf8");
  try {
    writeFileSync(SW_FILE, `${original}\n// despliegue nuevo`);
    // vite preview mantiene el ETag del arranque: sin vaciar la caché HTTP del navegador respondería 304 (sin cambios).
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.clearBrowserCache");
    // Volver a la app (visibilitychange) busca la versión nueva: se instala y espera, y aparece el aviso.
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    const banner = page.getByRole("status").filter({ hasText: "Hay una versión nueva" });
    await expect(banner).toBeVisible();
    await expect(banner.getByRole("button", { name: "Actualizar" })).toBeVisible();
    expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.waiting?.state)).toBe("installed");

    // Dentro del asistente no se ofrece ni se recarga; la versión nueva sigue esperando.
    // «Publicar casa» entra directo al paso 1 (revisión UX C4).
    await page.goto("/propietario/publicar");
    await expect(page).toHaveURL(/\/propietario\/publicar\/[0-9a-f-]+\/1$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForTimeout(800);
    await expect(page.getByText("Hay una versión nueva")).toHaveCount(0);
    expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.waiting?.state)).toBe("installed");

    // Al salir del asistente vuelve el aviso; «Actualizar» activa la versión nueva y recarga esta pestaña.
    await page.getByRole("button", { name: /Cerrar/ }).click();
    await expect(page).not.toHaveURL(/\/propietario\/publicar/);
    await expect(banner).toBeVisible();
    // Si no recarga, que diga en qué se quedó el service worker (falló una vez en local con la suite entera, 2026-11-24, y no
    // se reprodujo: ni en 20 intentos, 15 con la CPU cargada, ni en CI).
    const reloaded = page.waitForEvent("load", { timeout: 15_000 }).catch(async () => {
      const sw = await page.evaluate(async () => {
        const r = await navigator.serviceWorker.getRegistration();
        return { controller: !!navigator.serviceWorker.controller, active: r?.active?.state ?? null, waiting: r?.waiting?.state ?? null, installing: r?.installing?.state ?? null };
      }).catch((e: unknown) => String(e));
      throw new Error(`«Actualizar» no recargó en 15 s; service worker: ${JSON.stringify(sw)}`);
    });
    await banner.getByRole("button", { name: "Actualizar" }).click();
    await reloaded;
    await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.waiting ?? null)).toBe(null);
    await expect(page.getByText("Hay una versión nueva")).toHaveCount(0);
  } finally {
    writeFileSync(SW_FILE, original);
  }
});

// Sin tocar «Actualizar», recargar no bastaba: la versión vieja seguía sirviéndose durante días (Ana, 2026-11-25, con una
// del 17 de noviembre). Al abrir la app con una versión nueva esperando y sin otras pestañas, se aplica sola.
test("versión nueva: al abrir o recargar la app con una versión esperando, se aplica sola sin aviso", async ({ page }) => {
  await injectSession(page, "owner");
  await page.goto("/explorar");
  await controlled(page);
  await page.waitForTimeout(500);
  const original = readFileSync(SW_FILE, "utf8");
  try {
    writeFileSync(SW_FILE, `${original}\n// otro despliegue`);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.clearBrowserCache");
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect(page.getByRole("status").filter({ hasText: "Hay una versión nueva" })).toBeVisible();
    const waitingScript = () => page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.waiting?.scriptURL ?? null);
    expect(await waitingScript()).not.toBeNull();

    // Al recargar, la app ve la versión esperando, la activa y se recarga una sola vez más, ya con la nueva.
    let loads = 0;
    page.on("load", () => loads++);
    await page.reload();
    await expect.poll(() => loads, { timeout: 15_000 }).toBe(2);
    await page.waitForTimeout(2_000);
    expect(loads, "una sola recarga más, no dos").toBe(2);
    expect(await waitingScript()).toBe(null);
    await expect(results(page)).toHaveText("2 casas");
    await expect(page.getByText("Hay una versión nueva")).toHaveCount(0);
    expect(await page.evaluate(() => fetch("/sw.js").then((r) => r.text()))).toContain("// otro despliegue");
  } finally {
    writeFileSync(SW_FILE, original);
  }
});
