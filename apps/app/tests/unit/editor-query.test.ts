import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { LOCAL_USER, editorListingQuery, ownerPort, type EditorPort } from "../../src/client/editor-port";
import { OWNER_STALE_MS, ownListingsQuery } from "../../src/client/owner";
import { enqueueSave } from "../../src/client/save-queue";
import { activeListing } from "./fixtures";

describe("consulta compartida de edición", () => {
  it.each([false, true])("el propietario conserva la fila y la frescura de Mis casas (invalidada: %s)", async (invalidated) => {
    const client = new QueryClient();
    const key = ownListingsQuery("owner").queryKey;
    client.setQueryData(key, [activeListing]);
    if (invalidated) await client.invalidateQueries({ queryKey: key });
    const options = editorListingQuery(ownerPort, "owner", activeListing.id, client);
    const result = new QueryObserver(client, options).getCurrentResult();
    expect(options.queryKey).toEqual(["own-listing", "owner", activeListing.id]);
    expect(options.staleTime).toBe(OWNER_STALE_MS);
    expect(result.data).toEqual(activeListing);
    expect(result.isStale).toBe(invalidated);
    client.clear();
  });

  it("el admin no siembra el detalle con Mis casas y espera los guardados de esa casa", async () => {
    const client = new QueryClient();
    client.setQueryData(ownListingsQuery("admin").queryKey, [activeListing]);
    const getOwn = vi.fn(async () => activeListing);
    const listings = {
      getOwn, saveStep: vi.fn(), submit: vi.fn(), updateLive: vi.fn(), saveEdit: vi.fn(), discardEditField: vi.fn(),
    };
    const port: EditorPort = { ...ownerPort, admin: true, listings: async () => listings };
    const options = editorListingQuery(port, "admin", activeListing.id, client);
    expect(options.queryKey).toEqual(["own-listing", "admin", activeListing.id]);
    expect(options.staleTime).toBe(OWNER_STALE_MS);
    expect(new QueryObserver(client, options).getCurrentResult().data).toBeUndefined();
    let release!: () => void;
    const save = enqueueSave(activeListing.id, () => new Promise<void>((resolve) => { release = resolve; }));
    const read = client.fetchQuery(options);
    await Promise.resolve();
    expect(getOwn).not.toHaveBeenCalled();
    release();
    await save;
    await expect(read).resolves.toEqual(activeListing);
    expect(getOwn).toHaveBeenCalledExactlyOnceWith(activeListing.id);
    await client.fetchQuery(options);
    expect(getOwn).toHaveBeenCalledTimes(1);
    client.clear();
  });

  it("el borrador local usa su usuario, conserva la caché sin caducar y relee solo al invalidarla", async () => {
    const client = new QueryClient();
    const getOwn = vi.fn(async () => activeListing);
    const port: EditorPort = {
      ...ownerPort,
      local: true,
      listings: async () => ({
        getOwn, saveStep: vi.fn(), submit: vi.fn(), updateLive: vi.fn(), saveEdit: vi.fn(), discardEditField: vi.fn(),
      }),
    };
    const options = editorListingQuery(port, LOCAL_USER, activeListing.id, client);
    expect(options.queryKey).toEqual(["own-listing", "telefono", activeListing.id]);
    expect(options.staleTime).toBe(Infinity);
    await expect(client.fetchQuery(options)).resolves.toEqual(activeListing);
    await client.fetchQuery(options);
    expect(getOwn).toHaveBeenCalledExactlyOnceWith(activeListing.id);
    await client.invalidateQueries({ queryKey: options.queryKey });
    await client.fetchQuery(options);
    expect(getOwn).toHaveBeenCalledTimes(2);
    client.clear();
  });

  it("casa inexistente y fallo de lectura siguen siendo resultados distintos", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const getOwn = vi.fn().mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("sin red"));
    const port: EditorPort = {
      ...ownerPort,
      admin: true,
      listings: async () => ({
        getOwn, saveStep: vi.fn(), submit: vi.fn(), updateLive: vi.fn(), saveEdit: vi.fn(), discardEditField: vi.fn(),
      }),
    };
    const options = editorListingQuery(port, "admin", "missing", client);
    await expect(client.fetchQuery(options)).resolves.toBeNull();
    await client.invalidateQueries({ queryKey: options.queryKey });
    await expect(client.fetchQuery(options)).rejects.toThrow("sin red");
    expect(client.getQueryState(options.queryKey)).toMatchObject({ data: null, status: "error" });
    client.clear();
  });
});
