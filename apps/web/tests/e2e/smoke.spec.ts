import { expect, test } from "@playwright/test";

test("la portada carga en móvil con los tokens aplicados y el manifest de la PWA", async ({ page }) => {
  await page.goto("/");
  // En producción sin NEXT_PUBLIC_STAGE es «Muy pronto»; en pruebas y en local entra a la app.
  await expect(page.getByRole("heading", { name: /Alquilá en el Caribe|¿A dónde vas\?/ })).toBeVisible();
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(["rgb(247, 245, 239)", "rgb(20, 25, 23)"]).toContain(bg);
  // Google Analytics en todas las páginas (en desarrollo Next solo precarga; en producción inyecta el script y define gtag).
  const ga = page.locator('script[src*="gtag/js?id=G-PZ17LLFS6S"], link[href*="gtag/js?id=G-PZ17LLFS6S"]');
  expect(await ga.count()).toBeGreaterThan(0);
  const manifest = await page.request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBeTruthy();
  const json = await manifest.json();
  expect(json.display).toBe("standalone");
  expect(json.icons.map((i: { sizes: string }) => i.sizes).sort()).toEqual(["192x192", "512x512"]);
});
