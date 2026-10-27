// TEMPORAL: recorrido de revisión UX (no se confirma).
import { readdirSync, readFileSync } from "node:fs";
import { test, type Page } from "./helpers/test";
import { postgrestHarness } from "../db/postgrest-harness";
import { injectSession } from "./helpers/session";
const DIR = "../../design/pantallas/fotos";
const PHOTOS = readdirSync(DIR).filter((f) => f.endsWith(".jpg")).map((f) => readFileSync(`${DIR}/${f}`));
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
const OUT = "/tmp/ux";
const log: string[] = [];
async function photos(page: Page) {
  await page.route("**/storage/v1/object/public/**", (r) => {
    const u = r.request().url(); let h = 0; for (const c of u.split("/").slice(-3, -1).join("")) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return r.fulfill({ body: PHOTOS[h % PHOTOS.length], contentType: "image/jpeg" });
  });
  await page.route("https://tile.openstreetmap.org/**", (r) => r.fulfill({ body: TILE, contentType: "image/png" }));
  page.on("console", (m) => m.type() === "error" && log.push(`console: ${m.text()}`));
  page.on("pageerror", (e) => log.push(`pageerror: ${e.message}`));
}
async function step(page: Page, name: string, fn: () => Promise<unknown>, full = true) {
  page.setDefaultTimeout(6000);
  try { await fn(); await page.waitForTimeout(700); await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full }); console.log(`ok ${name} ${page.url()}`); }
  catch (e) { console.log(`FAIL ${name}: ${(e as Error).message.split("\n")[0]}`); await page.screenshot({ path: `${OUT}/${name}-FAIL.png` }).catch(() => {}); }
}
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
test.setTimeout(600_000);
test("recorrido", async ({ page, browser }) => {
  const h = await postgrestHarness();
  await h.reset();
  const casas = [
    { title: "Casa Playa Negra", zone: "Playa Negra", capacity: 4, bedrooms: 2, features: ["wifi", "beachfront", "parking"], parkingPaid: false, nightlyPriceCrc: 95000, description: "Casa de madera a 50 metros de la playa, con porche, hamacas y cocina equipada. Ideal para familias." },
    { title: "Cabinas Cocles Surf", zone: "Cocles", capacity: 2, features: ["wifi", "ac"], nightlyPriceCrc: 38000, acceptsMonthly: true, monthlyPriceCrc: 520000 },
    { title: "Villa Manzanillo con piscina y rancho frente al mar Caribe", zone: "Manzanillo", capacity: 8, bedrooms: 4, bathrooms: 3, features: ["pool", "bbq", "beachfront", "pets", "wifi"], nightlyPriceCrc: 185000 },
    { title: "Habitación en Puerto Viejo", zone: "Puerto Viejo", kind: "habitacion", bathroomShared: true, capacity: 2, features: ["wifi"], nightlyPriceCrc: 22000 },
    { title: "Casa Cahuita", zone: "Cahuita", capacity: 6, bedrooms: 3, features: ["parking", "kids_free"], parkingPaid: false, nightlyPriceCrc: 70000 },
  ] as const;
  const seeded = [];
  for (const d of casas) seeded.push(await h.seed({ status: "active", as: "other", photos: 6, draft: d as never }));
  await photos(page);

  // ---------- Cliente ----------
  await step(page, "g01-portada", () => page.goto("/?pronto=1"));
  await step(page, "g02-explorar", async () => { await page.goto("/"); await page.locator(".listing-card").first().waitFor(); }, false);
  await step(page, "g02b-explorar-full", async () => {});
  await step(page, "g03-chip-piscina", () => page.getByRole("button", { name: "Piscina" }).click());
  await page.getByRole("button", { name: "Piscina" }).click().catch(() => {});
  await step(page, "g04-filtros", () => page.getByRole("link", { name: /Más filtros/ }).click());
  await step(page, "g05-filtros-aplicar", async () => { const b = page.getByRole("link", { name: /Ver .* casa/ }).or(page.getByRole("button", { name: /Ver .* casa/ })); await b.first().click(); });
  await step(page, "g06-ficha", async () => { await page.locator(".listing-card").first().click(); await page.locator(".hero").waitFor(); }, false);
  await step(page, "g06b-ficha-full", async () => {});
  log.push("ficha buttons: " + (await page.getByRole("button").allInnerTexts()).join(" | "));
  await step(page, "g07-favorito", () => page.getByRole("button", { name: /favorit|Guardar/i }).first().click(), false);
  await step(page, "g08-contactar", () => page.getByRole("button", { name: /Contactar por WhatsApp/ }).click(), false);
  log.push("after contactar texts: " + (await page.locator("body").innerText()).slice(0, 800).replace(/\n+/g, " / "));
  await step(page, "g09-contactar-enviar", async () => {
    const b = page.getByRole("button", { name: /Abrir WhatsApp|Continuar|Ingresar|Enviar/ }).first(); await b.click();
  }, false);
  await step(page, "g10-favoritos", () => page.goto("/favoritos"));
  await step(page, "g11-cuenta", () => page.goto("/cuenta"));
  await step(page, "g11b-cuenta-enviar-vacio", () => page.getByRole("button", { name: /Recibir código/ }).click(), false);
  await step(page, "g12-ayuda", () => page.goto("/ayuda"));
  await step(page, "g13-404", () => page.goto("/no-existe"));
  await step(page, "g14-ficha-se", async () => { await page.setViewportSize({ width: 375, height: 667 }); await page.goto(`/casa/${seeded[2]!.publicId}`); await page.locator(".hero").waitFor(); }, false);
  await step(page, "g15-explorar-se", async () => { await page.goto("/explorar"); await page.locator(".listing-card").first().waitFor(); }, false);
  await page.setViewportSize({ width: 390, height: 844 });

  // ---------- Propietario nuevo (sin casas) ----------
  await injectSession(page, "owner");
  await step(page, "o01-cuenta-cliente-con-sesion", () => page.goto("/cuenta"));
  await step(page, "o02-inicio-vacio", () => page.goto("/propietario"));
  await step(page, "o03-mis-casas-vacio", () => page.goto("/propietario/casas"));
  await step(page, "o04-publicar-entrada", () => page.goto("/propietario/publicar"));

  // ---------- Propietario con casas ----------
  const active = await h.seed({ status: "active", photos: 6, draft: { title: "Casa Selva Cocles", zone: "Cocles", nightlyPriceCrc: 65000, features: ["wifi", "pool"] } as never });
  await h.seed({ status: "review", photos: 5, draft: { title: "Cabina en revisión" } as never });
  const draft = await h.seed({ status: "draft", photos: 2, draft: { title: "Mi borrador" } as never });
  try {
    const inq = h.inquiries("other");
    await inq.create(active.publicId, { arrival: null, departure: null, people: 3, message: "Hola, ¿está disponible para el fin de semana del 14? Somos 3 adultos." });
  } catch (e) { log.push("inquiry FAIL " + (e as Error).message); }
  await step(page, "o05-inicio", () => page.goto("/propietario"));
  await step(page, "o06-mis-casas", () => page.goto("/propietario/casas"));
  await step(page, "o07-detalle", () => page.goto(`/propietario/casas/${active.id}`));
  await step(page, "o08-calendario", () => page.goto("/propietario/calendario"));
  await step(page, "o09-consultas", () => page.goto("/propietario/consultas"));
  await step(page, "o10-cuenta-prop", () => page.goto("/cuenta"));
  for (let i = 1; i <= 9; i++) await step(page, `o2${i}-paso${i}`, async () => { await page.goto(`/propietario/publicar/${draft.id}/${i}`); await page.getByText(`Paso ${i} de 9`).waitFor(); }, false);
  await step(page, "o30-enviada", () => page.goto(`/propietario/casas/${active.id}/enviada`));

  // ---------- Escritorio ----------
  const desk = await browser.newPage({ viewport: { width: 1280, height: 800 } }); await photos(desk);
  await step(desk, "d01-portada", () => desk.goto("/?pronto=1"));
  await step(desk, "d02-explorar", async () => { await desk.goto("/explorar"); await desk.locator(".listing-card").first().waitFor(); });
  await step(desk, "d03-ficha", async () => { await desk.goto(`/casa/${seeded[0]!.publicId}`); await desk.locator(".hero").waitFor(); });
  console.log(log.join("\n"));
});
