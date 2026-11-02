import { expect, test, type Page } from "./helpers/test";
import type { CalendarHarness } from "../contract/harness";
import { sql } from "../db/local";
import { postgrestHarness } from "../db/postgrest-harness";
import { injectSession } from "./helpers/session";
import { addDays, addMonths } from "../../src/domain/calendar";
import { longDate, shortDate } from "../../src/domain/dates";
import { costaRicaToday } from "../../src/domain/inquiry";

// Una fila que quedara cerrada a consultas (ticket 04 de la ronda del 2 nov: la app ya no cierra casas, «Marcar una reserva»
// sustituyó a «Cerrar la casa hasta…»; la migración reabrir_casas_cerradas las abre todas, pero el SSR de la ficha, Explorar,
// «Mis casas» y la reapertura nocturna siguen cubriéndolas hasta que se retire ese código). Se siembra cerrada por SQL, como el
// servicio. Contra Supabase local; cada prueba siembra sus casas. La ficha del servidor se mira solo en una casa que nadie
// ha visitado antes (la copia en caché del worker local y su purga son del ticket 05); tras reabrir se mira dentro de la SPA.
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
let h: CalendarHarness;

test.describe.configure({ mode: "serial" });

const today = () => costaRicaToday(Date.now());
const nextMonthDay = (d: number) => `${addMonths(today().slice(0, 7), 1)}-${String(d).padStart(2, "0")}`;
const markRow = (page: Page) => page.getByRole("button", { name: /Marcar una reserva/ });
const calendar = (page: Page, id: string) => page.goto(`/propietario/calendario?casa=${id}`);
const reopenDue = (date: string) => Number(sql(`select public.reopen_due_listings('${date}')`));

async function seedHouse(title: string) {
  return h.seed({ status: "active", draft: { title, nightlyPriceCrc: 95000 } });
}

test.beforeAll(async () => {
  h = await postgrestHarness();
  await h.reset();
});

test.beforeEach(async ({ page }) => {
  await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
  await injectSession(page, "owner");
});

test("una fila cerrada sembrada: el calendario ya no ofrece cerrar ni abrir, Explorar la oculta, su ficha no tiene contacto y la reapertura nocturna la abre con sus noches y precios", async ({ page }) => {
  const casa = await seedHouse("Casa Reapertura");
  const days = [
    { day: today(), available: false, specialPriceCrc: null },
    { day: nextMonthDay(5), available: false, specialPriceCrc: null },
    { day: nextMonthDay(20), available: true, specialPriceCrc: 150000 },
  ];
  for (const d of days) await h.putDay(casa.id, d);
  const reopen = addDays(today(), 10);
  await h.setClosed(casa.id, true, reopen);

  await calendar(page, casa.id);
  await expect(markRow(page)).toBeVisible();
  await expect(page.getByRole("button", { name: /Cerrar la casa hasta…/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Abrir la casa" })).toHaveCount(0);
  await expect(page.getByText(/Cerrada hasta el/)).toHaveCount(0);
  await expect(page.locator(".month-grid.is-dimmed")).toHaveCount(0);

  // Mis casas (una sola casa: la lista con su tarjeta) lo dice en la etiqueta de la foto.
  await page.goto("/propietario/casas");
  await expect(page.getByRole("article").getByRole("heading", { name: "Casa Reapertura" })).toBeVisible();
  await expect(page.getByRole("article").getByTestId("card-label")).toHaveText(`Cerrada hasta el ${shortDate(reopen)}`);

  // Cerrada: no sale en Explorar (ticket 20), pero su ficha se abre y dice que no está disponible por ahora.
  await page.goto("/explorar?prov=Todas");
  await expect(page.getByTestId("results-count")).toHaveText(/\d+ casas?/);
  await expect(page.getByRole("link", { name: /Casa Reapertura/ })).toHaveCount(0);
  await page.goto(`/casa/${casa.publicId}`);
  await expect(page.locator(".badge-mute", { hasText: "No disponible por ahora" })).toBeVisible();
  await expect(page.getByRole("button", { name: "No disponible por ahora" })).toBeDisabled();
  await expect(page.locator(".cta-bar").getByText(`Vuelve a estar disponible el ${longDate(reopen)}`)).toBeVisible();

  // La reapertura de las 00:00 de Costa Rica (el job de pg_cron llama a esta función).
  expect(reopenDue(reopen)).toBeGreaterThanOrEqual(1);
  await page.goto(`/propietario/casas/${casa.id}`);
  await expect(page.getByRole("switch")).toHaveCount(0);
  await expect(page.getByText("Anuncio visible")).toHaveCount(0);
  await page.getByRole("link", { name: "Ver ficha" }).click();
  await expect(page.getByRole("button", { name: "Contactar por WhatsApp" })).toBeVisible();
  await expect(page.getByText(/Vuelve a estar disponible/)).toHaveCount(0);

  const after = await h.owner("owner").getOwn(casa.id);
  expect(after).toMatchObject({ status: "active", available: true, reopenAt: null, nightlyPriceCrc: 95000 });
  expect(await h.calendar("owner").days(casa.id)).toEqual(days);
});

test("una fila cerrada sin fecha sigue cerrada tras la reapertura nocturna de dentro de 40 días", async () => {
  const casa = await seedHouse("Casa Sin Fecha");
  await h.setClosed(casa.id, true);
  reopenDue(addDays(today(), 40));
  expect(await h.owner("owner").getOwn(casa.id)).toMatchObject({ available: false, reopenAt: null });
});

test("una casa vuelta a borrador con la fecha vencida se abre a consultas pero sigue oculta", async ({ page }) => {
  const casa = await seedHouse("Casa En Edición");
  const reopen = addDays(today(), 1);
  await h.setClosed(casa.id, true, reopen);
  // Estado heredado: desde la edición de casas publicadas ningún propietario devuelve una casa activa a borrador, así que
  // se pasa como el servicio (igual que el estado "reopened" de la siembra).
  sql(`begin; select set_config('app.allow_status','on',true); update public.listings set status = 'draft' where id = '${casa.id}'; commit;`);

  expect(reopenDue(reopen)).toBeGreaterThanOrEqual(1);
  expect(await h.owner("owner").getOwn(casa.id)).toMatchObject({ status: "draft", available: true, reopenAt: null });
  expect(await h.anon.getPublic(casa.publicId)).toBeNull();

  await page.goto(`/propietario/casas/${casa.id}`);
  await expect(page.getByRole("link", { name: "Seguir publicando" })).toBeVisible(); // revisión UX 2026-10-29, A4
  await expect(page.getByRole("switch")).toHaveCount(0);
  await expect(page.getByText("Anuncio visible")).toHaveCount(0);
});
