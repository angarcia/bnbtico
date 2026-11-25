import { expect, test, type Locator, type Page } from "./helpers/test";
import { userIdOf } from "./helpers/admin";
import { deleteAccount, FREE_PHONE, INTL_PHONE } from "../db/postgrest-auth-harness";
import { BUILD_FLAGS } from "./helpers/flags";
import { serviceClient, TEST_PHONES } from "../db/local";
import { postgrestHarness } from "../db/postgrest-harness";

// Ingresar en escritorio es una ventana sobre la página. Al verificar el código (correcto), la ventana se cierra con la sesión
// iniciada; antes se quedaba abierta con «Solicite un código nuevo para continuar.» (Ana, 2026-11-17).
test.beforeAll(async () => {
  await (await postgrestHarness()).reset();
});

test("en escritorio, verificar el código cierra la ventana de Ingresar con la sesión iniciada", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/explorar");
  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  await nav.getByRole("button", { name: "Ingresar" }).click();
  const dialog = page.getByRole("dialog", { name: "Ingresar" });
  await dialog.getByLabel("Número de WhatsApp").fill(TEST_PHONES.other.replace(/^\+506/, ""));
  await dialog.getByRole("button", { name: /Recibir código/ }).click();
  await dialog.getByLabel("Código de 6 dígitos").fill("123456");
  await dialog.getByRole("button", { name: "Verificar y continuar" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Solicite un código nuevo para continuar.")).toHaveCount(0);
  await expect(page).toHaveURL(/\/explorar$/);
  await expect(nav.getByRole("button", { name: "Ingresar" })).toHaveCount(0);
});

// ---------- Historia 02 (revision-app-20261117.02): los demás escenarios ----------

const NEW_CODE = "Solicite un código nuevo para continuar.";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Vigila el documento desde que carga: anota si el texto aparece en algún momento, aunque sea un instante. */
async function watchForText(page: Page, text: string) {
  await page.addInitScript((t) => {
    const w = window as unknown as { __seen?: boolean };
    w.__seen = false;
    const check = () => { if (document.body?.textContent?.includes(t)) w.__seen = true; };
    new MutationObserver(check).observe(document, { subtree: true, childList: true, characterData: true });
  }, text);
  return () => page.evaluate(() => (window as unknown as { __seen?: boolean }).__seen === true);
}

async function openSignIn(page: Page, path = "/explorar") {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(path);
  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  await nav.getByRole("button", { name: "Ingresar" }).click();
  return { nav, dialog: page.getByRole("dialog", { name: "Ingresar" }) };
}

async function requestCode(dialog: Locator, phone = TEST_PHONES.other.replace(/^\+506/, "")) {
  await dialog.getByLabel("Número de WhatsApp").fill(phone);
  await dialog.getByRole("button", { name: /Recibir código/ }).click();
}

for (const slow of [
  { listings: 2_000, profiles: 7_000, label: "la cuenta tarda más de 5 s y las casas menos" },
  { listings: 7_000, profiles: 2_000, label: "las casas tardan más de 5 s y la cuenta menos" },
]) {
  test(`en escritorio, con respuestas lentas (${slow.label}) la ventana se cierra con sesión y sin pedir otro código`, async ({ page }) => {
    test.setTimeout(60_000);
    const seen = await watchForText(page, NEW_CODE);
    const { nav, dialog } = await openSignIn(page);
    await requestCode(dialog);
    await dialog.getByLabel("Código de 6 dígitos").fill("123456");
    const delayed: string[] = [];
    await page.route(/\/rest\/v1\/listings\?/, async (route) => { delayed.push("listings"); await sleep(slow.listings); await route.continue(); });
    await page.route(/\/rest\/v1\/profiles\?/, async (route) => { delayed.push("profiles"); await sleep(slow.profiles); await route.continue(); });
    await dialog.getByRole("button", { name: "Verificar y continuar" }).click();
    // Mientras dura la espera, nunca «Solicite un código nuevo» ni el formulario del número.
    const until = Date.now() + Math.max(slow.listings, slow.profiles) + 1_000;
    while (Date.now() < until && (await dialog.count()) > 0) {
      await expect(page.getByText(NEW_CODE)).toHaveCount(0);
      await page.waitForTimeout(150);
    }
    await expect(dialog).toBeHidden({ timeout: 15_000 });
    expect(delayed, "las peticiones lentas sí pasaron por la espera").toEqual(expect.arrayContaining(["listings", "profiles"]));
    expect(await seen(), "el texto no aparece en ningún momento").toBe(false);
    await expect(page).toHaveURL(/\/explorar$/);
    await expect(nav.getByRole("button", { name: "Ingresar" })).toHaveCount(0);
    // No pide verificar otra vez: sin ventana ni campo de código, también un rato después y tras recargar.
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await page.waitForTimeout(1_000);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByLabel("Código de 6 dígitos")).toHaveCount(0);
    await page.reload();
    await expect(nav.getByRole("button", { name: "Ingresar" })).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
}

// Con casas, al ingresar la barra pasa a cinco pestañas y se leen las consultas; la ventana se cierra igual. (El 2026-11-25
// Ana volvió a ver «Solicite un código nuevo», pero con una versión del 17 de noviembre, anterior al arreglo, que seguía
// en su navegador porque no había tocado «Actualizar».)
test("en escritorio, una cuenta con casas ingresa desde Explorar y la ventana se cierra sin pedir otro código", async ({ page }) => {
  test.setTimeout(60_000);
  const h = await postgrestHarness();
  await h.seed({ status: "active", draft: { title: "Casa para ingresar" } });
  await h.seed({ status: "active", draft: { title: "Otra casa para ingresar" } });
  const seen = await watchForText(page, NEW_CODE);
  const { nav, dialog } = await openSignIn(page);
  await requestCode(dialog, TEST_PHONES.owner.replace(/^\+506/, ""));
  await dialog.getByLabel("Código de 6 dígitos").fill("123456");
  await dialog.getByRole("button", { name: "Verificar y continuar" }).click();
  await expect(dialog).toBeHidden({ timeout: 15_000 });
  await expect(nav.getByRole("link", { name: "Calendario" })).toBeVisible();
  await page.waitForTimeout(1_500);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await seen(), "el texto no aparece en ningún momento").toBe(false);
  await expect(page).toHaveURL(/\/explorar$/);
});

test("en escritorio, un código incorrecto muestra el error y la ventana sigue abierta; con el bueno, entra", async ({ page }) => {
  const { nav, dialog } = await openSignIn(page);
  await requestCode(dialog);
  await dialog.getByLabel("Código de 6 dígitos").fill("000000");
  await dialog.getByRole("button", { name: "Verificar y continuar" }).click();
  await expect(dialog.getByText("Ese código no es correcto o caducó.")).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(NEW_CODE)).toHaveCount(0);
  await expect(nav.getByRole("button", { name: "Ingresar" })).toBeVisible();
  await dialog.getByLabel("Código de 6 dígitos").fill("123456");
  await dialog.getByRole("button", { name: "Verificar y continuar" }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/explorar$/);
  await expect(nav.getByRole("button", { name: "Ingresar" })).toHaveCount(0);
});

test("en escritorio, Ingresar desde Favoritos vuelve a Favoritos (destino explícito)", async ({ page }) => {
  const { nav, dialog } = await openSignIn(page, "/favoritos");
  await requestCode(dialog);
  await dialog.getByLabel("Código de 6 dígitos").fill("123456");
  await dialog.getByRole("button", { name: "Verificar y continuar" }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/favoritos$/);
  await expect(page.getByText(NEW_CODE)).toHaveCount(0);
  await expect(nav.getByRole("button", { name: "Ingresar" })).toHaveCount(0);
});

test("en escritorio, entra una cuenta nueva con un WhatsApp de EE. UU./Canadá (+1)", async ({ page }) => {
  await deleteAccount(INTL_PHONE);
  try {
    const { nav, dialog } = await openSignIn(page);
    await dialog.getByLabel("País de su WhatsApp").selectOption({ label: "Estados Unidos / Canadá (+1)" });
    await requestCode(dialog, "415 555 0100");
    await dialog.getByLabel("Nombre").fill("John Test");
    await dialog.getByRole("button", { name: /Recibir código/ }).click();
    await dialog.getByLabel("Código de 6 dígitos").fill("123456");
    await dialog.getByRole("button", { name: "Verificar y continuar" }).click();
    await expect(dialog).toBeHidden();
    // Cuenta nueva: «¡Listo!» pregunta si tiene una casa para alquilar.
    await expect(page).toHaveURL(/\/cuenta\/lista/);
    await expect(page.getByRole("heading", { name: "¿Tiene una casa para alquilar?" })).toBeVisible();
    await expect(page.getByText(NEW_CODE)).toHaveCount(0);
    await expect(nav.getByRole("button", { name: "Ingresar" })).toHaveCount(0);
    expect(await userIdOf(INTL_PHONE)).toBeTruthy();
  } finally {
    await deleteAccount(INTL_PHONE);
  }
});

const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
const DRAFT_KEY = "3bstays-publicar-borrador";

test("en escritorio, publicar sin cuenta pide el WhatsApp en la ventana al llegar a las Fotos y sigue a la casa creada con lo escrito", async ({ page }) => {
  test.setTimeout(60_000);
  await deleteAccount(FREE_PHONE);
  try {
    await page.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/publicar");
    // En escritorio, lo de antes de las Fotos va en una sola pantalla (tipo, personas, características y mapa).
    await expect(page).toHaveURL(/\/publicar\/nueva\/\d$/);
    await expect(page.locator(".publish-step-columns")).toBeVisible();
    if (BUILD_FLAGS.rooms) await page.locator("label.choice", { hasText: "Alojamiento completo" }).click();
    await expect(page.locator(".map-box.leaflet-container")).toBeVisible();
    const map = (await page.locator(".map-box").boundingBox())!;
    await page.mouse.click(map.x + map.width / 2 - 10, map.y + map.height / 2);
    await expect(page.locator('input[name="zoneId"]')).toHaveValue(/^701-/);
    await page.getByRole("button", { name: "Una persona más" }).click();
    await page.getByRole("button", { name: "Una persona más" }).click();
    await page.getByText("Wifi", { exact: true }).click();
    await page.getByRole("button", { name: "Continuar" }).click();

    const dialog = page.getByRole("dialog", { name: "Verificar WhatsApp" });
    await expect(dialog).toBeVisible();
    expect(await page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY)).not.toBeNull();
    await requestCode(dialog, "8888 9999");
    await dialog.getByLabel("Nombre").fill("Ana Prueba");
    await dialog.getByRole("button", { name: /Recibir código/ }).click();
    await dialog.getByLabel("Código de 6 dígitos").fill("123456");
    await dialog.getByRole("button", { name: "Verificar y continuar" }).click();
    await expect(dialog).toBeHidden();
    // Sigue a /publicar/continuar, que crea la casa con lo escrito y abre las Fotos; sin «¡Listo!» ni otro código.
    await expect(page).toHaveURL(/\/propietario\/publicar\/[0-9a-f-]{36}\/7$/);
    await expect(page.getByText(NEW_CODE)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "¡Listo! Su cuenta está creada" })).toHaveCount(0);
    expect(await page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY)).toBeNull();
    await page.waitForTimeout(500);
    const { data, error } = await serviceClient().from("listings").select("id, status, capacity, features, province, lat").eq("owner_id", await userIdOf(FREE_PHONE));
    if (error) throw error;
    expect(data).toHaveLength(1);
    expect(page.url()).toContain(data[0]!.id);
    expect(data[0]).toMatchObject({ status: "draft", capacity: 2, features: ["wifi"], province: "Limón" });
    expect(data[0]!.lat).not.toBeNull();
  } finally {
    await deleteAccount(FREE_PHONE);
  }
});
