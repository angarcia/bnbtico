import { readFileSync } from "node:fs";
import { chromium, devices, type Browser } from "@playwright/test";
import { expect, test, type Page } from "./helpers/test";
import type { CalendarHarness } from "../contract/harness";
import { sql } from "../db/local";
import { postgrestHarness } from "../db/postgrest-harness";
import { injectSession } from "./helpers/session";
import { addDays, addMonths, monthTitle } from "../../src/domain/calendar";
import { longDate } from "../../src/domain/dates";
import { costaRicaToday } from "../../src/domain/inquiry";

// Frescura de punta a punta (fase 4, ticket 05): el worker local (vite preview + miniflare) guarda la ficha en su Cache API
// igual que en Cloudflare. La base local llama a su /_purge con pg_net (Vault → host.docker.internal:<E2E_PORT>) y la
// copia se cae. Quien mira la ficha es otro navegador, anónimo, que entra por host.docker.internal (resuelto a 127.0.0.1):
// la clave de caché lleva el origen y así coincide con la que purga la base.
// Los secretos de Vault solo existen mientras corre este archivo: con ellos, cualquier otra suite encolaría purgas.
const PORT = Number(process.env.E2E_PORT ?? 4173);
const VIEW_ORIGIN = `http://host.docker.internal:${PORT}`;
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
const purgeSecret = () => {
  const secret = /^PURGE_SECRET=(.+)$/m.exec(readFileSync(new URL("../../.dev.vars", import.meta.url), "utf8"))?.[1];
  if (!secret) throw new Error("Falta PURGE_SECRET en .dev.vars: pnpm dev:vars (y reiniciar vite preview)");
  return secret;
};
const dropSecrets = () => sql(`delete from vault.secrets where name in ('worker_purge_url', 'worker_purge_secret')`);

let h: CalendarHarness;
let viewer: Browser;
/** La base (Docker) llega al preview: en Docker Desktop sí; en Linux (el runner de CI) host.docker.internal apunta a la
 *  pasarela de Docker y el preview escucha solo en 127.0.0.1, así que allí la prueba se omite. */
let reachable = false;

test.describe.configure({ mode: "serial" });

const today = () => costaRicaToday(Date.now());
const next = () => addMonths(today().slice(0, 7), 1);
const on = (d: number) => `${next()}-${String(d).padStart(2, "0")}`;
const dayJson = (day: string, available: boolean, price: number | null = null) => `{"day":"${day}","available":${available},"specialPriceCrc":${price}}`;
const lastResponseId = () => Number(sql("select coalesce(max(id), 0) from net._http_response"));
const statusesAfter = (id: number) => sql(`select string_agg(status_code::text, ',' order by id) from net._http_response where id > ${id}`);

/** HTML de la ficha en un contexto anónimo nuevo (sin caché del navegador ni sesión). */
async function freshHtml(publicId: string): Promise<string> {
  const context = await viewer.newContext({ ...devices["Pixel 7"], serviceWorkers: "block" });
  try {
    const page = await context.newPage();
    await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
    const res = await page.goto(`${VIEW_ORIGIN}/casa/${publicId}`, { waitUntil: "commit" });
    return (await res!.text()) ?? "";
  } finally {
    await context.close();
  }
}

/** Purga con pg_net y espera la respuesta del worker (también limpia una copia de una ejecución anterior con el mismo id). */
async function purgeNow(publicId: string) {
  const from = lastResponseId();
  sql(`select public.purge_listing_page('${publicId}')`);
  await expect.poll(() => statusesAfter(from), { timeout: 5000 }).toContain("200");
}

test.beforeAll(async () => {
  h = await postgrestHarness();
  await h.reset();
  dropSecrets();
  const secret = purgeSecret().replace(/'/g, "''");
  sql(`select vault.create_secret('${VIEW_ORIGIN}', 'worker_purge_url'); select vault.create_secret('${secret}', 'worker_purge_secret');`);
  const from = lastResponseId();
  sql(`select net.http_get('${VIEW_ORIGIN}/robots.txt')`);
  for (let i = 0; i < 20 && !reachable; i++) {
    await new Promise((r) => setTimeout(r, 250));
    reachable = (statusesAfter(from) ?? "").includes("200");
  }
  const executablePath = process.env.CHROMIUM_PATH;
  viewer = await chromium.launch({ ...(executablePath ? { executablePath } : {}), args: [`--host-resolver-rules=MAP host.docker.internal 127.0.0.1`] });
});

test.afterAll(async () => {
  // También si algo falló: sin esto, las demás suites encolarían purgas hacia un preview que ya no está.
  dropSecrets();
  await viewer?.close();
});

test.beforeEach(async ({ page }) => {
  test.skip(!reachable && !!process.env.CI, "La base local no llega al preview por host.docker.internal (Linux)");
  expect(reachable, "la base local debe llegar al preview por host.docker.internal").toBe(true);
  await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
  await injectSession(page, "owner");
});

const toggle = (page: Page) => page.getByRole("switch", { name: /Disponible para consultas/ });
const sheet = (page: Page) => page.getByRole("dialog", { name: "Cerrar a consultas" });

test("el worker local cachea la ficha; guardar el calendario, cerrar y la reapertura nocturna la refrescan en ≤ 5 s", async ({ page }) => {
  const casa = await h.seed({ status: "active", draft: { title: "Casa Frescura", nightlyPriceCrc: 95000 } });
  await purgeNow(casa.publicId);

  // 1. Sin purga la copia sale vieja: el worker local cachea de verdad. (Escribir con la service role en listing_days no
  //    pasa por save_listing_days ni por ningún trigger de purga.)
  const first = await freshHtml(casa.publicId);
  expect(first).toContain("Casa Frescura");
  expect(first).not.toContain(on(10));
  await h.putDay(casa.id, { day: on(10), available: false, specialPriceCrc: null });
  const stale = await freshHtml(casa.publicId);
  expect(stale, "sin purga, la ficha sale de la caché del worker").not.toContain(on(10));

  // 2. El propietario guarda en el calendario (save_listing_days purga una vez) → la ficha nueva ya trae el día.
  const from = lastResponseId();
  await page.goto(`/propietario/calendario?casa=${casa.id}&mes=${next()}`);
  await expect(page.getByText(monthTitle(next()), { exact: true })).toBeVisible();
  await page.getByRole("button", { name: new RegExp(`^${longDate(on(12))} de ${on(12).slice(0, 4)},`) }).click();
  const panel = page.getByRole("region", { name: "Días seleccionados" });
  await panel.getByRole("button", { name: "Ocupado" }).click();
  await panel.getByRole("button", { name: "Guardar cambios" }).click();
  await expect.poll(() => freshHtml(casa.publicId), { timeout: 5000, intervals: [250] }).toContain(dayJson(on(12), false));
  expect(statusesAfter(from), "la purga de pg_net llegó al worker con 200").toContain("200");

  // 3. Cerrar a consultas con fecha (trigger de listings) → «Calendario cerrado» en el HTML.
  const reopen = addDays(today(), 9);
  await page.goto(`/propietario/casas/${casa.id}`);
  await toggle(page).click();
  await sheet(page).getByLabel("¿Cuándo vuelve a abrir? (opcional)").fill(reopen);
  await sheet(page).getByRole("button", { name: "Cerrar a consultas" }).click();
  await expect(toggle(page)).toHaveAttribute("aria-checked", "false");
  await expect.poll(() => freshHtml(casa.publicId), { timeout: 5000, intervals: [250] }).toContain("Calendario cerrado");
  expect(await freshHtml(casa.publicId)).toContain(`Vuelve a estar disponible el ${longDate(reopen)}`);

  // 4. La reapertura nocturna (pg_cron llama a reopen_due_listings) → la ficha vuelve con su calendario y el contacto.
  expect(Number(sql(`select public.reopen_due_listings('${reopen}')`))).toBeGreaterThanOrEqual(1);
  await expect.poll(() => freshHtml(casa.publicId), { timeout: 5000, intervals: [250] }).toContain('<div class="listing-calendar" aria-hidden="true"></div>');
  const reopened = await freshHtml(casa.publicId);
  expect(reopened).not.toContain("Calendario cerrado");
  expect(reopened).toContain("Contactar por WhatsApp");
  expect(reopened).toContain(dayJson(on(12), false));
});
