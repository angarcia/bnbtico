// Puerta de rendimiento (ticket 12): Lighthouse con el perfil móvil por defecto (pantalla de teléfono, RTT 150 ms,
// 1,6 Mbit/s, CPU 4×) contra el build local y Supabase local sembrado. Dos medidas, mediana de RUNS ejecuciones:
//  - Ficha /casa/CT-…: visita en frío desde un enlace de WhatsApp (sin caché ni service worker). LCP < 2,0 s.
//  - Shell instalado /explorar: segunda carga con el service worker ya instalado y la caché de Query en IndexedDB. LCP < 2,5 s.
// Throttling «devtools» (aplicado de verdad por CDP), no el simulado: Lantern modela como red las respuestas que da el
// service worker desde su caché, y la segunda medida perdería justo lo que mide. Delante del preview va un proxy que
// comprime como Cloudflare (gzip-proxy.ts). Resultados (resumen.md e informes HTML) en lighthouse-results/.
import { appendFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, expect, test } from "@playwright/test";
import lighthouse, { type Flags } from "lighthouse";
import { postgrestHarness } from "../db/postgrest-harness";
import { realPhotos } from "../e2e/helpers/real-photos";
import { gzipProxy } from "./gzip-proxy";

const RUNS = Number(process.env.LH_RUNS ?? 3);
const BUDGET = { ficha: 2000, shell: 2500 } as const;
const OUT = new URL("../../lighthouse-results/", import.meta.url).pathname;
type Metrics = { lcp: number; fcp: number; tbt: number; cls: number; si: number; score: number };

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address() as { port: number };
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

const sec = (ms: number, digits = 2) => `${(ms / 1000).toFixed(digits).replace(".", ",")} s`;

function median(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}

test("Lighthouse móvil: ficha y shell instalado dentro del presupuesto de LCP", async ({ baseURL: preview }) => {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  const h = await postgrestHarness();
  await h.reset();
  const casa = await h.seed({
    status: "active",
    photos: 5,
    draft: { title: "Casa Playa Negra", zone: "Playa Negra", zoneSource: "other", zoneId: null, nightlyPriceCrc: 95000, features: ["wifi", "pool", "parking"], parkingPaid: false },
  });
  await realPhotos(casa.id);
  for (let i = 1; i <= 7; i++) {
    const s = await h.seed({ status: "active", draft: { title: `Casa Cocles ${i}`, zone: "Cocles", zoneSource: "other", zoneId: null, nightlyPriceCrc: 40000 + i * 1000 } });
    await realPhotos(s.id);
  }

  const proxy = await gzipProxy(preview!);
  const baseURL = proxy.url;
  const port = await freePort();
  const profile = join(tmpdir(), `bnbtico-lh-${Date.now()}`);
  // Contexto persistente = contexto por defecto del navegador: Lighthouse (por el puerto de depuración) ve el mismo
  // service worker, caché y IndexedDB que deja el calentamiento de Playwright.
  const context = await chromium.launchPersistentContext(profile, {
    executablePath: process.env.CHROMIUM_PATH || undefined,
    headless: true,
    args: [`--remote-debugging-port=${port}`],
    serviceWorkers: "allow",
  });

  const flags: Flags = {
    port,
    output: "html",
    logLevel: "error",
    onlyCategories: ["performance"],
    throttlingMethod: process.env.LH_THROTTLING === "simulate" ? "simulate" : "devtools",
    // Las teselas de OSM son de terceros y no forman parte del LCP; fuera para que la red ajena no meta ruido.
    blockedUrlPatterns: ["*tile.openstreetmap.org*"],
  };

  async function measure(name: "ficha" | "shell", url: string, extra: Partial<Flags>): Promise<Metrics[]> {
    const runs: Metrics[] = [];
    for (let i = 1; i <= RUNS; i++) {
      const result = await lighthouse(url, { ...flags, ...extra });
      if (!result) throw new Error("Lighthouse no devolvió resultado");
      const { lhr, report } = result;
      if (lhr.runtimeError) throw new Error(`${name}: ${lhr.runtimeError.code} ${lhr.runtimeError.message}`);
      writeFileSync(join(OUT, `${name}-${i}.html`), Array.isArray(report) ? report[0]! : report);
      const a = lhr.audits;
      runs.push({
        lcp: a["largest-contentful-paint"]!.numericValue!,
        fcp: a["first-contentful-paint"]!.numericValue!,
        tbt: a["total-blocking-time"]!.numericValue!,
        cls: a["cumulative-layout-shift"]!.numericValue!,
        si: a["speed-index"]!.numericValue!,
        score: Math.round((lhr.categories.performance!.score ?? 0) * 100),
      });
    }
    return runs;
  }

  let ficha: Metrics[];
  let shell: Metrics[];
  try {
    // 1) Ficha en frío: Lighthouse borra caché y almacenamiento del origen antes de cada ejecución.
    ficha = await measure("ficha", `${baseURL}/casa/${casa.publicId}`, { disableStorageReset: false });

    // 2) Instalar: primera visita a Explorar, service worker activo y caché de Query guardada en IndexedDB.
    const page = await context.newPage();
    await page.goto(`${baseURL}/explorar`);
    await expect(page.getByTestId("results-count")).toHaveText("8 casas");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            new Promise<boolean>((resolve) => {
              const req = indexedDB.open("bnbtico");
              req.onerror = () => resolve(false);
              req.onsuccess = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains("query-cache")) return resolve(false);
                const get = db.transaction("query-cache").objectStore("query-cache").get("bnbtico-query");
                get.onsuccess = () => resolve(typeof get.result === "string" && get.result.includes('"listings"'));
                get.onerror = () => resolve(false);
              };
            }),
        ),
      )
      .toBe(true);
    await page.close();

    // 3) Shell instalado: sin borrar nada, como al abrir la app desde la pantalla de inicio.
    shell = await measure("shell", `${baseURL}/explorar`, { disableStorageReset: true });
  } finally {
    await context.close();
    await proxy.close();
    rmSync(profile, { recursive: true, force: true });
  }

  const row = (label: string, budget: number, runs: Metrics[]) => {
    const m = (k: keyof Metrics) => median(runs.map((r) => r[k]));
    const lcp = m("lcp");
    const ok = lcp < budget;
    return {
      ok,
      lcp,
      line: `| ${label} | **${sec(lcp)}** ${ok ? "✅" : "❌"} | < ${sec(budget, 1)} | ${sec(m("fcp"))} | ${Math.round(m("tbt"))} ms | ${m("cls").toFixed(3).replace(".", ",")} | ${sec(m("si"))} | ${m("score")} | ${runs.map((r) => sec(r.lcp)).join(" · ")} |`,
    };
  };
  const f = row(`Ficha \`/casa/${casa.publicId}\` (en frío)`, BUDGET.ficha, ficha);
  const s = row("Shell instalado `/explorar` (segunda carga, SW)", BUDGET.shell, shell);
  const summary = [
    `### Lighthouse (móvil, CPU 4×, RTT 150 ms, 1,6 Mbit/s, throttling ${flags.throttlingMethod})`,
    "",
    `Mediana de ${RUNS} ejecuciones contra el build local y Supabase local (no es un teléfono en Costa Rica).`,
    "",
    "| Página | LCP | Puerta | FCP | TBT | CLS | Speed Index | Puntuación | LCP de cada ejecución |",
    "|---|---|---|---|---|---|---|---|---|",
    f.line,
    s.line,
    "",
  ].join("\n");
  writeFileSync(join(OUT, "resumen.md"), summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  console.log(summary);

  expect(f.lcp, `LCP de la ficha ${f.lcp} ms`).toBeLessThan(BUDGET.ficha);
  expect(s.lcp, `LCP del shell instalado ${s.lcp} ms`).toBeLessThan(BUDGET.shell);
});
