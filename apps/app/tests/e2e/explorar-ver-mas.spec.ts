import { expect, test } from "./helpers/test";
import { sql } from "../db/local";
import { postgrestHarness } from "../db/postgrest-harness";

// «Ver más casas» (issue #10): con más de 60 casas, Explorar enseña 60, dice «Más de 60 casas» y el botón trae las
// siguientes, en la lista y en el mapa. Contra Supabase local.
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
const TOTAL = 65;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const h = await postgrestHarness();
  await h.reset();
  const template = await h.seed({ status: "active", photos: 1, draft: { title: "Casa Cocles", zone: "Cocles", zoneSource: "other", zoneId: null } });
  // Las demás, copias de la plantilla (activas), como el servicio: sembrarlas una a una tardaría demasiado.
  sql(`begin; select set_config('app.allow_status', 'on', true);
    do $$ declare cols text; begin
      select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
        from information_schema.columns
        where table_schema = 'public' and table_name = 'listings' and is_generated = 'NEVER' and is_identity = 'NO'
          and column_name not in ('id', 'public_id', 'created_at', 'updated_at');
      execute format('insert into public.listings (%s) select %s from public.listings, generate_series(1, ${TOTAL - 1}) where id = %L',
        cols, cols, '${template.id}');
    end $$;
    commit;`);
});

test.beforeEach(async ({ page }) => {
  await page.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
  await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
});

test("con más de 60 casas: «Más de 60 casas», «Ver más casas» añade las siguientes a la lista y al mapa, y desaparece al final", async ({ page }) => {
  await page.goto("/explorar");
  const cards = page.locator(".listing-grid:not(.skeleton) .listing-card");
  await expect(cards).toHaveCount(60);
  await expect(page.getByTestId("results-count")).toHaveText("Más de 60 casas");
  // Todas en Cocles: el mapa las agrupa en un solo marcador «N casas».
  const group = (n: number) => page.locator(".explore-map .leaflet-marker-pane .map-price").filter({ hasText: new RegExp(`^${n} casas$`) });
  await expect(group(60)).toHaveCount(1);

  const more = page.getByRole("button", { name: "Ver más casas" });
  await more.scrollIntoViewIfNeeded();
  const scrolled = await page.evaluate(() => window.scrollY);
  await more.click();
  await expect(cards).toHaveCount(TOTAL);
  // Las nuevas van debajo: la lista no vuelve arriba.
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThanOrEqual(scrolled - 1);
  await expect(more).toHaveCount(0);
  await expect(page.getByTestId("results-count")).toHaveText(`${TOTAL} casas`);
  await expect(group(TOTAL)).toHaveCount(1);
  const ids = await cards.evaluateAll((els) => els.map((el) => el.getAttribute("href")));
  expect(new Set(ids).size).toBe(TOTAL);
});

test("Filtros dice «Ver más de 60 casas» mientras quedan páginas", async ({ page }) => {
  await page.goto("/explorar/filtros");
  await expect(page.getByRole("button", { name: "Ver más de 60 casas" })).toBeVisible();
});

test("si la página siguiente falla, lo dice encima del botón y el mismo botón reintenta", async ({ page }) => {
  await page.goto("/explorar");
  const cards = page.locator(".listing-grid:not(.skeleton) .listing-card");
  await expect(cards).toHaveCount(60);
  let fail = true;
  await page.route("**/rest/v1/rpc/search_listings*", (route) => (fail ? route.abort() : route.fallback()));
  const more = page.getByRole("button", { name: "Ver más casas" });
  await more.click();
  // Antes de avisar, Query reintenta (1 s, 2 s, 4 s), como en la primera página.
  await expect(page.getByRole("alert")).toHaveText("No pudimos cargar más casas. Revise su conexión e inténtelo de nuevo.", { timeout: 15_000 });
  await expect(cards).toHaveCount(60);
  fail = false;
  await more.click();
  await expect(cards).toHaveCount(TOTAL);
  await expect(page.getByRole("alert")).toHaveCount(0);
});
