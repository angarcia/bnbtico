// `vite preview` (miniflare) sirve HTML, JS y CSS sin comprimir; Cloudflare los comprime en el borde. Medir sin
// compresión triplica los bytes del JS (279 KB frente a 88 KB gz) y la puerta mediría el servidor local, no la app.
// Este proxy delante del preview comprime con gzip (nivel 6, más conservador que el brotli de Cloudflare) lo que el
// navegador acepte y sea texto; el resto pasa tal cual. Conserva el Host del proxy: el worker compara el origen de las
// balizas con él.
import { createServer, request, type Server } from "node:http";
import { gzipSync } from "node:zlib";

const TEXT = /^(text\/|application\/(javascript|json|manifest\+json|xml)|image\/svg\+xml)/;

export function gzipProxy(target: string): Promise<{ url: string; close: () => Promise<void> }> {
  const upstream = new URL(target);
  const server: Server = createServer((req, res) => {
    const out = request(
      { host: upstream.hostname, port: upstream.port, path: req.url, method: req.method, headers: { ...req.headers, "accept-encoding": "identity" } },
      (up) => {
        const type = String(up.headers["content-type"] ?? "");
        const gzip = /\bgzip\b/.test(String(req.headers["accept-encoding"] ?? "")) && TEXT.test(type) && !up.headers["content-encoding"];
        if (!gzip) {
          res.writeHead(up.statusCode ?? 502, up.headers);
          up.pipe(res);
          return;
        }
        const chunks: Buffer[] = [];
        up.on("data", (c: Buffer) => chunks.push(c));
        up.on("end", () => {
          const body = gzipSync(Buffer.concat(chunks), { level: 6 });
          const headers = { ...up.headers, "content-encoding": "gzip", "content-length": String(body.length), vary: "accept-encoding" };
          delete headers["transfer-encoding"];
          res.writeHead(up.statusCode ?? 502, headers);
          res.end(body);
        });
      },
    );
    out.on("error", () => {
      res.writeHead(502);
      res.end();
    });
    req.pipe(out);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as { port: number };
      resolve({ url: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(() => r())) });
    });
  });
}
