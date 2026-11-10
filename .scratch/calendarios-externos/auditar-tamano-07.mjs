// Diagnóstico de solo lectura. Ana lo ejecuta: no build, instalación, red, Git mutable ni base de datos.
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const app = resolve(root, "apps/app");
const assetDir = resolve(app, "dist/client/assets");
const assets = readdirSync(assetDir).filter(name => name.endsWith(".js"));
const gzip = text => gzipSync(text, { level: 9 }).length; // Igual que @size-limit/file 14.3.0.
const hash = text => createHash("sha256").update(text).digest("hex");
const matches = (pattern, name) => new RegExp("^" + pattern.split("*").map(part => part.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\?/g, ".")).join(".*") + "$").test(name);
const checks = JSON.parse(readFileSync(resolve(app, ".size-limit.json"), "utf8"));
const focus = checks.filter(check => /^(Campos del asistente|Calendario ·|Airbnb ·|Hoja «Marcar una reserva»|Zona privada ·)/.test(check.name));
const checkFiles = check => {
  const all = assets.map(name => `dist/client/assets/${name}`);
  return all.filter(path => check.path.some(pattern => !pattern.startsWith("!") && matches(pattern, path)) &&
    !check.path.some(pattern => pattern.startsWith("!") && matches(pattern.slice(1), path)));
};
const groups = focus.map(check => {
  const files = checkFiles(check).map(path => ({ path, gzipBytes: gzip(readFileSync(resolve(app, path))) }));
  return { name: check.name.split(" · ")[0], limit: check.limit, gzipBytes: files.reduce((n, f) => n + f.gzipBytes, 0), files };
});
const chunks = assets.filter(name => /^(fields|calendario|airbnb|mark-sheet|reservation-calendar)-/.test(name)).map(name => {
  const source = readFileSync(resolve(assetDir, name), "utf8");
  const firstLineEnd = source.indexOf("\n");
  const preloadTable = source.startsWith("const __vite__mapDeps=") && firstLineEnd !== -1 ? source.slice(0, firstLineEnd + 1) : "";
  const dependencyArray = preloadTable.match(/m\.f=\[([^\]]*)\]/);
  return { name, rawBytes: Buffer.byteLength(source), gzipBytes: gzip(source),
    preloadTableRawBytes: Buffer.byteLength(preloadTable),
    // Diferencia orientativa de compresión: no es una propuesta de eliminar la precarga.
    gzipDifferenceWithoutPreloadTable: preloadTable ? gzip(source) - gzip(source.slice(preloadTable.length)) : 0,
    preloadDependencies: dependencyArray ? JSON.parse(`[${dependencyArray[1]}]`) : [],
    imports: [...source.matchAll(/\bfrom["']([^"']+)["']/g)].map(match => match[1]),
    dynamicImports: [...source.matchAll(/\bimport\(["']([^"']+)["']\)/g)].map(match => match[1]),
  };
});
const sourcePaths = [
  "apps/app/src/client/publish/fields.tsx",
  "apps/app/src/client/publish/location-step.tsx",
  "apps/app/src/client/publish/location-picker.tsx",
  "apps/app/src/client/screens/calendario.tsx",
  "apps/app/src/client/mark-sheet.tsx",
  "apps/app/src/client/airbnb-calendar-row.tsx",
  "apps/app/src/client/screens/airbnb.tsx",
  "apps/app/vite.config.ts",
];
const baseline = "b4d929a"; // Merge de #6, anterior a todo #7; no representa el estado intermedio de #7.
const sources = sourcePaths.map(path => {
  const current = readFileSync(resolve(root, path));
  try {
    const before = execFileSync("git", ["show", `${baseline}:${path}`], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    return { path, baseline, unchanged: hash(before) === hash(current), beforeRawBytes: before.length, currentRawBytes: current.length };
  } catch { return { path, baseline, comparisonUnavailable: true, currentRawBytes: current.length }; }
});
console.log(JSON.stringify({ measurement: "gzip nivel 9, suma por archivo como @size-limit/file; build existente", groups, chunks, sources }, null, 2));
