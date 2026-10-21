import { describe, expect, it } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { refreshSupabaseSession } from "@/lib/auth/refresh";

describe("refresco de la sesión de Supabase en el proxy", () => {
  it("sin Supabase configurado no hace nada", async () => {
    const request = new NextRequest("http://127.0.0.1/cuenta");
    const response = NextResponse.next();
    let called = 0;
    await refreshSupabaseSession(request, response, {}, () => {
      called++;
      return { auth: { getUser: async () => ({ data: { user: null }, error: null }) } };
    });
    expect(called).toBe(0);
  });

  it("pide el usuario y guarda en la respuesta las cookies que Supabase renueva", async () => {
    const request = new NextRequest("http://127.0.0.1/cuenta", { headers: { cookie: "sb-x-auth-token=viejo" } });
    const response = NextResponse.next();
    let seen: { name: string; value: string }[] = [];
    await refreshSupabaseSession(request, response, { url: "http://x", anonKey: "k" }, (_url, _key, options) => {
      seen = options.cookies.getAll();
      return {
        auth: {
          async getUser() {
            options.cookies.setAll([{ name: "sb-x-auth-token", value: "nuevo", options: { maxAge: 3600 } }]);
            return { data: { user: null }, error: null };
          },
        },
      };
    });
    expect(seen).toEqual([{ name: "sb-x-auth-token", value: "viejo" }]);
    expect(response.cookies.get("sb-x-auth-token")?.value).toBe("nuevo");
    expect(response.cookies.get("sb-x-auth-token")?.httpOnly).toBe(true);
  });
});
