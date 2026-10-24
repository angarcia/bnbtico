import { expect, test, type Page } from "./helpers/test";
import type { Seeded } from "../contract/harness";
import { sql, TEST_NAMES, TEST_PHONES } from "../db/local";
import { postgrestHarness } from "../db/postgrest-harness";
import { injectSession } from "./helpers/session";
import { catchWhatsApp } from "./helpers/whatsapp";

// Fase 3, ticket 05: Mis consultas del propietario (pantalla 18), la tarjeta de Inicio y el contador de la pestaña. Contra
// Supabase local con las sesiones inyectadas (sin gastar SMS).
test.describe.configure({ mode: "serial" });

const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
let h: Awaited<ReturnType<typeof postgrestHarness>>;
let casa: Seeded;
let cabina: Seeded;

const nav = (page: Page) => page.getByRole("navigation", { name: "Navegación principal" });
const cards = (page: Page) => page.getByRole("article");
const card = (page: Page, house: string) => cards(page).filter({ hasText: house });
const opened = (publicId: string) => sql(`select count(*) from public.inquiries i join public.listings l on l.id = i.listing_id where l.public_id = '${publicId}' and i.owner_opened_at is not null`);

/** La caché de Query guardada en IndexedDB, como texto. */
const persistedCache = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const req = indexedDB.open("bnbtico");
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const get = req.result.transaction("query-cache").objectStore("query-cache").get("bnbtico-query");
          get.onsuccess = () => resolve(String(get.result ?? ""));
          get.onerror = () => reject(get.error);
        };
      }),
  );

test.beforeAll(async () => {
  h = await postgrestHarness();
  await h.reset();
  casa = await h.seed({
    status: "active",
    photos: 5,
    draft: { title: "Casa Playa Negra", zone: "Playa Negra" },
  });
  cabina = await h.seed({
    status: "active",
    photos: 5,
    draft: { title: "Cabina Cocles", zone: "Cocles" },
  });
});

test.beforeEach(async ({ page }) => {
  await page.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
  await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
});

async function contact(page: Page, publicId: string, people?: string) {
  await page.goto(`/casa/${publicId}`);
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  await page.getByRole("button", { name: "Contactar por WhatsApp" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  if (people) {
    await sheet.getByLabel("Personas (opcional)").fill(people);
    await sheet.getByLabel("Personas (opcional)").blur();
    await expect(sheet).not.toHaveClass(/\bkb\b/);
  }
  await sheet.getByRole("button", { name: "Abrir WhatsApp" }).click();
  await expect(page).toHaveURL(/wa\.me/);
}

test("el cliente escribe a dos casas → el propietario ve dos «Nueva», filtra, abre WhatsApp con el cliente y el contador baja; sin red, desde la caché", async ({ page }) => {
  // El cliente contacta las dos casas del mismo propietario (desde la ficha, como en el ticket 04).
  await injectSession(page, "other");
  await catchWhatsApp(page);
  await contact(page, casa.publicId, "3");
  await contact(page, cabina.publicId);

  // El propietario entra: Inicio con «2 consultas nuevas» y el contador en la pestaña.
  await page.evaluate(() => localStorage.clear());
  await injectSession(page, "owner");
  await page.goto("/propietario");
  await expect(page.getByTestId("inquiries-title")).toHaveText("2 consultas nuevas");
  await expect(nav(page).getByTestId("inquiries-badge")).toHaveText("2");
  const tab = nav(page).getByRole("link", { name: "Consultas, 2 nuevas" });
  await expect(tab).toBeVisible();
  await page.screenshot({ path: "test-results/consultas-inicio.png" });

  await page.getByRole("link", { name: /2 consultas nuevas/ }).click();
  await expect(page).toHaveURL(/\/propietario\/consultas$/);
  await expect(page.getByRole("heading", { level: 1, name: "Mis consultas" })).toBeVisible();
  await expect(page.getByText("Clientes que le escribieron por WhatsApp desde su ficha. Toque una para seguir la conversación; aquí no hay nada que aceptar ni rechazar.")).toBeVisible();
  await expect(cards(page)).toHaveCount(2);
  // La más reciente primero.
  await expect(cards(page).nth(0)).toContainText("Cabina Cocles · sin fechas");
  const first = card(page, "Casa Playa Negra");
  await expect(first.getByRole("heading", { name: TEST_NAMES.other })).toBeVisible();
  await expect(first).toContainText("AP");
  await expect(first).toContainText("Casa Playa Negra · sin fechas · 3 personas");
  await expect(first).toContainText(/ahora|hace \d+ min/);
  await expect(first).toContainText("“Hola, vi Casa Playa Negra en bnbtico y me interesa.");
  await expect(first.getByText("Nueva", { exact: true })).toBeVisible();
  await expect(card(page, "Cabina Cocles").getByText("Nueva", { exact: true })).toBeVisible();
  await expect(page.getByText("Es un registro de quién le escribió; la conversación completa está en su WhatsApp.")).toBeVisible();
  await page.screenshot({
    path: "test-results/consultas-lista.png",
    fullPage: true,
  });

  // Filtro por casa.
  const filters = page.getByRole("group", { name: "Filtrar por casa" });
  await expect(filters.getByRole("button")).toHaveText(["Todas · 2", "Cabina Cocles", "Casa Playa Negra"]);
  await filters.getByRole("button", { name: "Cabina Cocles" }).click();
  await expect(filters.getByRole("button", { name: "Cabina Cocles" })).toHaveAttribute("aria-pressed", "true");
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page)).toContainText("Cabina Cocles");
  await page.screenshot({ path: "test-results/consultas-filtro.png" });
  await filters.getByRole("button", { name: "Todas · 2" }).click();
  await expect(cards(page)).toHaveCount(2);

  // «Abrir WhatsApp»: el chat con el cliente, sin texto; la consulta deja de ser nueva en la base.
  const wa = await catchWhatsApp(page);
  await first.getByRole("button", { name: "Abrir WhatsApp" }).click();
  await expect.poll(() => wa).toEqual([`https://wa.me/${TEST_PHONES.other.replace(/\D/g, "")}`]);
  expect(wa[0]).toBe("https://wa.me/50688881234");
  await expect.poll(() => opened(casa.publicId)).toBe("1");
  expect(opened(cabina.publicId)).toBe("0");

  // De vuelta de WhatsApp: una nueva, contador 1.
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1, name: "Mis consultas" })).toBeVisible();
  await expect(cards(page)).toHaveCount(2);
  await expect(card(page, "Casa Playa Negra").getByText("Nueva", { exact: true })).toHaveCount(0);
  await expect(card(page, "Cabina Cocles").getByText("Nueva", { exact: true })).toBeVisible();
  await expect(nav(page).getByTestId("inquiries-badge")).toHaveText("1");
  await expect(nav(page).getByRole("link", { name: "Consultas, 1 nueva" })).toBeVisible();
  await page.screenshot({
    path: "test-results/consultas-abierta.png",
    fullPage: true,
  });

  // Recargar trae lo mismo de la base (no solo lo optimista).
  await page.reload();
  await expect(card(page, "Cabina Cocles").getByText("Nueva", { exact: true })).toBeVisible();
  await expect(card(page, "Casa Playa Negra").getByText("Nueva", { exact: true })).toHaveCount(0);
  await expect(nav(page).getByTestId("inquiries-badge")).toHaveText("1");

  // Sin red: la pantalla visitada se pinta desde la caché del dispositivo.
  await page.waitForTimeout(1500); // la caché se guarda en IndexedDB con un pequeño retraso
  await page.route("**/rest/v1/**", (route) => route.abort());
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Mis consultas" })).toBeVisible();
  await expect(cards(page)).toHaveCount(2);
  await expect(nav(page).getByTestId("inquiries-badge")).toHaveText("1");
  await page.unroute("**/rest/v1/**");

  // Inicio, con la misma consulta.
  await nav(page).getByRole("link", { name: "Inicio" }).click();
  await expect(page.getByTestId("inquiries-title")).toHaveText("1 consulta nueva");
});

test("el contador se va con la sesión y no aparece en las pestañas del cliente", async ({ page }) => {
  await injectSession(page, "owner");
  await page.goto("/propietario/consultas");
  await expect(nav(page).getByTestId("inquiries-badge")).toHaveText("1");
  await nav(page).getByRole("link", { name: "Cuenta" }).click();
  await expect(nav(page).getByTestId("inquiries-badge")).toHaveText("1"); // en Cuenta, modo propietario: lo leído
  await expect.poll(() => persistedCache(page)).toContain('"inquiries"');
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page.getByRole("button", { name: "Cerrar sesión" })).toHaveCount(0);
  await page.getByRole("link", { name: "Volver" }).click();
  await expect(nav(page).getByRole("link")).toHaveText(["Explorar", "Favoritos", "Mi cuenta"]);
  // La consulta privada salió también de la caché guardada en el dispositivo.
  await expect
    .poll(
      async () => {
        const c = await persistedCache(page);
        return c.length > 0 && !c.includes('"inquiries"');
      },
      { timeout: 5000 },
    )
    .toBe(true);
  await expect(page.getByTestId("inquiries-badge")).toHaveCount(0);
});

test("sin consultas: el aviso y «Compartir ficha» de la casa activa; todo leído: sin contador", async ({ page }) => {
  sql("delete from public.inquiries");
  await injectSession(page, "owner");
  await page.goto("/propietario/consultas");
  await expect(page.getByText("Todavía no le han escrito. Comparta su ficha para recibir consultas.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Compartir ficha" })).toHaveAttribute("data-share-url", new RegExp(`/casa/CT-\\d{4}$`));
  await expect(page.getByRole("group", { name: "Filtrar por casa" })).toHaveCount(0);
  await expect(nav(page).getByTestId("inquiries-badge")).toHaveCount(0);
  await expect(nav(page).getByRole("link", { name: "Consultas" })).toBeVisible();
  await page.screenshot({ path: "test-results/consultas-vacio.png" });
  await nav(page).getByRole("link", { name: "Inicio" }).click();
  await expect(page.getByTestId("inquiries-title")).toHaveText("Sin consultas nuevas");
});
