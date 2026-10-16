import { beforeEach, describe, expect, it } from "vitest";
import { createDemoAuth, DEMO_CODE } from "@/lib/auth/demo";
import { createSupabaseAuth } from "@/lib/auth/supabase";
import { RESEND_COOLDOWN_MS } from "@/lib/auth/cooldown";
import type { AuthProvider, CookieJar } from "@/lib/auth/types";
import { fakeSupabase, FAKE_OTP } from "./helpers/fake-supabase";

type Jar = CookieJar & { all(): { name: string; value: string }[] };
function memoryJar(): Jar {
  const store = new Map<string, string>();
  return {
    get: (name) => store.get(name) ?? null,
    set: (name, value) => void store.set(name, value),
    delete: (name) => void store.delete(name),
    all: () => [...store].map(([name, value]) => ({ name, value })),
  };
}

interface Harness { auth: AuthProvider; code: string; advance(ms: number): void }
const clock = () => {
  let t = 1_700_000_000_000;
  return { now: () => t, advance: (ms: number) => void (t += ms) };
};
const providers: [string, () => Harness][] = [
  [
    "demo",
    () => {
      const c = clock();
      return { auth: createDemoAuth(memoryJar(), "secreto", { now: c.now }), code: DEMO_CODE, advance: c.advance };
    },
  ],
  [
    "supabase",
    () => {
      const c = clock();
      const fake = fakeSupabase();
      return { auth: createSupabaseAuth(memoryJar(), { url: "http://x", anonKey: "k", secret: "secreto" }, { client: fake.client, now: c.now }), code: FAKE_OTP, advance: c.advance };
    },
  ],
];
const PHONE = "+50688881234";

describe.each(providers)("contrato de AuthProvider · %s", (_name, make) => {
  let h: Harness;
  beforeEach(() => {
    h = make();
  });

  it("registra con nombre y WhatsApp y deja la sesión abierta", async () => {
    expect(await h.auth.current()).toBeNull();
    expect((await h.auth.start({ mode: "register", name: "Ana", phone: PHONE })).ok).toBe(true);
    expect((await h.auth.pending())?.phone).toBe(PHONE);
    expect((await h.auth.verify("000000")).ok).toBe(false);
    expect((await h.auth.verify(h.code)).ok).toBe(true);
    const account = await h.auth.current();
    expect(account?.name).toBe("Ana");
    expect(account?.phone).toBe(PHONE);
    expect(account?.phoneVerified).toBe(true);
    expect(account?.isOwner).toBe(false);
    expect(await h.auth.pending()).toBeNull();
  });

  it("no deja iniciar sesión con un número sin cuenta", async () => {
    const started = await h.auth.start({ mode: "login", phone: PHONE });
    expect(started.ok).toBe(false);
    expect(started.error).toMatch(/no hay una cuenta/i);
  });

  it("vuelve a entrar tras cerrar sesión y conserva el perfil", async () => {
    await h.auth.start({ mode: "register", name: "Ana", phone: PHONE });
    await h.auth.verify(h.code);
    await h.auth.updateProfile({ description: "Viajo con mi familia", email: "ana@ejemplo.com" });
    await h.auth.logout();
    expect(await h.auth.current()).toBeNull();
    h.advance(RESEND_COOLDOWN_MS);
    expect((await h.auth.start({ mode: "login", phone: PHONE })).ok).toBe(true);
    await h.auth.verify(h.code);
    const account = await h.auth.current();
    expect(account?.name).toBe("Ana");
    expect(account?.description).toBe("Viajo con mi familia");
    expect(account?.email).toBe("ana@ejemplo.com");
  });

  it("registrarse con un número que ya tiene cuenta no la duplica ni la renombra", async () => {
    await h.auth.start({ mode: "register", name: "Ana", phone: PHONE });
    await h.auth.verify(h.code);
    await h.auth.logout();
    h.advance(RESEND_COOLDOWN_MS);
    const again = await h.auth.start({ mode: "register", name: "Otra", phone: PHONE });
    if (again.ok) await h.auth.verify(h.code);
    else {
      expect(again.error).toMatch(/ya hay una cuenta/i);
      await h.auth.start({ mode: "login", phone: PHONE });
      await h.auth.verify(h.code);
    }
    expect((await h.auth.current())?.name).toBe("Ana");
  });

  it("espera 30 segundos entre códigos para el mismo número", async () => {
    await h.auth.start({ mode: "register", name: "Ana", phone: PHONE });
    const tooSoon = await h.auth.resend();
    expect(tooSoon.ok).toBe(false);
    expect(tooSoon.error).toMatch(/30 segundos/);
    const restart = await h.auth.start({ mode: "register", name: "Ana", phone: PHONE });
    expect(restart.ok).toBe(false);
    expect(restart.error).toMatch(/30 segundos/);
    h.advance(RESEND_COOLDOWN_MS);
    expect((await h.auth.resend()).ok).toBe(true);
    expect((await h.auth.verify(h.code)).ok).toBe(true);
  });

  it("cancelar olvida el número pendiente", async () => {
    await h.auth.start({ mode: "register", name: "Ana", phone: PHONE });
    await h.auth.cancel();
    expect(await h.auth.pending()).toBeNull();
    expect((await h.auth.verify(h.code)).ok).toBe(false);
  });
});

describe("proveedor Supabase", () => {
  it("manda el nombre como metadato del usuario y deja que el trigger cree el perfil", async () => {
    const fake = fakeSupabase();
    const auth = createSupabaseAuth(memoryJar(), { url: "http://x", anonKey: "k", secret: "secreto" }, { client: fake.client });
    await auth.start({ mode: "register", name: "Ana", phone: PHONE });
    expect(fake.sent[0]?.data).toEqual({ full_name: "Ana" });
    await auth.verify(FAKE_OTP);
    expect(fake.profiles.size).toBe(1);
    expect([...fake.profiles.values()][0]?.full_name).toBe("Ana");
  });

  it("traduce el límite de envíos de Supabase a un aviso con los segundos de espera", async () => {
    const fake = fakeSupabase({ rateLimited: true });
    const auth = createSupabaseAuth(memoryJar(), { url: "http://x", anonKey: "k", secret: "secreto" }, { client: fake.client });
    const started = await auth.start({ mode: "register", name: "Ana", phone: PHONE });
    expect(started.ok).toBe(false);
    expect(started.error).toMatch(/42 segundos/);
  });

  it("si el perfil no existe tras verificar, cierra la sesión y avisa", async () => {
    const fake = fakeSupabase({ trigger: false });
    const auth = createSupabaseAuth(memoryJar(), { url: "http://x", anonKey: "k", secret: "secreto" }, { client: fake.client });
    await auth.start({ mode: "register", name: "Ana", phone: PHONE });
    const result = await auth.verify(FAKE_OTP);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/perfil/i);
    expect(await auth.current()).toBeNull();
  });
});

describe("segundos de espera para reenviar", () => {
  it("cuenta hacia atrás desde 30 y no baja de 0", async () => {
    const { resendWaitSeconds } = await import("@/lib/auth/cooldown");
    expect(resendWaitSeconds(1000, 1000)).toBe(30);
    expect(resendWaitSeconds(1000, 1000 + 12_400)).toBe(18);
    expect(resendWaitSeconds(1000, 1000 + 31_000)).toBe(0);
  });
});
