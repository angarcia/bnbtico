import { expect, test, type Page } from "./helpers/test";
import type { Seeded } from "../contract/harness";
import { serviceClient, sql, TEST_NAMES, TEST_PHONES } from "../db/local";
import { postgrestHarness } from "../db/postgrest-harness";
import { injectSession } from "./helpers/session";
import { catchWhatsApp } from "./helpers/whatsapp";

// Navegación simple: Mis casas (una casa directa, dos o más en lista), Actividad (cifras de 30 días por casa y últimas
// consultas) y la vuelta de /propietario y /propietario/consultas.
// Contra Supabase local con las sesiones inyectadas (sin gastar SMS).
test.describe.configure({ mode: "serial" });

const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
let h: Awaited<ReturnType<typeof postgrestHarness>>;
let casa: Seeded;

const nav = (page: Page) => page.getByRole("navigation", { name: "Navegación principal" });
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
});

test.beforeEach(async ({ page }) => {
  await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
  await injectSession(page, "owner");
});

test("6 · /propietario/consultas lleva a Actividad sin quedar en el historial", async ({ page }) => {
  await page.goto("/explorar");
  const before = await page.evaluate(() => history.length);
  await page.goto("/propietario/consultas");
  await expect(page).toHaveURL(/\/propietario\/actividad$/);
  await expect(page.getByRole("heading", { level: 1, name: "Actividad" })).toBeVisible();
  expect(await page.evaluate(() => history.length)).toBe(before + 1);
});

test("/propietario lleva a Mis casas sin quedar en el historial", async ({ page }) => {
  await page.goto("/explorar");
  const before = await page.evaluate(() => history.length);
  await page.goto("/propietario");
  await expect(page).toHaveURL(/\/propietario\/casas$/);
  expect(await page.evaluate(() => history.length)).toBe(before + 1);
});

test("7 · con una casa activa: las tres cifras en grande y las últimas consultas", async ({ page }) => {
  casa = await h.seed({ status: "active", photos: 5, draft: { title: "Casa Cocles" } });
  await h.recordViews(casa.publicId, 4);
  await h.recordTaps(casa.publicId, 2);
  await h.inquiries("other").create(casa.publicId, { arrival: null, departure: null, people: 2, message: "Hola, ¿está libre?" });
  await page.goto("/propietario/actividad");
  await expect(page.getByText("Últimos 30 días")).toBeVisible();
  await expect(page.getByTestId("activity-figures")).toHaveText(/4\s*visitas.*2\s*toques en WhatsApp.*1\s*consulta/s);
  await expect(page.locator(".activity-card")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: "Últimas consultas" })).toBeVisible();
  const inquiry = page.getByRole("article").filter({ hasText: "Hola, ¿está libre?" });
  await expect(inquiry.getByRole("heading", { name: TEST_NAMES.other })).toBeVisible();
  await expect(inquiry).toContainText("AP");
  await expect(inquiry).toContainText("Casa Cocles · sin fechas · 2 personas");
  await expect(inquiry.getByText("Nueva", { exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "Filtrar por casa" })).toHaveCount(0);
  await expect(nav(page).getByTestId("inquiries-badge")).toHaveText("1");
  await expect(nav(page).getByRole("link", { name: "Actividad, 1 nueva" })).toHaveAttribute("aria-current", "page");
  await page.screenshot({ path: "test-results/actividad-una-casa.png", fullPage: true });

  // «Abrir WhatsApp»: el chat con el cliente, sin texto; la consulta deja de ser nueva y el contador de la pestaña se va.
  const wa = await catchWhatsApp(page);
  await inquiry.getByRole("button", { name: "Abrir WhatsApp" }).click();
  await expect.poll(() => wa).toEqual([`https://wa.me/${TEST_PHONES.other.replace(/\D/g, "")}`]);
  await expect.poll(() => opened(casa.publicId)).toBe("1");
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1, name: "Actividad" })).toBeVisible();
  await expect(inquiry.getByText("Nueva", { exact: true })).toHaveCount(0);
  await expect(nav(page).getByTestId("inquiries-badge")).toHaveCount(0);
  await expect(nav(page).getByRole("link", { name: "Actividad" })).toBeVisible();

  // Sin red: la pantalla visitada se pinta desde la caché del dispositivo.
  await page.reload();
  await expect(page.getByTestId("activity-figures")).toHaveText(/4\s*visitas/);
  await page.waitForTimeout(1500); // la caché se guarda en IndexedDB con un pequeño retraso
  await page.route("**/rest/v1/**", (route) => route.abort());
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Actividad" })).toBeVisible();
  await expect(page.getByTestId("activity-figures")).toHaveText(/4\s*visitas.*2\s*toques en WhatsApp.*1\s*consulta/s);
  await expect(page.getByRole("article").filter({ hasText: "Hola, ¿está libre?" })).toBeVisible();
  await page.unroute("**/rest/v1/**");
});

test("7b · con dos casas: una tarjeta por casa; la que no está activa muestra solo su estado", async ({ page }) => {
  await h.seed({ status: "review", draft: { title: "Casa en revisión" } });
  await page.goto("/propietario/actividad");
  const cards = page.locator(".activity-card");
  await expect(cards).toHaveCount(2);
  const active = cards.filter({ hasText: "Casa Cocles" });
  await expect(active).toContainText(casa.publicId);
  await expect(active.getByTestId("activity-figures")).toHaveText(/4\s*visitas.*2\s*toques en WhatsApp.*1\s*consulta/s);
  await expect(active.locator("img.thumb-sm")).toHaveCount(1);
  const review = cards.filter({ hasText: "Casa en revisión" });
  await expect(review).toContainText("En revisión");
  await expect(review.getByTestId("activity-figures")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: "Últimas consultas" })).toBeVisible();
  await page.screenshot({ path: "test-results/actividad-dos-casas.png", fullPage: true });
});

test("7c · sin casa activa ni consultas: un único mensaje", async ({ page }) => {
  const { data: other } = await serviceClient().from("profiles").select("id").eq("phone", TEST_PHONES.other).single();
  await serviceClient().from("listings").delete().eq("owner_id", other!.id);
  await h.seed({ status: "draft", as: "other", draft: { title: "Borrador de Ana" } });
  await injectSession(page, "other");
  await page.goto("/propietario/actividad");
  await expect(page.getByText("Cuando su casa esté activa verá aquí cuántas personas la visitan y le escriben")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Últimas consultas" })).toHaveCount(0);
  await expect(page.getByTestId("activity-figures")).toHaveCount(0);
  await expect(page.getByText("Borrador", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: "test-results/actividad-vacia.png" });
});

test("el contador se va con la sesión y la consulta privada sale de la caché del dispositivo", async ({ page }) => {
  await h.inquiries("other").create(casa.publicId, { arrival: null, departure: null, people: null, message: "Otra pregunta" });
  await page.goto("/propietario/actividad");
  await expect(nav(page).getByTestId("inquiries-badge")).toHaveText("1");
  await nav(page).getByRole("link", { name: "Cuenta" }).click();
  await expect(nav(page).getByTestId("inquiries-badge")).toHaveText("1"); // en Cuenta, modo propietario: lo leído
  await expect.poll(() => persistedCache(page)).toContain('"inquiries"');
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page.getByRole("button", { name: "Cerrar sesión" })).toHaveCount(0);
  await page.getByRole("link", { name: "Volver" }).click();
  await expect(nav(page).getByRole("link")).toHaveText(["Explorar", "Favoritos", "Mi cuenta"]);
  await expect
    .poll(
      async () => {
        const c = await persistedCache(page);
        return c.length > 0 && !c.includes('"inquiries"') && !c.includes('"own-activity"');
      },
      { timeout: 5000 },
    )
    .toBe(true);
  await expect(page.getByTestId("inquiries-badge")).toHaveCount(0);
});

test("3 · una casa: su detalle como raíz de la pestaña; con una segunda, la lista", async ({ page }) => {
  h = await postgrestHarness(); // la prueba anterior cerró la sesión del propietario también en el servidor
  await h.reset();
  await h.seed({ status: "draft", draft: { title: "Casa Puerto Viejo" } });
  await page.goto("/propietario/casas");
  await expect(page.getByRole("heading", { level: 1, name: "Casa Puerto Viejo" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Volver" })).toHaveCount(0);
  await expect(page.getByTestId("resume-card").getByRole("link", { name: "Seguir publicando" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Descartar borrador" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Añadir otra casa" })).toHaveAttribute("href", "/propietario/publicar");
  await page.screenshot({ path: "test-results/mis-casas-una.png", fullPage: true });
  await h.seed({ status: "active", draft: { title: "Casa Cocles" } });
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Mis casas" })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(2);
  await expect(page.locator("[data-testid=resume-card], [data-testid=pay-notice]")).toHaveCount(1);
  await expect(page.getByTestId("resume-card")).toContainText("Casa Puerto Viejo");
  await expect(page.locator("main .btn-primary")).toHaveCount(1);
  await page.screenshot({ path: "test-results/mis-casas-lista.png", fullPage: true });
});

test("la casa abierta desde la lista se queda aunque se descarte la otra", async ({ page }) => {
  const { data } = await serviceClient().from("listings").select("id, title, status").eq("owner_id", h.ownerId("owner"));
  const active = data!.find((l) => l.status === "active")!;
  const draft = data!.find((l) => l.status === "draft")!;
  await page.goto("/propietario/casas");
  await page.getByRole("article").filter({ hasText: "Casa Cocles" }).getByRole("link", { name: "Casa Cocles" }).click();
  await expect(page).toHaveURL(new RegExp(`/propietario/casas/${active.id}$`));
  await serviceClient().from("listings").delete().eq("id", draft.id);
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/propietario/casas/${active.id}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Casa Cocles" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Volver" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Añadir otra casa" })).toHaveCount(0);
  await page.getByRole("link", { name: "Volver" }).click();
  await expect(page).toHaveURL(/\/propietario\/casas$/);
  await expect(page.getByRole("heading", { level: 1, name: "Casa Cocles" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Volver" })).toHaveCount(0);
});
