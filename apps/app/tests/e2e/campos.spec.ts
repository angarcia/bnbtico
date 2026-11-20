import { expect, test, type Locator, type Page } from "./helpers/test";
import type { Seeded } from "../contract/harness";
import { postgrestHarness } from "../db/postgrest-harness";
import { expectErrorUnder } from "./helpers/field-error";
import { injectSession } from "./helpers/session";

// Campos comunes (historia 07, paso 4), contra Supabase local: el error sale debajo del campo culpable al publicar, el
// contador −/+ es el mismo en todas partes, «¿Acepta alquiler por meses?» es un segmento (D8) y todo lo que se toca mide
// 44 px o más.
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
let h: Awaited<ReturnType<typeof postgrestHarness>>;
let casa: Seeded;

test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  h = await postgrestHarness();
  await h.reset();
  casa = await h.seed({ status: "active", draft: { title: "Casa Campos", capacity: 4, features: ["wifi", "pool"] }, photos: 1 });
});
test.beforeEach(async ({ page }) => {
  await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
});

/** El alto y el ancho de todos los que casan con `targets`, al menos uno. */
async function expectHit(targets: Locator, what: string) {
  const n = await targets.count();
  expect(n, `${what}: hay alguno`).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    const box = (await targets.nth(i).boundingBox())!;
    expect(box.height, `${what} ${i}: alto`).toBeGreaterThanOrEqual(44);
    expect(box.width, `${what} ${i}: ancho`).toBeGreaterThanOrEqual(44);
  }
}

/** El contador común: «−» y «+» con el nombre «Una persona menos/más», 44 × 44, con el mismo aspecto. */
async function stepperLook(page: Page, scope: Locator = page.locator("body")) {
  const less = scope.getByRole("button", { name: "Una persona menos" });
  const more = scope.getByRole("button", { name: "Una persona más" });
  await expect(less).toHaveCount(1);
  await expect(more).toHaveCount(1);
  await expectHit(scope.locator(".stepper button"), "contador");
  return more.evaluate((el) => {
    const s = getComputedStyle(el);
    return { width: s.width, height: s.height, radius: s.borderRadius, background: s.backgroundColor, color: s.color, parent: el.parentElement!.className };
  });
}

test("publicar: si la base rechaza el precio por noche, el error sale debajo de ese campo y no arriba", async ({ page }) => {
  const draft = await h.seed({ status: "draft", draft: { nightlyPriceCrc: null }, photos: 1 });
  await injectSession(page, "owner");
  await page.route(/\/rest\/v1\/listings\?/, (route) =>
    route.request().method() === "PATCH" ? route.fulfill({ status: 400, json: { code: "P0001", message: "Indique el precio por noche en colones." } }) : route.fallback(),
  );
  await page.goto(`/propietario/publicar/${draft.id}/8`);
  await page.getByLabel("Precio por noche").fill("95000");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/8$/);
  await expectErrorUnder(page, page.getByLabel("Precio por noche"), "Indique el precio por noche en colones.");
  // Lo escrito se queda, como antes.
  await expect(page.getByLabel("Precio por noche")).toHaveValue("95000");
});

test("publicar: un error que no es de un campo (la red) sigue en el aviso de arriba", async ({ page }) => {
  const draft = await h.seed({ status: "draft", photos: 1 });
  await injectSession(page, "owner");
  await page.route(/\/rest\/v1\/listings\?/, (route) => (route.request().method() === "PATCH" ? route.fulfill({ status: 500, json: { message: "caída" } }) : route.fallback()));
  await page.goto(`/propietario/publicar/${draft.id}/8`);
  await page.getByLabel("Precio por noche").fill("95000");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.locator('.note[role="alert"]')).toBeVisible();
  await expect(page.getByLabel("Precio por noche")).not.toHaveAttribute("aria-invalid", "true");
});

test("publicar: «¿Acepta alquiler por meses?» es un segmento No | Sí de 44 px, con No elegido y el valor en el formulario", async ({ page }) => {
  const draft = await h.seed({ status: "draft", photos: 1 });
  await injectSession(page, "owner");
  await page.goto(`/propietario/publicar/${draft.id}/8`);
  const accepts = page.getByRole("group", { name: "¿Acepta alquiler por meses?" });
  await expect(accepts).toHaveClass(/\bseg\b/);
  await expect(accepts.getByRole("button")).toHaveText(["No", "Sí"]);
  await expect(accepts.getByRole("button", { name: "No" })).toHaveAttribute("aria-pressed", "true");
  await expectHit(accepts.getByRole("button"), "segmento");
  // Con el teclado: Tab llega a «Sí» y Espacio lo elige.
  await accepts.getByRole("button", { name: "No" }).focus();
  await page.keyboard.press("Tab");
  await expect(accepts.getByRole("button", { name: "Sí" })).toBeFocused();
  await page.keyboard.press("Space");
  await expect(accepts.getByRole("button", { name: "Sí" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('input[type="hidden"][name="acceptsMonthly"]')).toHaveValue("yes");
  await expect(page.getByLabel("Precio al mes (opcional)")).toBeVisible();
  await page.getByLabel("Precio al mes (opcional)").fill("350000");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/9$/);
  await expect.poll(async () => (await h.owner("owner").getOwn(draft.id))?.monthlyPriceCrc).toBe(350000);
});

test("el contador −/+ es el mismo en publicar, Filtros, la búsqueda y la hoja de contacto", async ({ page }) => {
  const draft = await h.seed({ status: "draft", photos: 1 });
  await injectSession(page, "owner");
  await page.goto(`/propietario/publicar/${draft.id}/4`);
  await expect(page.getByRole("button", { name: "Una persona más" })).toBeVisible();
  const publish = await stepperLook(page);
  await expect(page.getByRole("button", { name: "Un dormitorio más" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Un baño menos" })).toBeVisible();

  await page.goto("/explorar/filtros");
  await expect(page.getByRole("button", { name: "Una persona más" })).toBeVisible();
  const filters = await stepperLook(page);
  await page.goto("/explorar/buscar?abrir=quienes");
  await expect(page.getByRole("button", { name: "Una persona más" })).toBeVisible();
  const search = await stepperLook(page);
  await page.goto(`/casa/${casa.publicId}`);
  await page.getByRole("button", { name: "Contactar por WhatsApp", exact: true }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("button", { name: "Una persona más" })).toBeVisible();
  const contact = await stepperLook(page, sheet);
  for (const other of [filters, search, contact]) expect(other).toEqual(publish);
  // El de la hoja lleva la cifra en un campo, con su etiqueta.
  await expect(sheet.getByLabel("Personas (opcional)")).toHaveAttribute("type", "number");
});

test("chips de características: casilla nativa con el foco visible al usar el teclado, y 44 px", async ({ page }) => {
  const draft = await h.seed({ status: "draft", photos: 1 });
  await injectSession(page, "owner");
  await page.goto(`/propietario/publicar/${draft.id}/5`);
  const wifi = page.getByRole("checkbox", { name: "Wifi" });
  await expect(wifi).toBeAttached();
  await expectHit(page.locator(".feature-choices .chip"), "chip");
  await expect(page.locator("label[aria-pressed]")).toHaveCount(0);
  // Con el teclado: del chip de Wifi, Tab al siguiente (Aire acondicionado), que enseña el foco, y Espacio lo marca.
  await wifi.focus();
  await page.keyboard.press("Tab");
  const ac = page.getByRole("checkbox", { name: "Aire acondicionado" });
  await expect(ac).toBeFocused();
  const chip = page.locator("label.chip", { has: ac });
  await expect(chip).toHaveCSS("outline-style", "solid");
  await expect(ac).not.toBeChecked();
  await page.keyboard.press("Space");
  await expect(ac).toBeChecked();
  await expect(chip.locator(".feature-check svg")).toBeVisible();
});

test("Filtros y el calendario: segmentos, precio con ₡ y su error, todo de 44 px", async ({ page }) => {
  await page.goto("/explorar/filtros?min=200000&max=100000");
  const min = page.getByLabel("Precio mínimo por noche");
  await expect(page.locator(".affix", { has: min }).locator(".affix-sign")).toHaveText("₡");
  await expect(min).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator(".counter .stepper button").first()).toBeVisible();
  await expect(min).toHaveAccessibleDescription("El precio mínimo no puede ser mayor que el máximo.");
  await expectHit(page.locator(".counter .stepper button"), "contadores de Filtros");

  await injectSession(page, "owner");
  await page.goto(`/propietario/calendario?casa=${casa.id}`);
  await expect(page.getByRole("group", { name: "Moneda de los precios" })).toBeVisible();
  await expectHit(page.getByRole("group", { name: "Moneda de los precios" }).getByRole("button"), "₡ | $");
  await page.locator(".cal-month-block").first().getByRole("button", { name: /disponible|\d/ }).last().click();
  const availability = page.getByRole("group", { name: "Disponibilidad" });
  await expect(availability).toHaveClass(/\bseg\b/);
  await expectHit(availability.getByRole("button"), "Disponible | Ocupado");
});
