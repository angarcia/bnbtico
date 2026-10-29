import { expect, test } from "./helpers/test";
import type { Seeded } from "../contract/harness";
import { sql } from "../db/local";
import { postgrestHarness } from "../db/postgrest-harness";
import { injectSession } from "./helpers/session";

// Balizas de primera parte de punta a punta: navegador → worker (vite preview) → Supabase local con la service role.
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
let casa: Seeded;
let draft: Seeded;
let since: string;

const rows = (query: string) => sql(query).split("\n").filter(Boolean);

test.beforeAll(async () => {
  const h = await postgrestHarness();
  await h.reset();
  casa = await h.seed({ status: "active", photos: 5 });
  draft = await h.seed({ status: "draft" });
});

test.beforeEach(async ({ page }) => {
  since = sql("select now()::text");
  await page.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
});

test("la ficha SSR manda vista de página, vista de ficha y su LCP", async ({ page }) => {
  await page.goto(`/casa/${casa.publicId}`);
  await expect(page.locator("html[data-hydrated=true]")).toHaveCount(1);
  await expect
    .poll(() => rows(`select name || ' ' || coalesce(listing_public_id, '-') || ' ' || page || ' ' || path from public.events where created_at >= '${since}' order by id`))
    .toEqual([`page_view - ficha /casa/${casa.publicId}`, `listing_view ${casa.publicId} ficha /casa/${casa.publicId}`]);

  // web-vitals cierra el LCP con la primera interacción; el trozo se carga tras `load`.
  await page.waitForLoadState("load");
  await page.waitForTimeout(300);
  await page.keyboard.press("Tab");
  await expect
    .poll(() => rows(`select name || ' ' || page || ' ' || path || ' ' || (value > 0) from public.web_vitals where created_at >= '${since}' and name = 'LCP'`))
    .toEqual([`LCP ficha /casa/${casa.publicId} true`]);
});

test("el shell manda una vista por ruta y la ficha abierta desde una tarjeta", async ({ page }) => {
  await page.goto("/explorar");
  await expect(page.getByRole("heading", { name: "Explorar casas" })).toBeVisible();
  await page.getByRole("link", { name: /Cabina Cahuita/ }).first().click();
  await expect(page).toHaveURL(`/casa/${casa.publicId}`);
  await expect
    .poll(() => rows(`select name || ' ' || page || ' ' || coalesce(listing_public_id, '-') from public.events where created_at >= '${since}' order by name, page`))
    .toEqual([`listing_view ficha ${casa.publicId}`, "page_view explorar -", "page_view ficha -"]);
});

// Revisión UX A2: las visitas del propio dueño no cuentan.
test("el propietario que abre su propia ficha no suma una visita", async ({ page }) => {
  const own = await postgrestHarness().then((h) => h.seed({ status: "active", draft: { title: "Casa Propia Telemetría" } }));
  await injectSession(page, "owner");
  await page.goto("/propietario/casas"); // la lista de Mis casas recuerda en el teléfono qué casas son suyas
  await expect(page.getByRole("heading", { name: "Casa Propia Telemetría" })).toBeVisible();
  await page.goto(`/casa/${own.publicId}`);
  await expect(page.locator("html[data-hydrated=true]")).toHaveCount(1);
  await page.waitForTimeout(800);
  expect(rows(`select name from public.events where created_at >= '${since}' and name = 'listing_view' and listing_public_id = '${own.publicId}'`)).toEqual([]);
});

// Revisión UX C4 (punto 6): cada pantalla del asistente que se abre, para ver dónde se abandona.
test("el asistente manda «wizard_step» con la casa y la ruta sin el id del borrador", async ({ page }) => {
  await injectSession(page, "owner");
  await page.goto(`/propietario/publicar/${draft.id}/4`);
  await expect(page.locator(".stage-label")).toHaveText("Su casa3 de 4");
  await expect
    .poll(() => rows(`select name || ' ' || listing_public_id || ' ' || page || ' ' || path from public.events where created_at >= '${since}' and name = 'wizard_step'`))
    .toEqual([`wizard_step ${draft.publicId} publicar /propietario/publicar/:id/4`]);
});

test("errores no capturados y promesas rechazadas llegan con ruta y build; una baliza ajena se rechaza", async ({ page }) => {
  test.info().annotations.push({ type: "nota", description: "Los errores se provocan a propósito." });
  await page.goto("/explorar");
  await expect(page.getByRole("heading", { name: "Explorar casas" })).toBeVisible();
  await page.evaluate(() => {
    setTimeout(() => {
      throw new Error("error de prueba e2e");
    });
    void Promise.reject(new Error("rechazo de prueba e2e"));
  });
  await expect
    .poll(() => rows(`select kind || ' ' || message || ' ' || page || ' ' || path || ' ' || (length(build) > 0) from public.client_errors where created_at >= '${since}' order by kind`))
    .toEqual(["error Uncaught Error: error de prueba e2e explorar /explorar true", "rejection rechazo de prueba e2e explorar /explorar true"]);

  const status = await page.evaluate(async () => (await fetch("/events", { method: "POST", body: JSON.stringify({ name: "signup", path: "/", build: "x" }) })).status);
  expect(status).toBe(400);
});
