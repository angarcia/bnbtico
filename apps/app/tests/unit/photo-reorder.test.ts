import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { DomainError } from "../../src/domain/errors";
import type { Listing } from "../../src/domain/listing";
import { photoReorderCallbacks, photosErrorMessage } from "../../src/client/publish/photo-reorder";

const key = ["own-listing", "u1", "l1"] as const;
const listing = (order: string[]) => ({ id: "l1", photos: order.map((id, position) => ({ id, position, path: `l1/${id}`, url: id })) }) as unknown as Listing;
const order = (c: QueryClient) => c.getQueryData<Listing>(key)!.photos.map((p) => p.id);

describe("reordenado optimista de fotos", () => {
  it("una relectura en curso con el orden viejo no pisa el orden nuevo", async () => {
    const client = new QueryClient();
    client.setQueryData(key, listing(["a", "b", "c"]));
    const slow = client.fetchQuery({ queryKey: key, queryFn: () => new Promise<Listing>((r) => setTimeout(() => r(listing(["a", "b", "c"])), 30)), staleTime: 0 }).catch(() => {});
    const cb = photoReorderCallbacks(client, "u1", "l1", async () => {});
    await cb.onMutate(["c", "a", "b"]);
    expect(order(client)).toEqual(["c", "a", "b"]);
    await slow;
    await new Promise((r) => setTimeout(r, 40));
    expect(order(client)).toEqual(["c", "a", "b"]);
  });
  it("si falla, vuelve el orden anterior", async () => {
    const client = new QueryClient();
    client.setQueryData(key, listing(["a", "b", "c"]));
    const cb = photoReorderCallbacks(client, "u1", "l1", async () => {});
    const ctx = await cb.onMutate(["b", "a", "c"]);
    cb.onError(new Error("x"), ["b", "a", "c"], ctx);
    expect(order(client)).toEqual(["a", "b", "c"]);
  });
  it("onSettled relee", async () => {
    const reread = vi.fn(async () => {});
    await photoReorderCallbacks(new QueryClient(), "u1", "l1", reread).onSettled();
    expect(reread).toHaveBeenCalledOnce();
  });
  it("mensajes", () => {
    expect(photosErrorMessage(new Error("500"))).toBe("No pudimos cambiar las fotos. Intente de nuevo.");
    expect(photosErrorMessage(new DomainError("Algo salió mal. Intente de nuevo en un momento.", "unknown"))).toBe("No pudimos cambiar las fotos. Intente de nuevo.");
    expect(photosErrorMessage(new DomainError("La lista de fotos cambió. Vuelva a intentarlo.", "conflict"))).toBe("La lista de fotos cambió. Vuelva a intentarlo.");
  });
});
