// «¿No encuentra lo que busca?» en Explorar (fase 6, ticket 01): sin número de atención a clientes en el build
// (VITE_WA_GUESTS vacío) no sale la nota ni el botón; el build de las pruebas E2E sí lleva un número de prueba.
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Filters } from "../../src/domain/filters";
import { SearchHelp } from "../../src/client/search-help";

const f: Filters = { prov: "Limón", modes: [], ppl: 4, beds: 0, features: ["pool"], min: 0, max: 0, open: false };
const noop = () => undefined;

describe("Explorar · ¿No encuentra lo que busca?", () => {
  it("con número: la nota y el botón en contorno a wa.me con el mensaje", () => {
    const html = renderToString(<SearchHelp filters={f} number="+506 6000 0000" />);
    expect(html).toContain("¿No encuentra lo que busca?");
    expect(html).toContain("btn-outline");
    expect(html).not.toContain("btn-wa");
    expect(html).toContain(`href="https://wa.me/50660000000?text=${encodeURIComponent("Hola, estoy buscando casa en bnbtico.\nZona: Limón.\nPersonas: 4.\nNecesito: Piscina.\nFechas: ")}"`);
    expect(html).toContain("Escribir a bnbtico por WhatsApp");
  });

  it("sin número no sale nada al final de la rejilla", () => {
    expect(renderToString(<SearchHelp filters={f} number="" />)).toBe("");
  });

  it("sin resultados: título, nota y «Quitar filtros» si hay filtros", () => {
    const html = renderToString(<SearchHelp filters={f} number="50660000000" onClear={noop} />);
    expect(html).toContain("No hay casas con esos filtros");
    expect(html).toContain("¿No encuentra lo que busca?");
    expect(html).toContain("wa.me/50660000000");
    expect(html).toContain("Quitar filtros");
  });

  it("sin resultados y sin número: solo el título y «Quitar filtros»", () => {
    const html = renderToString(<SearchHelp filters={f} number="" onClear={noop} />);
    expect(html).toContain("No hay casas con esos filtros");
    expect(html).toContain("Quitar filtros");
    expect(html).not.toContain("No encuentra");
    expect(html).not.toContain("wa.me");
  });

  it("sin filtros puestos (onClear null) no ofrece «Quitar filtros»", () => {
    const html = renderToString(<SearchHelp filters={f} number="50660000000" onClear={null} />);
    expect(html).not.toContain("Quitar filtros");
  });
});
