import { expect, type Page } from "./test";
import { totp } from "../../contract/totp";
import { TEST_PHONES, serviceClient, totpSecretOf } from "../../db/local";

export const userIdOf = async (phone: string) => (await serviceClient().from("profiles").select("id").eq("phone", phone).single()).data!.id;
export const factorsOf = async (phone: string) => (await serviceClient().auth.admin.mfa.listFactors({ userId: await userIdOf(phone) })).data?.factors ?? [];

/** El código que mostraría ahora la app de autenticación del admin. */
export async function adminCode() {
  const verified = (await factorsOf(TEST_PHONES.admin)).find((f) => f.status === "verified");
  return totp(totpSecretOf(verified!.id));
}

export async function secondCode(page: Page) {
  await expect(page).toHaveURL(/\/admin\/codigo/);
  await expect(page.getByRole("heading", { name: "Confirme que es usted" })).toBeVisible();
  await expect(page.getByText("Abra su app de autenticación y escriba el código de 6 dígitos de 3bstays.")).toBeVisible();
  await expect(page.getByRole("img", { name: "Código QR para su app de autenticación" })).toHaveCount(0);
  const verify = page.getByRole("button", { name: "Verificar y entrar" });
  await expect(verify).toBeEnabled();
  await page.getByLabel("Código de 6 dígitos").fill(await adminCode());
  await verify.click();
}
