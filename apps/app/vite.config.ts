import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { appendFileSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { build, defineConfig, loadEnv, type Plugin } from "vite";
import { FLAG_NAMES, parseFlags } from "./src/domain/flags";
import { withOwnerCta } from "./src/domain/portada";
import { launchedFor, supportNumbersCheck } from "./src/domain/support";
import { staticHeadersBlock } from "./src/shared/security";
import { precacheList } from "./src/sw/routes";

const root = import.meta.dirname;

/** Feature flags (historia #58): FLAG_* del entorno del build (en CI, de las variables de GitHub del destino; en local,
 *  de .env.local o vacías = valores iniciales). Navegador y worker salen de este mismo build, así que la ficha se
 *  renderiza en el worker con las mismas flags que hidrata el navegador. Un valor inválido para el build. */
const parsedFlags = parseFlags({ ...loadEnv("", root, "FLAG_"), ...process.env });
if (!parsedFlags.ok) throw new Error(`${parsedFlags.errors.join(", ")} no es válida: use «true», «false» o déjela vacía.`);
const flags = parsedFlags.flags;

/** Las flags van en el identificador del build: con «Re-run» del despliegue (mismo commit, otra flag) también se
 *  descarta la caché persistida de Query, que si no conservaría respuestas calculadas con las flags anteriores. */
const flagsKey = FLAG_NAMES.map((name) => (flags[name] ? "1" : "0")).join("");
const buildId = `${process.env.GITHUB_SHA?.slice(0, 12) ?? Date.now().toString(36)}-${flagsKey}`;

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
    name: "3bstays:service-worker",
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
          lib: { entry: join(root, "src/sw/sw.ts"), formats: ["iife"], name: "swApp", fileName: () => "sw.js" },
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
    name: "3bstays:security-headers",
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
    name: "3bstays:portada-cta",
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
    name: "3bstays:support-numbers",
    apply: "build",
    applyToEnvironment: (env) => env.name === "client",
    configResolved(config) {
      // El hook corre una vez por build anidado (cliente, worker, service worker): basta con mirar una.
      if (process.env.SUPPORT_NUMBERS_CHECKED) return;
      process.env.SUPPORT_NUMBERS_CHECKED = "1";
      const env = { ...loadEnv(config.mode, root, "VITE_"), ...process.env };
      const wrangler = ts.parseConfigFileTextToJson("wrangler.jsonc", readFileSync(join(root, "wrangler.jsonc"), "utf8")).config;
      const check = supportNumbersCheck({ launched: launchedFor(wrangler, process.env.CLOUDFLARE_ENV), owners: env.VITE_WA_OWNERS, guests: env.VITE_WA_GUESTS });
      if (check?.level === "error") throw new Error(check.message);
      if (check && process.env.CI) console.warn(`::warning::${check.message}`);
    },
  };
}

// Grupos de trozos con nombre (presupuestos de .size-limit.json). Cada grupo anota si casó con algún módulo, y el build
// falla si alguno no casa: una ruta movida dejaría el grupo vacío y repartiría su código sin avisar (estructura por áreas,
// 2026-11-22: los grupos aún nombraban client/screens/ y sumaban 6 KB al JS inicial medido).
const groupHits = new Set<string>();
const GROUP_NAMES: string[] = [];
function group(name: string, test: RegExp, options: { includeDependenciesRecursively?: boolean } = {}) {
  GROUP_NAMES.push(name);
  return { name, ...options, test: (id: string) => { const hit = test.test(id); if (hit) groupHits.add(name); return hit; } };
}

function chunkGroupsMatch(): Plugin {
  return {
    name: "chunk-groups-match",
    apply: "build",
    applyToEnvironment: (env) => env.name === "client",
    generateBundle() {
      const empty = GROUP_NAMES.filter((name) => !groupHits.has(name));
      if (empty.length) throw new Error(`Grupos de trozos sin ningún módulo (¿ruta movida?): ${empty.join(", ")}. Revise codeSplitting en vite.config.ts.`);
    },
  };
}

export default defineConfig({
  plugins: [react(), cloudflare(), serviceWorker(), securityHeadersFile(), supportNumbers(), portadaOwnerCta(), chunkGroupsMatch()],
  define: { __BUILD_ID__: JSON.stringify(buildId), __FLAGS__: JSON.stringify(flags) },
  // zod/mini en su propio trozo (zod-*): ya no va en el JS inicial (filters.ts se lee a mano) y lo comparten el asistente
  // de publicar y la edición; sin el grupo se pegaría a step-forms-* y las reglas de los formularios medirían 5 KB más.
  environments: {
    client: { build: { rolldownOptions: { output: {
      chunkFileNames: (chunk) => chunk.moduleIds.length === 2 && chunk.moduleIds.every((id) => /[\\/]src[\\/]domain[\\/](?:admin-actions|edit-label)\.ts$/.test(id))
        ? "assets/edit-label-[hash].js"
        : "assets/[name]-[hash].js",
      codeSplitting: { groups: [
      // Lo común que pide el marco de la app y también las pantallas diferidas (cabecera, contador de consultas, claves de
      // consultas): un solo trozo en vez de tres, que pesaban 0,6 KB más en el JS inicial (estructura por áreas, 2026-11-22).
      group("marco", /[\\/]src[\\/]client[\\/](?:comun[\\/](?:screen-header\.tsx|listing-keys\.ts)|propietario[\\/]inquiries\.ts)$/, { includeDependenciesRecursively: false }),
      // Los ganchos de estado del router en un trozo, como antes de repartir client/ por áreas: rolldown los partía en tres
      // (useMatch, useSelector, useLocation) y el JS inicial pagaba 0,3 KB más (estructura por áreas, 2026-11-22).
      group("useMatch", /[\\/]node_modules[\\/](?:use-sync-external-store[\\/]|@tanstack[\\/]react-store[\\/]dist[\\/]useSelector\.js$|@tanstack[\\/]react-router[\\/]dist[\\/]esm[\\/](?:useMatch|useLocation)\.js$)/, { includeDependenciesRecursively: false }),
      group("zod", /[\\/]node_modules[\\/]zod[\\/]/),
      // El calendario de rango en su trozo (lo comparten la búsqueda, la hoja de contacto y «Marcar una reserva»; cuenta en
      // sus presupuestos): sin el grupo, se juntaba con el contador común (historia 07, paso 4).
      group("range-calendar", /[\\/]src[\\/]shared[\\/]range-calendar\.tsx$/, { includeDependenciesRecursively: false }),
      // Calendario carga API/fila. La gestión diferida carga también su tarjeta de exportación.
      // Ambos grupos cuentan en airbnb-*.js del presupuesto existente.
      group("airbnb", /[\\/]src[\\/]client[\\/]propietario[\\/]calendario[\\/](?:airbnb-queries\.ts|airbnb-calendar-row\.tsx)$/, { includeDependenciesRecursively: false }),
      group("airbnb-management", /[\\/]src[\\/]client[\\/]propietario[\\/]calendario[\\/](?:airbnb|ical-export-card)\.tsx$/, { includeDependenciesRecursively: false }),
      group("cuenta", /[\\/]src[\\/](?:client[\\/](?:cuenta[\\/]cuenta(?:-(?:navigation|codigo|lista|ayuda|profile))?|comun[\\/]sign-in)\.tsx|client[\\/](?:comun[\\/](?:turnstile|token-gate)|cuenta[\\/]support)\.ts|shared[\\/](?:timeout|security)\.ts)$/, { includeDependenciesRecursively: false }),
      group("propietario", /[\\/]src[\\/](?:client[\\/]propietario[\\/](?:propietario\.tsx|owner-ui\.tsx|editor-query\.ts|editor-status\.tsx|house-card\.tsx)|domain[\\/]navigation\.ts)$/, { includeDependenciesRecursively: false }),
      group("admin", /(?:[\\/]src[\\/](?:client[\\/]admin[\\/](?:admin(?:-(?:anuncios|casas|codigo|edicion|revision|review-details|shared))?\.tsx|admin-queries\.ts)|domain[\\/](?:admin-houses|owner-notice)\.ts)|[\\/]@tanstack[\\/]react-query[\\/]build[\\/]modern[\\/]useMutationState\.js)$/, { includeDependenciesRecursively: false }),
    ] } } } } },
  },
  // La base local (Docker) llama a /_purge del preview por host.docker.internal (pg_net, tests/e2e/frescura.spec.ts).
  preview: { allowedHosts: ["host.docker.internal"] },
});
