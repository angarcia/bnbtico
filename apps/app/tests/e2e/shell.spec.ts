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
  await page.goto("/");
  await expect(page).toHaveURL(/\/explorar$/);
  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  await expect(nav.getByRole("link", { name: "Explorar" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { level: 1, name: "¿Para dónde va?" })).toBeVisible();

  await page.evaluate(() => ((window as unknown as { __sinRecargar: boolean }).__sinRecargar = true));
  await nav.getByRole("link", { name: "Favoritos" }).click();
  await expect(page).toHaveURL(/\/favoritos$/);
  await expect(page.getByRole("heading", { level: 1, name: "Favoritos" })).toBeVisible();
  await nav.getByRole("link", { name: "Mi cuenta" }).click();
  // Sin sesión, Mi cuenta es Ingresar, con la barra inferior y «Mi cuenta» activa (ticket 17).
  await expect(page.getByRole("heading", { level: 1, name: "Ingresar" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Mi cuenta" })).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "Volver" }).click();
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
