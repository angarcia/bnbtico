import { messagePreview, pickDates } from "./helpers/contact-sheet";
import { expect, test, type Page } from "./helpers/test";
import type { Seeded } from "../contract/harness";
import { sql, TEST_PHONES } from "../db/local";
import { postgrestHarness } from "../db/postgrest-harness";
import { injectSession } from "./helpers/session";
import { backFromWhatsApp, catchWhatsApp, waExpected } from "./helpers/whatsapp";

// Fase 3, ticket 04: con sesión, «Abrir WhatsApp» registra la consulta (create_inquiry) y abre wa.me con el número de la
// casa, que solo entrega esa RPC. Contra Supabase local; las sesiones se inyectan (sin gastar SMS).
test.describe.configure({ mode: "serial" });

const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
const TITLE = "Casa Playa Negra";
/** WhatsApp propio de la segunda casa, distinto del perfil del propietario (lo pone el servicio en la base). */
const HOUSE_PHONE = "+50660001234";
let h: Awaited<ReturnType<typeof postgrestHarness>>;
let casa: Seeded;
let otra: Seeded;
let owner: string;

const day = (days: number) => new Date(Date.now() - 6 * 3_600_000 + days * 86_400_000).toISOString().slice(0, 10);
const sheet = (page: Page) => page.getByRole("dialog", { name: `Escríbale a ${owner}` });
const openButton = (page: Page) => sheet(page).getByRole("button", { name: /Abrir WhatsApp|Abriendo WhatsApp/ });
const digits = (e164: string) => e164.replace(/\D/g, "").slice(3);
const inquiries = (publicId: string, cols: string) =>
  sql(`select ${cols} from public.inquiries i join public.listings l on l.id = i.listing_id where l.public_id = '${publicId}'`);

test.beforeAll(async () => {
  h = await postgrestHarness();
  await h.reset();
  casa = await h.seed({ status: "active", photos: 5, draft: { title: TITLE, zone: "Playa Negra", zoneSource: "other", zoneId: null, nightlyPriceCrc: 95000, capacity: 6 } });
  otra = await h.seed({ status: "active", photos: 5, draft: { title: "Cabina Cocles", zone: "Cocles", zoneSource: "other", zoneId: null } });
  sql(`begin; set local app.allow_status = 'on'; update public.listings set whatsapp_phone = '${HOUSE_PHONE}' where id = '${otra.id}'; commit;`);
  owner = h.ownerName("owner").split(" ")[0]!;
});

test.beforeEach(async ({ page }) => {
  await page.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
});

async function openSheet(page: Page, publicId: string) {
  await page.goto(`/casa/${publicId}`);
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  await page.getByRole("button", { name: "Contactar por WhatsApp" }).click();
  await expect(sheet(page)).toBeVisible();
}

/** Todo lo que el navegador guarda de este origen (localStorage, sessionStorage, IndexedDB), como texto. */
function storedEverywhere(page: Page): Promise<string> {
  return page.evaluate(async () => {
    let out = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage });
    for (const { name } of await indexedDB.databases()) {
      if (!name) continue;
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(name);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      for (const store of Array.from(db.objectStoreNames)) {
        const all = await new Promise<unknown[]>((resolve, reject) => {
          const req = db.transaction(store).objectStore(store).getAll();
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        out += JSON.stringify(all);
      }
      db.close();
    }
    return out;
  });
}

test("cliente con sesión: «Abriendo…» al instante, un solo vuelo, wa.me exacto, consulta en la base y la ficha sin la hoja al volver", async ({ page }) => {
  const since = sql("select now()::text");
  // El número de la casa no está en el HTML de la ficha.
  const html = await (await page.request.get(`/casa/${casa.publicId}`)).text();
  expect(html).toContain(TITLE);
  expect(html).not.toContain(digits(TEST_PHONES.owner));

  await injectSession(page, "other");
  await openSheet(page, casa.publicId);
  const s = sheet(page);
  const [a, b] = [day(30), day(37)];
  await pickDates(s, a, b);
  await s.getByLabel("Personas (opcional)").fill("3");
  await s.getByLabel("Personas (opcional)").blur();
  await expect(s).not.toHaveClass(/\bkb\b/);
  const text = (await messagePreview(s).textContent())!;

  // La RPC tarda: se ve «Abriendo WhatsApp…» y un doble toque no hace dos llamadas.
  const rpc: string[] = [];
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route("**/rest/v1/rpc/create_inquiry", async (route) => {
    rpc.push(route.request().url());
    await held;
    await route.continue();
  });
  const wa = await catchWhatsApp(page);
  const tap = await openButton(page).evaluate(async (el) => {
    const t = performance.now();
    (el as HTMLButtonElement).click();
    (el as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 0));
    return { ms: performance.now() - t, busy: el.getAttribute("aria-busy"), text: el.textContent };
  });
  expect(tap).toMatchObject({ busy: "true" });
  expect(tap.text?.trim()).toBe("Abriendo WhatsApp…");
  expect(tap.ms).toBeLessThan(50);
  await expect.poll(() => rpc.length).toBe(1);
  await openButton(page).click({ force: true }); // otro toque mientras espera
  await page.screenshot({ path: "test-results/contacto-abriendo.png" });
  release();

  await expect.poll(() => wa).toEqual([waExpected(TEST_PHONES.owner, text)]);
  expect(rpc).toHaveLength(1);
  expect(inquiries(casa.publicId, "i.arrival, i.departure, i.people, i.message")).toBe(`${a}|${b}|3|${text}`);
  await expect
    .poll(() => sql(`select count(*) from public.events where created_at >= '${since}' and name = 'inquiry_created' and listing_public_id = '${casa.publicId}'`))
    .toBe("1");

  // Atrás desde WhatsApp: la ficha, sin la hoja, sin el borrador y sin el número en ningún almacenamiento.
  await page.unroute("**/rest/v1/rpc/create_inquiry");
  await backFromWhatsApp(page);
  await expect(page).toHaveURL(new RegExp(`/casa/${casa.publicId}$`));
  await expect(page.getByRole("button", { name: "Contactar por WhatsApp" })).toBeVisible();
  await expect(s).toHaveCount(0);
  expect(await page.evaluate((k) => sessionStorage.getItem(k), `bnbtico-contacto:${casa.publicId}`)).toBeNull();
  expect(await storedEverywhere(page)).not.toContain(digits(TEST_PHONES.owner));

  // Repetir en menos de 7 días renueva la misma consulta (sin fechas ahora: el mensaje por defecto).
  await page.getByRole("button", { name: "Contactar por WhatsApp" }).click();
  const fresh = `Hola, vi ${TITLE} en bnbtico y me interesa. ¿Está disponible? Gracias.`;
  await expect(messagePreview(s)).toHaveText(fresh);
  await openButton(page).click();
  await expect.poll(() => wa.length).toBe(2);
  expect(wa[1]).toBe(waExpected(TEST_PHONES.owner, fresh));
  expect(inquiries(casa.publicId, "count(*), max(i.arrival::text), max(i.message)")).toBe(`1||${fresh}`);
});

test("una casa con un WhatsApp distinto del perfil: wa.me va al número de la casa (también desde la ficha de la SPA)", async ({ page }) => {
  const html = await (await page.request.get(`/casa/${otra.publicId}`)).text();
  expect(html).not.toContain(digits(HOUSE_PHONE));
  await injectSession(page, "other");
  const wa = await catchWhatsApp(page);
  await page.goto("/explorar");
  await page.getByRole("link", { name: /Cabina Cocles/ }).click();
  await expect(page).toHaveURL(new RegExp(`/casa/${otra.publicId}$`));
  await page.getByRole("button", { name: "Contactar por WhatsApp" }).click();
  await openButton(page).click();
  await expect.poll(() => wa).toEqual([waExpected(HOUSE_PHONE, "Hola, vi Cabina Cocles en bnbtico y me interesa. ¿Está disponible? Gracias.")]);
  expect(inquiries(otra.publicId, "i.whatsapp_phone")).toBe(HOUSE_PHONE);
  await backFromWhatsApp(page);
  await expect(page.getByRole("button", { name: "Contactar por WhatsApp" })).toBeVisible();
  expect(await storedEverywhere(page)).not.toContain(digits(HOUSE_PHONE));
});

test("el propietario en su casa ve la negativa; sin red, «Sin conexión…»; nada se abre", async ({ page }) => {
  await injectSession(page, "owner");
  const wa = await catchWhatsApp(page);
  await openSheet(page, casa.publicId);
  const s = sheet(page);
  await openButton(page).click();
  await expect(s.locator('.note[role="alert"]')).toHaveText("Esta es su propia casa.");
  await expect(openButton(page)).toHaveText("Abrir WhatsApp");
  await page.screenshot({ path: "test-results/contacto-propia.png" });

  await page.context().setOffline(true);
  await openButton(page).click();
  await expect(s.locator('.note[role="alert"]')).toHaveText("Sin conexión. Revise su internet e intente de nuevo.");
  await page.context().setOffline(false);
  expect(wa).toEqual([]);
  expect(inquiries(casa.publicId, "count(*)")).toBe("1"); // solo la del cliente de la primera prueba
});

test("la casa deja de recibir consultas con la hoja abierta: el mensaje de la base y nada se abre", async ({ page }) => {
  await injectSession(page, "other");
  const wa = await catchWhatsApp(page);
  await openSheet(page, otra.publicId);
  await h.owner("owner").setAvailable(otra.id, false);
  await openButton(page).click();
  await expect(sheet(page).locator('.note[role="alert"]')).toHaveText("Esta casa no está disponible para consultas.");
  await page.screenshot({ path: "test-results/contacto-error-base.png" });
  expect(wa).toEqual([]);
  await h.owner("owner").setAvailable(otra.id, true);
});

test("sesión vencida (la base la rechaza): a Ingresar con la vuelta a la hoja y lo escrito guardado", async ({ page }) => {
  await injectSession(page, "other");
  const wa = await catchWhatsApp(page);
  await page.route("**/rest/v1/rpc/create_inquiry", (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ code: "PGRST303", message: "JWT expired", details: null, hint: null }) }),
  );
  await openSheet(page, casa.publicId);
  await sheet(page).getByLabel("Personas (opcional)").fill("5");
  await openButton(page).click();
  await expect(page).toHaveURL(new RegExp(`/cuenta\\?next=%2Fcasa%2F${casa.publicId}%3Fcontacto%3D1$`));
  expect(wa).toEqual([]);
  const stored = await page.evaluate((k) => sessionStorage.getItem(k), `bnbtico-contacto:${casa.publicId}`);
  expect(stored).toContain('"people":5');
});
