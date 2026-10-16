import { expect, test } from "@playwright/test";

test("la portada carga en móvil con los tokens aplicados y el manifest de la PWA", async ({ page }) => {
  await page.goto("/");
  // En producción sin NEXT_PUBLIC_STAGE es «Muy pronto»; en pruebas y en local entra a la app.
  await expect(page.getByRole("heading", { name: /Muy pronto|¿A dónde vas\?/ })).toBeVisible();
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(["rgb(247, 245, 239)", "rgb(20, 25, 23)"]).toContain(bg);
  const manifest = await page.request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBeTruthy();
  expect((await manifest.json()).display).toBe("standalone");
});
