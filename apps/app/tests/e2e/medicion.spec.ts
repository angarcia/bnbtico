import { devices, expect, test } from "./helpers/test";
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

// Los presupuestos de CLAUDE.md con «Slow 4G» + CPU 4× por CDP, contra el preview detrás del proxy que comprime como
// Cloudflare. Toque: Event Timing (entrada → siguiente fotograma). Pantallas: del toque al fotograma con la pantalla nueva.
test("presupuestos con Slow 4G y CPU 4×", async ({ browser }) => {
  test.setTimeout(600_000);
  const { realPhotos } = await import("./helpers/real-photos");
  const { gzipProxy } = await import("../lighthouse/gzip-proxy");
  const { signIn } = await import("../db/local");
  const { SESSION_STORAGE_KEY } = await import("../../src/data/storage");
  const h = await postgrestHarness();
  await h.reset();
  const casa = await h.seed({ status: "active", photos: 5, draft: { title: "Casa Playa Negra", zone: "Playa Negra", nightlyPriceCrc: 95000 } });
  await realPhotos(casa.id);
  for (let i = 1; i <= 5; i++) await realPhotos((await h.seed({ status: "active", draft: { title: `Casa Cocles ${i}`, zone: "Cocles" } })).id);
  const proxy = await gzipProxy(`http://127.0.0.1:${process.env.E2E_PORT ?? 4173}`);
  const base = proxy.url;
  const p = (xs: number[], q: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.ceil(q * xs.length) - 1)]!;
  const report = (name: string, xs: number[], budget: string) =>
    console.log(`${name}: ${xs.map(Math.round).join(", ")} ms · mediana ${Math.round(p(xs, 0.5))} · p75 ${Math.round(p(xs, 0.75))} (presupuesto ${budget})`);

  async function throttled(ctx: import("@playwright/test").BrowserContext) {
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", SLOW_4G);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    return { page, cdp };
  }
  // Del clic (programático, en la página) al fotograma en que aparece `selector`.
  const navTime = (page: import("@playwright/test").Page, click: string, selector: string, text = "") =>
    page.evaluate(
      ([click, selector, text]) =>
        new Promise<number>((resolve) => {
          const t0 = performance.now();
          (document.querySelector(click) as HTMLElement).click();
          const there = () => [...document.querySelectorAll(selector)].some((el) => (el.textContent ?? "").includes(text));
          const check = () => (there() ? requestAnimationFrame(() => resolve(performance.now() - t0)) : requestAnimationFrame(check));
          check();
        }),
      [click, selector, text] as const,
    );

  // 1) Ficha en frío: LCP.
  const lcps: number[] = [];
  for (let i = 0; i < 5; i++) {
    const ctx = await browser.newContext({ ...devices["Pixel 7"], serviceWorkers: "block" as const });
    const { page } = await throttled(ctx);
    await page.addInitScript(() => {
      const w = window as unknown as { lcp?: number };
      new PerformanceObserver((l) => (w.lcp = l.getEntries().at(-1)!.startTime)).observe({ type: "largest-contentful-paint", buffered: true });
    });
    await page.goto(`${base}/casa/${casa.publicId}`, { waitUntil: "load" });
    await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true", { timeout: 30_000 });
    lcps.push(await page.evaluate(() => (window as unknown as { lcp: number }).lcp));

    // 2) Toque: el corazón de favoritos (con la ficha ya hidratada; la ficha ya no cambia de moneda, ticket 15).
    if (i === 0) {
      const taps: number[] = [];
      await page.evaluate(() => {
        const w = window as unknown as { taps: number[] };
        w.taps = [];
        new PerformanceObserver((l) => l.getEntries().forEach((e) => e.name === "click" && w.taps.push(e.duration))).observe({ type: "event", durationThreshold: 16 } as PerformanceObserverInit);
      });
      for (let t = 0; t < 6; t++) {
        await page.locator(".heart-hero").click();
        await page.waitForTimeout(300);
      }
      taps.push(...(await page.evaluate(() => (window as unknown as { taps: number[] }).taps)));
      console.log(`Toque del corazón (Event Timing, solo se registran ≥ 16 ms): ${taps.length ? taps.join(", ") + " ms" : "todos < 16 ms"} (presupuesto < 50 ms)`);
    }
    await ctx.close();
  }
  report("Ficha en frío, LCP", lcps, "< 1,5 s p75 real; puerta Lighthouse < 2,0 s");

  // 3) Pantalla ya visitada, sin red: Explorar ⇄ Filtros.
  {
    const ctx = await browser.newContext({ ...devices["Pixel 7"], serviceWorkers: "block" as const });
    const { page } = await throttled(ctx);
    await page.goto(`${base}/explorar`);
    await expect(page.getByTestId("results-count")).toHaveText("6 casas en Limón", { timeout: 30_000 });
    await page.getByRole("link", { name: /Más filtros/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Filtros" })).toBeVisible({ timeout: 30_000 });
    await page.goBack();
    await expect(page.getByTestId("results-count")).toBeVisible();
    await ctx.setOffline(true);
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      times.push(await navTime(page, 'a[href^="/explorar/filtros"]', "h1", "Filtros"));
      await expect(page.getByRole("heading", { level: 1, name: "Filtros" })).toBeVisible();
      await page.goBack();
      await expect(page.getByTestId("results-count")).toBeVisible();
    }
    report("Pantalla visitada sin red (Explorar → Filtros)", times, "< 100 ms");
    // Pestaña con pantalla diferida (Favoritos), ya visitada: el trozo está cargado y no espera a la red.
    await ctx.setOffline(false);
    await page.getByRole("link", { name: "Favoritos" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Favoritos" })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("link", { name: "Explorar" }).click();
    await expect(page.getByTestId("results-count")).toBeVisible();
    await ctx.setOffline(true);
    const tabs: number[] = [];
    for (let i = 0; i < 5; i++) {
      tabs.push(await navTime(page, 'nav a[href="/favoritos"]', "h1", "Favoritos"));
      await page.getByRole("link", { name: "Explorar" }).click();
      await expect(page.getByTestId("results-count")).toBeVisible();
    }
    report("Pestaña visitada sin red (Explorar → Favoritos, pantalla diferida)", tabs, "< 100 ms");
    await ctx.close();
  }

  // 4) Pantalla nueva con sesión: Calendario → Mis casas por primera vez (datos de la red).
  {
    const client = await signIn("owner");
    const { data } = await client.auth.getSession();
    const times: number[] = [];
    for (let i = 0; i < 3; i++) {
      const ctx = await browser.newContext({ ...devices["Pixel 7"], serviceWorkers: "block" as const });
      const setup = await ctx.newPage();
      await setup.goto(`${base}/robots.txt`);
      await setup.evaluate(([k, v]) => localStorage.setItem(k!, v!), [SESSION_STORAGE_KEY, JSON.stringify(data.session)]);
      await setup.close();
      const { page } = await throttled(ctx);
      await page.goto(`${base}/propietario/calendario`);
      await expect(page.getByRole("heading", { level: 1, name: "Calendario" })).toBeVisible({ timeout: 30_000 });
      times.push(await navTime(page, 'a[href="/propietario/casas"]', "article h2, article h3", "Casa Cocles"));
      await ctx.close();
    }
    report("Pantalla nueva con sesión (Calendario → Mis casas, con red)", times, "< 300 ms");
  }
  await proxy.close();
});
