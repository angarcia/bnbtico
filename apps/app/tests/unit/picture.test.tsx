import { renderToString } from "react-dom/server";
import type { SyntheticEvent } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fadeIn, Picture } from "../../src/shared/picture";

const attrs = (html: string) => Object.fromEntries([...html.matchAll(/([a-zA-Z]+)="([^"]*)"/g)].map((m) => [m[1]!.toLowerCase(), m[2]!]));

describe("Picture", () => {
  it("variantes 480/800 con sizes, dimensiones explícitas y carga diferida", () => {
    const html = renderToString(
      <Picture photo={{ path: "l1/abc", url: "https://s/l1/abc/800.jpg", srcSet: "https://s/l1/abc/480.jpg 480w, https://s/l1/abc/800.jpg 800w" }} alt="" sizes="50vw" width={480} height={336} />,
    );
    const a = attrs(html);
    expect(a.src).toBe("https://s/l1/abc/800.jpg");
    expect(a.srcset).toBe("https://s/l1/abc/480.jpg 480w, https://s/l1/abc/800.jpg 800w");
    expect(a.sizes).toBe("50vw");
    expect(a).toMatchObject({ width: "480", height: "336", loading: "lazy", decoding: "async", alt: "" });
  });
  it("una foto anterior (un solo archivo) va sin srcset ni sizes", () => {
    const a = attrs(renderToString(<Picture photo={{ path: "l1/vieja.jpg", url: "https://s/l1/vieja.jpg", srcSet: null }} alt="Casa" sizes="50vw" width={480} height={336} />));
    expect(a.src).toBe("https://s/l1/vieja.jpg");
    expect(a.srcset).toBeUndefined();
    expect(a.sizes).toBeUndefined();
    expect(a.loading).toBe("lazy");
  });
});

describe("fadeIn", () => {
  afterEach(() => vi.restoreAllMocks());
  const img = (complete = false) => ({ complete, naturalWidth: complete ? 480 : 0, dataset: {} as DOMStringMap }) as unknown as HTMLImageElement;
  const load = (el: HTMLImageElement) => fadeIn.onLoad({ currentTarget: el } as SyntheticEvent<HTMLImageElement>);
  const at = (ms: number) => vi.spyOn(performance, "now").mockReturnValue(ms);

  it("ya en caché al montarla: visible sin esperar al load", () => {
    const el = img(true);
    fadeIn.ref(el);
    expect(el.dataset).toEqual({ loaded: "" });
  });
  it("llega casi al montarla (caché del service worker): aparece sin fundido, para no retrasar el LCP", () => {
    const el = img();
    at(1000);
    fadeIn.ref(el);
    at(1060);
    load(el);
    expect(el.dataset).toEqual({ loaded: "", instant: "" });
  });
  it("llega de la red: con fundido", () => {
    const el = img();
    at(1000);
    fadeIn.ref(el);
    at(1400);
    load(el);
    expect(el.dataset).toEqual({ loaded: "" });
  });
});
