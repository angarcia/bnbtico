// Capturas de las muestras de la historia 07 (móvil 375 y escritorio 1280). Uso, con el servidor estático en 8766:
//   cd apps/app && node ../../.scratch/revision-app-2026-11-17/07/muestras/capturar.mjs
import { createRequire } from "node:module";
// Playwright se resuelve desde apps/app (este archivo vive fuera del paquete).
const { chromium } = createRequire(`${process.cwd()}/package.json`)("@playwright/test");
import { fileURLToPath } from "node:url";
const out = fileURLToPath(new URL(".", import.meta.url));
const url = "http://127.0.0.1:8766/.scratch/revision-app-2026-11-17/07/muestras/muestras.html";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
for (const [name, viewport] of [["movil-375", { width: 375, height: 812 }], ["escritorio-1280", { width: 1280, height: 800 }]]) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${out}${name}.png`, fullPage: true });
  await page.close();
}
await browser.close();
