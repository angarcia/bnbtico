import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { appendFileSync, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { build, defineConfig, loadEnv, type Plugin } from "vite";
import { launchedFor, supportNumbersCheck } from "./src/domain/support";
import { staticHeadersBlock } from "./src/shared/security";
import { precacheList } from "./src/sw/routes";

const buildId = process.env.GITHUB_SHA?.slice(0, 12) ?? Date.now().toString(36);
const root = import.meta.dirname;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

/**
 * /sw.js con nombre estable: se compila aparte (IIFE, sin trozos compartidos con la app) al final del build del cliente,
 * con la lista de precache sacada de los ficheros con hash de ese mismo build y de `public/`.
 */
function serviceWorker(): Plugin {
  return {
    name: "bnbtico:service-worker",
    apply: "build",
    enforce: "post",
    applyToEnvironment: (env) => env.name === "client",
    async generateBundle(_options, bundle) {
      const publicDir = join(root, "public");
      const precache = precacheList(Object.keys(bundle), files(publicDir).map((f) => relative(publicDir, f)));
      const out = await build({
        configFile: false,
        root,
        logLevel: "warn",
        publicDir: false,
        define: { __PRECACHE__: JSON.stringify(precache), __BUILD_ID__: JSON.stringify(buildId) },
        build: {
          write: false,
          minify: true,
          emptyOutDir: false,
          lib: { entry: join(root, "src/sw/sw.ts"), formats: ["iife"], name: "bnbticoSw", fileName: () => "sw.js" },
        },
      });
      const output = (Array.isArray(out) ? out[0]! : out) as { output: { type: string; code?: string }[] };
      const chunk = output.output.find((o) => o.type === "chunk");
      if (!chunk?.code) throw new Error("No se pudo compilar el service worker.");
      this.emitFile({ type: "asset", fileName: "sw.js", source: chunk.code });
    },
  };
}

/**
 * CSP del shell y de los estáticos: se añade a dist/client/_headers (copiado de public/) con la URL de Supabase del build
 * (la misma VITE_SUPABASE_URL que usa el navegador). Solo en el build: `vite dev` inyecta scripts en línea.
 */
function securityHeadersFile(): Plugin {
  let supabaseUrl: string | undefined;
  return {
    name: "bnbtico:security-headers",
    apply: "build",
    applyToEnvironment: (env) => env.name === "client",
    configResolved(config) {
      supabaseUrl = loadEnv(config.mode, root, "VITE_").VITE_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
    },
    writeBundle(options) {
      const file = join(options.dir!, "_headers");
      if (!existsSync(file)) throw new Error("Falta dist/client/_headers (public/_headers).");
      appendFileSync(file, `\n${staticHeadersBlock({ supabaseUrl, turnstile: true, photon: true })}`);
    },
  };
}

/**
 * Números de WhatsApp de Ayuda (revisión UX A12): con LAUNCHED "true" en el entorno de wrangler que se construye
 * (`CLOUDFLARE_ENV`) el build falla sin ellos; si no, en CI deja un aviso visible en el log de GitHub Actions.
 */
function supportNumbers(): Plugin {
  return {
    name: "bnbtico:support-numbers",
    apply: "build",
    applyToEnvironment: (env) => env.name === "client",
    configResolved(config) {
      // El hook corre una vez por build anidado (cliente, worker, service worker): basta con mirar una.
      if (process.env.BNBTICO_SUPPORT_CHECKED) return;
      process.env.BNBTICO_SUPPORT_CHECKED = "1";
      const env = { ...loadEnv(config.mode, root, "VITE_"), ...process.env };
      const wrangler = ts.parseConfigFileTextToJson("wrangler.jsonc", readFileSync(join(root, "wrangler.jsonc"), "utf8")).config;
      const check = supportNumbersCheck({ launched: launchedFor(wrangler, process.env.CLOUDFLARE_ENV), owners: env.VITE_WA_OWNERS, guests: env.VITE_WA_GUESTS });
      if (check?.level === "error") throw new Error(check.message);
      if (check && process.env.CI) console.warn(`::warning::${check.message}`);
    },
  };
}

export default defineConfig({
  plugins: [react(), cloudflare(), serviceWorker(), securityHeadersFile(), supportNumbers()],
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  // La base local (Docker) llama a /_purge del preview por host.docker.internal (pg_net, tests/e2e/frescura.spec.ts).
  preview: { allowedHosts: ["host.docker.internal"] },
});
