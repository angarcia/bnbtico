import { expect, test } from "./helpers/test";
import { TEST_PHONES } from "../db/local";
import { enterCode, injectSession, signOut } from "./helpers/session";

test("3Btico se abre sin sesión y conserva la navegación a 320 px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.route("**/rest/v1/rpc/launch_offer_taken", (route) => route.fulfill({ json: 50 }));
  await page.goto("/");
  await expect(page).toHaveURL(/\/que-es-3bstays$/);
  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  const info = nav.getByRole("link", { name: "3Btico", exact: true });
  await expect(nav.getByRole("link")).toHaveText(["3Btico", "Explorar", "Favoritos", "Ingresar"]);
  await expect(info).toHaveAttribute("aria-current", "page");
  await nav.getByRole("link", { name: "Explorar" }).click();
  await info.focus();
  await expect(info).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(info).toHaveAttribute("aria-current", "page");
  await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
  await expect(info.locator("svg")).toHaveAttribute("aria-hidden", "true");
  await expect(info.locator("svg")).toHaveAttribute("width", "26");
  await expect(page.getByRole("banner").getByRole("img", { name: "3bstays" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Anuncie su casa gratis durante 6 meses" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Publicar mi casa" })).toHaveAttribute("href", "/publicar");
  await expect(page.getByRole("link", { name: "Publique ahora y obtenga 6 meses gratis" })).toHaveAttribute("href", "/publicar");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  const offerLink = page.getByRole("link", { name: "Publique ahora y obtenga 6 meses gratis" });
  await offerLink.scrollIntoViewIfNeeded();
  await expect(offerLink).toBeInViewport();

  await page.getByRole("link", { name: "Aquí, explorar alojamientos" }).click();
  await expect(page).toHaveURL(/\/explorar$/);
  await info.click();
  await nav.getByRole("link", { name: "Favoritos" }).click();
  await expect(page).toHaveURL(/\/favoritos$/);
  await info.click();
  await nav.getByRole("link", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/cuenta$/);
  await expect(page.getByRole("heading", { name: "¿Busca alojamiento en Costa Rica?" })).toHaveCount(0);
});

test("el viajero entra por Explorar, conserva 3Btico y vuelve allí al salir", async ({ page }) => {
  await injectSession(page, "other");
  await page.goto("/");
  await expect(page).toHaveURL(/\/explorar$/);
  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  await nav.getByRole("link", { name: "3Btico" }).click();
  await expect(page).toHaveURL(/\/que-es-3bstays$/);
  await page.goto("/cuenta");
  await signOut(page);
  await expect(nav.getByRole("link", { name: "3Btico" })).toHaveAttribute("aria-current", "page");
});

test("si se inicia sesión en otra pestaña, 3Btico lleva a Explorar", async ({ page, context }) => {
  await page.goto("/que-es-3bstays");
  await expect(page.getByRole("heading", { name: "¿Busca alojamiento en Costa Rica?" })).toBeVisible();
  const login = await context.newPage();
  await login.goto("/cuenta");
  await login.getByLabel("Número de WhatsApp").fill(TEST_PHONES.other.replace(/^\+506/, "").trim());
  await login.getByRole("button", { name: "Recibir código por WhatsApp" }).click();
  await enterCode(login);
  await expect(page).toHaveURL(/\/explorar$/);
  await expect(page.getByRole("link", { name: "3Btico", exact: true })).toBeVisible();
});

test("si la oferta se agota, la pantalla muestra la suscripción sin meses gratis", async ({ page }) => {
  await page.route("**/rest/v1/rpc/launch_offer_taken", (route) => route.fulfill({ json: 200 }));
  await page.goto("/que-es-3bstays");
  await expect(page.getByRole("heading", { name: "Suscripción por casa activa" })).toBeVisible();
  await expect(page.getByText(/meses gratis|publique su casa gratis/i)).toHaveCount(0);
});
