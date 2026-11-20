// Historia #70 (segv1-contactos): el límite de 20 casas distintas en 24 h se aplica por cliente aunque lleguen peticiones a
// la vez. Antes el candado era por cliente y casa: varias casas nuevas en conexiones distintas contaban las mismas 19 y
// todas recibían el WhatsApp. Cada llamada es una conexión propia de psql con el rol y el JWT del cliente, y se queda
// abierta un rato tras la llamada para que las demás coincidan con ella.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INQUIRY_MESSAGES } from "../../src/domain/inquiry";
import { TEST_PHONES, serviceClient, signIn, sqlAsync } from "./local";

const TITLE = "Límite concurrente";
const uuid = (s: string) => s.replace(/[^0-9a-f-]/g, "");
const ct = (s: string) => s.replace(/[^A-Z0-9-]/g, "");

/** Una transacción como el cliente `sub`: llama a create_inquiry (firma actual o anterior) y espera `hold` s antes de confirmar. */
const contact = (sub: string, publicId: string, hold: number, legacy = false) => `begin;
  set local role authenticated;
  select set_config('request.jwt.claims', '${JSON.stringify({ sub: uuid(sub), role: "authenticated", aal: "aal1" })}', true);
  select 'ok:' || whatsapp_phone from public.create_inquiry('${ct(publicId)}', null, null, null${legacy ? ", 'Hola'" : ""});
  select pg_sleep(${hold});
  commit;`;

describe("límite de contactos con peticiones simultáneas", () => {
  const service = serviceClient();
  let ownerId: string;
  let clientId: string;
  let secondClientId: string;

  const cleanup = async () => {
    await service.from("listings").delete().like("title", `${TITLE}%`);
  };
  const houses = async (n: number, tag: string) => {
    const rows = Array.from({ length: n }, (_, i) => ({
      owner_id: ownerId,
      status: "active" as const,
      title: `${TITLE} ${tag} ${i}`,
      description: "x",
      province: "Limón",
      whatsapp_phone: TEST_PHONES.owner,
      capacity: 2,
      bedrooms: 1,
      bathrooms: 1,
      accepts_nightly: true,
      nightly_price_crc: 30000,
    }));
    const { data, error } = await service.from("listings").insert(rows).select("id, public_id");
    if (error) throw error;
    return data!;
  };
  /** Consultas ya contadas: casas distintas contactadas en las últimas 24 h. */
  const counted = async (client: string, n: number) => {
    const list = await houses(n, `contada-${client.slice(0, 4)}`);
    const rows = list.map((l) => ({ listing_id: l.id, client_id: client, owner_id: ownerId, whatsapp_phone: TEST_PHONES.owner, consent_share_phone: true }));
    const { error } = await service.from("inquiries").insert(rows);
    if (error) throw error;
  };
  const inquiriesOf = async (client: string, listingIds: string[]) =>
    (await service.from("inquiries").select("listing_id").eq("client_id", client).in("listing_id", listingIds)).data!.map((r) => r.listing_id);

  beforeAll(async () => {
    ownerId = (await (await signIn("owner")).auth.getUser()).data.user!.id;
    clientId = (await (await signIn("other")).auth.getUser()).data.user!.id;
    secondClientId = (await (await signIn("admin")).auth.getUser()).data.user!.id;
    for (const id of [clientId, secondClientId]) await service.from("profiles").update({ is_active: true, phone_verified_at: new Date().toISOString() }).eq("id", id);
  });
  afterAll(cleanup);

  it("con 19 casas contadas, tres casas nuevas a la vez (con las dos firmas): solo una recibe el WhatsApp y crea consulta", async () => {
    await cleanup();
    await counted(clientId, 19);
    const fresh = await houses(3, "nueva");
    const calls = fresh.map((h, i) => sqlAsync(contact(clientId, h.public_id, 1.5, i === 2)));
    const results = await Promise.allSettled(calls);
    const ok = results.filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled");
    const denied = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(ok[0]!.value).toContain(`ok:${TEST_PHONES.owner}`);
    expect(denied).toHaveLength(2);
    for (const d of denied) {
      expect(String(d.reason)).toContain(INQUIRY_MESSAGES.rateLimit);
      expect(String(d.reason)).not.toContain(TEST_PHONES.owner);
    }
    expect(await inquiriesOf(clientId, fresh.map((h) => h.id))).toHaveLength(1);
  }, 30_000);

  it("en el límite, una casa ya contada se renueva a la vez que se rechaza una nueva, sin consumir otra casa", async () => {
    await cleanup();
    await counted(clientId, 20);
    const contactedId = (await service.from("inquiries").select("listing_id").eq("client_id", clientId).limit(1).single()).data!.listing_id;
    const contactedCt = (await service.from("listings").select("public_id").eq("id", contactedId).single()).data!.public_id;
    const [fresh] = await houses(1, "nueva");
    const [renewed, denied] = await Promise.allSettled([sqlAsync(contact(clientId, contactedCt, 1)), sqlAsync(contact(clientId, fresh!.public_id, 0))]);
    expect(renewed.status).toBe("fulfilled");
    expect(denied.status).toBe("rejected");
    expect(await inquiriesOf(clientId, [fresh!.id])).toEqual([]);
    expect(await inquiriesOf(clientId, [contactedId])).toHaveLength(1);
  }, 30_000);

  it("dos toques a la vez en la misma casa crean una sola consulta", async () => {
    await cleanup();
    const [house] = await houses(1, "doble");
    const results = await Promise.allSettled([sqlAsync(contact(clientId, house!.public_id, 1)), sqlAsync(contact(clientId, house!.public_id, 0, true))]);
    expect(results.map((r) => r.status)).toEqual(["fulfilled", "fulfilled"]);
    expect(await inquiriesOf(clientId, [house!.id])).toHaveLength(1);
  }, 30_000);

  it("otro cliente no espera al primero: la cuota es por cliente, sin candado global", async () => {
    await cleanup();
    const [a, b] = await houses(2, "dos-clientes");
    const first = sqlAsync(contact(clientId, a!.public_id, 2));
    await new Promise((r) => setTimeout(r, 400));
    const started = Date.now();
    await sqlAsync(contact(secondClientId, b!.public_id, 0, true));
    expect(Date.now() - started).toBeLessThan(1500);
    await first;
    expect(await inquiriesOf(clientId, [a!.id])).toHaveLength(1);
    expect(await inquiriesOf(secondClientId, [b!.id])).toHaveLength(1);
  }, 30_000);
});
