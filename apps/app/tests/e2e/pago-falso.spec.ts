import { expect, test } from "./helpers/test";
import { postgrestHarness } from "../db/postgrest-harness";

// Método de pago con la pasarela falsa de punta a punta (fase 5, ticket 04): worker (vite preview, PAYMENTS=fake de
// pnpm dev:vars) → payment_setup_context con el JWT del propietario → página /_pago-falso sin nada en línea →
// webhook falso firmado → apply_payment_event en Supabase local. Las pantallas llegan en el ticket 05.
test("la casa pendiente de pago vuelve a activa al guardar la tarjeta de prueba", async ({ page, baseURL }) => {
  const h = await postgrestHarness();
  await h.reset();
  const casa = await h.seed({ status: "active" });
  await h.setDaysLeft(casa.id, -1);
  await h.service.runDay();
  expect((await h.billing("owner").overview()).houses.find((x) => x.listingId === casa.id)!.status).toBe("payment_due");

  const res = await page.request.post("/api/pago/sesion", { headers: { authorization: `Bearer ${await h.jwt("owner")}`, origin: baseURL! }, data: { publicId: casa.publicId } });
  expect(res.status()).toBe(200);
  const { url } = (await res.json()) as { url: string };
  expect(url.startsWith(`${baseURL}/_pago-falso/`)).toBe(true);

  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Pasarela de prueba" })).toBeVisible();
  const saved = page.waitForResponse((r) => r.url() === url && r.request().method() === "POST");
  await page.getByRole("button", { name: "Guardar tarjeta de prueba" }).click();
  const answer = await saved;
  expect(answer.status()).toBe(303);
  expect(answer.headers()["location"]).toBe(`${baseURL}/propietario/suscripcion?pago=ok#pago=${casa.publicId}`);

  const overview = await h.billing("owner").overview();
  expect(overview.method).toMatchObject({ brand: "visa", last4: "4242" });
  expect(overview.houses.find((x) => x.listingId === casa.id)!.status).toBe("active");
  expect(await h.storedMethod("owner")).toMatchObject({ customerRef: expect.stringMatching(/^fake_cus_/), methodRef: expect.stringMatching(/^fake_pm_/) });

  // Sin sesión válida, la sesión de pago no se abre.
  expect((await page.request.post("/api/pago/sesion", { headers: { authorization: "Bearer no-vale", origin: baseURL! }, data: {} })).status()).toBe(401);
});
