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
