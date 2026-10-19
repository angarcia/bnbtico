import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../../proxy";

describe("contraseña de pruebas.bnbtico.com", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("sin PREVIEW_PASSWORD deja pasar", async () => {
    vi.stubEnv("PREVIEW_PASSWORD", "");
    expect((await proxy(new NextRequest("http://127.0.0.1/cuenta"))).status).toBe(200);
  });

  it("con contraseña pide credenciales salvo para los iconos y el manifest de la PWA", async () => {
    vi.stubEnv("PREVIEW_PASSWORD", "clave");
    expect((await proxy(new NextRequest("http://127.0.0.1/cuenta"))).status).toBe(401);
    for (const path of ["/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png", "/favicon.ico"]) {
      expect((await proxy(new NextRequest(`http://127.0.0.1${path}`))).status, path).toBe(200);
    }
    const ok = await proxy(new NextRequest("http://127.0.0.1/cuenta", { headers: { authorization: `Basic ${btoa("quien:clave")}` } }));
    expect(ok.status).toBe(200);
  });
});

describe("vista previa de WhatsApp en pruebas", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("el rastreador de WhatsApp lee /casa/* sin contraseña; el resto sigue cerrado", async () => {
    vi.stubEnv("PREVIEW_PASSWORD", "clave");
    const wa = { headers: { "user-agent": "WhatsApp/2.23.20.0 A" } };
    expect((await proxy(new NextRequest("http://127.0.0.1/casa/CT-1001", wa))).status).toBe(200);
    expect((await proxy(new NextRequest("http://127.0.0.1/casa/CT-1001", { headers: { "user-agent": "facebookexternalhit/1.1" } }))).status).toBe(200);
    expect((await proxy(new NextRequest("http://127.0.0.1/explorar", wa))).status).toBe(401);
    expect((await proxy(new NextRequest("http://127.0.0.1/casa/CT-1001", { headers: { "user-agent": "Mozilla/5.0" } }))).status).toBe(401);
  });
});

describe("sondas de disponibilidad", () => {
  it("HEAD / responde 200 sin redirigir (panel de vista previa, monitores)", async () => {
    vi.stubEnv("PREVIEW_PASSWORD", "");
    const res = await proxy(new NextRequest("http://127.0.0.1/", { method: "HEAD" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    // Debe responder el propio proxy, no dejar pasar la petición a la página (que redirige a /explorar en pruebas y local).
    expect(res.headers.get("x-middleware-next")).toBeNull();
  });
});
