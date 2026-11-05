import { QueryClient, QueryClientProvider, QueryObserver, type QueryKey } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { persistQueryClientRestore, persistQueryClientSave } from "@tanstack/react-query-persist-client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addOwnCached, ownListingQuery, ownListingsQuery, patchCached, refresh, useDeleteDraft, useSetAvailable } from "../../src/client/owner";
import { useDiscardEditField, useSaveEdit, useUpdateLive } from "../../src/client/edit";
import { adminEditQuery, adminListingQuery, useEditsWithPending, useHouseAction, useQueueWithPending, useReview, useReviewEdit } from "../../src/client/admin";
import { EditorContext, ownerPort, type EditorPort } from "../../src/client/editor-port";
import { memoryStore } from "../../src/data/storage";
import type { Listing } from "../../src/domain/listing";
import { emptyQueue, type AdminQueue, type QueueItem } from "../../src/domain/review";
import { activeListing } from "./fixtures";

const transport = vi.hoisted(() => ({
  updateLive: vi.fn(), setAvailable: vi.fn(), deleteDraft: vi.fn(), saveEdit: vi.fn(), discardEditField: vi.fn(),
  review: vi.fn(), pauseListing: vi.fn(), reviewEditField: vi.fn(), reviewEditPhoto: vi.fn(),
}));
vi.mock("../../src/client/session", () => ({
  authApi: async () => ({}),
  sessionState: () => ({ status: "signed-in" }),
}));
vi.mock("../../src/client/supabase-data", () => ({ ownerListings: () => transport, adminApi: () => transport }));
vi.mock("../../src/shared/toast", () => ({ toast: vi.fn() }));

const userId = "u1";
const id = activeListing.id;
const listKey = ["own-listings", userId] as const;
const detailKey = ["own-listing", userId, id] as const;
const queueKey = ["admin-queue", userId] as const;
const adminDetailKey = ["admin-listing", userId, id] as const;
const editsKey = ["admin-edits", userId] as const;
const editKey = ["admin-edit", userId, id] as const;
const housesKey = ["admin-houses", userId] as const;
const publicKeys = [["listing", activeListing.publicId], ["listings", { province: "Limón" }], ["offer-taken"]] as const;
const ownerRefresh = [listKey, detailKey, ...publicKeys, ["billing", userId]];
const untouched = [["own-listings", "u2"], ["own-listing", "u2", id], ["admin-queue", "u2"], ["admin-houses", "u2"], ["listing", "CT-9999"], ["account", userId], ["calendar", userId, id], ["own-resumable", userId], ["admin-drafts", userId], ["favorite-listings"], ["provinces"]];
let client: QueryClient;
let cleanups: (() => void)[];

function render<T>(read: () => T, port: EditorPort = ownerPort): T {
  let result: T;
  function Consumer() { result = read(); return null; }
  renderToString(<QueryClientProvider client={client}><EditorContext.Provider value={port}><Consumer /></EditorContext.Provider></QueryClientProvider>);
  return result!;
}

function seed() {
  for (const key of [...ownerRefresh, queueKey, adminDetailKey, editsKey, editKey, housesKey, ...untouched]) client.setQueryData(key, []);
  client.setQueryData(listKey, [activeListing, { ...activeListing, id: "otra" }]);
  client.setQueryData(detailKey, activeListing);
}

function invalidations() {
  const keys: QueryKey[] = [];
  cleanups.push(client.getQueryCache().subscribe((event) => {
    if (event.type === "updated" && event.action.type === "invalidate") keys.push(event.query.queryKey);
  }));
  return keys;
}

function pendingRead(key: QueryKey, data: unknown, consumesSignal = true) {
  const response = Promise.withResolvers<unknown>();
  let signal: AbortSignal | undefined;
  const promise = client.fetchQuery({
    queryKey: key,
    queryFn: (context) => { if (consumesSignal) signal = context.signal; return response.promise; },
  }).catch((error: unknown) => error);
  return { promise, finish: () => response.resolve(data), aborted: () => signal?.aborted };
}

const detail = () => client.getQueryData<Listing>(detailKey)!;
const entry = () => client.getQueryData<Listing[]>(listKey)![0]!;
const item = (): QueueItem => ({ listing: { ...activeListing, status: "review" }, ownerName: "Ana" });
const editedItem = (): QueueItem => ({
  ...item(),
  listing: { ...activeListing, edit: {
    status: "review", title: "Otro nombre", kind: null, bathroomShared: null, description: null, location: null,
    submittedAt: "2026-11-01", photos: [], fields: { nombre: { status: "review", reviewNote: null, submittedAt: "2026-11-01" } },
  } },
});

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  cleanups = [];
  vi.resetAllMocks();
  vi.stubGlobal("window", { location: { origin: "https://bnbtico.test" } });
  vi.stubGlobal("__BUILD_ID__", "cache-test");
});
afterEach(() => { cleanups.forEach((f) => f()); client.clear(); vi.unstubAllGlobals(); });

describe("contrato de caché de casas", () => {
  it("no crea listas ni detalles ausentes y conserva null", () => {
    patchCached(client, userId, id, { title: "Nuevo" });
    addOwnCached(client, userId, activeListing);
    expect(client.getQueryState(listKey)).toBeUndefined();
    expect(client.getQueryState(detailKey)).toBeUndefined();
    client.setQueryData(detailKey, null);
    patchCached(client, userId, id, { title: "Nuevo" });
    expect(client.getQueryData(detailKey)).toBeNull();
  });

  it("añade una vez al principio y actualiza solo la casa y el usuario elegidos", () => {
    client.setQueryData(listKey, [{ ...activeListing, id: "otra" }]);
    client.setQueryData(["own-listings", "u2"], [activeListing]);
    addOwnCached(client, userId, activeListing);
    addOwnCached(client, userId, activeListing);
    patchCached(client, userId, id, { title: "Nuevo" });
    expect(client.getQueryData<Listing[]>(listKey)?.map((l) => [l.id, l.title])).toEqual([[id, "Nuevo"], ["otra", activeListing.title]]);
    expect(client.getQueryData(["own-listings", "u2"])).toEqual([activeListing]);
  });

  it("refresca seis ámbitos en orden sin esperar, ni tocar consultas ajenas", () => {
    seed();
    const keys = invalidations();
    expect(refresh(client, userId, activeListing)).toBeUndefined();
    expect(keys).toEqual(ownerRefresh);
    for (const key of untouched) expect(client.getQueryState(key)?.isInvalidated).toBe(false);
  });

  it("relee una vez cada consulta activa del ámbito y no espera sus respuestas", async () => {
    seed();
    const requests: QueryKey[] = [];
    const response = Promise.withResolvers<unknown>();
    for (const key of [...ownerRefresh, ...untouched]) {
      const observer = new QueryObserver(client, { queryKey: key, staleTime: Infinity, queryFn: () => { requests.push(key); return response.promise; } });
      cleanups.push(observer.subscribe(() => {}));
    }
    expect(refresh(client, userId, activeListing)).toBeUndefined();
    expect(requests).toEqual(ownerRefresh);
    response.resolve([]);
    await vi.waitFor(() => expect(client.isFetching()).toBe(0));
  });

  it.each(["live", "available", "save", "admin-save", "review", "house", "review-edit", "discard"] as const)(
    "%s: la mutación termina antes de las relecturas y pide exactamente su ámbito",
    async (action) => {
      seed();
      const current = editedItem();
      patchCached(client, userId, id, { edit: current.listing.edit });
      client.setQueryData(queueKey, { ...emptyQueue(), review: [current] });
      client.setQueryData(adminDetailKey, current);
      client.setQueryData(editsKey, [current]);
      client.setQueryData(editKey, current);
      transport.saveEdit.mockResolvedValue(null);
      const requests: QueryKey[] = [];
      const response = Promise.withResolvers<unknown>();
      for (const key of [...ownerRefresh, queueKey, adminDetailKey, editsKey, editKey, housesKey, ...untouched]) {
        const observer = new QueryObserver(client, { queryKey: key, staleTime: Infinity, queryFn: () => { requests.push(key); return response.promise; } });
        cleanups.push(observer.subscribe(() => {}));
      }
      const expected = action === "review" ? [queueKey, adminDetailKey, ...publicKeys, housesKey]
        : action === "house" ? [housesKey, queueKey, ...publicKeys]
        : action === "review-edit" ? [editsKey, editKey, publicKeys[0], publicKeys[1], housesKey]
        : action === "save" || action === "discard" ? [listKey, detailKey] : ownerRefresh;
      switch (action) {
        case "live": await render(() => useUpdateLive(userId, activeListing)).mutateAsync({ capacity: 4 }); break;
        case "available": await render(() => useSetAvailable(userId, activeListing)).mutateAsync({ available: false, reopenAt: null }); break;
        case "save": await render(() => useSaveEdit(userId, activeListing)).mutateAsync({ title: "Otro" }); break;
        case "admin-save": await render(() => useSaveEdit(userId, activeListing), { ...ownerPort, admin: true }).mutateAsync({ title: "Otro" }); break;
        case "review": await render(() => useReview(userId)).mutateAsync({ item: current, decision: "approve", note: "" }); break;
        case "house": await render(() => useHouseAction(userId)).mutateAsync({ kind: "pause", id, publicId: activeListing.publicId, reason: "Motivo" }); break;
        case "review-edit": await render(() => useReviewEdit(userId)).mutateAsync({ item: current, target: { field: "nombre" }, decision: "approve", note: "" }); break;
        case "discard": await render(() => useDiscardEditField(userId, activeListing)).mutateAsync("nombre"); break;
      }
      expect(requests).toEqual(expected);
      expect(client.isFetching()).toBe(expected.length);
      response.resolve([]);
      await vi.waitFor(() => expect(client.isFetching()).toBe(0));
    },
  );

  it.each([true, false])("transporte con AbortSignal=%s: cancela en orden, descarta respuestas tardías y revierte solo columnas propias", async (consumesSignal) => {
    seed();
    const order: QueryKey[] = [];
    cleanups.push(client.getQueryCache().subscribe((e) => {
      if (e.type === "updated" && e.action.type === "setState" && e.query.state.fetchStatus === "idle") order.push(e.query.queryKey);
    }));
    const listRead = pendingRead(listKey, [activeListing], consumesSignal);
    const detailRead = pendingRead(detailKey, activeListing, consumesSignal);
    const rpc = Promise.withResolvers<void>();
    transport.updateLive.mockReturnValue(rpc.promise);
    const mutation = render(() => useUpdateLive(userId, activeListing));
    const result = mutation.mutateAsync({ nightlyPriceCrc: 55000 }).catch((e: unknown) => e);
    await vi.waitFor(() => expect(detail().nightlyPriceCrc).toBe(55000));
    expect(entry().nightlyPriceCrc).toBe(55000);
    expect(order).toEqual([detailKey, listKey]);
    expect(listRead.aborted()).toBe(consumesSignal ? true : undefined);
    expect(detailRead.aborted()).toBe(consumesSignal ? true : undefined);
    listRead.finish(); detailRead.finish();
    await Promise.all([listRead.promise, detailRead.promise]);
    expect(detail().nightlyPriceCrc).toBe(55000);
    patchCached(client, userId, id, { capacity: 8 });
    rpc.reject(new Error("sin red"));
    await result;
    expect(detail()).toMatchObject({ nightlyPriceCrc: 42000, capacity: 8 });
    expect(entry()).toMatchObject({ nightlyPriceCrc: 42000, capacity: 8 });
  });

  it("usa la lista para rollback cuando falta el detalle", async () => {
    client.setQueryData(listKey, [activeListing]);
    transport.updateLive.mockRejectedValue(new Error("sin red"));
    await expect(render(() => useUpdateLive(userId, activeListing)).mutateAsync({ capacity: 8 })).rejects.toThrow("sin red");
    expect(entry().capacity).toBe(2);
    expect(client.getQueryState(detailKey)).toBeUndefined();
  });

  it("disponibilidad cancela lista antes que detalle y restaura la fecha al fallar", async () => {
    seed();
    patchCached(client, userId, id, { available: false, reopenAt: "2026-12-01" });
    const order: QueryKey[] = [];
    cleanups.push(client.getQueryCache().subscribe((e) => {
      if (e.type === "updated" && e.action.type === "setState" && e.query.state.fetchStatus === "idle") order.push(e.query.queryKey);
    }));
    const list = pendingRead(listKey, [activeListing]);
    const detail = pendingRead(detailKey, activeListing);
    transport.setAvailable.mockRejectedValue(new Error("no"));
    await expect(render(() => useSetAvailable(userId, activeListing)).mutateAsync({ available: true })).rejects.toThrow("no");
    expect(order).toEqual([listKey, detailKey]);
    expect(entry()).toMatchObject({ available: false, reopenAt: "2026-12-01" });
    expect(transport.setAvailable).toHaveBeenCalledWith(id, true, null);
    list.finish(); detail.finish();
    await Promise.all([list.promise, detail.promise]);
  });

  it.each([false, true])("borrar borrador, fallo=%s: solo elimina al confirmar y refresca la lista", async (fail) => {
    seed();
    const keys = invalidations();
    if (fail) transport.deleteDraft.mockRejectedValue(new Error("no"));
    await render(() => useDeleteDraft(userId)).mutateAsync(id).catch(() => {});
    expect(keys).toEqual([listKey]);
    expect(client.getQueryState(detailKey) === undefined).toBe(!fail);
    expect(client.getQueryData<Listing[]>(listKey)?.some((l) => l.id === id)).toBe(fail);
  });

  it.each([false, true])("guardar edición, admin=%s: aplica la respuesta y conserva su ámbito", async (admin) => {
    seed();
    const keys = invalidations();
    const edit = editedItem().listing.edit;
    transport.saveEdit.mockResolvedValue(edit);
    await render(() => useSaveEdit(userId, activeListing), { ...ownerPort, admin }).mutateAsync({ title: "Otro nombre" });
    expect(detail().edit).toEqual(edit);
    expect(entry().edit).toEqual(edit);
    expect(keys).toEqual(admin ? ownerRefresh : [listKey, detailKey]);
  });

  it("descartar un dato restaura la edición al fallar y no invalida la ficha pública", async () => {
    seed();
    const edit = editedItem().listing.edit;
    patchCached(client, userId, id, { edit });
    const rpc = Promise.withResolvers<void>();
    transport.discardEditField.mockReturnValue(rpc.promise);
    const keys = invalidations();
    const pending = render(() => useDiscardEditField(userId, activeListing)).mutateAsync("nombre").catch(() => {});
    await vi.waitFor(() => expect(detail().edit).toBeNull());
    rpc.reject(new Error("no"));
    await pending;
    expect(detail().edit).toEqual(edit);
    expect(keys).toEqual([listKey, detailKey]);
  });

  it("revisar cancela solo la cola, aplica pendientes sobre relecturas y revierte el snapshot", async () => {
    seed();
    const current = item();
    const queue: AdminQueue = { ...emptyQueue(), review: [current] };
    client.setQueryData(queueKey, queue);
    client.setQueryData(adminDetailKey, current);
    const queueRead = pendingRead(queueKey, queue);
    const detailRead = pendingRead(adminDetailKey, current);
    const rpc = Promise.withResolvers<void>();
    transport.review.mockReturnValue(rpc.promise);
    const keys = invalidations();
    const pending = render(() => useReview(userId)).mutateAsync({ item: current, decision: "approve", note: "" }).catch(() => {});
    await vi.waitFor(() => expect(client.getQueryData<AdminQueue>(queueKey)?.review).toEqual([]));
    expect(queueRead.aborted()).toBe(true);
    expect(detailRead.aborted()).toBe(false);
    expect(render(() => useQueueWithPending(userId, queue))?.review).toEqual([]);
    detailRead.finish(); queueRead.finish();
    await Promise.all([detailRead.promise, queueRead.promise]);
    rpc.reject(new Error("no"));
    await pending;
    expect(client.getQueryData(queueKey)).toEqual(queue);
    expect(client.getQueryData(adminDetailKey)).toEqual(current);
    expect(keys).toEqual([queueKey, adminDetailKey, ...publicKeys, housesKey]);
  });

  it("una acción administrativa no es optimista e invalida cinco ámbitos incluso al fallar", async () => {
    seed();
    const keys = invalidations();
    const rpc = Promise.withResolvers<void>();
    transport.pauseListing.mockReturnValue(rpc.promise);
    const pending = render(() => useHouseAction(userId)).mutateAsync({ kind: "pause", id, publicId: activeListing.publicId, reason: "Motivo" }).catch(() => {});
    await vi.waitFor(() => expect(transport.pauseListing).toHaveBeenCalled());
    expect(keys).toEqual([]);
    rpc.reject(new Error("no"));
    await pending;
    expect(keys).toEqual([housesKey, queueKey, ...publicKeys]);
  });

  it("revisar un dato cancela cola y detalle, protege pendientes y revierte sin refrescar ofertas", async () => {
    seed();
    const current = editedItem();
    client.setQueryData(editsKey, [current]);
    client.setQueryData(editKey, current);
    const queueRead = pendingRead(editsKey, [current]);
    const detailRead = pendingRead(editKey, current);
    const rpc = Promise.withResolvers<void>();
    transport.reviewEditField.mockReturnValue(rpc.promise);
    const keys = invalidations();
    const pending = render(() => useReviewEdit(userId)).mutateAsync({ item: current, target: { field: "nombre" }, decision: "approve", note: "" }).catch(() => {});
    await vi.waitFor(() => expect(client.getQueryData(editsKey)).toEqual([]));
    expect(queueRead.aborted()).toBe(true);
    expect(detailRead.aborted()).toBe(true);
    expect(render(() => useEditsWithPending(userId, [current]))).toEqual([]);
    queueRead.finish(); detailRead.finish();
    await Promise.all([queueRead.promise, detailRead.promise]);
    expect(client.getQueryData<QueueItem>(editKey)?.listing.edit).toBeNull();
    rpc.reject(new Error("no"));
    await pending;
    expect(client.getQueryData(editsKey)).toEqual([current]);
    expect(client.getQueryData(editKey)).toEqual(current);
    expect(keys).toEqual([editsKey, editKey, publicKeys[0], publicKeys[1], housesKey]);
  });

  it("siembra detalles con el timestamp y no mezcla usuarios", () => {
    seed();
    const current = item();
    const edited = editedItem();
    client.setQueryData(queueKey, { ...emptyQueue(), review: [current] }, { updatedAt: 1234 });
    client.setQueryData(editsKey, [edited], { updatedAt: 5678 });
    client.removeQueries({ queryKey: adminDetailKey });
    client.removeQueries({ queryKey: editKey });
    expect(new QueryObserver(client, adminListingQuery(userId, id, client)).getCurrentResult()).toMatchObject({ data: current, dataUpdatedAt: 1234 });
    expect(new QueryObserver(client, adminEditQuery(userId, id, client)).getCurrentResult()).toMatchObject({ data: edited, dataUpdatedAt: 5678 });
    expect(new QueryObserver(client, adminListingQuery("u3", id, client)).getCurrentResult().data).toBeUndefined();
    expect(new QueryObserver(client, ownListingQuery("u3", id, client)).getCurrentResult().data).toBeUndefined();
    expect(ownListingsQuery(userId).queryKey).toEqual(listKey);
  });

  it("guarda y restaura tuplas y datos con el persister y Storage reales sin ampliar lo persistido", async () => {
    const { persistOptions } = await import("../../src/client/persist");
    seed();
    const storage = memoryStore();
    const persister = createAsyncStoragePersister({ storage, key: "bnbtico-query", throttleTime: 0 });
    const options = { ...persistOptions, persister, queryClient: client };
    await persistQueryClientSave(options);
    const saved = (await persister.restoreClient())!;
    expect(saved.buster).toBe("cache-test");
    expect(saved.clientState.queries.map((q) => q.queryKey)).not.toContainEqual(housesKey);
    expect(saved.clientState.queries.map((q) => q.queryKey)).not.toContainEqual(editsKey);
    expect(saved.clientState.queries.map((q) => q.queryKey)).not.toContainEqual(editKey);
    expect(storage.getItem("bnbtico-query")).toContain('"queryKey":["own-listing","u1","l-activa"]');
    client.clear();
    await persistQueryClientRestore(options);
    expect(detail()).toEqual(activeListing);
    expect(entry()).toEqual(activeListing);
    expect(client.getQueryState(queueKey)).toBeDefined();
    expect(client.getQueryState(housesKey)).toBeUndefined();
  });
});
