import { describe, expect, it } from "vitest";
import { supabaseEnv } from "@/lib/auth/supabase-env";

describe("variables de Supabase", () => {
  it("devuelve URL y clave cuando están las dos", () => {
    expect(supabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k" })).toEqual({ url: "https://abc.supabase.co", anonKey: "k" });
  });
  it("recorta la ruta si se pegó la URL de REST o una barra final", () => {
    expect(supabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co/rest/v1", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k" })?.url).toBe("https://abc.supabase.co");
    expect(supabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co/", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k" })?.url).toBe("https://abc.supabase.co");
    expect(supabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321/", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k" })?.url).toBe("http://127.0.0.1:54321");
  });
  it("null si falta algo, la URL no es válida o se fuerza el demo", () => {
    expect(supabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co" })).toBeNull();
    expect(supabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: "abc", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k" })).toBeNull();
    expect(supabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k", AUTH_PROVIDER: "demo" })).toBeNull();
  });
});
