import { DomainError } from "../../domain/errors";
import { ICAL_EXPORT_MESSAGES, ICAL_EXPORT_TOKEN, readIcalExportSnapshot, readOwnerIcalExport, type IcalExportService, type OwnerIcalExportApi } from "../../domain/ical-export";
import { airbnbRpc, type AirbnbServiceConfig } from "./airbnb";

type OwnerConfig = Pick<AirbnbServiceConfig, "supabaseUrl" | "anonKey" | "fetch">;
const messages: ReadonlySet<string> = new Set(Object.values(ICAL_EXPORT_MESSAGES));

export function createIcalExportService(cfg: AirbnbServiceConfig): IcalExportService {
  const rpc = airbnbRpc(cfg, messages);
  return {
    async owner(jwt, listingId, generate) {
      return readOwnerIcalExport(await rpc("owner_ical_export", { p_listing: listingId, p_generate: generate }, jwt));
    },
    async revoke(jwt, listingId) { await rpc("revoke_ical_export", { p_listing: listingId }, jwt); },
    async read(token) {
      if (!ICAL_EXPORT_TOKEN.test(token)) return null;
      return readIcalExportSnapshot(await rpc("read_ical_export", { p_token: token }, cfg.serviceKey, cfg.serviceKey));
    },
  };
}

/** El secreto devuelto no entra en Query ni en una mutación persistida: la tarjeta lo conserva solo mientras está abierta. */
export function createOwnerIcalExport(cfg: OwnerConfig & { token(): Promise<string | null> }): OwnerIcalExportApi {
  const rpc = airbnbRpc(cfg, messages);
  async function read(listingId: string, generate: boolean) {
    const jwt = await cfg.token();
    if (!jwt) throw new DomainError(ICAL_EXPORT_MESSAGES.session, "session");
    return readOwnerIcalExport(await rpc("owner_ical_export", { p_listing: listingId, p_generate: generate }, jwt));
  }
  return { overview: id => read(id, false), generate: id => read(id, true) };
}
