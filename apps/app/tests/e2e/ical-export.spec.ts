import { expect, test } from "./helpers/test";
import { injectSession } from "./helpers/session";
import { icalExportHarness } from "../db/ical-export-harness";
import type { SubscriptionHarness } from "../contract/harness";
import { addDays } from "../../src/domain/calendar";
import { costaRicaToday } from "../../src/domain/inquiry";

let h: SubscriptionHarness;
test.describe.configure({ mode: "serial" });
test.beforeAll(async () => { h = await icalExportHarness(); });
test.afterAll(async () => { if (h) await h.reset(); });

// Detecta generación ficticia, copia de otra casa, pérdida del enlace al volver
// y una fila del calendario que solo considera la conexión de importación.
test("genera y copia el enlace real por casa y lo recupera al volver", async ({ page, context }) => {
  const l = await h.seed({ status: "active", draft: { title: "Casa exportación iCal" } });
  const day = addDays(costaRicaToday(Date.now()), 10);
  await h.calendar("owner").save(l.id, { days: [day], available: false, priceCrc: 75000 });
  await injectSession(page, "owner");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const month = day.slice(0, 7);
  await page.goto(`/propietario/calendario?casa=${l.id}&mes=${month}`);
  await page.getByRole("button", { name: "Conectar con Airbnb" }).click();
  await expect(page.getByRole("heading", { name: "Exportar hacia Airbnb" })).toBeVisible();
  await page.getByRole("button", { name: "Generar enlace", exact: true }).click();
  const field = page.getByLabel("Enlace de 3bstays para Airbnb", { exact: true });
  await expect(field).toHaveValue(/^http:\/\/127\.0\.0\.1:\d+\/ical\/[a-f0-9]{64}\.ics$/);
  await expect(field).toHaveAttribute("readonly", "");
  const url = await field.inputValue();
  await page.getByRole("button", { name: "Copiar enlace", exact: true }).click();
  await expect(page.getByText("Enlace copiado", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);
  const feed = await page.request.get(url);
  expect(feed.status()).toBe(200);
  expect(await feed.text()).toContain(`DTSTART;VALUE=DATE:${day.replaceAll("-", "")}`);
  expect(await feed.text()).not.toContain("75000");
  await expect(page.getByRole("button", { name: "Revocar enlace", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Conectar Airbnb", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Volver", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`casa=${l.id}.*mes=${month}`));
  await page.getByRole("button", { name: /Conectar con Airbnb/ }).click();
  await expect(field).toHaveValue(url);
  await page.reload();
  await expect(field).toHaveValue(url);
  const persisted = () => page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("3bstays", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<string>((resolve, reject) => {
        const request = db.transaction("query-cache", "readonly").objectStore("query-cache").get("3bstays-query");
        request.onsuccess = () => resolve(JSON.stringify(request.result) ?? "");
        request.onerror = () => reject(request.error);
      });
    } finally { db.close(); }
  });
  await expect.poll(persisted).toContain("airbnb");
  expect(await persisted()).toContain(l.id);
  expect((await persisted()).includes(new URL(url).pathname.split("/")[2]!.replace(".ics", ""))).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("fallar al generar permite reintentar y no anuncia un enlace antes de confirmarlo", async ({ page }) => {
  const l = await h.seed({ status: "active" });
  await injectSession(page, "owner");
  let fail = true;
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/rest/v1/rpc/owner_ical_export", async route => {
    const raw: unknown = route.request().postDataJSON();
    if (raw && typeof raw === "object" && "p_generate" in raw && raw.p_generate === true) {
      if (fail) {
        fail = false;
        await route.fulfill({ status: 500, json: { message: "Error interno de prueba" } });
        return;
      }
      await gate;
    }
    await route.continue();
  });
  await page.goto(`/propietario/casas/${l.id}/airbnb`);
  await page.getByRole("button", { name: "Generar enlace", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("No pudimos generar el enlace");
  await expect(page.getByLabel("Enlace de 3bstays para Airbnb", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Generar enlace", exact: true }).click();
  await expect(page.getByRole("button", { name: "Generando enlace…" })).toBeDisabled();
  await expect(page.getByLabel("Enlace de 3bstays para Airbnb", { exact: true })).toHaveCount(0);
  release();
  await expect(page.getByRole("button", { name: "Copiar enlace", exact: true })).toBeVisible();
  await expect(page.getByText("No hay noches bloqueadas manualmente en este período.", { exact: true })).toBeVisible();
  await expect(page.getByText("Error interno de prueba", { exact: true })).toHaveCount(0);
});

test("denegar portapapeles conserva el enlace seleccionable y no anuncia copia", async ({ page }) => {
  const l = await h.seed({ status: "active" });
  await injectSession(page, "owner");
  // El permiso del sistema es externo: se fuerza su rechazo sin sustituir UI ni RPC.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      writeText: async () => { throw new DOMException("Permiso denegado", "NotAllowedError"); },
    } });
  });
  await page.goto(`/propietario/casas/${l.id}/airbnb`);
  await page.getByRole("button", { name: "Generar enlace", exact: true }).click();
  const field = page.getByLabel("Enlace de 3bstays para Airbnb", { exact: true });
  await expect(field).toBeVisible();
  const url = await field.inputValue();
  await page.getByRole("button", { name: "Copiar enlace", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Mantenga pulsado el enlace para copiarlo");
  await expect(page.getByText("Enlace copiado", { exact: true })).toHaveCount(0);
  await expect(field).toBeFocused();
  await expect(field).toHaveValue(url);
  expect(await field.evaluate((element: HTMLTextAreaElement) => element.selectionEnd - element.selectionStart)).toBe(url.length);
});
