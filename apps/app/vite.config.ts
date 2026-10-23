import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { build, defineConfig, type Plugin } from "vite";
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

export default defineConfig({
  plugins: [react(), cloudflare(), serviceWorker()],
  define: { __BUILD_ID__: JSON.stringify(buildId) },
});
