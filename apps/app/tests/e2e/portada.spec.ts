import { expect, test } from "./helpers/test";

// Portada estática (ticket 13): la que verá 3bstays.com hasta el lanzamiento; en pruebas y local, con `/?pronto=1`.
test("`/?pronto=1` muestra la portada sin JavaScript, con su imagen, su CSP y sus etiquetas", async ({ page, request }) => {
  const requested: string[] = [];
  page.on("request", (r) => requested.push(r.url()));
  const res = await page.goto("/?pronto=1");
  expect(res!.status()).toBe(200);
  expect(res!.headers()["content-security-policy"]).toContain("script-src 'self';");
  await expect(page.getByRole("heading", { level: 1, name: "Alquile en el Caribe de Costa Rica, directo con quien lo recibe" })).toBeVisible();
  await expect(page.getByText("Muy pronto")).toBeVisible();
  // Revisión UX C1: la oferta en su tarjeta bajo la foto y «Cómo funciona» en tres pasos. Sin número de WhatsApp de
  // propietarios (como aquí), la frase de «abrimos pronto» en vez de un botón.
  await expect(page.getByRole("heading", { level: 2, name: "¿Tiene una casa en el Caribe?" })).toBeVisible();
  await expect(page.getByText("Las primeras 50 casas: 12 meses gratis.")).toBeVisible();
  // Fuera de producción antes del lanzamiento el botón lleva al asistente, no a WhatsApp ni a la frase.
  await expect(page.getByRole("link", { name: "Publicar mi casa" })).toHaveAttribute("href", "/publicar");
  await expect(page.getByText("Abrimos pronto en el Caribe sur.")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Escríbanos por WhatsApp" })).toHaveCount(0);
  await expect(page.getByText(/bien tico/i)).toHaveCount(0);
  await expect(page.locator(".soon-steps li")).toHaveCount(3);
  await expect(page).toHaveTitle("3bstays · Casas y alojamientos en alquiler en el Caribe de Costa Rica");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://3bstays.com/");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", "https://3bstays.com/og.jpg");
  const playa = page.getByRole("img", { name: /Playa Negra, en Puerto Viejo/ });
  await expect.poll(() => playa.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect.poll(() => page.getByRole("img", { name: "3bstays" }).evaluate((img: HTMLImageElement) => img.naturalWidth > 0)).toBe(true);
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
  await expect(page.getByRole("heading", { name: "Explorar casas" })).toBeVisible();
});

test("HEAD / responde 200, también con ?pronto=1", async ({ request }) => {
  for (const path of ["/", "/?pronto=1"]) {
    const res = await request.head(path);
    expect(res.status(), path).toBe(200);
    expect(res.headers()["content-type"], path).toMatch(/text\/html/);
  }
});
