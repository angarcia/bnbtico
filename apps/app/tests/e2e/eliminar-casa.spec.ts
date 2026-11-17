import { expect, test, type Page } from "./helpers/test";
import type { Seeded } from "../contract/harness";
import { postgrestHarness } from "../db/postgrest-harness";
import { injectSession } from "./helpers/session";

// «Eliminar casa» del anfitrión (historia 28) en el móvil, contra Supabase local. Guarda capturas para la revisión de Ana.
const TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
const SHOTS = "../../.scratch/eliminar-casa/capturas";
let h: Awaited<ReturnType<typeof postgrestHarness>>;
let gone: Seeded;
let keep: Seeded;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  h = await postgrestHarness();
  await h.reset();
  keep = await h.seed({ status: "active", draft: { title: "Casa que se queda", zone: "Cahuita" } });
  gone = await h.seed({ status: "active", draft: { title: "Casa Cocles", zone: "Cocles", zoneSource: "other", zoneId: null } });
});

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/storage/v1/object/public/**", (route) => route.fulfill({ body: TILE, contentType: "image/png" }));
  await injectSession(page, "owner");
});

const card = (page: Page, title: string) => page.getByRole("article").filter({ has: page.getByRole("heading", { name: title }) });

test("la hoja nombra la casa y explica qué pasa; cancelar o fallar no cambia nada; confirmar la quita de Mis casas y del público", async ({ page }) => {
  await page.goto(`/propietario/casas/${gone.id}`);
  const action = page.getByRole("button", { name: "Eliminar casa" });
  await action.scrollIntoViewIfNeeded();
  await expect(action).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/1-detalle-final.png`, fullPage: true });

  const sheet = page.getByRole("dialog");
  await action.click();
  await expect(sheet.getByRole("heading", { name: "¿Eliminar «Casa Cocles»?" })).toBeVisible();
  await expect(sheet).toContainText(`${gone.publicId} · Cocles`);
  await expect(sheet).toContainText("no podrá recuperarla desde la app");
  await expect(sheet).toContainText("use «Pausar la casa» en el Calendario");
  await expect(sheet.getByRole("button")).toHaveText(["Eliminar casa", "Cancelar"]);
  await page.screenshot({ path: `${SHOTS}/2-hoja.png` });
  await sheet.getByRole("button", { name: "Cancelar" }).click();
  await expect(sheet).toHaveCount(0);
  expect(await h.anon.linkState(gone.publicId)).toBe("active");

  // Sin red: la hoja sigue abierta con el aviso y la casa sigue.
  await page.route("**/rest/v1/rpc/delete_own_listing", (route) => route.abort("internetdisconnected"));
  await action.click();
  await sheet.getByRole("button", { name: "Eliminar casa" }).click();
  await expect(sheet.getByRole("alert")).toHaveText("Sin conexión. Revise su internet e intente de nuevo.");
  await page.screenshot({ path: `${SHOTS}/3-hoja-sin-red.png` });
  expect(await h.anon.linkState(gone.publicId)).toBe("active");
  await page.unroute("**/rest/v1/rpc/delete_own_listing");

  await sheet.getByRole("button", { name: "Eliminar casa" }).click();
  await expect(page).toHaveURL(/\/propietario\/casas$/);
  await expect(page.locator(".toast")).toHaveText("Casa eliminada.");
  await page.screenshot({ path: `${SHOTS}/4-mis-casas-tras-eliminar.png` });
  await expect(card(page, "Casa Cocles")).toHaveCount(0);
  await expect(card(page, "Casa que se queda")).toHaveCount(1);
  expect(await h.anon.linkState(gone.publicId)).toBeNull();
  expect(await h.anon.getPublic(gone.publicId)).toBeNull();
});

test("si era la última casa, vuelve a Explorar con la vista de cliente", async ({ page }) => {
  await page.goto(`/propietario/casas/${keep.id}`);
  await page.getByRole("button", { name: "Eliminar casa" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Eliminar casa" }).click();
  await expect(page).toHaveURL(/\/explorar/);
  await expect(page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", { name: /Mis casas|Mi casa/ })).toHaveCount(0);
});

test("en revisión, con un borrador sin enviar o bloqueada no se ofrece «Eliminar casa»", async ({ page }) => {
  await h.reset();
  const review = await h.seed({ status: "review", draft: { title: "Casa en revisión" } });
  const draft = await h.seed({ status: "draft", draft: { title: "Borrador nuevo" } });
  const blocked = await h.seed({ status: "active", draft: { title: "Casa bloqueada" } });
  await h.admin("aal2").blockListing(blocked.id, "Fotos de otra casa.");
  for (const s of [review, draft, blocked]) {
    await page.goto(`/propietario/casas/${s.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "Eliminar casa" })).toHaveCount(0);
  }
  await page.goto(`/propietario/casas/${draft.id}`);
  await expect(page.getByRole("button", { name: "Descartar borrador" })).toBeVisible();
});
