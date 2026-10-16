import { beforeEach, describe, expect, it } from "vitest";
import { createDemoAuth, DEMO_CODE } from "@/lib/auth/demo";
import type { CookieJar } from "@/lib/auth/types";

function memoryJar(): CookieJar {
  const store = new Map<string, string>();
  return {
    get: (name) => store.get(name) ?? null,
    set: (name, value) => void store.set(name, value),
    delete: (name) => void store.delete(name),
  };
}

describe("autenticación demo (sin envíos reales)", () => {
  let jar: CookieJar;
  beforeEach(() => {
    jar = memoryJar();
  });

  it("registra con nombre y WhatsApp usando el código de ejemplo", async () => {
    const auth = createDemoAuth(jar, "secreto");
    expect(await auth.current()).toBeNull();
    const started = await auth.start({ mode: "register", name: "Ana", phone: "+50688881234" });
    expect(started.ok).toBe(true);
    expect((await auth.verify("000000")).ok).toBe(false);
    expect((await auth.verify(DEMO_CODE)).ok).toBe(true);
    const account = await auth.current();
    expect(account?.name).toBe("Ana");
    expect(account?.phone).toBe("+50688881234");
    expect(account?.phoneVerified).toBe(true);
  });

  it("no deja iniciar sesión con un número que no tiene cuenta", async () => {
    const auth = createDemoAuth(jar, "secreto");
    const started = await auth.start({ mode: "login", phone: "+50688889999" });
    expect(started.ok).toBe(false);
    expect(started.error).toMatch(/no hay una cuenta/i);
  });

  it("vuelve a entrar con el mismo número tras cerrar sesión", async () => {
    const auth = createDemoAuth(jar, "secreto");
    await auth.start({ mode: "register", name: "Ana", phone: "+50688881234" });
    await auth.verify(DEMO_CODE);
    await auth.logout();
    expect(await auth.current()).toBeNull();
    expect((await auth.start({ mode: "login", phone: "+50688881234" })).ok).toBe(true);
    await auth.verify(DEMO_CODE);
    expect((await auth.current())?.name).toBe("Ana");
  });

  it("bloquea tras 5 intentos fallidos", async () => {
    const auth = createDemoAuth(jar, "secreto");
    await auth.start({ mode: "register", name: "Ana", phone: "+50688881234" });
    for (let i = 0; i < 5; i++) expect((await auth.verify("111111")).ok).toBe(false);
    const last = await auth.verify(DEMO_CODE);
    expect(last.ok).toBe(false);
    expect(last.error).toMatch(/pedí otro código/i);
  });

  it("guarda cambios de perfil", async () => {
    const auth = createDemoAuth(jar, "secreto");
    await auth.start({ mode: "register", name: "Ana", phone: "+50688881234" });
    await auth.verify(DEMO_CODE);
    await auth.updateProfile({ description: "Viajo con mi familia", email: "ana@ejemplo.com" });
    const account = await auth.current();
    expect(account?.description).toBe("Viajo con mi familia");
    expect(account?.email).toBe("ana@ejemplo.com");
  });
});

describe("cuentas demo en cookies (límite de 4 KB por cookie del navegador)", () => {
  function browserJar(): CookieJar & { sizes(): number[] } {
    const store = new Map<string, string>();
    return {
      get: (name) => store.get(name) ?? null,
      set: (name, value) => {
        if (name.length + value.length > 4096) return; // el navegador descarta la cookie entera
        store.set(name, value);
      },
      delete: (name) => void store.delete(name),
      sizes: () => [...store.values()].map((v) => v.length),
    };
  }

  it("tres cuentas con descripciones largas siguen pudiendo entrar", async () => {
    const jar = browserJar();
    const auth = createDemoAuth(jar, "secreto");
    const phones = ["+50688880001", "+50688880002", "+50688880003"];
    for (const [i, phone] of phones.entries()) {
      await auth.start({ mode: "register", name: `Persona ${i}`, phone });
      await auth.verify(DEMO_CODE);
      await auth.updateProfile({ description: "x".repeat(1000), email: `persona${i}@ejemplo.com` });
      await auth.logout();
    }
    for (const [i, phone] of phones.entries()) {
      expect((await auth.start({ mode: "login", phone })).ok).toBe(true);
      await auth.verify(DEMO_CODE);
      const account = await auth.current();
      expect(account?.name).toBe(`Persona ${i}`);
      expect(account?.description).toBe("x".repeat(1000));
      await auth.logout();
    }
    expect(Math.max(...jar.sizes())).toBeLessThan(4096);
  });
});
