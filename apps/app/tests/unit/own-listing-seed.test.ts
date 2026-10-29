import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { ownListingQuery, ownListingsQuery } from "../../src/client/owner";
import { activeListing } from "./fixtures";

// El detalle de una casa se siembra con la fila de Mis casas. Si esa lista está invalidada (p. ej. restaurada del
// dispositivo, que se guarda cada segundo como mucho, y marcada para volver a pedirse), la fila se pinta al instante pero
// el detalle no hereda su frescura: se vuelve a pedir al montarse.
const userId = "u1";
const listKey = ownListingsQuery(userId).queryKey;

function detailFrom(client: QueryClient) {
  // Sin suscribirse no sale ninguna petición; el resultado dice si al montarse se volvería a pedir.
  const result = new QueryObserver(client, ownListingQuery(userId, activeListing.id, client)).getCurrentResult();
  return { data: result.data, stale: result.isStale };
}

describe("detalle sembrado con la lista de Mis casas", () => {
  it("con la lista recién leída, se pinta con su fila y no se vuelve a pedir", () => {
    const client = new QueryClient();
    client.setQueryData(listKey, [activeListing]);
    const { data, stale } = detailFrom(client);
    expect(data).toEqual(activeListing);
    expect(stale).toBe(false);
  });

  it("con la lista invalidada (restaurada y pendiente de refrescar), se pinta con su fila pero se vuelve a pedir", async () => {
    const client = new QueryClient();
    client.setQueryData(listKey, [activeListing]);
    await client.invalidateQueries({ queryKey: listKey });
    const { data, stale } = detailFrom(client);
    expect(data).toEqual(activeListing);
    expect(stale).toBe(true);
  });
});
