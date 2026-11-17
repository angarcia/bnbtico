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

  it.each([
    ["refs/heads/refactor/limpieza-segura", {}],
    ["refs/heads/develop", null],
    ["refs/heads/ci-minutos-actions", {}],
  ])("dispatch sin opciones en %s solo verifica, en cualquier rama", (ref, inputs) => {
    const dir = fixture();
    const event = join(dir, "event.json");
    const output = join(dir, "output");
    writeFileSync(event, JSON.stringify({ inputs }));
    const result = run(["select"], { GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REF: ref, GITHUB_EVENT_PATH: event, GITHUB_OUTPUT: output });
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(output, "utf8")).toBe("environment=\nbuild=false\npublish=none\n");
  });

  it.each([
    ["refs/heads/main", { shards: "2" }],
    ["refs/heads/main", { publish: "deploy" }],
    ["refs/heads/desconocida", { environment: "production" }],
    ["refs/heads/", {}],
    ["refs/tags/main", {}],
    ["refs/pull/5/merge", {}],
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
      workers_dev: true, preview_urls: true, triggers: { crons: ["17 * * * *", "17 */3 * * *"] },
      vars: { ENVIRONMENT: "pruebas" },
    },
    production: {
      name: "3bstays-production", targetEnvironment: "production",
      routes: [{ pattern: "3bstays.com", custom_domain: true }],
      workers_dev: false, preview_urls: false, triggers: { crons: ["17 * * * *", "17 */3 * * *"] },
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

  // Portada en 3bstays.com (decisión 2026-11-11): producción solo con su dominio, ni otro ni ninguno.
  it("producción solo con la ruta 3bstays.com", () => {
    expect(validate("production", configs.production).status).toBe(0);
    const { routes: _sinRuta, ...sinRuta } = configs.production;
    expect(validate("production", sinRuta).status).not.toBe(0);
    expect(validate("production", { ...configs.production, routes: [{ pattern: "pruebas.3bstays.com", custom_domain: true }] }).status).not.toBe(0);
    expect(validate("production", { ...configs.production, routes: [{ pattern: "3bstays.com", custom_domain: true }, { pattern: "otro.com", custom_domain: true }] }).status).not.toBe(0);
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
    // Producción antes del lanzamiento solo sirve la portada: desde main el worker no recibe ningún secreto.
    const secrets = step("Secretos del worker");
    for (const name of ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY", "PURGE_SECRET", "CF_ZONE_ID", "CF_PURGE_TOKEN", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_WHATSAPP_FROM", "WHATSAPP_ALLOWLIST", "TEST_CLOCK_SECRET", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]) {
      // «main && '' || x» devolvía siempre x: en las expresiones de Actions '' es falso (incidente 2026-11-12).
      expect(secrets, name).toMatch(new RegExp(`${name}: \\$\\{\\{ github\\.ref != 'refs/heads/main' && .+ \\|\\| '' \\}\\}`));
      expect(secrets, name).not.toMatch(new RegExp(`${name}: .*&& '' \\|\\|`));
    }
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

describe("intervalo de Airbnb al desplegar (2026-11-17)", () => {
  const base = {
    pruebas: { name: "3bstays-pruebas", targetEnvironment: "pruebas", routes: [{ pattern: "pruebas.3bstays.com", custom_domain: true }], workers_dev: true, preview_urls: true, triggers: { crons: ["17 * * * *", "17 */3 * * *"] }, vars: { ENVIRONMENT: "pruebas" } },
    production: { name: "3bstays-production", targetEnvironment: "production", routes: [{ pattern: "3bstays.com", custom_domain: true }], workers_dev: false, preview_urls: false, triggers: { crons: ["17 * * * *", "17 */3 * * *"] }, vars: { ENVIRONMENT: "production", LAUNCHED: "false" } },
    refactor: { name: "3bstays-refactor", targetEnvironment: "refactor", routes: [{ pattern: "refactor.3bstays.com", custom_domain: true }], workers_dev: false, preview_urls: false, triggers: { crons: [] }, vars: { ENVIRONMENT: "pruebas", SUPABASE_URL: "https://bpxiggdzgzolcazaaboj.supabase.co", LISTING_CACHE: "no-store" } },
  };
  function schedule(target: keyof typeof base, minutes?: string) {
    const file = join(fixture(), "wrangler.json");
    writeFileSync(file, JSON.stringify(base[target]));
    const result = run(["schedule", file], { DEPLOY_ENV: target, ...(minutes === undefined ? {} : { AIRBNB_SYNC_MINUTES: minutes }) });
    const config = JSON.parse(readFileSync(file, "utf8"));
    const check = run(["validate", file], { DEPLOY_ENV: target, VITE_SUPABASE_URL: "https://bpxiggdzgzolcazaaboj.supabase.co" });
    return { result, config, check };
  }

  it.each([
    ["pruebas", undefined, ["17 * * * *", "17 */3 * * *"], "180"],
    ["pruebas", "", ["17 * * * *", "17 */3 * * *"], "180"],
    ["pruebas", "5", ["17 * * * *", "*/5 * * * *"], "5"],
    ["pruebas", "1440", ["17 * * * *", "17 0 * * *"], "1440"],
    ["production", "60", ["17 * * * *"], "60"],
    ["production", "360", ["17 * * * *", "17 */6 * * *"], "360"],
  ] as const)("%s con %s minutos → %j", (target, minutes, crons, value) => {
    const { result, config, check } = schedule(target, minutes);
    expect(result.status, result.stderr).toBe(0);
    expect(config.triggers).toEqual({ crons });
    expect(config.vars.AIRBNB_SYNC_MINUTES).toBe(value);
    expect(check.status, check.stderr).toBe(0);
  });

  it.each([
    ["production", "5", "AIRBNB_SYNC_MINUTES_PRODUCCION"],
    ["production", "30", "AIRBNB_SYNC_MINUTES_PRODUCCION"],
    ["pruebas", "7", "AIRBNB_SYNC_MINUTES_PRUEBAS"],
    ["pruebas", "abc", "AIRBNB_SYNC_MINUTES_PRUEBAS"],
    ["pruebas", "2880", "AIRBNB_SYNC_MINUTES_PRUEBAS"],
  ] as const)("%s rechaza %s minutos con un mensaje y no toca la configuración", (target, minutes, variable) => {
    const { result, config } = schedule(target, minutes);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(variable);
    expect(config).toEqual(base[target]);
  });

  it("el refactor no tiene crons y no cambia", () => {
    const { result, config, check } = schedule("refactor", "5");
    expect(result.status, result.stderr).toBe(0);
    expect(config).toEqual(base.refactor);
    expect(check.status, check.stderr).toBe(0);
  });

  it("la validación rechaza un cron que no corresponde a los minutos", () => {
    const file = join(fixture(), "wrangler.json");
    writeFileSync(file, JSON.stringify({ ...base.pruebas, vars: { ENVIRONMENT: "pruebas", AIRBNB_SYNC_MINUTES: "5" } }));
    const check = run(["validate", file], { DEPLOY_ENV: "pruebas" });
    expect(check.status).not.toBe(0);
    expect(check.stderr).toContain("triggers");
  });
});

describe("límites manuales de Airbnb al desplegar (2026-11-17)", () => {
  const limits = (env: Record<string, string>) => run(["limits"], env);

  it.each([
    ["pruebas", {}, "espera 15 min, 10 al día"],
    ["pruebas", { AIRBNB_MANUAL_WAIT_MINUTES: "5", AIRBNB_MANUAL_PER_DAY: "50" }, "espera 5 min, 50 al día"],
    ["production", { AIRBNB_MANUAL_WAIT_MINUTES: "60", AIRBNB_MANUAL_PER_DAY: "1" }, "espera 60 min, 1 al día"],
  ] as const)("%s acepta %j", (target, env, text) => {
    const result = limits({ DEPLOY_ENV: target, ...env });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(text);
  });

  it.each([
    ["pruebas", { AIRBNB_MANUAL_WAIT_MINUTES: "0" }, "AIRBNB_MANUAL_WAIT_MINUTES_PRUEBAS"],
    ["pruebas", { AIRBNB_MANUAL_WAIT_MINUTES: "61" }, "AIRBNB_MANUAL_WAIT_MINUTES_PRUEBAS"],
    ["production", { AIRBNB_MANUAL_PER_DAY: "51" }, "AIRBNB_MANUAL_PER_DAY_PRODUCCION"],
    ["production", { AIRBNB_MANUAL_PER_DAY: "diez" }, "AIRBNB_MANUAL_PER_DAY_PRODUCCION"],
  ] as const)("%s rechaza %j nombrando la variable", (target, env, variable) => {
    const result = limits({ DEPLOY_ENV: target, ...env });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(variable);
  });

  it("en pruebas los escribe con la clave de servicio; en producción solo valida", async () => {
    const { createServer } = await import("node:http");
    const { spawn } = await import("node:child_process");
    const seen: { url?: string; auth?: string; body: string }[] = [];
    const server = createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => { seen.push({ url: req.url, auth: req.headers.authorization, body }); res.writeHead(204).end(); });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const exec = (env: Record<string, string>) => new Promise<number>((resolve) => {
      spawn(process.execPath, [script, "limits"], { env: { ...env, SUPABASE_URL: `http://127.0.0.1:${port}`, SUPABASE_SERVICE_ROLE_KEY: "clave-de-prueba" }, stdio: "ignore" })
        .on("exit", (code) => resolve(code ?? 1));
    });
    try {
      expect(await exec({ DEPLOY_ENV: "pruebas", AIRBNB_MANUAL_WAIT_MINUTES: "5", AIRBNB_MANUAL_PER_DAY: "3" })).toBe(0);
      expect(await exec({ DEPLOY_ENV: "production", AIRBNB_MANUAL_WAIT_MINUTES: "20" })).toBe(0);
    } finally { server.close(); }
    expect(seen).toEqual([{ url: "/rest/v1/rpc/set_airbnb_manual_limits", auth: "Bearer clave-de-prueba", body: JSON.stringify({ p_wait_minutes: 5, p_per_day: 3 }) }]);
  });
});
