import { expect, test } from "@playwright/test";
import { postgrestHarness } from "../db/postgrest-harness";

// Medición (no es una puerta): apertura con el SW instalado hasta Explorar interactivo, con «Slow 4G» y CPU 4× de DevTools.
// Se corre a mano: MEDIR=1 pnpm test:e2e tests/e2e/medicion.spec.ts. Es local (vite preview en este equipo), no un teléfono.
test.skip(!process.env.MEDIR, "solo con MEDIR=1");
test.use({ serviceWorkers: "allow" });

// Valores del perfil «Slow 4G» de Chrome DevTools.
const SLOW_4G = { offline: false, latency: 562.5, downloadThroughput: 180_000, uploadThroughput: 84_375 };
const RUNS = 7;

test("apertura instalada hasta Explorar interactivo", async ({ context }) => {
  test.setTimeout(120_000);
  const h = await postgrestHarness();
  await h.reset();
  for (let i = 1; i <= 8; i++) await h.seed({ status: "active", draft: { title: `Casa Cocles ${i}`, zone: "Cocles", nightlyPriceCrc: 40000 + i * 1000 } });

  // Primera visita: instala el SW y guarda Explorar en IndexedDB.
  const first = await context.newPage();
  await first.goto("/explorar");
  await expect(first.getByTestId("results-count")).toHaveText("8 casas en Limón");
  await first.evaluate(() => navigator.serviceWorker.ready);
  await first.waitForTimeout(1500);
  await first.close();

  await context.addInitScript(() => {
    // Explorar interactivo: el recuento con datos pintado (React ya montó el router y los enlaces responden).
    const w = window as unknown as { interactiveAt?: number };
    new MutationObserver((_m, obs) => {
      if (document.querySelector('[data-testid="results-count"]')?.textContent?.includes("casas")) {
        w.interactiveAt = performance.now();
        obs.disconnect();
      }
    }).observe(document, { childList: true, subtree: true, characterData: true });
  });

  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", SLOW_4G);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const res = await page.goto("/explorar", { waitUntil: "commit" });
    expect(res?.fromServiceWorker()).toBe(true);
    await page.waitForFunction(() => (window as unknown as { interactiveAt?: number }).interactiveAt !== undefined, null, { timeout: 30_000 });
    times.push(await page.evaluate(() => Math.round((window as unknown as { interactiveAt: number }).interactiveAt)));
    await page.close();
  }
  const sorted = [...times].sort((a, b) => a - b);
  const p = (q: number) => sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)]!;
  console.log(`Apertura instalada → Explorar interactivo (Slow 4G + CPU 4×, ${RUNS} aperturas): ${times.join(", ")} ms · mediana ${p(0.5)} ms · p75 ${p(0.75)} ms`);
});
