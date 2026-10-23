import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import app, { type Env } from "../../src/server";

const template = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const SHELL = "<!doctype html><title>shell</title>";

function env(overrides: Partial<Env> = {}): Env {
  return {
    ENVIRONMENT: "pruebas",
    ASSETS: {
      async fetch(input: RequestInfo | URL) {
        const url = new URL(input instanceof Request ? input.url : input);
        return url.pathname === "/" ? new Response(template, { headers: { "content-type": "text/html" } }) : new Response(SHELL, { headers: { "content-type": "text/html" } });
      },
    },
    ...overrides,
  };
}

async function get(path: string, e = env()) {
  return app.request(`https://nueva.bnbtico.com${path}`, {}, e);
}

describe("worker · ficha de prueba /casa/CT-0000", () => {
  it("responde HTML renderizado en servidor con la casa dentro de #root", async () => {
    const res = await get("/casa/CT-0000");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    const html = await res.text();
    expect(html).toMatch(/<div id="root">[\s\S]*<main class="listing">[\s\S]*<h1>Casa de prueba frente a Playa Negra<\/h1>/);
    expect(html).toContain("₡95\u00a0000");
    expect(html).not.toContain("<!--app-html-->");
  });

  it("inyecta título, descripción, Open Graph, Twitter y canónica", async () => {
    const html = await (await get("/casa/CT-0000")).text();
    expect(html).toContain("<title>Casa de prueba frente a Playa Negra · bnbtico</title>");
    expect(html).not.toContain("<title>bnbtico</title>");
    expect(html).toMatch(/<meta name="description" content="[^"]+"/);
    expect(html).toContain('<meta property="og:title" content="Casa de prueba frente a Playa Negra"');
    expect(html).toContain('<meta property="og:type" content="website"');
    expect(html).toContain('<meta property="og:url" content="https://nueva.bnbtico.com/casa/CT-0000"');
    expect(html).toContain('<meta property="og:image" content="https://nueva.bnbtico.com/fixture/ct-0000.jpg"');
    expect(html).toContain('<meta property="og:locale" content="es_CR"');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image"');
    expect(html).toContain('<link rel="canonical" href="https://nueva.bnbtico.com/casa/CT-0000"');
  });

  it("precarga la foto principal con prioridad alta", async () => {
    const html = await (await get("/casa/CT-0000")).text();
    expect(html).toContain('<link rel="preload" as="image" href="/fixture/ct-0000.jpg" fetchpriority="high"');
  });

  it("incrusta la casa en un script JSON no ejecutable y escapado", async () => {
    const html = await (await get("/casa/CT-0000")).text();
    const match = html.match(/<script type="application\/json" id="listing-data">([\s\S]*?)<\/script>/);
    expect(match).not.toBeNull();
    const json = match![1]!;
    expect(json).not.toContain("<");
    const listing = JSON.parse(json);
    expect(listing).toMatchObject({ publicId: "CT-0000", title: "Casa de prueba frente a Playa Negra", nightlyPrice: 95000, currency: "CRC" });
  });

  it("escapa el texto de la casa en las etiquetas", async () => {
    const { renderListingDocument } = await import("../../src/server/render");
    const html = renderListingDocument(template, { ...(await import("../../src/shared/fixture")).FIXTURE_LISTING, title: 'Casa "Sol" <b>&</b>' }, "https://nueva.bnbtico.com");
    expect(html).toContain('content="Casa &quot;Sol&quot; &lt;b&gt;&amp;&lt;/b&gt;"');
    expect(html).not.toContain("<b>&</b>");
  });
});

describe("worker · resto de rutas", () => {
  it("sirve el shell de la SPA para cualquier ruta desconocida", async () => {
    const res = await get("/explorar");
    expect(await res.text()).toBe(SHELL);
  });

  it("robots.txt bloquea todo fuera de producción", async () => {
    const res = await get("/robots.txt");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("User-agent: *\nDisallow: /\n");
  });

  it("robots.txt permite indexar en producción", async () => {
    const res = await get("/robots.txt", env({ ENVIRONMENT: "production" }));
    expect(await res.text()).toBe("User-agent: *\nAllow: /\nSitemap: https://bnbtico.com/sitemap.xml\n");
  });
});
