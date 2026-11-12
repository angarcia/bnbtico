import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";

const targets = new Map([
  ["production", { name: "3bstays-production", routes: [{ pattern: "3bstays.com", custom_domain: true }], workers_dev: false, preview_urls: false, triggers: { crons: ["17 * * * *"] } }],
  ["pruebas", { name: "3bstays-pruebas", routes: [{ pattern: "pruebas.3bstays.com", custom_domain: true }], workers_dev: true, preview_urls: true, triggers: { crons: ["17 * * * *"] } }],
  ["refactor", { name: "3bstays-refactor", routes: [{ pattern: "refactor.3bstays.com", custom_domain: true }], workers_dev: false, preview_urls: false, triggers: { crons: [] } }],
]);
const branches = new Map([
  ["main", "production"],
  ["develop", "pruebas"],
  ["refactor/limpieza-segura", "refactor"],
]);
const ensure = (condition, message) => {
  if (!condition) throw new Error(message);
};

function select() {
  const env = process.env;
  const result = { environment: "", build: "false", publish: "none" };
  if (env.GITHUB_EVENT_NAME === "workflow_dispatch") {
    const inputs = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8")).inputs;
    ensure(env.GITHUB_REF?.startsWith("refs/heads/") && branches.has(env.GITHUB_REF.slice("refs/heads/".length)), "Rama de verificación desconocida.");
    ensure(inputs && Object.keys(inputs).length === 1 && ["2", "3"].includes(inputs.shards), "La verificación requiere dos o tres shards, sin opciones de publicación.");
  } else if (env.GITHUB_EVENT_NAME === "push" && env.GITHUB_REF?.startsWith("refs/heads/")) {
    const target = branches.get(env.GITHUB_REF.slice("refs/heads/".length));
    if (target) Object.assign(result, { environment: target, build: "true", publish: "deploy" });
  } else if (env.GITHUB_EVENT_NAME === "pull_request") {
    const pr = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8")).pull_request;
    if (pr?.head?.ref && branches.has(pr?.base?.ref)) {
      const refactor = pr.head.ref.startsWith("refactor/") || pr.base.ref === "refactor/limpieza-segura";
      result.environment = refactor ? "refactor" : "pruebas";
      if (env.GITHUB_REPOSITORY && pr.head.repo?.full_name === env.GITHUB_REPOSITORY) {
        result.build = "true";
        result.publish = refactor ? "none" : "preview";
      }
    }
  }
  appendFileSync(env.GITHUB_OUTPUT, Object.entries(result).map(([key, value]) => `${key}=${value}\n`).join(""));
}

function validate(file) {
  const target = process.env.DEPLOY_ENV;
  const expected = targets.get(target);
  ensure(expected, "Destino de despliegue no autorizado.");
  const config = JSON.parse(readFileSync(file, "utf8"));
  ensure(config.targetEnvironment === target, "El build pertenece a otro entorno.");
  for (const [key, value] of Object.entries(expected)) {
    ensure(isDeepStrictEqual(config[key], value), `Configuración de destino incorrecta: ${key}.`);
  }
  ensure(config.vars?.ENVIRONMENT === (target === "production" ? "production" : "pruebas"), "ENVIRONMENT incorrecto.");
  if (target === "refactor") {
    ensure(isDeepStrictEqual(config.vars, {
      ENVIRONMENT: "pruebas",
      SUPABASE_URL: "https://bpxiggdzgzolcazaaboj.supabase.co",
      LISTING_CACHE: "no-store",
    }), "Variables del refactor fuera de la lista permitida.");
    ensure(process.env.VITE_SUPABASE_URL === config.vars.SUPABASE_URL, "Cliente y Worker deben usar el mismo Supabase.");
  } else {
    ensure(config.vars.LISTING_CACHE === undefined, "El entorno habitual debe conservar su caché.");
  }
}

function secrets(file) {
  ensure(process.env.DEPLOY_ENV === "refactor", "La lista mínima de secretos solo corresponde al refactor.");
  const anon = process.env.SUPABASE_ANON_KEY;
  ensure(anon?.trim(), "Falta SUPABASE_ANON_KEY.");
  writeFileSync(file, JSON.stringify({ SUPABASE_ANON_KEY: anon }), { mode: 0o600, flag: "wx" });
}

const [command, file] = process.argv.slice(2);
switch (command) {
  case "select": select(); break;
  case "validate": validate(file); break;
  case "secrets": secrets(file); break;
  default: throw new Error("Comando de despliegue no reconocido.");
}
