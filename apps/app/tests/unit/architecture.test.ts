// Reglas del dominio (decisión 2026-10-21): supabase-js solo en el adaptador PostgREST; el dominio sin frameworks.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = new URL("../../src/", import.meta.url).pathname;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const imports = (path: string) => [...readFileSync(path, "utf8").matchAll(/(?:from|import)\s+["']([^"']+)["']/g)].map((m) => m[1]!);

describe("arquitectura", () => {
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
});
