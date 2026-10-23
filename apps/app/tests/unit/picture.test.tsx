import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Picture } from "../../src/shared/picture";

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
