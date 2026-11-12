// Solo en vertical en el teléfono (decisión 2026-11-03): el manifiesto fija `portrait` y, en un teléfono en horizontal, un aviso
// estático (sin JS) tapa la app. Va fuera de #root en index.html, que es también la plantilla de la ficha del worker.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderDocument } from "../../src/server/render";
import { readCss } from "../read-css";

const template = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const css = readCss();
const manifest = JSON.parse(readFileSync(new URL("../../public/manifest.webmanifest", import.meta.url), "utf8")) as { orientation?: string };

const NOTICE = /<div class="rotate-notice" role="alert">[\s\S]*?Gire el teléfono para usar 3bstays[\s\S]*?<\/div>/;

describe("solo en vertical", () => {
  it("el manifiesto de la PWA fija la orientación vertical", () => {
    expect(manifest.orientation).toBe("portrait");
  });

  it("el aviso está en la plantilla, fuera de #root (React no lo toca ni al hidratar), sin estilos en línea", () => {
    const notice = template.match(NOTICE)?.[0];
    expect(notice).toBeDefined();
    expect(template.indexOf(notice!)).toBeGreaterThan(template.indexOf('<div id="root"><!--app-html--></div>'));
    expect(notice).not.toMatch(/\sstyle=/);
    // El logo no compite con la portada de la ficha: diferido y, fuera de horizontal (display:none), ni se pide.
    expect(notice).toMatch(/<img [^>]*src="\/logo-horizontal.png"[^>]*loading="lazy"/);
  });

  it("la ficha que pinta el worker lleva el aviso", () => {
    const html = renderDocument(template, { page: "missing" });
    expect(html).toMatch(NOTICE);
  });

  it("el CSS lo muestra solo en un teléfono en horizontal y entonces esconde la app", () => {
    expect(css).toMatch(/\.rotate-notice\{display:none/);
    const media = "@media (orientation:landscape) and (max-height:500px) and (min-width:560px) and (pointer:coarse)";
    const block = css.slice(css.indexOf(media));
    expect(css.includes(media)).toBe(true);
    expect(block).toMatch(/\.rotate-notice\{display:flex/);
    expect(block).toMatch(/body>:not\(\.rotate-notice\)\{visibility:hidden/);
  });
});
