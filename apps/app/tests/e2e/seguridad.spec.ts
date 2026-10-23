import { expect, test } from "./helpers/test";
import type { Seeded } from "../contract/harness";
import { localSupabase } from "../db/local";
import { postgrestHarness } from "../db/postgrest-harness";
import { deleteAccount, FREE_PHONE } from "../db/postgrest-auth-harness";

// CSP aplicada en el build (shell desde _headers, ficha desde el worker) y Turnstile en el inicio del código.
let casa: Seeded;

test.beforeAll(async () => {
  const h = await postgrestHarness();
  await h.reset();
  casa = await h.seed({ status: "active", photos: 5 });
});

test("el shell y la ficha llevan la CSP; Turnstile solo en el shell", async ({ request }) => {
  for (const path of ["/", "/explorar", "/cuenta", "/propietario/publicar"]) {
    const csp = (await request.get(path)).headers()["content-security-policy"];
    expect(csp, path).toContain("script-src 'self' https://challenges.cloudflare.com;");
    expect(csp, path).toContain("style-src 'self';");
    expect(csp, path).toContain(`connect-src 'self' ${localSupabase().url} https://tile.openstreetmap.org`);
    expect(csp, path).not.toContain("unsafe-inline");
  }
  const ficha = (await request.get(`/casa/${casa.publicId}`)).headers()["content-security-policy"];
  expect(ficha).toContain("script-src 'self';");
  expect(ficha).toContain("frame-src 'none'");
});

test.describe("con violaciones esperadas", () => {
  test.use({ allowCspViolations: true });

  test("la CSP se aplica: un script en línea inyectado no corre y se registra la violación", async ({ page, cspViolations }) => {
    await page.goto("/explorar");
    await expect(page.getByRole("heading", { name: "¿Para dónde va?" })).toBeVisible();
    const ran = await page.evaluate(async () => {
      const s = document.createElement("script");
      s.textContent = "window.__inline = true";
      document.head.appendChild(s);
      await new Promise((r) => setTimeout(r, 100));
      return (window as { __inline?: boolean }).__inline === true;
    });
    expect(ran).toBe(false);
    await expect.poll(() => cspViolations.length).toBeGreaterThan(0);
    expect(cspViolations.join("\n")).toContain("script-src");
  });
});

test("Turnstile se carga solo en Ingresar y su token llega a Supabase Auth al pedir el código", async ({ page }) => {
  const turnstile: string[] = [];
  page.on("request", (r) => r.url().startsWith("https://challenges.cloudflare.com/") && turnstile.push(r.url()));
  await page.goto("/explorar");
  await expect(page.getByRole("heading", { name: "¿Para dónde va?" })).toBeVisible();
  expect(turnstile).toEqual([]);

  await deleteAccount(FREE_PHONE);
  await page.goto("/cuenta");
  await page.getByLabel("Nombre").fill("Ana Prueba");
  await page.getByLabel("Número de WhatsApp").fill("8888 9999");
  const otp = page.waitForRequest((r) => r.url().includes("/auth/v1/otp") && r.method() === "POST");
  await page.getByRole("button", { name: "Recibir código por WhatsApp" }).click();
  // La sitekey de prueba de Cloudflare (1x00000000000000000000AA) siempre pasa y da este token.
  expect((await otp).postDataJSON()).toMatchObject({ phone: "+50688889999", gotrue_meta_security: { captcha_token: "XXXX.DUMMY.TOKEN.XXXX" } });
  await expect(page).toHaveURL(/\/cuenta\/codigo/);
  expect(turnstile.some((u) => u.includes("/turnstile/v0/api.js"))).toBe(true);
});
