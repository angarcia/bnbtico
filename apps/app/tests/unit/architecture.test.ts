// Reglas del dominio (decisión 2026-10-21): supabase-js solo en el adaptador PostgREST; el dominio sin frameworks.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = new URL("../../src/", import.meta.url).pathname;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

// Las pantallas (hasta el 2026-11-22 en client/screens/): las piezas compartidas no deben depender de ellas.
const SCREENS = new Set([
  "client/admin/admin-anuncios.tsx",
  "client/admin/admin-casas.tsx",
  "client/admin/admin-codigo.tsx",
  "client/admin/admin-edicion.tsx",
  "client/admin/admin-review-details.tsx",
  "client/admin/admin-revision.tsx",
  "client/admin/admin-shared.tsx",
  "client/admin/admin.tsx",
  "client/cuenta/cuenta-ayuda.tsx",
  "client/cuenta/cuenta-codigo.tsx",
  "client/cuenta/cuenta-lista.tsx",
  "client/cuenta/cuenta-navigation.tsx",
  "client/cuenta/cuenta-profile.tsx",
  "client/cuenta/cuenta.tsx",
  "client/explorar/buscar.tsx",
  "client/explorar/casa.tsx",
  "client/explorar/explorar-escritorio.tsx",
  "client/explorar/explorar.tsx",
  "client/explorar/favoritos.tsx",
  "client/explorar/filtros.tsx",
  "client/explorar/que-es-3bstays.tsx",
  "client/propietario/actividad.tsx",
  "client/propietario/asistir.tsx",
  "client/propietario/calendario/airbnb.tsx",
  "client/propietario/calendario/calendario.tsx",
  "client/propietario/calendario/ical-export-card.tsx",
  "client/propietario/casa-editable.tsx",
  "client/propietario/propietario.tsx",
  "client/propietario/publicar/editar.tsx",
  "client/propietario/publicar/publicar-entrada.tsx",
  "client/propietario/publicar/publicar.tsx",
  "client/propietario/suscripcion/suscripcion.tsx",
]);

const imports = (path: string) => [...readFileSync(path, "utf8").matchAll(/(?:from|import)\s+["']([^"']+)["']/g)].map((m) => m[1]!);

describe("arquitectura", () => {
  it("las consultas y piezas compartidas de edición no dependen de pantallas; la composición de rutas queda fuera de esta regla", () => {
    const seen = new Set<string>();
    const offenders: string[] = [];
    const walk = (path: string) => {
      if (seen.has(path)) return;
      seen.add(path);
      const source = readFileSync(path, "utf8");
      const specs = [
        ...imports(path),
        ...[...source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']/g)].map((m) => m[1]!),
      ];
      for (const spec of specs.filter((i) => i.startsWith("."))) {
        const base = join(path, "..", spec);
        const target = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]
          .find((p) => existsSync(p) && statSync(p).isFile());
        if (!target) continue;
        if (SCREENS.has(relative(SRC, target))) offenders.push(`${relative(SRC, path)} → ${spec}`);
        else walk(target);
      }
    };
    for (const entry of ["client/propietario/editor-query.ts", "client/propietario/editor-status.tsx", "client/propietario/owner-ui.tsx"]) walk(join(SRC, entry));
    expect(offenders).toEqual([]);
  });

  // Dependencias en un solo sentido (decisión 2026-11-22, `.scratch/estructura-frontend/`): `shared/` lo usa también la ficha
  // SSR y no conoce la app privada. Cuenta también las importaciones dinámicas.
  it("src/shared no importa src/client", () => {
    const offenders = files(join(SRC, "shared")).flatMap((f) =>
      [...readFileSync(f, "utf8").matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)]
        .map((m) => m[1]!)
        .filter((spec) => spec.startsWith(".") && relative(SRC, join(f, "..", spec)).startsWith("client/"))
        .map((spec) => `${relative(SRC, f)} → ${spec}`),
    );
    expect(offenders).toEqual([]);
  });

  // Los componentes comunes (historia 07) no dependen de pantallas ni de datos: solo React, el dominio y ellos mismos.
  it("src/shared/ui solo importa React, el dominio y otros componentes comunes", () => {
    const offenders = files(join(SRC, "shared/ui")).flatMap((f) =>
      imports(f)
        .filter((spec) => !["react", "react-dom"].includes(spec))
        .filter((spec) => !spec.startsWith(".") || !/^(?:shared\/ui|domain)\//.test(relative(SRC, join(f, "..", spec))))
        .map((spec) => `${relative(SRC, f)} → ${spec}`),
    );
    expect(offenders).toEqual([]);
  });

  // Áreas (decisión 2026-11-22, `.scratch/estructura-frontend/paso-1-mapa.md`): `app/` compone las rutas y puede importar
  // todo; un área solo importa su carpeta, `comun/`, `shared/`, `domain/` y `data/`; `comun/` no importa áreas ni `app/`.
  // Cuenta también las importaciones dinámicas. Una excepción solo si de verdad no cabe en `comun/`, con su motivo.
  const AREA_EXCEPTIONS: Record<string, string> = {
    "client/comun/own-listings-query.ts → ../propietario/owner": "carga bajo demanda el trozo del propietario para leer sus casas; el contador de casas lo usan todas las áreas",
    "client/comun/whatsapp-dialog.tsx → ../cuenta/cuenta-codigo": "la ventana de WhatsApp pide el código con el formulario de Cuenta, cargado bajo demanda",
    "client/cuenta/cuenta-profile.tsx → ../app/lazy-screens": "precarga la pantalla de la suscripción al apuntar a su enlace: composición de rutas",
    "client/cuenta/cuenta.tsx → ../app/chrome": "elige el marco (pestañas o flujo) según la sesión: composición de rutas",
  };
  const areaOf = (path: string) => /^client\/([^/]+)\//.exec(path)?.[1];
  const crossings = () =>
    files(join(SRC, "client")).flatMap((f) => {
      const from = relative(SRC, f);
      const own = areaOf(from);
      if (own === "app") return [];
      return [...readFileSync(f, "utf8").matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)]
        .map((m) => m[1]!)
        .filter((spec) => spec.startsWith("."))
        .filter((spec) => {
          const target = areaOf(relative(SRC, join(f, "..", spec)) + "/");
          return target !== undefined && target !== own && target !== "comun";
        })
        .map((spec) => `${from} → ${spec}`);
    });

  it("un área no importa otra área ni app/, y comun/ no importa áreas", () => {
    expect(crossings().filter((c) => !(c in AREA_EXCEPTIONS))).toEqual([]);
  });

  it("cada excepción de áreas sigue haciendo falta", () => {
    const now = new Set(crossings());
    expect(Object.keys(AREA_EXCEPTIONS).filter((c) => !now.has(c))).toEqual([]);
  });

  it("solo src/data/postgrest importa supabase-js", () => {
    const offenders = files(SRC)
      .filter((f) => !relative(SRC, f).startsWith("data/postgrest/"))
      .filter((f) => imports(f).some((i) => i.startsWith("@supabase/")));
    expect(offenders.map((f) => relative(SRC, f))).toEqual([]);
  });

  it("src/domain no importa frameworks: solo zod (o zod/mini) y sus propios módulos", () => {
    const offenders = files(join(SRC, "domain")).flatMap((f) => imports(f).filter((i) => !i.startsWith("./") && i !== "zod" && i !== "zod/mini").map((i) => `${relative(SRC, f)} → ${i}`));
    expect(offenders).toEqual([]);
  });

  // La ficha pública la monta en su propio trozo (fase 4, ticket 05): sin router, Query, supabase ni la zona privada.
  it("src/shared/month-grid.tsx solo importa React y el dominio", () => {
    const own = imports(join(SRC, "shared/month-grid.tsx"));
    expect(own.filter((i) => i !== "react" && !i.startsWith("../domain/"))).toEqual([]);
  });

  // Hace de regla de lint (ticket 11): corre en `pnpm test` y antes de `pnpm build`, que falla si alguna aparece.
  it("nadie usa dangerouslySetInnerHTML", () => {
    const offenders = files(SRC).filter((f) => readFileSync(f, "utf8").includes("dangerouslySetInnerHTML"));
    expect(offenders.map((f) => relative(SRC, f))).toEqual([]);
  });

  it("sin HTML crudo ni código desde texto: innerHTML, outerHTML, insertAdjacentHTML, document.write, eval, new Function", () => {
    const RAW = /\.(innerHTML|outerHTML)\s*=|insertAdjacentHTML|document\.write|\beval\(|new Function\(/;
    const offenders = files(SRC).filter((f) => RAW.test(readFileSync(f, "utf8")));
    expect(offenders.map((f) => relative(SRC, f))).toEqual([]);
  });

  it("sin atributos style en JSX: la CSP no lleva 'unsafe-inline' para estilos (el SSR los escribiría en el HTML)", () => {
    const offenders = files(SRC).filter((f) => /\bstyle=\{/.test(readFileSync(f, "utf8")));
    expect(offenders.map((f) => relative(SRC, f))).toEqual([]);
  });

  it("index.html sin scripts en línea ni estilos en línea (CSP script-src/style-src 'self')", () => {
    const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
    expect(scripts.filter(([, attrs, body]) => !/\bsrc=/.test(attrs!) || body!.trim() !== "").map(([tag]) => tag)).toEqual([]);
    expect(html).not.toMatch(/<style\b|\sstyle=/);
  });

  // zod/mini suma ~5 KB gz: solo en trozos diferidos (asistente, edición) y en el worker. Se sigue el grafo de imports
  // estáticos desde las entradas del JS inicial (las `import("…")` dinámicas no cuentan: son trozos aparte).
  it("el JS inicial no lleva zod", () => {
    const resolve = (from: string, spec: string) => {
      const base = join(from, "..", spec);
      return [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")].find((p) => existsSync(p) && statSync(p).isFile());
    };
    const seen = new Set<string>();
    const offenders: string[] = [];
    const walk = (path: string) => {
      if (seen.has(path)) return;
      seen.add(path);
      const source = readFileSync(path, "utf8");
      // Solo lo que llega al navegador: los `import type` se borran al compilar.
      const values = [...source.matchAll(/^import\s+(?!type\s)[^;]*?from\s+["']([^"']+)["']/gm), ...source.matchAll(/^import\s+["']([^"']+)["']/gm)].map((m) => m[1]!);
      for (const spec of values) {
        if (spec === "zod" || spec === "zod/mini") offenders.push(relative(SRC, path));
        else if (spec.startsWith(".")) {
          const next = resolve(path, spec);
          if (next) walk(next);
        }
      }
    };
    for (const entry of ["client/app/main.tsx", "client/app/start-shell.tsx", "client/explorar/hydrate-listing.tsx"]) walk(join(SRC, entry));
    expect(seen.size).toBeGreaterThan(20);
    expect(offenders).toEqual([]);
  });

  // La puerta de tamaño no cuenta listing-cache-* como JS inicial (.size-limit.json, 2026-11-17): solo lo piden las pantallas
  // del propietario, el admin y publicar. Si el arranque lo importara de forma estática, la exclusión ocultaría ese peso.
  it("el arranque del shell no importa la caché de las casas (listing-cache) de forma estática", () => {
    const seen = new Set<string>();
    const walk = (path: string) => {
      if (seen.has(path)) return;
      seen.add(path);
      for (const spec of imports(path).filter((i) => i.startsWith("."))) {
        const base = join(path, "..", spec);
        const target = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")].find((p) => existsSync(p) && statSync(p).isFile());
        if (target) walk(target);
      }
    };
    walk(join(SRC, "client/app/start-shell.tsx"));
    expect(seen.size).toBeGreaterThan(20);
    expect([...seen].map((p) => relative(SRC, p)).filter((p) => p === "client/comun/listing-cache.ts")).toEqual([]);
  });

  it("el JS inicial de Explorar no arrastra trozos diferidos", () => {
    // Las importaciones dinámicas `import("…")` no las ve `imports()`: son las únicas permitidas hacia esos trozos.
    for (const path of ["domain/filters.ts", "domain/search.ts"].map((p) => join(SRC, p)).filter(existsSync)) {
      expect(imports(path).filter((i) => i === "./calendar" || i === "./inquiry"), path).toEqual([]);
    }
    for (const path of ["client/explorar/explore-map.tsx", "client/explorar/explorar.tsx"].map((p) => join(SRC, p)).filter(existsSync)) {
      expect(imports(path).filter((i) => i.includes("leaflet") || /^\.\.?\/explore-map-leaflet$/.test(i)), path).toEqual([]);
    }
  });
});
