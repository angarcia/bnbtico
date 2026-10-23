import { expect, test } from "./helpers/test";

// Portada estática (ticket 13): la que verá bnbtico.com hasta el lanzamiento; en pruebas y local, con `/?pronto=1`.
test("`/?pronto=1` muestra la portada sin JavaScript, con su imagen, su CSP y sus etiquetas", async ({ page, request }) => {
  const requested: string[] = [];
  page.on("request", (r) => requested.push(r.url()));
  const res = await page.goto("/?pronto=1");
  expect(res!.status()).toBe(200);
  expect(res!.headers()["content-security-policy"]).toContain("script-src 'self';");
  await expect(page.getByRole("heading", { level: 1, name: "Alquile en el Caribe de Costa Rica, directo con quien lo recibe" })).toBeVisible();
  await expect(page.getByText("Muy pronto")).toBeVisible();
  await expect(page).toHaveTitle("bnbtico · Casas y alojamientos en alquiler en el Caribe de Costa Rica");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://bnbtico.com/");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", "https://bnbtico.com/og.jpg");
  const playa = page.getByRole("img", { name: /Playa Negra, en Puerto Viejo/ });
  await expect.poll(() => playa.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect.poll(() => page.getByRole("img", { name: "bnbtico" }).evaluate((img: HTMLImageElement) => img.naturalWidth > 0)).toBe(true);
  // La fuente de títulos llega (autoalojada) y nada sale del origen ni carga la app.
  await expect.poll(() => page.evaluate(() => document.fonts.check('800 30px "Outfit"'))).toBe(true);
  await page.waitForLoadState("networkidle");
  const origin = new URL(page.url()).origin;
  expect(requested.filter((u) => !u.startsWith(origin))).toEqual([]);
  expect(requested.filter((u) => /\.js(\?|$)/.test(u))).toEqual([]);
  expect((await request.get("/og.jpg")).headers()["content-type"]).toBe("image/jpeg");
});

test("`/` sigue llevando a Explorar fuera de producción", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/explorar$/);
  await expect(page.getByRole("heading", { name: "¿Para dónde va?" })).toBeVisible();
});

test("HEAD / responde 200, también con ?pronto=1", async ({ request }) => {
  for (const path of ["/", "/?pronto=1"]) {
    const res = await request.head(path);
    expect(res.status(), path).toBe(200);
    expect(res.headers()["content-type"], path).toMatch(/text\/html/);
  }
});
