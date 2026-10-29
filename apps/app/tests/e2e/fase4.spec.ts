import { readFileSync } from "node:fs";
import { chromium, devices, type Browser, type TestInfo } from "@playwright/test";
import { expect, test, type Page } from "./helpers/test";
import type { CalendarHarness } from "../contract/harness";
import { totp } from "../contract/totp";
import { serviceClient, sql, TEST_PHONES, totpSecretOf } from "../db/local";
import { postgrestHarness } from "../db/postgrest-harness";
import { injectSession } from "./helpers/session";
import { addDays, addMonths, monthTitle, openingMonth } from "../../src/domain/calendar";
import { longDate, shortDate } from "../../src/domain/dates";
import { costaRicaToday } from "../../src/domain/inquiry";

// Cierre de la fase 4 (ticket 06): el recorrido entero del calendario, cada actor en su teléfono (contexto Pixel 7 propio).
// La propietaria envía su casa → «Marcar las noches ocupadas» → marca 3 noches y un precio ★ mientras está en revisión →
// el admin (aal2) la aprueba → un cliente anónimo abre la ficha y los ve → la propietaria libera una noche y cambia la ★
// → la carga nueva del cliente ya lo trae (purga) → la propietaria la cierra con fecha de reapertura → el cliente ve «No
// disponible… Vuelve a estar disponible el …» y «Calendario cerrado» → reapertura nocturna (`reopen_due_listings`) →
// abierta otra vez con el calendario intacto.
// La frescura usa el mismo mecanismo que frescura.spec.ts: secretos de Vault locales que apuntan al preview (creados en
// beforeAll y SIEMPRE borrados en afterAll) y un Chrome aparte que entra por host.docker.internal, para que la clave de
// caché del worker coincida con el origen que purga pg_net.
test.describe.configure({ mode: "serial" });

const PORT = Number(process.env.E2E_PORT ?? 4173);
const VIEW_ORIGIN = `http://host.docker.internal:${PORT}`;
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
const TITLE = "Casa Calendario Gandoca";
const purgeSecret = () => {
  const secret = /^PURGE_SECRET=(.+)$/m.exec(readFileSync(new URL("../../.dev.vars", import.meta.url), "utf8"))?.[1];
  if (!secret) throw new Error("Falta PURGE_SECRET en .dev.vars: pnpm dev:vars (y reiniciar vite preview)");
  return secret;
};
const dropSecrets = () => sql(`delete from vault.secrets where name in ('worker_purge_url', 'worker_purge_secret')`);

let h: CalendarHarness;
let viewer: Browser | undefined;
let reachable = false;
let listingId: string | undefined;

const today = () => costaRicaToday(Date.now());
const next = () => addMonths(today().slice(0, 7), 1);
// Revisión UX A4: a fin de mes el calendario ya abre en el siguiente.
const opensOnNext = () => openingMonth(today()) === next();
const on = (d: number) => `${next()}-${String(d).padStart(2, "0")}`;
const dayJson = (day: string, available: boolean, price: number | null = null) => `{"day":"${day}","available":${available},"specialPriceCrc":${price}}`;
const dayName = (iso: string) => new RegExp(`^${longDate(iso)} de ${iso.slice(0, 4)},`);
const lastResponseId = () => Number(sql("select coalesce(max(id), 0) from net._http_response"));
const statusesAfter = (id: number) => sql(`select string_agg(status_code::text, ',' order by id) from net._http_response where id > ${id}`);

async function stubImages(page: Page) {
  await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
  await page.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
}

/** Un teléfono de la propietaria o del admin (contexto nuevo, sesión inyectada). */
async function phone(browser: Browser, info: TestInfo, who: "owner" | "admin") {
  const context = await browser.newContext({ ...devices["Pixel 7"], baseURL: info.project.use.baseURL, serviceWorkers: "block" });
  const page = await context.newPage();
  await stubImages(page);
  await injectSession(page, who);
  return page;
}

/** El cliente anónimo: cada visita es un teléfono nuevo (sin caché del navegador ni sesión) que entra por el origen purgado. */
async function client(publicId: string): Promise<{ page: Page; html: string }> {
  const context = await viewer!.newContext({ ...devices["Pixel 7"], serviceWorkers: "block" });
  const page = await context.newPage();
  await stubImages(page);
  const res = await page.goto(`${VIEW_ORIGIN}/casa/${publicId}`);
  return { page, html: (await res!.text()) ?? "" };
}

async function freshHtml(publicId: string): Promise<string> {
  const { page, html } = await client(publicId);
  await page.context().close();
  return html;
}

/** La ficha hidratada del cliente con la rejilla del mes que viene a la vista. */
async function clientCalendar(publicId: string) {
  const { page } = await client(publicId);
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  const section = page.locator(".listing-calendar");
  await expect(section.getByRole("grid", { name: monthTitle(openingMonth(today())) })).toBeVisible();
  if (!opensOnNext()) await section.getByRole("button", { name: "Mes siguiente" }).click();
  await expect(section.getByRole("grid", { name: monthTitle(next()) })).toBeVisible();
  return { page, cell: (iso: string) => section.getByRole("gridcell", { name: dayName(iso) }) };
}

test.beforeAll(async () => {
  h = await postgrestHarness(); // marca al admin y le deja un factor TOTP verificado
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
  if (listingId) await serviceClient().from("listings").delete().eq("id", listingId);
});

test("enviar → marcar noches y ★ en revisión → aprobar → el cliente lo ve → cambios frescos → cerrar con fecha → reapertura nocturna", async ({ browser }, info) => {
  test.skip(!reachable && !!process.env.CI, "La base local no llega al preview por host.docker.internal (Linux)");
  expect(reachable, "la base local debe llegar al preview por host.docker.internal").toBe(true);
  test.setTimeout(180_000);

  // 1. La propietaria envía su casa (borrador completo con fotos sembradas; el asistente entero está en fase3.spec.ts).
  const draft = await h.seed({ status: "draft", photos: 5, draft: { title: TITLE, nightlyPriceCrc: 95000 } });
  listingId = draft.id;
  const owner = await phone(browser, info, "owner");
  await owner.goto(`/propietario/publicar/${draft.id}/9`);
  await owner.getByRole("button", { name: "Enviar a revisión" }).click();
  await expect(owner.getByRole("heading", { name: "¡Listo! Su casa está en revisión" })).toBeVisible();

  // 2. «Marcar las noches ocupadas» → su calendario, aún en revisión: 3 noches ocupadas y una ★.
  await owner.getByRole("link", { name: "Marcar las noches ocupadas" }).click();
  await expect(owner).toHaveURL(new RegExp(`/propietario/calendario\\?casa=${draft.id}`));
  // Una sola casa: su nombre como subtítulo, sin selector (revisión UX A5).
  await expect(owner.locator(".cal-house")).toHaveText(new RegExp(TITLE));
  await owner.locator(`[data-month="${next()}"]`).scrollIntoViewIfNeeded();
  await expect(owner.getByRole("heading", { name: monthTitle(next()) })).toBeVisible();
  const day = (iso: string) => owner.getByRole("button", { name: dayName(iso) });
  const panel = owner.getByRole("region", { name: "Días seleccionados" });
  for (const d of [10, 11, 12]) await day(on(d)).click();
  await panel.getByRole("button", { name: "Ocupado" }).click();
  await panel.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(day(on(11))).toContainText("Ocupado");
  await day(on(20)).click();
  await panel.getByLabel("Precio por noche").fill("150000");
  await panel.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(day(on(20))).toContainText("20 ★");
  await expect(day(on(20))).toContainText("150k");
  const saved = [dayJson(on(10), false), dayJson(on(11), false), dayJson(on(12), false), dayJson(on(20), true, 150000)];
  await expect
    .poll(async () => (await h.calendar("owner").days(draft.id)).map((d) => JSON.stringify(d)))
    .toEqual(saved);
  expect(await h.anon.getPublicDays(draft.publicId), "los días de una casa en revisión no son públicos").toEqual([]);

  // 3. El admin la aprueba con el segundo factor (aal2).
  const admin = await phone(browser, info, "admin");
  await admin.goto(`/admin/anuncios/${draft.id}`);
  await expect(admin).toHaveURL(/\/admin\/codigo/);
  const { data: user } = await serviceClient().from("profiles").select("id").eq("phone", TEST_PHONES.admin).single();
  const factor = (await serviceClient().auth.admin.mfa.listFactors({ userId: user!.id })).data!.factors.find((f) => f.status === "verified")!;
  await admin.getByLabel("Código de 6 dígitos").fill(totp(totpSecretOf(factor.id)));
  await admin.getByRole("button", { name: "Verificar y entrar" }).click();
  await expect(admin.getByRole("heading", { level: 2, name: TITLE })).toBeVisible();
  await admin.getByRole("button", { name: "Aprobar y publicar" }).click();
  await expect(admin.getByRole("status")).toContainText(`«${TITLE}»: Aprobada y publicada.`);
  await expect.poll(async () => (await h.owner("owner").getOwn(draft.id))?.status).toBe("active");
  await admin.context().close();

  // 4. Un cliente anónimo abre la ficha: las 3 noches ocupadas y la ★, tras hidratar.
  const first = await clientCalendar(draft.publicId);
  for (const d of [10, 11, 12]) await expect(first.cell(on(d))).toHaveClass(/is-busy/);
  await expect(first.cell(on(20))).toHaveText("20 ★150k");
  await expect(first.cell(on(15))).toHaveText("15");
  await expect(first.page.getByRole("button", { name: "Contactar por WhatsApp" })).toBeVisible();
  await first.page.context().close();

  // 5. La propietaria libera una noche y cambia la ★: la carga nueva del cliente lo trae en ≤ 5 s (purga de pg_net).
  let from = lastResponseId();
  await day(on(11)).click();
  await panel.getByRole("button", { name: "Disponible" }).click();
  await panel.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(day(on(11))).toContainText("95k");
  await day(on(20)).click();
  await panel.getByLabel("Precio por noche").fill("180000");
  await panel.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(day(on(20))).toContainText("180k");
  await expect.poll(() => freshHtml(draft.publicId), { timeout: 5000, intervals: [250] }).toContain(dayJson(on(20), true, 180000));
  expect(await freshHtml(draft.publicId)).not.toContain(dayJson(on(11), false));
  await expect.poll(() => statusesAfter(from), { message: "la purga de pg_net llegó al worker con 200" }).toContain("200");
  const second = await clientCalendar(draft.publicId);
  await expect(second.cell(on(11))).not.toHaveClass(/is-busy/);
  await expect(second.cell(on(10))).toHaveClass(/is-busy/);
  await expect(second.cell(on(20))).toHaveText("20 ★180k");
  await second.page.context().close();

  // 6. La cierra a consultas con fecha de reapertura: el cliente ve «No disponible…» y «Calendario cerrado».
  const reopen = addDays(today(), 9);
  from = lastResponseId();
  await owner.goto(`/propietario/calendario?casa=${draft.id}&mes=${next()}`);
  await owner.getByRole("button", { name: /Cerrar la casa hasta…/ }).click();
  const sheet = owner.getByRole("dialog", { name: "Cerrar la casa" });
  await sheet.getByLabel("Abrir de nuevo el (opcional)").fill(reopen);
  await sheet.getByRole("button", { name: "Cerrar la casa" }).click();
  await expect(owner.getByText(`Cerrada hasta el ${shortDate(reopen)}`)).toBeVisible();
  await expect.poll(() => freshHtml(draft.publicId), { timeout: 5000, intervals: [250] }).toContain("Calendario cerrado");
  await expect.poll(() => statusesAfter(from)).toContain("200");
  const closed = await client(draft.publicId);
  await expect(closed.page.locator("html")).toHaveAttribute("data-hydrated", "true");
  await expect(closed.page.getByRole("button", { name: "No disponible por ahora" })).toBeDisabled();
  await expect(closed.page.locator(".cta-bar").getByText(`Vuelve a estar disponible el ${longDate(reopen)}`)).toBeVisible();
  const note = closed.page.locator(".note").filter({ hasText: "Calendario cerrado" });
  await expect(note).toContainText(`Vuelve a estar disponible el ${longDate(reopen)}`);
  await expect(closed.page.getByRole("grid")).toHaveCount(0);
  await closed.page.context().close();

  // El calendario de la propietaria lo dice y no se edita, pero conserva sus días.
  await owner.goto(`/propietario/calendario?casa=${draft.id}&mes=${next()}`);
  await expect(owner.getByText(`Cerrada hasta el ${shortDate(reopen)}`)).toBeVisible();
  await expect(owner.getByRole("button", { name: "Abrir la casa" })).toBeVisible();

  // 7. La reapertura de las 00:00 de Costa Rica (el job de pg_cron llama a esta función con la fecha de ese día).
  expect(Number(sql(`select public.reopen_due_listings('${reopen}')`))).toBeGreaterThanOrEqual(1);
  await expect.poll(() => freshHtml(draft.publicId), { timeout: 5000, intervals: [250] }).toContain('<div class="listing-calendar" aria-hidden="true"></div>');
  const reopened = await clientCalendar(draft.publicId);
  await expect(reopened.page.getByRole("button", { name: "Contactar por WhatsApp" })).toBeVisible();
  await expect(reopened.page.getByText(/Vuelve a estar disponible/)).toHaveCount(0);
  for (const d of [10, 12]) await expect(reopened.cell(on(d))).toHaveClass(/is-busy/);
  await expect(reopened.cell(on(11))).not.toHaveClass(/is-busy/);
  await expect(reopened.cell(on(20))).toHaveText("20 ★180k");
  await reopened.page.context().close();
  expect(await h.owner("owner").getOwn(draft.id)).toMatchObject({ status: "active", available: true, reopenAt: null, nightlyPriceCrc: 95000 });
  expect((await h.calendar("owner").days(draft.id)).map((d) => JSON.stringify(d))).toEqual([dayJson(on(10), false), dayJson(on(12), false), dayJson(on(20), true, 180000)]);

  await owner.reload();
  await expect(owner.getByRole("button", { name: "Abrir la casa" })).toHaveCount(0);
  await expect(owner.getByRole("button", { name: /Cerrar la casa hasta…/ })).toBeVisible();
  await expect(day(on(12))).toContainText("Ocupado");
  await owner.context().close();
});
