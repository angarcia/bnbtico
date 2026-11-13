import { expect, test, type ConsoleMessage } from "./helpers/test";

function watchConsole(page: import("@playwright/test").Page) {
  const problems: string[] = [];
  page.on("console", (msg: ConsoleMessage) => {
    // El aviso de Playwright por bloquear el service worker (playwright.config.ts) no es de la app.
    if (msg.text().includes("Service Worker registration blocked by Playwright")) return;
    if (msg.type() === "error" || msg.type() === "warning") problems.push(`${msg.type()}: ${msg.text()}`);
  });
  page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
  return problems;
}

test("el shell muestra la barra inferior y cambia de pestaña sin recargar", async ({ page }) => {
  const problems = watchConsole(page);
  await page.goto("/explorar");
  await expect(page).toHaveURL(/\/explorar$/);
  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  await expect(nav.getByRole("link", { name: "Explorar" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { level: 1, name: "Explorar casas" })).toBeVisible();

  await page.evaluate(() => ((window as unknown as { __sinRecargar: boolean }).__sinRecargar = true));
  await nav.getByRole("link", { name: "Favoritos" }).click();
  await expect(page).toHaveURL(/\/favoritos$/);
  await expect(page.getByRole("heading", { level: 1, name: "Favoritos" })).toBeVisible();
  await expect(nav.getByRole("link")).toHaveText(["3Btico", "Explorar", "Favoritos", "Ingresar"]);
  // Revisión UX 2026-10-29 (C4): sin sesión, «Ingresar» es la pestaña de la derecha y abre Ingresar con la barra a la vista.
  await nav.getByRole("link", { name: "Ingresar" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Ingresar" })).toBeAttached();
  await expect(nav.getByRole("link", { name: "Ingresar" })).toHaveAttribute("aria-current", "page");
  await nav.getByRole("link", { name: "Explorar" }).click();
  await expect(nav.getByRole("link", { name: "Explorar" })).toHaveAttribute("aria-current", "page");
  expect(await page.evaluate(() => (window as unknown as { __sinRecargar?: boolean }).__sinRecargar)).toBe(true);
  expect(problems, problems.join("\n")).toEqual([]);
});

test("una ruta desconocida muestra el shell con su aviso", async ({ page }) => {
  await page.goto("/no-existe");
  await expect(page.getByRole("heading", { level: 1, name: "No encontramos esta página" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navegación principal" })).toBeVisible();
  // Revisión UX N4: la página no es un callejón sin salida.
  await page.getByRole("link", { name: "Ir a Explorar" }).click();
  await expect(page).toHaveURL(/\/explorar$/);
});

// Solo en vertical en el teléfono (decisión 2026-11-03): en un teléfono en horizontal, el aviso tapa la app y no deja tocar
// nada; al volver a vertical se va y la app sigue donde estaba (sin recargar). No sale en tabletas ni en el ordenador.
const ROTATE = "Gire el teléfono para usar 3bstays";

test("teléfono en horizontal: el aviso tapa la app, no deja tocar y al volver a vertical sigue donde estaba", async ({ page }) => {
  const problems = watchConsole(page);
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/favoritos");
  await expect(page.getByRole("heading", { level: 1, name: "Favoritos" })).toBeVisible();
  const notice = page.getByRole("alert").filter({ hasText: ROTATE });
  await expect(notice).toBeHidden();
  await page.evaluate(() => ((window as unknown as { __sinRecargar: boolean }).__sinRecargar = true));
  const tab = page.locator('nav[aria-label="Navegación principal"] a[href="/explorar"]');
  const box = (await tab.boundingBox())!;

  await page.setViewportSize({ width: 667, height: 375 });
  await expect(notice).toBeVisible();
  await expect(notice.locator("img")).toBeVisible();
  // Lo demás, fuera de la vista y del árbol de accesibilidad (visibility:hidden), pero montado.
  await expect(page.getByRole("heading", { level: 1, name: "Favoritos" })).toBeHidden();
  await expect(page.getByRole("navigation", { name: "Navegación principal" })).toBeHidden();
  const at = { x: Math.min(box.x + box.width / 2, 660), y: 375 - 20 };
  expect(await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest(".rotate-notice"), at)).toBe(true);
  await page.touchscreen.tap(at.x, at.y);
  await page.waitForTimeout(300);
  await expect(page).toHaveURL(/\/favoritos$/);

  await page.setViewportSize({ width: 375, height: 667 });
  await expect(notice).toBeHidden();
  await expect(page.getByRole("heading", { level: 1, name: "Favoritos" })).toBeVisible();
  await expect(page).toHaveURL(/\/favoritos$/);
  expect(await page.evaluate(() => (window as unknown as { __sinRecargar?: boolean }).__sinRecargar)).toBe(true);
  // Ya en vertical, la pestaña responde.
  await tab.click();
  await expect(page).toHaveURL(/\/explorar$/);
  expect(problems, problems.join("\n")).toEqual([]);
});

// Chrome de iPhone encoge la página al abrir el teclado: en vertical queda más ancha que alta (390 × 300) y el aviso no
// puede salir, o esconde el campo, le quita el foco y el teclado se cierra (Daniel, 2026-11-04).
test("en vertical con el teclado abierto (página más ancha que alta) no sale el aviso y el campo sigue con el foco", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cuenta");
  const phone = page.locator("#account-phone");
  await phone.focus();
  await page.setViewportSize({ width: 390, height: 300 });
  await expect(page.getByRole("alert").filter({ hasText: ROTATE })).toBeHidden();
  await expect(phone).toBeVisible();
  await expect(phone).toBeFocused();
});

test("la ficha que pinta el worker también lleva el aviso en horizontal", async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 375 });
  await page.goto("/casa/CT-999999");
  await expect(page.getByRole("alert").filter({ hasText: ROTATE })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 667 });
  await expect(page.getByRole("alert").filter({ hasText: ROTATE })).toBeHidden();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("ni en el ordenador ni en una tableta en horizontal sale el aviso", async ({ browser, baseURL }) => {
  for (const device of [
    { viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false },
    { viewport: { width: 1024, height: 768 }, isMobile: true, hasTouch: true },
  ]) {
    const ctx = await browser.newContext({ ...device, baseURL, serviceWorkers: "block" });
    const page = await ctx.newPage();
    await page.goto("/explorar");
    await expect(page.getByRole("heading", { level: 1, name: "Explorar casas" })).toBeVisible();
    await expect(page.getByText(ROTATE)).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", { name: "Explorar" })).toBeVisible();
    await ctx.close();
  }
});
