// Capturas de las muestras de la historia 06 y las comparativas antes/propuesta. Uso, con el servidor estático de la raíz
// del repo en 8766:  cd apps/app && node ../../.scratch/revision-app-2026-11-17/06/muestras/capturar.mjs
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";
const { chromium } = createRequire(`${process.cwd()}/package.json`)("@playwright/test");
const dir = fileURLToPath(new URL(".", import.meta.url));
const base = "http://127.0.0.1:8766/.scratch/revision-app-2026-11-17/06/muestras/";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const VP = { 1280: { width: 1280, height: 800 }, 1440: { width: 1440, height: 900 }, 1920: { width: 1920, height: 1080 } };
const shots = [
  ["precio", 1280], ["nombre-error", 1280], ["descripcion-error", 1280], ["capacidad", 1280], ["caracteristicas", 1280],
  ["ubicacion", 1280], ["ubicacion", 1440], ["descartar", 1280],
  ["fotos", 1280], ["fotos", 1440], ["fotos", 1920], ["fotos-horizontal", 1280], ["fotos-horizontal", 1440], ["fotos-horizontal", 1920],
  ["fotos-recorte", 1280], ["fotos-recorte-h", 1440],
];
const measures = {};
for (const [s, w] of shots) {
  const page = await browser.newPage({ viewport: VP[w], deviceScaleFactor: 1 });
  await page.goto(`${base}muestras.html?s=${s}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}propuesta-${w}-${s}.png` });
  measures[`${s}-${w}`] = await page.evaluate(() => {
    const box = (q) => { const e = document.querySelector(q); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; };
    return { dialog: box(".dialog"), body: box(".dialog-body"), stage: box(".p06-stage"), pic: box(".p06-pic"), cell: box(".p06-cell"), map: box(".map-wrap") };
  });
  await page.close();
}
writeFileSync(`${dir}medidas-propuesta.json`, JSON.stringify(measures, null, 2));
// Comparativas lado a lado (antes a la izquierda).
const pairs = [
  ["precio", "../antes/1280-1-inline-precio.png", "propuesta-1280-precio.png"],
  ["descripcion", "../antes/1280-1-inline-descripcion.png", "propuesta-1280-descripcion-error.png"],
  ["ubicacion", "../antes/1280-1-inline-ubicacion.png", "propuesta-1280-ubicacion.png"],
  ["fotos-1280", "../antes/1280-3-fotos.png", "propuesta-1280-fotos.png"],
  ["fotos-1440", "../antes/1440-3-fotos.png", "propuesta-1440-fotos.png"],
  ["fotos-1920", "../antes/1920-3-fotos.png", "propuesta-1920-fotos.png"],
];
for (const [name, a, b] of pairs) {
  const page = await browser.newPage({ viewport: { width: 2000, height: 300 }, deviceScaleFactor: 1 });
  await page.goto(`${base}muestras.html?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  await page.screenshot({ path: `${dir}../comparar-${name}.png`, fullPage: true });
  await page.close();
}
await browser.close();
