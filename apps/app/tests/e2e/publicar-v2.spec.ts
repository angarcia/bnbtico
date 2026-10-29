import { expect, test, type Page } from "./helpers/test";
import { deleteAccount, FREE_PHONE, INTL_PHONE } from "../db/postgrest-auth-harness";
import { enterCode } from "./helpers/session";

// Publicar v2 (decisiones §E): la cuenta nueva pregunta por la casa y la verificación desde publicar habla de guardar la
// casa. Contra Supabase local con los números de prueba (código 123456).
test.describe.configure({ mode: "serial" });

const READY = "¡Listo! Su cuenta está creada";

async function register(page: Page, phone: string, name: string, country?: string) {
  if (country) await page.getByLabel("País de su WhatsApp").selectOption({ label: country });
  await page.getByLabel("Número de WhatsApp").fill(phone);
  await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();
  await page.getByLabel("Nombre").fill(name);
  await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();
  await enterCode(page);
}

test("una cuenta nueva desde Ingresar responde Sí y entra al asistente", async ({ page }) => {
  await deleteAccount(FREE_PHONE);
  try {
    await page.goto("/explorar");
    await page.locator(".explore-top").getByRole("link", { name: "Ingresar" }).click();
    await register(page, "8888 9999", "Ana Prueba");
    await expect(page).toHaveURL(/\/cuenta\/lista/);
    await expect(page.getByRole("heading", { name: READY })).toBeVisible();
    await expect(page.getByRole("heading", { name: "¿Tiene una casa para alquilar?" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Añadir un correo de recuperación" })).toBeVisible();
    await page.getByRole("link", { name: "Sí, quiero publicarla" }).click();
    await expect(page).toHaveURL(/\/propietario\/publicar\/[0-9a-f-]{36}\/1$/);
  } finally {
    await deleteAccount(FREE_PHONE);
  }
});

test("otra cuenta nueva responde No y va a Explorar", async ({ page }) => {
  await deleteAccount(INTL_PHONE);
  try {
    await page.goto("/explorar");
    await page.locator(".explore-top").getByRole("link", { name: "Ingresar" }).click();
    await register(page, "+1 415 555 0100", "John Test", "Otro país");
    await expect(page).toHaveURL(/\/cuenta\/lista/);
    await expect(page.getByRole("heading", { name: "¿Tiene una casa para alquilar?" })).toBeVisible();
    await page.getByRole("link", { name: "No, busco casa" }).click();
    await expect(page).toHaveURL(/\/explorar$/);
  } finally {
    await deleteAccount(INTL_PHONE);
  }
});

test("verificar desde publicar habla de guardar la casa y nunca pasa por «¡Listo!»", async ({ page }) => {
  await deleteAccount(FREE_PHONE);
  try {
    await page.goto(`/cuenta?next=${encodeURIComponent("/publicar/continuar")}`);
    await expect(page.getByRole("heading", { name: "Para guardar su casa, verifique su WhatsApp" })).toBeVisible();
    await expect(page.getByText("Le enviamos un código por WhatsApp. Así nadie más puede publicar en su nombre.")).toBeVisible();
    await expect(page.getByText(/Su número solo se comparte con el propietario/)).toHaveCount(0);
    await expect(page.getByTestId("return-card")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "No tengo acceso a mi WhatsApp" })).toBeVisible();
    await page.getByLabel("Número de WhatsApp").fill("8888 9999");
    await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();
    await expect(page.getByRole("heading", { name: "Es su primera vez en bnbtico" })).toBeVisible();
    await page.getByLabel("Nombre").fill("Ana Prueba");
    await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();
    await expect(page).toHaveURL(/\/cuenta\/codigo\?next=%2Fpublicar%2Fcontinuar$/);
    await expect(page.getByRole("heading", { level: 1, name: "Publicar casa" })).toBeVisible();
    await expect(page.getByText("Después seguimos con su casa")).toBeVisible();
    await expect(page.getByText(/Después de verificar vuelve/)).toHaveCount(0);
    await enterCode(page);
    await expect(page).toHaveURL(/\/publicar\/continuar$/);
    await expect(page.getByRole("heading", { name: READY })).toHaveCount(0);
  } finally {
    await deleteAccount(FREE_PHONE);
  }
});

test("un enlace viejo a «¡Listo!» con la vuelta a publicar sigue hacia ella", async ({ page }) => {
  await deleteAccount(FREE_PHONE);
  try {
    await page.goto("/cuenta");
    await register(page, "8888 9999", "Ana Prueba");
    await expect(page).toHaveURL(/\/cuenta\/lista/);
    await page.goto(`/cuenta/lista?next=${encodeURIComponent("/publicar/continuar")}`);
    await expect(page).toHaveURL(/\/publicar\/continuar$/);
    await expect(page.getByRole("heading", { name: READY })).toHaveCount(0);
  } finally {
    await deleteAccount(FREE_PHONE);
  }
});
