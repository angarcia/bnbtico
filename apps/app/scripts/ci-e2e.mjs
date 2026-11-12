import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";

const ensure = (condition, message) => {
  if (!condition) throw new Error(message);
};
const read = (file) => JSON.parse(readFileSync(file, "utf8"));
const count = (value) => {
  ensure(["2", "3"].includes(value), "Solo se permiten dos o tres shards.");
  return Number(value);
};
const write = (file, value) => writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);

function cases(report) {
  ensure(!report.errors?.length, "El descubrimiento o la ejecución contiene errores.");
  const found = [];
  function walk(suites, parents = []) {
    for (const suite of suites) {
      const title = [...parents, suite.title];
      for (const spec of suite.specs ?? []) {
        ensure(spec.id && spec.file && spec.tests?.length === 1, "Identidad de caso incompleta o ambigua.");
        found.push({ id: spec.id, title: [...title, spec.title], file: spec.file, line: spec.line, column: spec.column });
      }
      walk(suite.suites ?? [], title);
    }
  }
  walk(report.suites ?? []);
  ensure(new Set(found.map(({ id }) => id)).size === found.length, "IDs duplicados.");
  return found;
}

function partition(full, shards) {
  const expected = new Map(full.map((test) => [test.id, test]));
  ensure(expected.size === full.length && full.length > 0, "Inventario vacío o duplicado.");
  const seen = new Set();
  const parts = shards.map((tests, index) => {
    ensure(tests.length > 0, `Shard ${index + 1} vacío.`);
    for (const test of tests) {
      ensure(isDeepStrictEqual(expected.get(test.id), test), `Caso desconocido o cambiado: ${test.id}.`);
      ensure(!seen.has(test.id), `Caso duplicado entre shards: ${test.id}.`);
      seen.add(test.id);
    }
    return { shard: index + 1, tests };
  });
  ensure(seen.size === full.length, `Faltan casos: ${full.length - seen.size}.`);
  return { total: shards.length, parts };
}

function list(shard) {
  const args = ["exec", "playwright", "test", "--list", "--reporter=json"];
  if (shard) args.push(`--shard=${shard}`);
  const result = spawnSync("pnpm", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  ensure(result.status === 0, `No se pudo listar Playwright: ${result.stderr}`);
  return JSON.parse(result.stdout);
}

function inventory(directory) {
  const full = list();
  const tests = cases(full);
  ensure(tests.length > 0, "Inventario vacío.");
  const configurations = [2, 3].map((total) => partition(tests,
    Array.from({ length: total }, (_, i) => cases(list(`${i + 1}/${total}`)))));
  mkdirSync(directory, { recursive: true });
  write(join(directory, "inventory.json"), { commit: process.env.GITHUB_SHA ?? "local", total: tests.length, tests, configurations });
  for (const config of configurations) {
    console.log(`${config.total} shards: ${config.parts.map((part) => part.tests.length).join(" + ")} = ${tests.length}`);
  }
}

function executions(report, strict = true) {
  const found = [];
  function walk(suites) {
    for (const suite of suites) {
      for (const spec of suite.specs ?? []) {
        const test = spec.tests[0];
        ensure(["expected", "skipped", "unexpected", "flaky"].includes(test.status), `Estado inválido: ${spec.id}.`);
        ensure(Array.isArray(test.results), `Resultados inválidos: ${spec.id}.`);
        if (strict) {
          ensure(["expected", "skipped"].includes(test.status), `Caso fallido o intermitente: ${spec.id}.`);
          ensure(test.results.length === 1 && test.results.every((result) => result.retry === 0), `Caso ausente o reintentado: ${spec.id}.`);
        }
        ensure(test.results.every((result) => Number.isFinite(result.duration) && result.duration >= 0), `Duración inválida: ${spec.id}.`);
        const duration = test.results.reduce((sum, result) => sum + result.duration, 0);
        found.push({ id: spec.id, file: spec.file, title: spec.title, status: test.status, durationMs: duration });
      }
      walk(suite.suites ?? []);
    }
  }
  walk(report.suites ?? []);
  return found;
}

function normalize(input, manifestFile, output) {
  const report = read(input);
  const manifest = read(manifestFile);
  const expected = cases(manifest);
  ensure(expected.length > 0, "Inventario vacío.");
  const shard = manifest.config?.shard;
  ensure([2, 3].includes(shard?.total) && Number.isInteger(shard.current) && shard.current >= 1 && shard.current <= shard.total, "Shard de inventario inválido.");
  for (const data of [manifest, report]) {
    ensure(data.config?.metadata?.commit === (process.env.GITHUB_SHA ?? "local"), "SHA de diagnóstico incorrecto.");
    ensure(isDeepStrictEqual(data.config.metadata.shard, shard), "Metadatos de shard incorrectos.");
    ensure(data.config.workers === 1 && data.config.projects?.length > 0 && data.config.projects.every(project => project.retries === 0), "Workers o reintentos incorrectos.");
  }
  ensure(report.config.shard === null || isDeepStrictEqual(report.config.shard, shard), "Shard de ejecución incorrecto.");
  ensure(Number.isFinite(report.stats?.duration) && report.stats.duration >= 0, "Duración de ejecución inválida.");
  ensure(Array.isArray(report.suites) && Array.isArray(report.errors), "Informe nativo incompleto.");
  cases({ ...report, errors: [] });
  executions(report, false);
  write(output, { ...report, config: { ...report.config, shard } });
}

function gate(input, manifestFile) {
  const report = read(input);
  const expected = cases(read(manifestFile));
  ensure(expected.length > 0 && isDeepStrictEqual(cases(report), expected), "El informe no coincide con el inventario.");
  executions(report);
}

function preparation(file) {
  const [header, ...rows] = readFileSync(file, "utf8").trim().split("\n");
  ensure(header === "paso\tsegundos\tcodigo", "Cabecera de tiempos incorrecta.");
  const times = rows.map((row) => {
    const [step, seconds, code] = row.split("\t");
    ensure(step && seconds?.trim() && code?.trim() && Number.isFinite(Number(seconds)) && Number(seconds) >= 0 && Number(code) === 0, `Preparación fallida o inválida: ${step}.`);
    return { step, seconds: Number(seconds), code: Number(code) };
  });
  ensure(isDeepStrictEqual(times.map(({ step }) => step), ["dependencias", "supabase", "variables-locales", "build-local", "navegador"]), "Faltan tiempos de preparación.");
  return times;
}

function summarize(inventoryFile, directory, shardCount, output) {
  const summary = { commit: process.env.GITHUB_SHA ?? "local", shards: [], errors: [] };
  let source;
  try {
    const total = count(shardCount);
    const attempt = process.env.CI_ARTIFACT_ATTEMPT;
    ensure(attempt === undefined || /^[1-9][0-9]*$/.test(attempt), "Intento de CI inválido.");
    const suffix = attempt ? `-attempt-${attempt}` : "";
    source = read(inventoryFile);
    ensure(source.commit === summary.commit, "El inventario pertenece a otro SHA.");
    const config = source.configurations.find((item) => item.total === total);
    ensure(config?.parts.length === total, "Falta la configuración del inventario.");
    partition(source.tests, config.parts.map((part) => part.tests));
    for (let shard = 1; shard <= total; shard++) {
      const item = { shard, total, tests: [], files: [], preparation: [] };
      summary.shards.push(item);
      try {
        const report = read(join(directory, `playwright-${shard}-of-${total}${suffix}`, "test-results/e2e.json"));
        ensure(report.config.metadata.commit === source.commit, "El informe pertenece a otro SHA.");
        item.runner = report.config.metadata.runner;
        ensure(isDeepStrictEqual(report.config.shard, { current: shard, total }), "Informe de otro shard.");
        ensure(report.config.workers === 1 && report.config.projects.every((project) => project.retries === 0), "Workers o reintentos incorrectos.");
        item.tests = executions(report, false);
        ensure(Number.isFinite(report.stats.duration) && report.stats.duration >= 0, "Falta duración de ejecución.");
        item.durationMs = report.stats.duration;
        const files = new Map();
        for (const test of item.tests) files.set(test.file, (files.get(test.file) ?? 0) + test.durationMs);
        item.files = [...files].map(([file, durationMs]) => ({ file, durationMs }));
        const actual = cases(report);
        ensure(isDeepStrictEqual(actual, config.parts[shard - 1].tests), "El informe no coincide con el inventario.");
        executions(report);
      } catch (error) {
        summary.errors.push(`Shard ${shard}: ${error.message}`);
      }
      try {
        item.preparation = preparation(join(directory, `e2e-preparation-${shard}-of-${total}${suffix}`, "e2e-preparation.tsv"));
      } catch (error) {
        summary.errors.push(`Preparación ${shard}: ${error.message}`);
      }
    }
  } catch (error) {
    summary.errors.push(`Falta inventario válido: ${error.message}`);
  }
  summary.inventory = source;
  mkdirSync(output, { recursive: true });
  write(join(output, "summary.json"), summary);
  const lines = [
    `# E2E · ${summary.commit}`,
    "",
    "Tiempos observados de preparación y ejecución. No son minutos facturados ni duración total del workflow.",
    "Comparar dos y tres shards solo sobre el mismo SHA y runner. La facturación requiere los datos de Actions.",
    "",
    "| Shard | Casos | Omitidos | Preparación (s) | Ejecución (s) |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...summary.shards.map((item) => `| ${item.shard}/${item.total} | ${item.tests.length} | ${item.tests.filter((test) => test.status === "skipped").length} | ${item.preparation.reduce((sum, row) => sum + row.seconds, 0).toFixed(2)} | ${item.durationMs === undefined ? "ausente" : (item.durationMs / 1000).toFixed(2)} |`),
    "",
    "El JSON adjunto conserva el inventario completo, los tiempos por caso y archivo, y los códigos de preparación.",
    ...summary.errors.map((error) => `- ${error}`),
    "",
  ].join("\n");
  writeFileSync(join(output, "summary.md"), lines);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines);
  ensure(summary.errors.length === 0, "Informes incompletos o inválidos. Consulte summary.md.");
}

const [command, ...args] = process.argv.slice(2);
switch (command) {
  case "matrix": {
    const total = count(args[0]);
    console.log(JSON.stringify({ include: Array.from({ length: total }, (_, i) => ({ shard: i + 1, total })) }));
    break;
  }
  case "inventory": inventory(args[0]); break;
  case "normalize": normalize(...args); break;
  case "gate": gate(...args); break;
  case "check": console.log(JSON.stringify(partition(cases(read(args[0])), args.slice(1).map((file) => cases(read(file)))))); break;
  case "report": summarize(...args); break;
  default: throw new Error("Comando CI desconocido.");
}
