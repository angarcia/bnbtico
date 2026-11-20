import { expect, test, type Page } from "./helpers/test";
import type { Seeded } from "../contract/harness";
import { postgrestHarness } from "../db/postgrest-harness";
import { injectSession } from "./helpers/session";

// Hojas y ventanas comunes (historia 07, paso 3; shared/overlay.tsx), contra Supabase local: Escape cierra solo la de arriba,
// el foco vuelve a quien la abrió, Atrás cierra la hoja en el teléfono y no la ventana en escritorio (D9), y «¿Descartar los
// cambios?» sale solo si hay cambios (D10).
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
let h: Awaited<ReturnType<typeof postgrestHarness>>;
let casa: Seeded;

test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  h = await postgrestHarness();
  await h.reset();
  casa = await h.seed({ status: "active", draft: { title: "Casa Superficies" } });
});
test.beforeEach(async ({ page }) => {
  await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
});

const pauseRow = (page: Page) => page.getByRole("region", { name: "Acciones del calendario" }).getByRole("button", { name: "Pausar la casa", exact: true });
const pauseSheet = (page: Page) => page.getByRole("dialog", { name: "Pausar la casa" });
const discard = (page: Page) => page.getByRole("dialog", { name: "¿Descartar los cambios?" });
const layerDepth = (page: Page) => page.evaluate(() => (history.state as Record<string, unknown> | null)?.["3bstaysCapa"] ?? 0);

test("teléfono: «Pausar la casa» sin cambios se cierra con Escape y el foco vuelve a la fila; con una fecha, Escape, el fondo y Atrás preguntan antes", async ({ page }) => {
  await injectSession(page, "owner");
  await page.goto(`/propietario/calendario?casa=${casa.id}`);
  await pauseRow(page).click();
  await expect(pauseSheet(page)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(pauseSheet(page)).toHaveCount(0);
  await expect(discard(page)).toHaveCount(0);
  await expect(pauseRow(page)).toBeFocused();

  await pauseRow(page).click();
  const date = pauseSheet(page).getByLabel("Volver a publicarla el (opcional)");
  const day = await date.getAttribute("min");
  await date.fill(day!);
  await page.keyboard.press("Escape");
  await expect(discard(page)).toBeVisible();
  await expect(discard(page).getByRole("button")).toHaveText(["Descartar", "Seguir editando"]);
  // Escape cierra solo la de arriba: la pregunta; la hoja sigue con la fecha.
  await page.keyboard.press("Escape");
  await expect(discard(page)).toHaveCount(0);
  await expect(date).toHaveValue(day!);

  await page.getByTestId("sheet-backdrop").click({ position: { x: 10, y: 10 } });
  await expect(discard(page)).toBeVisible();
  await discard(page).getByRole("button", { name: "Seguir editando" }).click();
  await expect(date).toHaveValue(day!);

  // Atrás del teléfono: pregunta y no sale del Calendario.
  const url = page.url();
  await page.goBack();
  await expect(discard(page)).toBeVisible();
  expect(page.url()).toBe(url);
  await discard(page).getByRole("button", { name: "Descartar" }).click();
  await expect(pauseSheet(page)).toHaveCount(0);
  await expect(pauseRow(page)).toBeFocused();
  expect(await h.calendar("owner").days(casa.id)).toEqual([]);
  await expect.poll(() => layerDepth(page)).toBe(0);
});

test("teléfono: Atrás cierra la confirmación «Eliminar casa» y deja la casa abierta; el foco vuelve al botón", async ({ page }) => {
  await injectSession(page, "owner");
  await page.goto(`/propietario/casas/${casa.id}`);
  const action = page.getByRole("button", { name: "Eliminar casa" });
  await action.click();
  const scrolled = await page.evaluate(() => scrollY);
  expect(scrolled).toBeGreaterThan(0);
  const sheet = page.getByRole("dialog", { name: "¿Eliminar «Casa Superficies»?" });
  await expect(sheet).toBeVisible();
  // La entrada del historial no hace que el router suba la página debajo de la hoja.
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => scrollY)).toBe(scrolled);
  await page.goBack();
  await expect(sheet).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(scrolled);
  await expect(page).toHaveURL(new RegExp(`/propietario/casas/${casa.id}$`));
  await expect(action).toBeFocused();
  // Sin cambios que perder: no pregunta.
  await expect(discard(page)).toHaveCount(0);
});

test("escritorio: Ingresar no añade entradas al historial (Atrás navega), Escape la cierra y el foco vuelve a «Ingresar»", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/favoritos");
  await page.goto("/explorar");
  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  const signIn = nav.getByRole("button", { name: "Ingresar" });
  await signIn.click();
  const dialog = page.getByRole("dialog", { name: "Ingresar" });
  await expect(dialog).toBeVisible();
  expect(await layerDepth(page)).toBe(0);
  // El fondo no la cierra: se perdería el código a medias.
  await page.mouse.click(10, 400);
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(signIn).toBeFocused();

  await signIn.click();
  await expect(dialog).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/favoritos$/);
});
