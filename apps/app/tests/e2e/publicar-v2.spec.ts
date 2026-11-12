import { expect, test, type Page } from "./helpers/test";
import type { ListingsHarness } from "../contract/harness";
import { serviceClient, sql, TEST_PHONES } from "../db/local";
import { deleteAccount, FREE_PHONE, INTL_PHONE } from "../db/postgrest-auth-harness";
import { postgrestHarness } from "../db/postgrest-harness";
import { EMAIL_SKIPPED_KEY } from "../../src/domain/publish-return";
import { userIdOf } from "./helpers/admin";
import { enterCode, injectSession } from "./helpers/session";

// Publicar v2 (decisiones §E): la cuenta nueva pregunta por la casa y la verificación desde publicar habla de guardar la
// casa. Contra Supabase local con los números de prueba (código 123456).
test.describe.configure({ mode: "serial" });

const READY = "¡Listo! Su cuenta está creada";
const STEP1_KEY = "3bstays-publicar-paso1";
const UUID = "[0-9a-f-]{36}";
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
let h: ListingsHarness;

test.beforeAll(async () => {
  h = await postgrestHarness();
});

test.beforeEach(async ({ page }) => {
  await h.reset();
  await page.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
});

/** Las casas de una cuenta, leídas con la clave de servicio. */
async function listingsOf(phone: string) {
  const { data, error } = await serviceClient().from("listings").select("id, status, kind").eq("owner_id", await userIdOf(phone)).order("created_at");
  if (error) throw error;
  return data;
}

async function register(page: Page, phone: string, name: string, country?: string) {
  if (country) await page.getByLabel("País de su WhatsApp").selectOption({ label: country });
  await page.getByLabel("Número de WhatsApp").fill(phone);
  await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();
  await page.getByLabel("Nombre").fill(name);
  await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();
  await enterCode(page);
}

test("una cuenta nueva desde Ingresar responde Sí y entra al asistente", async ({ page }) => {
  await deleteAccount(FREE_PHONE);
  try {
    await page.goto("/explorar");
    await page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", { name: "Ingresar" }).click();
    await register(page, "8888 9999", "Ana Prueba");
    await expect(page).toHaveURL(/\/cuenta\/lista/);
    await expect(page.getByRole("heading", { name: READY })).toBeVisible();
    await expect(page.getByRole("heading", { name: "¿Tiene una casa para alquilar?" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Añadir un correo de recuperación" })).toBeVisible();
    await page.getByRole("link", { name: "Sí, quiero publicarla" }).click();
    await expect(page).toHaveURL(/\/propietario\/publicar\/[0-9a-f-]{36}\/1$/);
  } finally {
    await deleteAccount(FREE_PHONE);
  }
});

test("otra cuenta nueva responde No y va a Explorar", async ({ page }) => {
  await deleteAccount(INTL_PHONE);
  try {
    await page.goto("/explorar");
    await page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", { name: "Ingresar" }).click();
    await register(page, "+1 415 555 0100", "John Test", "Otro país");
    await expect(page).toHaveURL(/\/cuenta\/lista/);
    await expect(page.getByRole("heading", { name: "¿Tiene una casa para alquilar?" })).toBeVisible();
    await page.getByRole("link", { name: "No, busco casa" }).click();
    await expect(page).toHaveURL(/\/explorar$/);
  } finally {
    await deleteAccount(INTL_PHONE);
  }
});

test("verificar desde publicar habla de subir las fotos y nunca pasa por «¡Listo!»", async ({ page }) => {
  await deleteAccount(FREE_PHONE);
  try {
    await page.goto(`/cuenta?next=${encodeURIComponent("/publicar/continuar")}`);
    await expect(page.getByRole("heading", { name: "Para subir las fotos, verifique su WhatsApp" })).toBeVisible();
    await expect(page.getByText("Lo que ya escribió se guarda. Le enviamos un código por WhatsApp: así nadie más puede publicar en su nombre.")).toBeVisible();
    await expect(page.getByText(/Su número solo se comparte con el anfitrión/)).toHaveCount(0);
    await expect(page.getByTestId("return-card")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "No tengo acceso a mi WhatsApp" })).toBeVisible();
    await page.getByLabel("Número de WhatsApp").fill("8888 9999");
    await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();
    await expect(page.getByRole("heading", { name: "Es su primera vez en 3bstays" })).toBeVisible();
    await page.getByLabel("Nombre").fill("Ana Prueba");
    await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();
    await expect(page).toHaveURL(/\/cuenta\/codigo\?next=%2Fpublicar%2Fcontinuar$/);
    await expect(page.getByRole("heading", { level: 1, name: "Publicar casa" })).toBeVisible();
    await expect(page.getByText("Después seguimos con su casa")).toBeVisible();
    await expect(page.getByText(/Después de verificar vuelve/)).toHaveCount(0);
    await enterCode(page);
    // Sin respuesta del paso 1 guardada, /publicar/continuar sigue a la entrada de siempre (crea el borrador, paso 1).
    await expect(page).toHaveURL(new RegExp(`/propietario/publicar/${UUID}/1$`));
    await expect(page.getByRole("heading", { name: READY })).toHaveCount(0);
  } finally {
    await deleteAccount(FREE_PHONE);
  }
});

test("un enlace viejo a «¡Listo!» con la vuelta a publicar sigue hacia ella", async ({ page }) => {
  await deleteAccount(FREE_PHONE);
  try {
    await page.goto("/cuenta");
    await register(page, "8888 9999", "Ana Prueba");
    await expect(page).toHaveURL(/\/cuenta\/lista/);
    await page.goto(`/cuenta/lista?next=${encodeURIComponent("/publicar/continuar")}`);
    await expect(page).toHaveURL(new RegExp(`/propietario/publicar/${UUID}/1$`));
    await expect(page.getByRole("heading", { name: READY })).toHaveCount(0);
  } finally {
    await deleteAccount(FREE_PHONE);
  }
});

// §E.3, desde el 2026-11-04 (Ana): /publicar sin cuenta hasta las fotos. Los pasos 1–6 se responden en el teléfono, el
// WhatsApp se verifica al llegar a las Fotos y la casa se crea con todo al volver, en las Fotos.
const DRAFT_KEY = "3bstays-publicar-borrador";
const DESCRIPTION = "Cabina de madera a 80 m de la playa, con rancho, hamacas y un jardín grande donde se ven monos.";
const continuar = (page: Page) => page.getByRole("button", { name: "Continuar" }).click();

/** Los pasos 2–6 sin cuenta: el pin (Limón a zoom 9, 10 px al oeste del centro, en tierra), 2 personas, Wifi, nombre y
 *  descripción. Sin una sola petición a la cuenta. */
async function stepsTwoToSix(page: Page) {
  await expect(page).toHaveURL(/\/publicar\/nueva\/2$/);
  await expect(page.getByRole("heading", { name: "¿Dónde está su casa?" })).toBeVisible();
  await expect(page.locator(".map-box.leaflet-container")).toBeVisible();
  const map = (await page.locator(".map-box").boundingBox())!;
  await page.mouse.click(map.x + map.width / 2 - 10, map.y + map.height / 2);
  await expect(page.getByRole("combobox", { name: "Zona" }).locator("option:checked")).toHaveAttribute("value", /^list:701-/);
  await continuar(page);
  await expect(page).toHaveURL(/\/publicar\/nueva\/4$/);
  await page.getByRole("button", { name: "Más personas" }).click();
  await page.getByRole("button", { name: "Más personas" }).click();
  await continuar(page);
  await expect(page).toHaveURL(/\/publicar\/nueva\/5$/);
  await page.getByText("Wifi", { exact: true }).click();
  await continuar(page);
  await expect(page).toHaveURL(/\/publicar\/nueva\/6$/);
  await page.getByLabel("Nombre de la casa").fill("Cabina Cocles");
  await page.getByLabel("Descripción").fill(DESCRIPTION);
  await continuar(page);
}

test("desde la portada sin cuenta: pasos 1–6 en el teléfono, verificación al llegar a las Fotos y la casa con todo", async ({ page }) => {
  await deleteAccount(FREE_PHONE);
  try {
    const account: string[] = [];
    page.on("request", (r) => /\/(rest\/v1\/(listings|profiles)|auth\/v1\/token)/.test(r.url()) && account.push(r.url()));
    await page.goto("/?pronto=1");
    await page.getByRole("link", { name: "Publicar mi casa" }).click();
    await expect(page).toHaveURL(/\/publicar$/);
    await expect(page.getByRole("heading", { name: "¿Qué es?" })).toBeVisible();
    await expect(page.locator(".stage-label")).toHaveText("1 de 4");
    await expect(page.locator(".ready-list")).toBeVisible();
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.locator('.note[role="alert"]')).toHaveText("Elija Alojamiento completo o Habitación.");
    await page.locator("label.choice", { hasText: "Habitación" }).click();
    await continuar(page);
    // «Atrás» desde el paso 2 vuelve a la entrada con el tipo elegido.
    await expect(page).toHaveURL(/\/publicar\/nueva\/2$/);
    await page.getByRole("link", { name: "Atrás" }).click();
    await expect(page).toHaveURL(/\/publicar$/);
    await expect(page.locator('label.choice[aria-pressed="true"]')).toHaveText(/Habitación/);
    await continuar(page);
    await stepsTwoToSix(page);
    expect(account, "sin cuenta no se toca la red de la cuenta").toEqual([]);

    await expect(page).toHaveURL(/\/publicar\/verificar$/);
    await expect(page.getByRole("heading", { name: "Para subir las fotos, verifique su WhatsApp" })).toBeVisible();
    await expect(page.locator(".stage-label")).toHaveText(/^Fotos/);
    await page.getByLabel("Número de WhatsApp").fill("8888 9999");
    await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();
    await page.getByLabel("Nombre").fill("Ana Prueba");
    await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();
    await expect(page).toHaveURL(/\/cuenta\/codigo\?next=%2Fpublicar%2Fcontinuar$/);
    // Lo escrito sigue guardado hasta que la casa existe.
    expect(await page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY)).not.toBeNull();
    await enterCode(page);
    await expect(page).toHaveURL(new RegExp(`/propietario/publicar/${UUID}/7$`));
    await expect(page.locator(".photos-grid")).toBeVisible();
    expect(await page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY)).toBeNull();
    await expect(page.getByRole("heading", { name: READY })).toHaveCount(0);
    // Exactamente una casa (un solo intento por visita), con todo lo de los pasos 1–6.
    await page.waitForTimeout(500);
    const mine = await listingsOf(FREE_PHONE);
    expect(mine.map((l) => [l.status, l.kind])).toEqual([["draft", "habitacion"]]);
    expect(page.url()).toContain(mine[0]!.id);
    const { data } = await serviceClient().from("listings").select("title, description, capacity, bedrooms, features, province, zone_source, lat").eq("id", mine[0]!.id).single();
    expect(data).toMatchObject({ title: "Cabina Cocles", description: DESCRIPTION, capacity: 2, bedrooms: 1, features: ["wifi"], province: "Limón", zone_source: "list" });
    expect(data!.lat).not.toBeNull();
  } finally {
    await deleteAccount(FREE_PHONE);
  }
});

test("sin cuenta, cerrar a medias guarda lo escrito: al volver sigue ahí; las Fotos piden el código", async ({ page }) => {
  await page.goto("/publicar");
  await page.locator("label.choice", { hasText: "Alojamiento completo" }).click();
  await continuar(page);
  await expect(page).toHaveURL(/\/publicar\/nueva\/2$/);
  // La dirección cambia antes de que llegue el trozo del asistente: se espera a la pantalla, no al «Continuar» de antes.
  await expect(page.getByRole("heading", { name: "¿Dónde está su casa?" })).toBeVisible();
  await continuar(page); // sin pin también se sigue
  await expect(page).toHaveURL(/\/publicar\/nueva\/4$/);
  await expect(page.getByRole("heading", { name: "¿Cuántos caben?" })).toBeVisible();
  await page.getByRole("button", { name: "Más personas" }).click();
  await continuar(page);
  await expect(page).toHaveURL(/\/publicar\/nueva\/5$/);
  await page.getByRole("button", { name: /Cerrar/ }).click();
  await expect(page).toHaveURL(/\/explorar/);
  await page.goto("/publicar/nueva/4");
  await expect(page.getByText("1", { exact: true }).first()).toBeVisible();
  await expect.poll(() => page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).draft.capacity, DRAFT_KEY)).toBe(1);
  // Las Fotos y lo que sigue no se abren sin cuenta: llevan a verificar el WhatsApp.
  await page.goto("/publicar/nueva/7");
  await expect(page).toHaveURL(/\/publicar\/verificar$/);
  await page.goto("/publicar/nueva/9");
  await expect(page).toHaveURL(/\/publicar\/verificar$/);
  // El paso 1 y un id que no es el del teléfono, a la entrada.
  await page.goto("/publicar/nueva/1");
  await expect(page).toHaveURL(/\/publicar$/);
  await page.goto("/publicar/otra/2");
  await expect(page).toHaveURL(/\/publicar$/);
  // Lo de hace más de 7 días ya no se usa.
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ draft: { kind: "completo", capacity: 3 }, savedAt: 0 })), DRAFT_KEY);
  await page.goto("/publicar/verificar");
  await expect(page).toHaveURL(/\/publicar$/);
});

test("con sesión, un paso del teléfono sigue a /publicar/continuar y crea la casa con lo escrito", async ({ page }) => {
  await injectSession(page, "owner");
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ draft: { kind: "completo", capacity: 3, title: "Casa del teléfono" }, savedAt: Date.now() })), DRAFT_KEY);
  await page.goto("/publicar/nueva/4");
  await expect(page).toHaveURL(new RegExp(`/propietario/publicar/${UUID}/7$`));
  const mine = await listingsOf(TEST_PHONES.owner);
  const created = mine.find((l) => page.url().includes(l.id))!;
  expect((await h.owner("owner").getOwn(created.id))).toMatchObject({ kind: "completo", capacity: 3, title: "Casa del teléfono" });
});

test("con un borrador ya empezado, elige; «Empezar otra» usa lo guardado", async ({ page }) => {
  const seeded = await h.seed({ status: "draft" });
  await page.goto("/publicar");
  await page.locator("label.choice", { hasText: "Alojamiento completo" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/publicar\/nueva\/2$/);
  await page.goto("/publicar/nueva/7");
  await expect(page).toHaveURL(/\/publicar\/verificar$/);
  await page.getByLabel("Número de WhatsApp").fill("8777 0001");
  await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();
  await enterCode(page);
  await expect(page.getByText("Tiene un borrador sin enviar")).toBeVisible();
  await expect(page.getByRole("link", { name: "Seguir con el borrador" })).toBeVisible();
  await page.getByRole("button", { name: "Empezar otra" }).click();
  await expect(page).toHaveURL(new RegExp(`/propietario/publicar/${UUID}/7$`));
  expect(page.url()).not.toContain(seeded.id);
  expect(await page.evaluate((k) => localStorage.getItem(k), STEP1_KEY)).toBeNull();
  expect(await page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY)).toBeNull();
  const mine = await listingsOf(TEST_PHONES.owner);
  expect(mine).toHaveLength(2);
  const created = mine.find((l) => l.id !== seeded.id)!;
  expect([created.status, created.kind]).toEqual(["draft", "completo"]);
  expect(page.url()).toContain(created.id);
});

test("con sesión, /publicar lleva al asistente de siempre", async ({ page }) => {
  await injectSession(page, "owner");
  await page.goto("/publicar");
  await expect(page).toHaveURL(new RegExp(`/propietario/publicar/${UUID}/1$`));
});

test("un paso 1 caducado no se usa", async ({ page }) => {
  await injectSession(page, "owner");
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ kind: "habitacion", savedAt: 0 })), STEP1_KEY);
  await page.goto("/publicar/continuar");
  await expect(page).toHaveURL(new RegExp(`/propietario/publicar/${UUID}/1$`));
  await expect(page.locator('label.choice[aria-pressed="true"]')).toHaveCount(0);
});

test("sin respuesta guardada, /publicar/verificar vuelve al paso 1; con sesión, sigue a /publicar/continuar", async ({ page }) => {
  await page.goto("/publicar/verificar");
  await expect(page).toHaveURL(/\/publicar$/);
  await expect(page.getByRole("heading", { name: "¿Qué es?" })).toBeVisible();
  await injectSession(page, "owner");
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ kind: "completo", savedAt: Date.now() })), STEP1_KEY);
  await page.goto("/publicar/verificar");
  await expect(page).toHaveURL(new RegExp(`/propietario/publicar/${UUID}/2$`));
});

test("una recarga entre crear la casa y guardar el tipo usa ese borrador vacío", async ({ page }) => {
  const orphan = await h.owner("owner").createDraft();
  await injectSession(page, "owner");
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ kind: "habitacion", savedAt: Date.now() })), STEP1_KEY);
  await page.goto("/publicar/continuar");
  await expect(page).toHaveURL(new RegExp(`/propietario/publicar/${orphan.id}/2$`));
  await expect(page.getByText("Tiene un borrador sin enviar")).toHaveCount(0);
  expect((await listingsOf(TEST_PHONES.owner)).map((l) => [l.id, l.kind])).toEqual([[orphan.id, "habitacion"]]);
});

test("un borrador vacío con fecha del futuro (reloj desfasado) no se toma por el de una recarga", async ({ page }) => {
  const orphan = await h.owner("owner").createDraft();
  sql(`begin; select set_config('app.allow_status','on',true); update public.listings set created_at = now() + interval '1 day' where id = '${orphan.id}'; commit;`);
  await injectSession(page, "owner");
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ kind: "habitacion", savedAt: Date.now() })), STEP1_KEY);
  await page.goto("/publicar/continuar");
  await expect(page.getByText("Tiene un borrador sin enviar")).toBeVisible();
  expect((await listingsOf(TEST_PHONES.owner)).map((l) => [l.id, l.kind])).toEqual([[orphan.id, null]]);
});

// ---------- «¿Quiere añadir un correo?» tras enviar ----------

const ownerEmail = () => sql(`select coalesce(email, '') from public.profiles where phone = '${TEST_PHONES.owner}'`);
const setOwnerEmail = (email: string) => sql(`update public.profiles set email = ${email ? `'${email}'` : "null"} where phone = '${TEST_PHONES.owner}'`);

/** Una casa completa con una sola foto y sin descripción, lista para enviar desde el paso 9. */
async function sendFromStep9(page: Page) {
  const { id } = await h.seed({ status: "draft", photos: 1, draft: { description: "" } });
  await page.goto(`/propietario/publicar/${id}/9`);
  await page.getByRole("button", { name: "Enviar a revisión" }).click();
  return id;
}

test("envía con una foto y sin descripción; el correo se puede saltar una vez", async ({ page }) => {
  const before = ownerEmail();
  setOwnerEmail("");
  try {
    await injectSession(page, "owner", { askEmail: true });
    const first = await sendFromStep9(page);
    await expect(page).toHaveURL(new RegExp(`/propietario/casas/${first}/correo$`));
    await expect(page.getByRole("heading", { name: "¿Quiere añadir un correo?" })).toBeVisible();
    await page.getByRole("button", { name: "Ahora no" }).click();
    await expect(page).toHaveURL(new RegExp(`/propietario/casas/${first}/enviada$`));
    expect(await page.evaluate((k) => localStorage.getItem(k), EMAIL_SKIPPED_KEY)).toBe("1");
    const second = await sendFromStep9(page);
    await expect(page).toHaveURL(new RegExp(`/propietario/casas/${second}/enviada$`));
  } finally {
    setOwnerEmail(before);
  }
});

test("si no se puede leer la cuenta tras enviar, la casa enviada se muestra igual, sin la pregunta del correo", async ({ page }) => {
  const before = ownerEmail();
  setOwnerEmail("");
  try {
    await injectSession(page, "owner", { askEmail: true });
    await page.route("**/rest/v1/profiles*", (route) => (route.request().method() === "GET" ? route.fulfill({ status: 500, body: "{}" }) : route.continue()));
    const id = await sendFromStep9(page);
    await expect(page).toHaveURL(new RegExp(`/propietario/casas/${id}/enviada$`));
    expect((await h.owner("owner").getOwn(id))?.status).toBe("review");
  } finally {
    setOwnerEmail(before);
  }
});

test("si la cuenta tarda en leerse tras enviar, pasa a la casa enviada sin esperarla", async ({ page }) => {
  const before = ownerEmail();
  setOwnerEmail("");
  try {
    await injectSession(page, "owner", { askEmail: true });
    await page.route("**/rest/v1/profiles*", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      await new Promise((r) => setTimeout(r, 8000));
      await route.continue().catch(() => undefined);
    });
    const id = await sendFromStep9(page);
    await expect(page).toHaveURL(new RegExp(`/propietario/casas/${id}/enviada$`), { timeout: 5000 });
  } finally {
    setOwnerEmail(before);
  }
});

test("guarda el correo desde la pregunta de después de enviar", async ({ page }) => {
  const before = ownerEmail();
  setOwnerEmail("");
  try {
    await injectSession(page, "owner", { askEmail: true });
    const id = await sendFromStep9(page);
    await expect(page).toHaveURL(new RegExp(`/propietario/casas/${id}/correo$`));
    await page.getByRole("button", { name: "Guardar correo" }).click();
    await expect(page.getByText("Escriba su correo o toque «Ahora no».")).toBeVisible();
    await expect(page.locator("#pub-email")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Correo")).toHaveAccessibleDescription(/Escriba su correo o toque «Ahora no»\./);
    await page.getByLabel("Correo").fill("ana@");
    await page.getByRole("button", { name: "Guardar correo" }).click();
    await expect(page.getByText("Ese correo no parece válido.")).toBeVisible();
    await page.getByLabel("Correo").fill("ana@ejemplo.cr");
    await page.getByRole("button", { name: "Guardar correo" }).click();
    await expect(page).toHaveURL(new RegExp(`/propietario/casas/${id}/enviada$`));
    expect(ownerEmail()).toBe("ana@ejemplo.cr");
  } finally {
    setOwnerEmail(before);
  }
});
