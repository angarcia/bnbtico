// `test` de Playwright con la CSP vigilada (ticket 11): toda prueba falla si el documento de la app registra una violación
// de la Content Security Policy (evento securitypolicyviolation o el aviso de consola de Chrome). Las violaciones dentro
// de iframes de terceros (Turnstile) no son nuestras y no cuentan.
import { test as base } from "@playwright/test";

export * from "@playwright/test";

declare global {
  interface Window {
    __cspViolations?: string[];
  }
}

export const test = base.extend<{ allowCspViolations: boolean; cspViolations: string[]; noPhoton: void }>({
  // Nada sale a Photon (sugerencias de zona del asistente, ticket 22): sin sugerencias salvo que la prueba lo intercepte
  // con page.route, que manda sobre la del contexto.
  noPhoton: [
    async ({ context }, use) => {
      await context.route("https://photon.komoot.io/**", (route) => route.fulfill({ json: { type: "FeatureCollection", features: [] }, headers: { "access-control-allow-origin": "*" } }));
      await use();
    },
    { auto: true },
  ],
  allowCspViolations: [false, { option: true }],
  cspViolations: [
    async ({ context, allowCspViolations, baseURL }, use) => {
      const violations: string[] = [];
      await context.addInitScript(() => {
        if (window.top !== window) return;
        window.__cspViolations = [];
        document.addEventListener("securitypolicyviolation", (e) => {
          const line = `${e.effectiveDirective} bloqueó ${e.blockedURI || "(en línea)"} en ${e.sourceFile || location.pathname}:${e.lineNumber}`;
          window.__cspViolations!.push(line);
          console.error(`[csp] ${line}`);
        });
      });
      context.on("console", (msg) => {
        const text = msg.text();
        const ours = !msg.location().url || msg.location().url.startsWith(baseURL ?? "http://127.0.0.1");
        if (ours && (text.startsWith("[csp] ") || /Content Security Policy/i.test(text))) violations.push(text);
      });
      await use(violations);
      if (!allowCspViolations && violations.length) throw new Error(`Violaciones de la CSP:\n${[...new Set(violations)].join("\n")}`);
    },
    { auto: true },
  ],
});
