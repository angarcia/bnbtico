import { spawnSync } from "node:child_process";
import { appendFileSync, closeSync, copyFileSync, cpSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { constants } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeRun, sanitizeRun } from "./sanitize-playwright-artifacts.mjs";

const ci = fileURLToPath(new URL("./ci-e2e.mjs", import.meta.url));
const ensure = (condition) => {
  if (!condition) throw Object.assign(new Error("Diagnóstico no publicable."), { code: "ci" });
};
// Los logs de texto libre (pnpm, Supabase, Vite, apt, Playwright, Lighthouse) quedan en <raíz>/logs: fuera de raw y
// render, el saneador no los lee ni se publican, y «Borrar diagnósticos privados» los borra con la raíz.
const logsOf = (root) => join(root, "logs");
const environment = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
  !name.startsWith("PLAYWRIGHT_") && !name.startsWith("PW_") && name !== "PWDEBUG" &&
  !["GITHUB_STEP_SUMMARY", "GITHUB_OUTPUT", "GITHUB_ENV", "GITHUB_PATH", "GITHUB_STATE"].includes(name)));

function command(executable, args, log, env = environment, stdout = log) {
  const out = openSync(stdout, "a", 0o600);
  const err = stdout === log ? out : openSync(log, "a", 0o600);
  try {
    const result = spawnSync(executable, args, { env, stdio: ["ignore", out, err] });
    return result.status ?? (result.signal ? 128 + constants.signals[result.signal] : 1);
  } finally {
    closeSync(out);
    if (err !== out) closeSync(err);
  }
}

// El reporter JSON escribe el informe por stdout de una sola vez («{\n  "config": …\n}»). Lo que otro proceso cuele
// delante o detrás (en CI, p. ej., líneas «[WebServer]») no es parte del informe y lo dejaba sin parsear: va al log
// privado, que no se publica, y el informe queda tal cual lo escribió Playwright. Si no se puede separar, no se toca y
// el saneador lo rechaza como antes.
function isolateReport(file, log) {
  const text = readFileSync(file, "utf8");
  try { JSON.parse(text); return; } catch {}
  const start = text.indexOf('{\n  "config": {');
  const end = text.lastIndexOf("\n}");
  if (start < 0 || end < start) return;
  const report = text.slice(start, end + 2);
  try { JSON.parse(report); } catch { return; }
  appendFileSync(log, `${text.slice(0, start)}${text.slice(end + 2)}`, { mode: 0o600 });
  writeFileSync(file, `${report}\n`, { mode: 0o600 });
}

async function publish(root, code, gateCode = 0) {
  await sanitizeRun({ root, input: "render", output: "publish" });
  const output = join(root, "publish");
  const summary = join(output, "summary.md");
  if (process.env.GITHUB_STEP_SUMMARY && existsSync(summary)) appendFileSync(process.env.GITHUB_STEP_SUMMARY, readFileSync(summary));
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT,
    `publish=${output}\ne2e_rc=${code}\ngate_rc=${gateCode}\nsafe_to_upload=true\n`);
  return code || gateCode;
}

async function e2e(root, current, total) {
  ensure(["2", "3"].includes(total) && /^[1-3]$/.test(current) && Number(current) <= Number(total));
  const raw = join(root, "raw");
  const render = join(root, "render");
  const logs = logsOf(root);
  const env = {
    ...environment,
    PW_ARTIFACT_ROOT: root,
    CI_SHARD_CURRENT: current,
    CI_SHARD_TOTAL: total,
  };
  const shard = `--shard=${current}/${total}`;
  const manifest = join(raw, "expected-shard.json");
  const listCode = command("pnpm", ["exec", "playwright", "test", "--list", "--reporter=json", shard, "--workers=1"],
    join(logs, "discovery.log"), env, manifest);
  ensure(listCode === 0);
  isolateReport(manifest, join(logs, "discovery.log"));
  const code = command("pnpm", ["exec", "playwright", "test", "--reporter=json", `--output=${join(raw, "results")}`, shard, "--workers=1"],
    join(logs, "runner.log"), env, join(raw, "runner.json"));
  isolateReport(join(raw, "runner.json"), join(logs, "runner.log"));
  writeFileSync(join(raw, "e2e-exit.txt"), `${code}\n`, { mode: 0o600 });
  // Solo el código numérico; los logs y el contenido de los artefactos siguen privados.
  console.log(`Playwright: código de salida ${code}.`);
  await sanitizeRun({ root, output: "clean" });
  const clean = join(root, "clean");
  // El JSON nativo ya contiene el resultado completo del shard. Evita el ZIP blob
  // intermedio, que puede repetir adjuntos; las trazas siguen en raw/results.
  copyFileSync(join(clean, "runner.json"), join(render, "e2e.json"));
  for (const file of ["runner.json", "e2e-exit.txt", "expected-shard.json"]) copyFileSync(join(clean, file), join(render, file));
  const normalized = join(render, "e2e-normalized.json");
  const normalizeCode = command(process.execPath, [ci, "normalize", join(render, "e2e.json"), join(clean, "expected-shard.json"), normalized],
    join(logs, "normalizer.log"));
  ensure(normalizeCode === 0 && existsSync(normalized));
  JSON.parse(readFileSync(normalized, "utf8"));
  mkdirSync(join(render, "test-results"), { mode: 0o700 });
  copyFileSync(normalized, join(render, "test-results", "e2e.json"));
  const gateCode = command(process.execPath, [ci, "gate", normalized, join(clean, "expected-shard.json")],
    join(logs, "gate.log"));
  writeFileSync(join(render, "gate-exit.txt"), `${gateCode}\n`, { mode: 0o600 });
  return publish(root, code, gateCode);
}

async function bundle(mode, root, args) {
  const raw = join(root, "raw");
  const log = join(logsOf(root), "runner.log");
  let code = 0;
  if (mode === "inventory") {
    code = command(process.execPath, [ci, "inventory", raw], log);
    ensure(code === 0 && existsSync(join(raw, "inventory.json")));
  } else if (mode === "preparation") {
    // Solo los tiempos y códigos (TSV); el log de preparación se queda privado en el runner.
    ensure(args.length === 1);
    copyFileSync(args[0], join(raw, "e2e-preparation.tsv"));
  } else if (mode === "report") {
    code = command(process.execPath, [ci, "report", ...args, raw], log);
    ensure(existsSync(join(raw, "summary.json")) && existsSync(join(raw, "summary.md")));
    JSON.parse(readFileSync(join(raw, "summary.json"), "utf8"));
  } else if (mode === "lighthouse") {
    code = command("pnpm", ["lighthouse"], log);
    ensure(existsSync("lighthouse-results"));
    // Solo el resumen y los JSON; los informes HTML quedan aplazados (decisión de Daniel).
    mkdirSync(join(raw, "lighthouse"), { mode: 0o700 });
    for (const name of readdirSync("lighthouse-results")) {
      if (name === "resumen.md" || name.endsWith(".json")) copyFileSync(join("lighthouse-results", name), join(raw, "lighthouse", name));
    }
  } else {
    throw new Error("Comando desconocido.");
  }
  writeFileSync(join(raw, "command-exit.txt"), `${code}\n`, { mode: 0o600 });
  await sanitizeRun({ root, output: "clean" });
  for (const name of readdirSync(join(root, "clean"))) {
    if (name !== "sanitization.json") cpSync(join(root, "clean", name), join(root, "render", name), { recursive: true, dereference: false });
  }
  return publish(root, code);
}

const [mode, root, ...args] = process.argv.slice(2);
try {
  process.umask(0o077);
  await initializeRun(root);
  mkdirSync(logsOf(root), { mode: 0o700 });
  process.exitCode = mode === "e2e" ? await e2e(root, ...args) : await bundle(mode, root, args);
} catch (error) {
  // Solo el código fijo (p. ej. «json» del saneador o «ci» de este guion), nunca contenido de los artefactos.
  const code = typeof error?.code === "string" && /^[a-z0-9-]{1,40}$/.test(error.code) ? error.code : "error";
  // Y dónde: solo nombres de archivo saneados por el propio saneador («runner.json > encoded.txt»), sin contenido.
  const where = typeof error?.where === "string" && /^[A-Za-z0-9._> -]{1,300}$/.test(error.where) ? ` en ${error.where}` : "";
  console.error(`Diagnóstico no publicable (${code}${where}); no se autoriza la subida.`);
  process.exitCode = 1;
}
