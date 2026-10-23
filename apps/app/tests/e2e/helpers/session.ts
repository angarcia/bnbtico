import { expect, type Page } from "@playwright/test";
import { SESSION_STORAGE_KEY } from "../../../src/data/storage";
import { signIn, type TEST_PHONES } from "../../db/local";

/** Abre sesión desde Node con un número de prueba y la deja en el localStorage del navegador, como si ya hubiera ingresado. */
export async function injectSession(page: Page, who: keyof typeof TEST_PHONES) {
  const client = await signIn(who);
  const { data } = await client.auth.getSession();
  await page.goto("/robots.txt");
  await page.evaluate(([key, value]) => localStorage.setItem(key!, value!), [SESSION_STORAGE_KEY, JSON.stringify(data.session)]);
}

/** Registro o ingreso por la interfaz con el código de prueba 123456. */
export async function enterCode(page: Page) {
  await expect(page).toHaveURL(/\/cuenta\/codigo/);
  await page.getByLabel("Código de 6 dígitos").fill("123456");
  await page.getByRole("button", { name: "Verificar y continuar" }).click();
}

export async function expectNoCookies(page: Page) {
  expect(await page.evaluate(() => document.cookie)).toBe("");
  expect(await page.context().cookies()).toEqual([]);
}
