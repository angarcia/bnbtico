import type { BrowserContextOptions } from "@playwright/test";
import { SESSION_STORAGE_KEY } from "../../../src/data/storage";
import { EMAIL_SKIPPED_KEY } from "../../../src/domain/publish-return";
import { localSupabase, signIn } from "../../db/local";

type StorageState = Exclude<BrowserContextOptions["storageState"], string | undefined>;
const BROWSER_REFRESH_WINDOW_MS = 120_000;

function localOrigin(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) && !url.username && !url.password) return url.origin;
  } catch {}
  throw new Error("La sesión de prueba exige un destino local.");
}

export function ownerMemorySession() {
  let client: Awaited<ReturnType<typeof signIn>> | null = null;
  let target: string | null = null;
  let busy = false;

  return {
    clear() {
      if (busy) throw new Error("El contexto todavía usa la sesión.");
      client = null;
      target = null;
    },
    async useState(baseURL: string, timeoutMs: number, use: (state: StorageState) => Promise<void>) {
      if (busy) throw new Error("El contexto anterior todavía usa la sesión.");
      if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("La sesión exige un tiempo de prueba limitado.");
      const origin = localOrigin(baseURL);
      const destination = `${localOrigin(localSupabase().url)}|${origin}`;
      if (target && target !== destination) throw new Error("No se comparte una sesión entre destinos.");
      target = destination;
      busy = true;
      let expiresAt = 0;
      try {
        const renewing = !!client;
        const session = await (async () => {
          try {
            if (!client) client = await signIn("owner");
            const result = renewing ? await client.auth.refreshSession() : await client.auth.getSession();
            if (result.error) throw new Error();
            return result.data.session;
          } catch {
            throw new Error(renewing ? "No se pudo renovar la sesión de prueba." : "No se pudo iniciar la sesión de prueba.");
          }
        })();
        expiresAt = (session?.expires_at ?? 0) * 1000;
        if (!session || !Number.isFinite(expiresAt) || expiresAt - Date.now() <= timeoutMs + BROWSER_REFRESH_WINDOW_MS) throw new Error("La sesión no tiene vigencia suficiente para el caso.");
        await use({
          cookies: [],
          origins: [{
            origin,
            localStorage: [
              { name: SESSION_STORAGE_KEY, value: JSON.stringify(session) },
              { name: EMAIL_SKIPPED_KEY, value: "1" },
            ],
          }],
        });
      } catch (error) {
        client = null;
        throw error;
      } finally {
        if (expiresAt - Date.now() <= BROWSER_REFRESH_WINDOW_MS) client = null;
        busy = false;
      }
    },
  };
}
