import { expect, test, type Page } from "./helpers/test";
import type { CalendarHarness, Seeded } from "../contract/harness";
import { postgrestHarness } from "../db/postgrest-harness";
import { addDays, addMonths, monthTitle, openingMonth } from "../../src/domain/calendar";
import { longDate } from "../../src/domain/dates";
import { costaRicaToday } from "../../src/domain/inquiry";
import { formatUSD } from "../../src/domain/money";

// «Disponibilidad» en la ficha pública (fase 4, ticket 05) contra Supabase local. Cada prueba siembra sus casas y sus
// días ANTES de la primera visita (la ficha queda en la caché del worker local; la frescura tras un cambio la prueba
// frescura.spec.ts).
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
let h: CalendarHarness;

test.describe.configure({ mode: "serial" });

const today = () => costaRicaToday(Date.now());
const next = () => addMonths(today().slice(0, 7), 1);
// Revisión UX A4: a fin de mes el calendario ya abre en el siguiente.
const opening = () => openingMonth(today());
const toNextMonth = async (page: Page) => {
  if (opening() !== next()) await section(page).getByRole("button", { name: "Mes siguiente" }).click();
};
const on = (d: number) => `${next()}-${String(d).padStart(2, "0")}`;
const section = (page: Page) => page.locator(".listing-calendar");
const grid = (page: Page, month: string) => section(page).getByRole("grid", { name: monthTitle(month) });
const cell = (page: Page, iso: string) => section(page).getByRole("gridcell", { name: new RegExp(`^${longDate(iso)} de ${iso.slice(0, 4)}(,|$)`) });
const boxHeight = (page: Page) => section(page).evaluate((el) => el.getBoundingClientRect().height);

function watch(page: Page) {
  const problems: string[] = [];
  const rest: string[] = [];
  page.on("console", (msg) => {
    if (msg.text().includes("Service Worker registration blocked by Playwright")) return;
    if (msg.type() === "error" || msg.type() === "warning") problems.push(`${msg.type()}: ${msg.text()}`);
  });
  page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
  page.on("request", (req) => req.url().includes("/rest/v1/") && rest.push(req.url()));
  return { problems, rest };
}

async function seedWithDays(title: string, draft: Record<string, unknown> = {}): Promise<Seeded> {
  const casa = await h.seed({ status: "active", draft: { title, nightlyPriceCrc: 95000, ...draft } });
  await h.putDay(casa.id, { day: on(10), available: false, specialPriceCrc: null });
  await h.putDay(casa.id, { day: on(11), available: false, specialPriceCrc: null });
  await h.putDay(casa.id, { day: on(20), available: true, specialPriceCrc: 150000 });
  return casa;
}

/** Retiene la portada: la ficha no hidrata hasta soltarla (main.tsx espera a la portada). */
async function holdHero(page: Page, casa: Seeded) {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(`**/listings/${casa.photoPaths[0]}*`, async (route) => {
    await held;
    await route.fulfill({ body: TILE, contentType: "image/png" });
  });
  return release;
}

test.beforeAll(async () => {
  h = await postgrestHarness();
  await h.reset();
});

test.beforeEach(async ({ page }) => {
  await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
  await page.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
});

test("tras hidratar: el formato del calendario del propietario (N4): ocupados solo con el número y el precio completo de cada noche, sin ★; sin rejilla en el HTML ni peticiones", async ({ page }) => {
  const casa = await seedWithDays("Casa Calendario Ficha");
  const seen = watch(page);
  const scripts: string[] = [];
  page.on("request", (req) => req.resourceType() === "script" && scripts.push(new URL(req.url()).pathname));
  const release = await holdHero(page, casa);

  const res = await page.goto(`/casa/${casa.publicId}`, { waitUntil: "domcontentloaded" });
  const html = await res!.text();
  const body = html.slice(html.indexOf('<div id="root">'));
  expect(body).toContain('<span class="eyebrow">Disponibilidad</span><div class="listing-calendar" aria-hidden="true"></div>');
  expect(body).not.toContain("month-grid");
  // Los días van en ssr-data (el calendario se monta con ellos, sin pedirlos).
  expect(html).toContain(`{"day":"${on(10)}","available":false,"specialPriceCrc":null}`);
  expect(html).toContain(`{"day":"${on(20)}","available":true,"specialPriceCrc":150000}`);

  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  expect(await page.locator("html").getAttribute("data-hydrated")).toBeNull();
  const before = await boxHeight(page);
  expect(before).toBeGreaterThan(300);
  expect(scripts.some((s) => s.includes("listing-calendar-")), "el trozo del calendario espera a la hidratación").toBe(false);

  release();
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  await expect(section(page).getByRole("grid", { name: monthTitle(opening()) })).toBeVisible();
  expect(scripts.some((s) => s.includes("listing-calendar-"))).toBe(true);
  expect(await boxHeight(page), "la caja mide lo mismo con la rejilla").toBe(before);
  // Nada se sale de la caja.
  expect(await section(page).evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);

  await toNextMonth(page);
  await expect(grid(page, next())).toBeVisible();
  await expect(cell(page, on(10))).toHaveAttribute("aria-label", `${longDate(on(10))} de ${on(10).slice(0, 4)}, ocupado`);
  await expect(cell(page, on(10))).toHaveText("10");
  await expect(cell(page, on(10))).toHaveClass(/is-busy/);
  // Precio especial: solo la cifra distinta, completa y sin «₡» (revisión UX 2026-10-29, N4).
  await expect(cell(page, on(20))).toHaveText("20150\u00a0000");
  await expect(cell(page, on(20))).toHaveAttribute("aria-label", /disponible, ₡150\s000, precio distinto$/);
  await expect(cell(page, on(15))).toHaveText("1595\u00a0000");
  expect(Math.round((await cell(page, on(15)).boundingBox())!.height)).toBe(92);
  await expect(section(page).locator(".month-legend")).toHaveText("DisponibleOcupado");
  await expect(section(page).getByText("★")).toHaveCount(0);
  expect(await boxHeight(page), "en otro mes, el mismo alto").toBe(before);
  await section(page).evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.screenshot({ path: "test-results/ficha-calendario.png" });

  // La moneda de la página manda también en el calendario.
  await page.evaluate(() => {
    localStorage.setItem("bnbtico_currency", "USD");
    dispatchEvent(new StorageEvent("storage", { key: "bnbtico_currency" }));
  });
  await expect(cell(page, on(20))).toHaveText(`20${formatUSD(150000, 510)}`);
  expect(await boxHeight(page), "en dólares, el mismo alto").toBe(before);

  expect(seen.rest, "ni la hidratación ni el calendario piden datos").toEqual([]);
  expect(seen.problems, seen.problems.join("\n")).toEqual([]);
});

test("meses: abre en el de apertura, del actual a doce más; los días pasados se tachan", async ({ page }) => {
  const casa = await seedWithDays("Casa Meses Ficha");
  await page.goto(`/casa/${casa.publicId}`);
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  const prev = section(page).getByRole("button", { name: "Mes anterior" });
  const following = section(page).getByRole("button", { name: "Mes siguiente" });
  const first = today().slice(0, 7);
  await expect(grid(page, opening())).toBeVisible();
  if (opening() !== first) await prev.click();
  await expect(grid(page, first)).toBeVisible();
  await expect(prev).toBeDisabled();
  if (today().slice(8) !== "01") await expect(cell(page, addDays(today(), -1))).toHaveClass(/is-past/);
  await expect(cell(page, today())).not.toHaveClass(/is-past/);
  for (let i = 1; i <= 12; i++) {
    await following.click();
    await expect(grid(page, addMonths(first, i))).toBeVisible();
  }
  await expect(following).toBeDisabled();
  await prev.click();
  await expect(grid(page, addMonths(first, 11))).toBeVisible();
});

test("con alquiler mensual a negociar, el calendario sigue siendo por noches con su precio base", async ({ page }) => {
  const casa = await seedWithDays("Casa Mensual Ficha", { acceptsMonthly: true, monthlyPriceCrc: null });
  await page.goto(`/casa/${casa.publicId}`);
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  await toNextMonth(page);
  await expect(cell(page, on(10))).toHaveClass(/is-busy/);
  await expect(cell(page, on(20))).toHaveText("20150\u00a0000");
  await expect(cell(page, on(15))).toHaveText("1595\u00a0000");
});

test("casa cerrada a consultas: «Calendario cerrado» y cuándo vuelve, ya en el HTML y sin rejilla", async ({ page }) => {
  const casa = await seedWithDays("Casa Cerrada Ficha");
  const reopen = addDays(today(), 12);
  await h.owner("owner").setAvailable(casa.id, false, reopen);
  const seen = watch(page);
  const res = await page.goto(`/casa/${casa.publicId}`);
  const html = await res!.text();
  expect(html).toContain("Calendario cerrado");
  expect(html).not.toContain('class="listing-calendar"');
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  const closed = page.locator(".note").filter({ hasText: "Calendario cerrado" });
  await expect(closed).toContainText(`Vuelve a estar disponible el ${longDate(reopen)}`);
  await expect(page.getByRole("grid")).toHaveCount(0);
  await closed.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.screenshot({ path: "test-results/ficha-calendario-cerrada.png" });
  expect(seen.problems, seen.problems.join("\n")).toEqual([]);
});

test("ficha dentro de la SPA: pide los días una vez y muestra el calendario", async ({ page }) => {
  const casa = await seedWithDays("Casa Calendario SPA");
  const days: string[] = [];
  page.on("request", (req) => req.url().includes("/rest/v1/rpc/public_listing_days") && days.push(req.url()));
  await page.goto("/explorar");
  await page.getByRole("link", { name: /Casa Calendario SPA/ }).first().click();
  await expect(page).toHaveURL(new RegExp(`/casa/${casa.publicId}$`));
  await expect(section(page).getByRole("grid", { name: monthTitle(opening()) })).toBeVisible();
  await toNextMonth(page);
  await expect(cell(page, on(11))).toHaveClass(/is-busy/);
  await expect(cell(page, on(20))).toHaveText("20150\u00a0000");
  expect(days).toHaveLength(1);
});

test("ficha dentro de la SPA: si fallan los días, la ficha se ve sin «Disponibilidad» (ni caja ni error)", async ({ page }) => {
  const casa = await seedWithDays("Casa Sin Dias SPA");
  const seen = watch(page);
  let calls = 0;
  await page.route("**/rest/v1/rpc/public_listing_days*", (route) => {
    calls++;
    return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "caída" }) });
  });
  await page.goto("/explorar");
  await page.getByRole("link", { name: /Casa Sin Dias SPA/ }).first().click();
  await expect(page).toHaveURL(new RegExp(`/casa/${casa.publicId}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Casa Sin Dias SPA" })).toBeVisible();
  await expect.poll(() => calls).toBeGreaterThanOrEqual(2); // la consulta y su único reintento
  await expect(page.getByText("Disponibilidad")).toHaveCount(0);
  await expect(section(page)).toHaveCount(0);
  await expect(page.getByText(/No pudimos cargar/)).toHaveCount(0);
  await expect(page.getByText("Zona aproximada")).toBeVisible();
  expect(seen.problems.filter((p) => !/500|Failed to load resource/.test(p)), seen.problems.join("\n")).toEqual([]);
});
