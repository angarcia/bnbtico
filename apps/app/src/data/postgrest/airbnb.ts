import { isRecord, readAirbnbSummary, type AirbnbService, type OwnerAirbnbApi } from "../../domain/airbnb";
import { DomainError, toDomainError } from "../../domain/errors";
import { IcalError } from "../../domain/ical";

interface Config { supabaseUrl: string; anonKey: string; fetch: typeof fetch }
export interface AirbnbServiceConfig extends Config { serviceKey: string }

export function airbnbRpc(cfg: Config, safeMessages: ReadonlySet<string> = SAFE_MESSAGES) {
  return async (name: string, args: Record<string, unknown>, bearer: string, apikey = cfg.anonKey): Promise<unknown> => {
    if (!bearer) throw new DomainError("Su sesión venció. Ingrese de nuevo.", "session");
    let response: Response;
    try {
      response = await cfg.fetch(`${cfg.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
        method: "POST", headers: { apikey, authorization: `Bearer ${bearer}`, "content-type": "application/json" }, body: JSON.stringify(args),
      });
    } catch { throw new DomainError("Sin conexión. Revise su internet e intente de nuevo.", "network"); }
    const raw: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      // Solo mensajes de dominio controlados; no propagar SQL, payload, URL ni errores de gateways.
      if (response.status === 401) throw new DomainError("Su sesión venció. Ingrese de nuevo.", "session");
      if (isRecord(raw) && raw.code === "P0001" && typeof raw.message === "string" && safeMessages.has(raw.message)) throw new DomainError(raw.message, "validation");
      throw toDomainError(isRecord(raw) ? { code: raw.code } : null);
    }
    return raw;
  };
}

const SAFE_MESSAGES = new Set([
  "Esta casa no permite conectar calendarios.", "Verifique su cuenta para conectar el calendario.",
  "No encontramos ese intento.", "Ya estamos leyendo este calendario.", "Esta casa ya tiene Airbnb conectado.",
  "Esta casa no tiene Airbnb conectado.", "Revise el enlace de exportación de Airbnb.",
  "Ingrese para conectar el calendario.", "No encontramos ese anuncio.", "Su sesión venció. Ingrese de nuevo.",
]);

function attempt(value: unknown): { run: boolean } {
  if (!isRecord(value) || typeof value.run !== "boolean") throw new Error("Intento de calendario no válido.");
  return { run: value.run };
}

export function createAirbnbService(cfg: AirbnbServiceConfig): AirbnbService {
  const rpc = airbnbRpc(cfg);
  const service = (name: string, args: Record<string, unknown>) => rpc(name, args, cfg.serviceKey, cfg.serviceKey);
  return {
    async begin(jwt, listingId, url, requestId) { return attempt(await rpc("begin_airbnb_import", { p_listing: listingId, p_url: url, p_request: requestId }, jwt)); },
    async claim(listingId, requestId) { return attempt(await service("claim_airbnb_import", { p_listing: listingId, p_request: requestId })); },
    async context(listingId, requestId) {
      const raw = await service("airbnb_import_context", { p_listing: listingId, p_request: requestId });
      if (raw === null) return null;
      if (!isRecord(raw) || typeof raw.url !== "string") throw new Error("Contexto de calendario no válido.");
      return { url: raw.url };
    },
    async finish(listingId, requestId, blocks, error) { await service("finish_airbnb_import", { p_listing: listingId, p_request: requestId, p_blocks: blocks, p_error: error }); },
    async overview(jwt, listingId) { return readAirbnbSummary(await rpc("airbnb_overview", { p_listing: listingId }, jwt)); },
  };
}

export function createOwnerAirbnb(cfg: Config & { token(): Promise<string | null> }): OwnerAirbnbApi {
  const rpc = airbnbRpc(cfg);
  async function token() {
    const jwt = await cfg.token();
    if (!jwt) throw new DomainError("Su sesión venció. Ingrese de nuevo.", "session");
    return jwt;
  }
  return {
    async overview(listingId) { return readAirbnbSummary(await rpc("airbnb_overview", { p_listing: listingId }, await token())); },
    async connect(listingId, url, requestId) {
      let response: Response;
      try {
        response = await cfg.fetch("/api/calendarios/airbnb", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${await token()}` }, body: JSON.stringify({ listingId, url, requestId }) });
      } catch (error) {
        if (error instanceof DomainError) throw error;
        throw new DomainError("Sin conexión. Revise su internet e intente de nuevo.", "network");
      }
      const raw: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 401) throw new DomainError("Su sesión venció. Ingrese de nuevo.", "session");
        const code = isRecord(raw) ? raw.code : null;
        if (code === "url" || code === "calendar" || code === "unsupported" || code === "download" || code === "timeout" || code === "size") throw new DomainError(new IcalError(code).message, "validation");
        if (isRecord(raw) && typeof raw.error === "string" && SAFE_MESSAGES.has(raw.error)) throw new DomainError(raw.error, "validation");
        throw new DomainError("No pudimos conectar Airbnb. Intente de nuevo.", "unknown");
      }
      return readAirbnbSummary(raw);
    },
  };
}
