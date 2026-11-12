import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const script = fileURLToPath(new URL("../../scripts/deploy-target.mjs", import.meta.url));
const workflow = readFileSync(new URL("../../../../.github/workflows/app.yml", import.meta.url), "utf8");
const temporary: string[] = [];
const fixture = () => {
  const dir = mkdtempSync(join(tmpdir(), "3bstays-deploy-test-"));
  temporary.push(dir);
  return dir;
};
afterEach(() => temporary.splice(0).forEach((dir) => rmSync(dir, { recursive: true })));
const run = (args: string[], env: Record<string, string> = {}) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8", env });
const step = (name: string) => {
  const block = workflow.split(`      - name: ${name}\n`)[1];
  expect(block, name).toBeDefined();
  return block!.split(/\n      - (?:name:|uses:|run:)/)[0]!;
};

describe("destino de despliegue", () => {
  function select(eventName: string, ref: string, head = "", base = "", repo = "3bstays/app") {
    const dir = fixture();
    const event = join(dir, "event.json");
    const output = join(dir, "output");
    writeFileSync(event, JSON.stringify({ pull_request: { head: { ref: head, repo: { full_name: repo } }, base: { ref: base } } }));
    const result = run(["select"], { GITHUB_EVENT_NAME: eventName, GITHUB_REF: ref, GITHUB_REPOSITORY: "3bstays/app", GITHUB_EVENT_PATH: event, GITHUB_OUTPUT: output });
    expect(result.status, result.stderr).toBe(0);
    return Object.fromEntries(readFileSync(output, "utf8").trim().split("\n").map((line) => line.split("=")));
  }

  it.each([
    ["main", "production"],
    ["develop", "pruebas"],
    ["refactor/limpieza-segura", "refactor"],
  ])("push de %s publica solo en %s", (branch, environment) => {
    expect(select("push", `refs/heads/${branch}`)).toEqual({ environment, build: "true", publish: "deploy" });
  });

  it.each([
    ["push", "refs/heads/otra"],
    ["push", "refs/heads/refactor/03-worker"],
    ["push", "refs/tags/main"],
    ["", ""],
  ])("%s %s no tiene destino implícito", (event, ref) => {
    expect(select(event, ref)).toEqual({ environment: "", build: "false", publish: "none" });
  });

  it.each([
    ["feature/cambio", "develop", "pruebas", "preview"],
    ["develop", "main", "pruebas", "preview"],
    ["refactor/limpieza-segura", "develop", "refactor", "none"],
    ["refactor/03-worker", "main", "refactor", "none"],
    ["feature/cambio", "refactor/limpieza-segura", "refactor", "none"],
    ["refactor/03-worker", "refactor/limpieza-segura", "refactor", "none"],
  ])("PR %s → %s selecciona %s y publicación %s", (head, base, environment, publish) => {
    expect(select("pull_request", "refs/pull/5/merge", head, base)).toEqual({ environment, build: "true", publish });
  });

  it.each([
    ["feature/cambio", "desconocida"],
    ["refactor/03-worker", "desconocida"],
    ["", "develop"],
    ["feature/cambio", ""],
  ])("PR incompleto o desconocido %s → %s queda cerrado", (head, base) => {
    expect(select("pull_request", "refs/pull/5/merge", head, base)).toEqual({ environment: "", build: "false", publish: "none" });
  });

  it.each(["develop", "main", "refactor/limpieza-segura"])("fork hacia %s no usa build alojado ni publica", (base) => {
    const selection = select("pull_request", "refs/pull/5/merge", "refactor/03-worker", base, "externo/fork");
    expect(selection.build).toBe("false");
    expect(selection.publish).toBe("none");
  });

  it.each(["2", "3"])("dispatch con %s shards solo verifica", (shards) => {
    const dir = fixture();
    const event = join(dir, "event.json");
    const output = join(dir, "output");
    writeFileSync(event, JSON.stringify({ inputs: { shards } }));
    const result = run(["select"], { GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REF: "refs/heads/refactor/limpieza-segura", GITHUB_EVENT_PATH: event, GITHUB_OUTPUT: output });
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(output, "utf8")).toBe("environment=\nbuild=false\npublish=none\n");
  });

  it.each([
    ["refs/heads/main", {}],
    ["refs/heads/main", { shards: "1" }],
    ["refs/heads/main", { shards: "4" }],
    ["refs/heads/main", { shards: "2", publish: "deploy" }],
    ["refs/heads/desconocida", { shards: "2" }],
    ["refs/tags/main", { shards: "3" }],
  ])("rechaza dispatch desconocido %s %j antes de emitir permisos", (ref, inputs) => {
    const dir = fixture();
    const event = join(dir, "event.json");
    const output = join(dir, "output");
    writeFileSync(event, JSON.stringify({ inputs }));
    const result = run(["select"], { GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REF: ref, GITHUB_EVENT_PATH: event, GITHUB_OUTPUT: output });
    expect(result.status).not.toBe(0);
    expect(() => readFileSync(output)).toThrow();
  });
});

describe("validación de la configuración generada y secretos", () => {
  const configs = {
    refactor: {
      name: "3bstays-refactor", targetEnvironment: "refactor",
      routes: [{ pattern: "refactor.3bstays.com", custom_domain: true }],
      workers_dev: false, preview_urls: false, triggers: { crons: [] },
      vars: { ENVIRONMENT: "pruebas", SUPABASE_URL: "https://bpxiggdzgzolcazaaboj.supabase.co", LISTING_CACHE: "no-store" },
    },
    pruebas: {
      name: "3bstays-pruebas", targetEnvironment: "pruebas",
      routes: [{ pattern: "pruebas.3bstays.com", custom_domain: true }],
      workers_dev: true, preview_urls: true, triggers: { crons: ["17 * * * *"] },
      vars: { ENVIRONMENT: "pruebas" },
    },
    production: {
      name: "3bstays-production", targetEnvironment: "production",
      workers_dev: false, preview_urls: false, triggers: { crons: ["17 * * * *"] },
      vars: { ENVIRONMENT: "production", LAUNCHED: "false" },
    },
  };
  function validate(target: string, config: unknown) {
    const file = join(fixture(), "wrangler.json");
    writeFileSync(file, JSON.stringify(config));
    return run(["validate", file], { DEPLOY_ENV: target, VITE_SUPABASE_URL: "https://bpxiggdzgzolcazaaboj.supabase.co" });
  }

  it.each(["refactor", "pruebas", "production"] as const)("acepta el destino generado %s", (target) => {
    const result = validate(target, configs[target]);
    expect(result.status, result.stderr).toBe(0);
  });

  it.each([
    { name: "3bstays-pruebas" },
    { targetEnvironment: "pruebas" },
    { routes: [{ pattern: "pruebas.3bstays.com", custom_domain: true }] },
    { routes: [] },
    { workers_dev: true },
    { preview_urls: true },
    { triggers: { crons: ["17 * * * *"] } },
    { vars: { ...configs.refactor.vars, LISTING_CACHE: "default" } },
    { vars: { ...configs.refactor.vars, SUPABASE_SERVICE_ROLE_KEY: "no-copiar" } },
    { vars: { ...configs.refactor.vars, PAYMENTS: "stripe" } },
    { vars: { ...configs.refactor.vars, SUPABASE_URL: "https://otro.supabase.co" } },
  ])("rechaza configuración refactor alterada: %j", (overrides) => {
    expect(validate("refactor", { ...configs.refactor, ...overrides }).status).not.toBe(0);
  });

  it("rechaza destino desconocido, configuración de otra rama y archivo ausente", () => {
    expect(validate("", configs.pruebas).status).not.toBe(0);
    expect(validate("desconocido", configs.pruebas).status).not.toBe(0);
    expect(validate("production", configs.pruebas).status).not.toBe(0);
    expect(validate("pruebas", configs.refactor).status).not.toBe(0);
    expect(run(["validate", join(fixture(), "ausente")], { DEPLOY_ENV: "refactor" }).status).not.toBe(0);
  });

  it("producción sigue sin rutas declaradas", () => {
    expect(validate("production", { ...configs.production, routes: [{ pattern: "3bstays.com", custom_domain: true }] }).status).not.toBe(0);
  });

  it("escribe solo anon aunque existan otros secretos, sin imprimir valores", () => {
    const file = join(fixture(), "secrets.json");
    const result = run(["secrets", file], {
      DEPLOY_ENV: "refactor", SUPABASE_ANON_KEY: "anon-sintetica",
      SUPABASE_SERVICE_ROLE_KEY: "privada", PURGE_SECRET: "purga", CF_PURGE_TOKEN: "purga-cf",
      TWILIO_AUTH_TOKEN: "twilio", STRIPE_SECRET_KEY: "stripe", TEST_CLOCK_SECRET: "reloj",
    });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ SUPABASE_ANON_KEY: "anon-sintetica" });
    expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(result.stdout + result.stderr).not.toContain("anon-sintetica");
  });

  it.each(["", "  "])("rechaza anon vacía (%s)", (key) => {
    expect(run(["secrets", join(fixture(), "secrets.json")], { DEPLOY_ENV: "refactor", SUPABASE_ANON_KEY: key }).status).not.toBe(0);
  });
  it("no genera secretos de otro destino", () => {
    expect(run(["secrets", join(fixture(), "secrets.json")], { DEPLOY_ENV: "pruebas", SUPABASE_ANON_KEY: "anon" }).status).not.toBe(0);
  });
});

describe("workflow · aislamiento y puertas", () => {
  it("conecta el selector explícito con los builds y las acciones remotas", () => {
    expect(workflow).toContain("branches: [develop, main, refactor/limpieza-segura]");
    expect(step("Seleccionar destino")).toContain("id: target");
    expect(step("Seleccionar destino")).toContain("node scripts/deploy-target.mjs select");
    const build = step("Build para desplegar (navegador y worker)");
    expect(build).toContain("if: steps.target.outputs.build == 'true'");
    expect(build).toContain("CLOUDFLARE_ENV: ${{ steps.target.outputs.environment }}");
    expect(build).toContain('test ! -e .dev.vars && test ! -e .env.local');
    expect(build).not.toContain('test -n "$VITE_TURNSTILE_SITE_KEY"');
    expect(build).toContain("steps.target.outputs.environment != 'refactor'");
    expect(step("Desplegar")).toContain("if: steps.target.outputs.publish == 'deploy' && steps.target-check.outcome == 'success'");
    expect(step("Versión de vista previa")).toContain("if: steps.target.outputs.publish == 'preview' && steps.target-check.outcome == 'success'");
    for (const name of ["Desplegar", "Versión de vista previa"]) {
      expect(step(name)).toContain("--config dist/3bstays/wrangler.json");
      expect(step(name)).not.toContain("always()");
    }
  });

  it("separa la allowlist refactor de los secretos vigentes", () => {
    const refactor = step("Secreto anon del refactor");
    expect(refactor).toContain("steps.target.outputs.environment == 'refactor'");
    expect(refactor).toContain("steps.target.outputs.publish == 'deploy'");
    expect(refactor).toContain("SUPABASE_ANON_KEY:");
    expect(refactor).toContain("deploy-target.mjs secrets");
    expect(refactor).not.toMatch(/SERVICE_ROLE|PURGE|TWILIO|STRIPE|TEST_CLOCK|TURNSTILE/);
    expect(step("Secretos del worker")).toContain("(steps.target.outputs.environment == 'pruebas' || steps.target.outputs.environment == 'production')");
    expect(step("Secretos del worker")).toContain("(steps.target.outputs.publish == 'deploy' || steps.target.outputs.publish == 'preview')");
    expect(step("Borrar los secretos del disco")).toContain("if: always()");
  });

  it("valida el artefacto exacto y mantiene todas las puertas antes de publicar", () => {
    const check = step("Validar destino generado");
    expect(check).toContain("id: target-check");
    expect(check).toContain("if: steps.target.outputs.build == 'true'");
    expect(check).toContain("DEPLOY_ENV: ${{ steps.target.outputs.environment }}");
    expect(check).toContain("node scripts/deploy-target.mjs validate dist/3bstays/wrangler.json");
    for (const name of ["Tipos", "Pruebas unitarias", "Tipos de la base al día con las migraciones", "Pruebas de base (contrato contra PostgREST)", "Ficha real, hidratación y shell (Pixel 7)", "Puerta de Lighthouse (LCP ficha < 2,0 s, shell instalado < 2,5 s)", "Puerta de tamaño (zona privada < 160 KB gz)"]) {
      expect(step(name)).not.toMatch(/if:|continue-on-error/);
      expect(workflow.indexOf(`- name: ${name}\n`)).toBeLessThan(workflow.indexOf("- name: Desplegar\n"));
    }
    expect(workflow).not.toContain("continue-on-error");
    for (const name of ["Desplegar", "Versión de vista previa"]) {
      expect(step(name)).toContain("steps.freshness-publish.outcome == 'success'");
    }
  });
});
