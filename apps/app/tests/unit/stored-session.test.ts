import { describe, expect, it } from "vitest";
import { quickWriter, storedSession } from "../../src/data/postgrest/session-client";
import { SESSION_STORAGE_KEY, memoryStore } from "../../src/data/storage";

const NOW = 1_800_000_000_000;
const store = (session: unknown) => {
  const s = memoryStore();
  if (session !== undefined) s.setItem(SESSION_STORAGE_KEY, typeof session === "string" ? session : JSON.stringify(session));
  return s;
};
const session = (expiresInS: number) => ({ access_token: "jwt", expires_at: NOW / 1000 + expiresInS, user: { id: "u1" } });

describe("sesión guardada para escribir sin esperas", () => {
  it("token vigente: se lee al momento", () => {
    expect(storedSession(store(session(3600)), NOW)).toEqual({ accessToken: "jwt", userId: "u1" });
  });

  it("vencido o a punto de vencer, sin sesión, ilegible o almacenamiento asíncrono: null (camino normal)", () => {
    expect(storedSession(store(session(5)), NOW)).toBeNull();
    expect(storedSession(store(session(-60)), NOW)).toBeNull();
    expect(storedSession(store(undefined), NOW)).toBeNull();
    expect(storedSession(store("{roto"), NOW)).toBeNull();
    expect(storedSession(store({ access_token: "jwt", expires_at: NOW / 1000 + 3600 }), NOW)).toBeNull();
    const async = { getItem: async () => JSON.stringify(session(3600)), setItem: async () => undefined, removeItem: async () => undefined };
    expect(storedSession(async, NOW)).toBeNull();
  });

  it("el escritor reutiliza un solo cliente y sigue la sesión guardada", () => {
    const s = store(session(3600));
    const write = quickWriter("http://127.0.0.1:54321", "anon", s, () => NOW);
    const a = write();
    expect(a).toMatchObject({ accessToken: "jwt", userId: "u1" });
    expect(write()?.db).toBe(a?.db);
    s.removeItem(SESSION_STORAGE_KEY);
    expect(write()).toBeNull();
  });
});
