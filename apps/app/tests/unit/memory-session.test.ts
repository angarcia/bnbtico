import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";
import { SESSION_STORAGE_KEY } from "../../src/data/storage";
import { EMAIL_SKIPPED_KEY } from "../../src/domain/publish-return";
import { ownerMemorySession } from "../e2e/helpers/memory-session";

const local = vi.hoisted(() => ({
  signIn: vi.fn(),
  localSupabase: vi.fn(),
}));
vi.mock("../db/local", () => local);

const now = 1_800_000_000_000;
const origin = "http://127.0.0.1:4273";
const session = (name: string, seconds = 3600): Session => ({
  access_token: `access-${name}`,
  refresh_token: `refresh-${name}`,
  token_type: "bearer",
  expires_in: seconds,
  expires_at: now / 1000 + seconds,
  user: { id: "owner", app_metadata: {}, user_metadata: {}, aud: "authenticated", created_at: "" },
});
const result = (value: Session | null) => ({ data: { session: value }, error: null });
const client = () => ({
  auth: {
    getSession: vi.fn().mockResolvedValue(result(session("initial"))),
    refreshSession: vi.fn().mockResolvedValue(result(session("renewed"))),
  },
});

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.spyOn(Date, "now").mockReturnValue(now);
  local.localSupabase.mockReturnValue({ url: "http://127.0.0.1:55321" });
});

describe("sesión del propietario en memoria, solo para editar-casa", () => {
  it("hace un OTP y renueva antes del siguiente contexto, sin reutilizar su almacenamiento", async () => {
    const owner = client();
    local.signIn.mockResolvedValue(owner);
    const memory = ownerMemorySession();
    await memory.useState(origin, 30_000, async (state) => {
      expect(state.cookies).toEqual([]);
      expect(state.origins).toEqual([{
        origin,
        localStorage: [
          { name: SESSION_STORAGE_KEY, value: JSON.stringify(session("initial")) },
          { name: EMAIL_SKIPPED_KEY, value: "1" },
        ],
      }]);
      state.origins[0]!.localStorage.push({ name: "private-cache", value: "old" });
    });
    await memory.useState(origin, 30_000, async (state) => {
      expect(state.origins[0]!.localStorage).toHaveLength(2);
      expect(JSON.parse(state.origins[0]!.localStorage[0]!.value)).toEqual(session("renewed"));
    });
    expect(local.signIn.mock.calls).toEqual([["owner"]]);
    expect(owner.auth.refreshSession).toHaveBeenCalledTimes(1);
  });

  it("no comparte el cliente entre familias ni conserva una sesión tras vaciar la memoria", async () => {
    local.signIn.mockImplementation(async () => client());
    const first = ownerMemorySession();
    const second = ownerMemorySession();
    await first.useState(origin, 30_000, async () => {});
    await second.useState(origin, 30_000, async () => {});
    first.clear();
    await first.useState(origin, 30_000, async () => {});
    expect(local.signIn).toHaveBeenCalledTimes(3);
  });

  it("rechaza dos contextos vivos y no permite vaciar una sesión prestada", async () => {
    local.signIn.mockResolvedValue(client());
    const memory = ownerMemorySession();
    await memory.useState(origin, 30_000, async () => {
      await expect(memory.useState(origin, 30_000, async () => {})).rejects.toThrow("contexto");
      expect(() => memory.clear()).toThrow("contexto");
    });
    expect(local.signIn).toHaveBeenCalledTimes(1);
  });

  it("una revocación falla sin repetir OTP ni exponer la respuesta de Auth", async () => {
    const owner = client();
    local.signIn.mockResolvedValue(owner);
    const memory = ownerMemorySession();
    await memory.useState(origin, 30_000, async () => {});
    owner.auth.refreshSession.mockResolvedValue({ data: { session: null }, error: { message: "private-refresh-token" } });
    const use = vi.fn();
    await expect(memory.useState(origin, 30_000, use)).rejects.toThrow(new Error("No se pudo renovar la sesión de prueba."));
    expect(use).not.toHaveBeenCalled();
    expect(local.signIn).toHaveBeenCalledTimes(1);
  });

  it.each(["https://pruebas.3bstays.com", "http://127.0.0.1.ejemplo.com", "http://localhost:4273@ejemplo.com"])(
    "rechaza el navegador alojado %s antes de autenticar",
    async (url) => {
      local.signIn.mockResolvedValue(client());
      await expect(ownerMemorySession().useState(url, 30_000, async () => {})).rejects.toThrow("local");
      expect(local.signIn).not.toHaveBeenCalled();
    },
  );

  it("rechaza Auth alojado aunque el navegador sea local", async () => {
    local.localSupabase.mockReturnValue({ url: "https://example.supabase.co" });
    await expect(ownerMemorySession().useState(origin, 30_000, async () => {})).rejects.toThrow("local");
    expect(local.signIn).not.toHaveBeenCalled();
  });

  it("no mezcla destinos en la misma memoria", async () => {
    local.signIn.mockResolvedValue(client());
    const memory = ownerMemorySession();
    await memory.useState(origin, 30_000, async () => {});
    await expect(memory.useState("http://127.0.0.1:4274", 30_000, async () => {})).rejects.toThrow("destino");
    local.localSupabase.mockReturnValue({ url: "http://127.0.0.1:55323" });
    await expect(memory.useState(origin, 30_000, async () => {})).rejects.toThrow("destino");
  });

  it.each([0, -1, Infinity, NaN])("rechaza un tiempo sin límite útil: %s", async (timeout) => {
    await expect(ownerMemorySession().useState(origin, timeout, async () => {})).rejects.toThrow("tiempo");
    expect(local.signIn).not.toHaveBeenCalled();
  });

  it.each([null, session("short", 120), { ...session("unknown"), expires_at: undefined }, { ...session("invalid"), expires_at: NaN }])(
    "no entrega una sesión que puede renovarse dentro del caso",
    async (value) => {
      const owner = client();
      owner.auth.getSession.mockResolvedValue(result(value));
      local.signIn.mockResolvedValue(owner);
      await expect(ownerMemorySession().useState(origin, 30_000, async () => {})).rejects.toThrow("vigencia");
      expect(local.signIn).toHaveBeenCalledTimes(1);
    },
  );

  it("descarta una sesión si el contexto alcanza la ventana de renovación del navegador", async () => {
    const owner = client();
    local.signIn.mockResolvedValue(owner);
    const memory = ownerMemorySession();
    await memory.useState(origin, 30_000, async () => {
      vi.mocked(Date.now).mockReturnValue(now + 3_510_000);
    });
    vi.mocked(Date.now).mockReturnValue(now);
    await memory.useState(origin, 30_000, async () => {});
    expect(local.signIn).toHaveBeenCalledTimes(2);
    expect(owner.auth.refreshSession).not.toHaveBeenCalled();
  });

  it("conserva el fallo del caso y descarta la sesión sin cerrar otras sesiones del usuario", async () => {
    local.signIn.mockResolvedValue(client());
    const memory = ownerMemorySession();
    const failure = new Error("assertion failed");
    await expect(memory.useState(origin, 30_000, async () => { throw failure; })).rejects.toBe(failure);
    await memory.useState(origin, 30_000, async () => {});
    expect(local.signIn).toHaveBeenCalledTimes(2);
  });

  it("no repite ni expone un fallo de OTP o de transporte", async () => {
    local.signIn.mockRejectedValue(new Error("private-auth-response"));
    const use = vi.fn();
    await expect(ownerMemorySession().useState(origin, 30_000, use)).rejects.toThrow(new Error("No se pudo iniciar la sesión de prueba."));
    expect(local.signIn).toHaveBeenCalledTimes(1);
    expect(use).not.toHaveBeenCalled();
  });
});
