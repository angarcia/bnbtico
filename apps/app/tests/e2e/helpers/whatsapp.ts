import type { Page } from "@playwright/test";

/**
 * Intercepta las salidas a WhatsApp (`location.assign` a wa.me es una navegación, no un fetch: la CSP `connect-src` no
 * la toca) y responde con una página mínima. Devuelve las URLs pedidas, tal cual.
 */
export async function catchWhatsApp(page: Page): Promise<string[]> {
  const urls: string[] = [];
  await page.route("https://wa.me/**", (route) => {
    urls.push(route.request().url());
    return route.fulfill({ contentType: "text/html", body: "<!doctype html><title>WhatsApp</title><p>WhatsApp</p>" });
  });
  return urls;
}

/**
 * Atrás desde la página falsa de WhatsApp. Las URLs de `catchWhatsApp` se apuntan al interceptar la petición, antes de que
 * la navegación a wa.me (otro sitio, otro proceso del navegador) se confirme: un `goBack` en ese hueco falla con
 * «Not attached to an active page» o `ERR_ABORTED`. Primero se espera a estar en wa.me, con la página cargada.
 */
export async function backFromWhatsApp(page: Page): Promise<void> {
  await page.waitForURL(/^https:\/\/wa\.me\//);
  await page.goBack();
}

/** La URL exacta que debe abrir «Abrir WhatsApp»: el número de la casa en dígitos y el mensaje codificado. */
export const waExpected = (e164: string, text: string) => `https://wa.me/${e164.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
