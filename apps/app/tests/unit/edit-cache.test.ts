import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { ownListingsQuery } from "../../src/client/owner";
import { updateLiveOptions } from "../../src/client/edit";
import type { Listing } from "../../src/domain/listing";
import { activeListing } from "./fixtures";

const userId = "u1";
const detailKey = ["own-listing", userId, activeListing.id] as const;
const listKey = ownListingsQuery(userId).queryKey;

function seeded() {
  const client = new QueryClient();
  client.setQueryData(detailKey, activeListing);
  client.setQueryData(listKey, [activeListing, { ...activeListing, id: "otra", publicId: "CT-1043" }]);
  return client;
}

const detail = (c: QueryClient) => c.getQueryData<Listing>(detailKey);
const entry = (c: QueryClient, id = activeListing.id) => c.getQueryData<Listing[]>(listKey)?.find((l) => l.id === id);

describe("cambio al momento de una casa publicada en la caché", () => {
  it("onMutate pinta el precio nuevo en el detalle y en la lista; onError devuelve el de antes", async () => {
    const client = seeded();
    const options = updateLiveOptions(client, userId, activeListing);
    const patch = { nightlyPriceCrc: 55000 };

    const context = await options.onMutate!(patch, undefined as never);
    expect(detail(client)?.nightlyPriceCrc).toBe(55000);
    expect(entry(client)?.nightlyPriceCrc).toBe(55000);
    expect(entry(client, "otra")?.nightlyPriceCrc).toBe(42000);

    options.onError!(new Error("sin red"), patch, context, undefined as never);
    expect(detail(client)?.nightlyPriceCrc).toBe(42000);
    expect(entry(client)?.nightlyPriceCrc).toBe(42000);
    expect(entry(client)).toEqual(activeListing);
  });
});
