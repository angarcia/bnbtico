// Comparativas «propuesta | resultado» de la historia 06 (y «antes | resultado» en el teléfono). Uso, con el servidor
// estático de la raíz del repo en 8766:  cd apps/app && node ../../.scratch/revision-app-2026-11-17/06/resultado/comparar.mjs
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(`${process.cwd()}/package.json`)("@playwright/test");
const dir = fileURLToPath(new URL(".", import.meta.url));
const base = "http://127.0.0.1:8766/.scratch/revision-app-2026-11-17/06/muestras/muestras.html";
const P = "Propuesta", R = "Resultado";
const pairs = [
  ["precio", "propuesta-1280-precio.png", "../resultado/resultado-1280-precio.png", P, R],
  ["ubicacion", "propuesta-1280-ubicacion.png", "../resultado/resultado-1280-ubicacion.png", P, R],
  ["ubicacion-1440", "propuesta-1440-ubicacion.png", "../resultado/resultado-1440-ubicacion.png", P, R],
  ["descripcion-error", "propuesta-1280-descripcion-error.png", "../resultado/resultado-1280-descripcion-error.png", P, R],
  ["nombre-error", "propuesta-1280-nombre-error.png", "../resultado/resultado-1280-nombre-error.png", P, R],
  ["descartar", "propuesta-1280-descartar.png", "../resultado/resultado-1280-descartar.png", P, R],
  ["fotos-1280", "propuesta-1280-fotos-recorte.png", "../resultado/resultado-1280-fotos.png", P, R],
  ["fotos-1440", "propuesta-1440-fotos.png", "../resultado/resultado-1440-fotos.png", P, R],
  ["fotos-horizontal-1440", "propuesta-1440-fotos-horizontal.png", "../resultado/resultado-1440-fotos-horizontal.png", P, R],
  ["fotos-quitar-1280", "propuesta-1280-fotos.png", "../resultado/resultado-1280-fotos-quitar.png", "Propuesta (sin la confirmación)", "Resultado: «¿Quitar esta foto?»"],
  ["fotos-quitar-1440", "propuesta-1440-fotos.png", "../resultado/resultado-1440-fotos-quitar.png", "Propuesta (sin la confirmación)", "Resultado: «¿Quitar esta foto?»"],
  ["movil-precio", "../antes/movil-precio.png", "../resultado/resultado-movil-precio.png", "Antes (teléfono)", "Resultado (teléfono, sin cambios)"],
  ["movil-fotos", "../antes/movil-fotos.png", "../resultado/resultado-movil-fotos.png", "Antes (teléfono)", "Resultado (teléfono, sin cambios)"],
];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
for (const [name, a, b, la, lb] of pairs) {
  const mobile = name.startsWith("movil");
  const page = await browser.newPage({ viewport: { width: mobile ? 900 : 2000, height: 300 }, deviceScaleFactor: 1 });
  await page.goto(`${base}?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}&la=${encodeURIComponent(la)}&lb=${encodeURIComponent(lb)}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
  await page.screenshot({ path: `${dir}comparar-${name}.png`, fullPage: true });
  await page.close();
}
await browser.close();
