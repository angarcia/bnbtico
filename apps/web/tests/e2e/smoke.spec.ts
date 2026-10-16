import { expect, test } from "@playwright/test";

test("la portada carga en móvil con «Muy pronto» y los tokens aplicados", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Muy pronto" })).toBeVisible();
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(["rgb(247, 245, 239)", "rgb(20, 25, 23)"]).toContain(bg);
  const manifest = await page.request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBeTruthy();
  expect((await manifest.json()).display).toBe("standalone");
});
