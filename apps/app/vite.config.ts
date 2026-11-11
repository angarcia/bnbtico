import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { appendFileSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { build, defineConfig, loadEnv, type Plugin } from "vite";
import { withOwnerCta } from "./src/domain/portada";
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
/**
 * Botón de propietarios de la portada (revisión UX C1): con `VITE_WA_OWNERS`, el build cambia en dist/client/portada.html la
 * frase «Abrimos pronto…» por el enlace a WhatsApp. Sin número, la portada se queda como está (sin botón muerto).
 */
function portadaOwnerCta(): Plugin {
  let owners: string | undefined;
  return {
    name: "bnbtico:portada-cta",
    apply: "build",
    applyToEnvironment: (env) => env.name === "client",
    configResolved(config) {
      owners = loadEnv(config.mode, root, "VITE_").VITE_WA_OWNERS ?? process.env.VITE_WA_OWNERS;
    },
    writeBundle(options) {
      const file = join(options.dir!, "portada.html");
      if (existsSync(file)) writeFileSync(file, withOwnerCta(readFileSync(file, "utf8"), owners));
    },
  };
}

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
  plugins: [react(), cloudflare(), serviceWorker(), securityHeadersFile(), supportNumbers(), portadaOwnerCta()],
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  // zod/mini en su propio trozo (zod-*): ya no va en el JS inicial (filters.ts se lee a mano) y lo comparten el asistente
  // de publicar y la edición; sin el grupo se pegaría a step-forms-* y las reglas de los formularios medirían 5 KB más.
  environments: {
    client: { build: { rolldownOptions: { output: {
      chunkFileNames: (chunk) => chunk.moduleIds.length === 2 && chunk.moduleIds.every((id) => /[\\/]src[\\/]domain[\\/](?:admin-actions|edit-label)\.ts$/.test(id))
        ? "assets/edit-label-[hash].js"
        : "assets/[name]-[hash].js",
      codeSplitting: { groups: [
      { name: "zod", test: /[\\/]node_modules[\\/]zod[\\/]/ },
      // Calendario usa API/fila; gestión y exportación mantienen entradas separadas para no adelantar sus pantallas.
      // Los tres grupos cuentan en airbnb-*.js del presupuesto existente.
      { name: "airbnb", test: /[\\/]src[\\/]client[\\/](?:airbnb\.ts|airbnb-calendar-row\.tsx)$/, includeDependenciesRecursively: false },
      { name: "airbnb-management", test: /[\\/]src[\\/]client[\\/]screens[\\/]airbnb\.tsx$/, includeDependenciesRecursively: false },
      { name: "airbnb-export", test: /[\\/]src[\\/]client[\\/]screens[\\/]ical-export-card\.tsx$/, includeDependenciesRecursively: false },
      { name: "cuenta", test: /[\\/]src[\\/](?:client[\\/](?:screens[\\/]cuenta(?:-(?:navigation|codigo|lista|ayuda|profile))?|sign-in)\.tsx|client[\\/](?:turnstile|token-gate|support)\.ts|shared[\\/](?:timeout|security)\.ts)$/, includeDependenciesRecursively: false },
      { name: "propietario", test: /[\\/]src[\\/](?:client[\\/](?:screens[\\/]propietario\.tsx|owner-ui\.tsx|editor-query\.ts|editor-status\.tsx|house-card\.tsx)|domain[\\/]navigation\.ts)$/, includeDependenciesRecursively: false },
      { name: "admin", test: /(?:[\\/]src[\\/](?:client[\\/](?:screens[\\/]admin(?:-(?:anuncios|casas|codigo|edicion|revision|review-details|shared))?\.tsx|admin\.ts)|domain[\\/](?:admin-houses|owner-notice)\.ts)|[\\/]@tanstack[\\/]react-query[\\/]build[\\/]modern[\\/]useMutationState\.js)$/, includeDependenciesRecursively: false },
    ] } } } } },
  },
  // La base local (Docker) llama a /_purge del preview por host.docker.internal (pg_net, tests/e2e/frescura.spec.ts).
  preview: { allowedHosts: ["host.docker.internal"] },
});
