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

test.beforeAll(async () => {
  const h = await postgrestHarness();
  await h.reset();
  oculta = await h.seed({ status: "reopened" });
  casa = await h.seed({ status: "active", photos: 5, draft: { title: "Casa Playa Negra", zone: "Playa Negra", nightlyPriceCrc: 95000, features: ["wifi", "pool", "parking"], parkingPaid: false } });
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
  await expect(page.getByTestId("approx-map").locator(".leaflet-tile-loaded").first()).toBeAttached();
  await expect(page.getByText("Parqueo gratis")).toBeVisible();
  expect(seen.rest, "la hidratación no debe pedir datos").toEqual([]);
  expect(seen.problems, seen.problems.join("\n")).toEqual([]);
});

test("el precio se ve en dólares al tocar y la preferencia se recuerda", async ({ page }) => {
  const seen = watch(page);
  await page.goto(`/casa/${casa.publicId}`);
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  await page.getByRole("button", { name: "Ver en dólares" }).click();
  await expect(page.getByTestId("main-price")).toHaveText("$186 / noche");
  await expect(page.getByRole("button", { name: "Ver en colones" })).toHaveText("≈ ₡95 000");

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
  await page.getByRole("button", { name: "Ver en dólares" }).click();
  await expect(page.getByTestId("main-price")).toHaveText("$186 / noche");
});
