import { expect, test, type Page } from "./helpers/test";

// Catálogo de componentes (estructura del frontend, paso 5): /_componentes pinta cada componente común sin errores, en
// móvil y en escritorio, y deja la captura de la página entera en el informe (para revisar el aspecto sin abrir la app).
const SECTIONS = ["Botones", "Botones de texto", "Tarjetas", "Etiquetas y contadores", "Avisos", "Esqueletos", "Campos", "Elecciones", "Contadores", "Campos cerrados", "Hojas y ventanas", "Cabeceras", "Enlaces de la app", "Confirmaciones", "Código de verificación", "Iconos"];

function watchErrors(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") problems.push(msg.text());
  });
  page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
  return problems;
}

for (const [device, size] of [["móvil", null], ["escritorio", { width: 1280, height: 800 }]] as const) {
  test(`en ${device}, cada sección del catálogo se pinta sin errores y queda su captura`, async ({ page }, info) => {
    if (size) await page.setViewportSize(size);
    const problems = watchErrors(page);
    await page.goto("/_componentes");
    await expect(page.getByRole("heading", { level: 1, name: "Componentes" })).toBeVisible();
    await expect(page.getByTestId("catalog-section").getByRole("heading", { level: 2 })).toHaveText(SECTIONS);
    await info.attach(`componentes-${device}`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    expect(problems).toEqual([]);
  });
}

test("la hoja, la ventana y las confirmaciones de muestra se abren y se cierran con Escape", async ({ page }) => {
  await page.goto("/_componentes");
  for (const [open, name] of [["Abrir hoja", "Hoja de muestra"], ["Abrir ventana", "Ventana de muestra"], ["Confirmar", "¿Seguro que quiere hacerlo?"], ["Confirmar algo que no se deshace", "¿Seguro que quiere hacerlo?"]] as const) {
    await page.getByRole("button", { name: open, exact: true }).click();
    const surface = page.getByRole("dialog", { name });
    await expect(surface).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(surface).toBeHidden();
  }
});
