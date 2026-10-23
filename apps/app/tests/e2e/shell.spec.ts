import { expect, test, type ConsoleMessage } from "@playwright/test";

function watchConsole(page: import("@playwright/test").Page) {
  const problems: string[] = [];
  page.on("console", (msg: ConsoleMessage) => {
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
  // Sin sesión, Mi cuenta es Ingresar (pantalla de flujo, sin barra inferior).
  await expect(page.getByRole("heading", { level: 1, name: "Ingresar" })).toBeVisible();
  await page.getByRole("link", { name: "Volver" }).click();
  await expect(nav.getByRole("link", { name: "Explorar" })).toHaveAttribute("aria-current", "page");
  expect(await page.evaluate(() => (window as unknown as { __sinRecargar?: boolean }).__sinRecargar)).toBe(true);
  expect(problems, problems.join("\n")).toEqual([]);
});

test("una ruta desconocida muestra el shell con su aviso", async ({ page }) => {
  await page.goto("/no-existe");
  await expect(page.getByRole("heading", { level: 1, name: "No encontramos esta página" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navegación principal" })).toBeVisible();
});
