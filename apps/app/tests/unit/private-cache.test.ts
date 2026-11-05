import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { isCancelledError, type QueryClient } from "@tanstack/react-query";
import { persistQueryClientRestore, persistQueryClientSave, persistQueryClientSubscribe } from "@tanstack/react-query-persist-client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { accountQuery } from "../../src/client/account";
import { adminEditQuery, adminEditsQuery, adminHousesQuery, adminListingQuery, adminQueueQuery } from "../../src/client/admin";
import { memoryStore } from "../../src/data/storage";
import type { Session } from "../../src/domain/api";

const auth = vi.hoisted(() => ({
  change: (_session: Session | null) => {},
  session: { userId: "admin-a", aal: "aal2" } as Session,
}));

vi.mock("../../src/client/supabase-data", () => ({
  authApi: () => ({
    session: async () => auth.session,
    onSessionChange: (change: (session: Session | null) => void) => { auth.change = change; },
  }),
}));

let client: QueryClient;
let refreshRestored: () => void;
let persistOptions: typeof import("../../src/client/persist").persistOptions;

const privatePersisted = ["account", "inquiries", "own-listings", "own-listing", "own-resumable", "own-stats", "own-activity", "calendar", "billing", "admin-queue", "admin-listing"];
const privateMemoryOnly = ["admin-houses", "admin-edits", "admin-edit", "admin-drafts"];
const publicPersisted = ["listings", "provinces", "listing", "listing-days", "offer-taken", "favorite-listings", "fx"];
const adminKey = (prefix: string, userId = "admin-a") => prefix === "admin-edit" ? [prefix, userId, "casa-1"] : [prefix, userId];

function storageOptions() {
  const storage = memoryStore();
  const persister = createAsyncStoragePersister({ storage, key: "bnbtico-query", throttleTime: 0 });
  return { storage, options: { ...persistOptions, queryClient: client, persister } };
}

beforeAll(async () => {
  vi.stubGlobal("__BUILD_ID__", "private-cache-test");
  const { Shell } = await import("../../src/client/shell");
  client = Shell().props.client;
  refreshRestored = Shell().props.onSuccess;
  persistOptions = Shell().props.persistOptions;
  await (await import("../../src/client/session")).authApi();
});

beforeEach(() => {
  client.clear();
  auth.change(auth.session);
});

afterEach(() => client.clear());

afterAll(() => {
  client?.clear();
  vi.unstubAllGlobals();
});

describe("limpieza privada del shell", () => {
  it.each(privateMemoryOnly)("borra %s al cerrar sesión", (prefix) => {
    const key = adminKey(prefix);
    client.setQueryData(key, { privado: prefix });

    auth.change(null);

    expect(client.getQueryState(key)).toBeUndefined();
  });

  it("conserva las públicas y las desconocidas, y borra las privadas anteriores", () => {
    const retained = [...publicPersisted, "no-clasificada", "admin-houses-extra"];
    for (const prefix of [...privatePersisted, ...retained]) client.setQueryData([prefix, "admin-a"], prefix);

    auth.change(null);

    for (const prefix of privatePersisted) expect(client.getQueryState([prefix, "admin-a"])).toBeUndefined();
    for (const prefix of retained) expect(client.getQueryData([prefix, "admin-a"])).toBe(prefix);
  });

  it("al salir A y entrar B no quedan consultas de A ni se usan para B", () => {
    for (const prefix of privateMemoryOnly) client.setQueryData(adminKey(prefix), "datos A");
    client.setQueryData(["listing", "CT-1001"], "pública");

    auth.change(null);
    auth.change({ userId: "admin-b", aal: "aal2" });

    for (const prefix of privateMemoryOnly) {
      expect(client.getQueryState(adminKey(prefix))).toBeUndefined();
      expect(client.getQueryState(adminKey(prefix, "admin-b"))).toBeUndefined();
      client.setQueryData(adminKey(prefix, "admin-b"), "datos B");
      expect(client.getQueryData(adminKey(prefix, "admin-b"))).toBe("datos B");
    }
    expect(client.getQueryData(["listing", "CT-1001"])).toBe("pública");
  });

  it("un cambio directo A → B conserva la semántica existente: claves separadas hasta el logout", () => {
    for (const prefix of privateMemoryOnly) client.setQueryData(adminKey(prefix), "datos A");

    auth.change({ userId: "admin-b", aal: "aal2" });

    for (const prefix of privateMemoryOnly) {
      expect(client.getQueryData(adminKey(prefix))).toBe("datos A");
      expect(client.getQueryState(adminKey(prefix, "admin-b"))).toBeUndefined();
      client.setQueryData(adminKey(prefix, "admin-b"), "datos B");
    }

    auth.change(null);

    for (const prefix of privateMemoryOnly) {
      expect(client.getQueryState(adminKey(prefix))).toBeUndefined();
      expect(client.getQueryState(adminKey(prefix, "admin-b"))).toBeUndefined();
    }
  });

  it.each(privateMemoryOnly)("cancela %s en curso y descarta su respuesta tardía", async (prefix) => {
    const key = adminKey(prefix);
    const response = Promise.withResolvers<string>();
    let signal: AbortSignal | undefined;
    const pending = client.fetchQuery({
      queryKey: key,
      queryFn: (context) => {
        signal = context.signal;
        return response.promise;
      },
    }).catch((error: unknown) => error);

    auth.change(null);
    response.resolve("respuesta de A");

    expect(isCancelledError(await pending)).toBe(true);
    expect(signal?.aborted).toBe(true);
    expect(client.getQueryState(key)).toBeUndefined();
    const { storage, options } = storageOptions();
    await persistQueryClientSave(options);
    expect(storage.getItem("bnbtico-query")).not.toContain("respuesta de A");
  });

  it("descarta también la respuesta privada cuyo transporte no consume AbortSignal", async () => {
    const key = adminKey("admin-houses");
    const response = Promise.withResolvers<string>();
    const pending = client.fetchQuery({ queryKey: key, queryFn: () => response.promise }).catch((error: unknown) => error);

    auth.change(null);
    response.resolve("respuesta de A");

    expect(isCancelledError(await pending)).toBe(true);
    expect(client.getQueryState(key)).toBeUndefined();
  });

  it("no cancela una lectura pública en curso", async () => {
    const response = Promise.withResolvers<string>();
    const key = ["listing", "CT-1001"];
    const pending = client.fetchQuery({ queryKey: key, queryFn: () => response.promise });

    auth.change(null);
    response.resolve("pública");

    expect(await pending).toBe("pública");
    expect(client.getQueryData(key)).toBe("pública");
  });
});

describe("persistencia privada y restauración", () => {
  it.each([true, false])("con sesión %s persiste solo el conjunto anterior de consultas exitosas", async (signedIn) => {
    if (!signedIn) auth.change(null);
    for (const prefix of [...privatePersisted, ...privateMemoryOnly, ...publicPersisted, "no-clasificada"]) {
      client.setQueryData([prefix, "admin-a"], prefix);
    }
    client.getQueryCache().build(client, { queryKey: ["account", "pendiente"] });
    client.getQueryCache().build(client, { queryKey: ["listing", "error"] }).setState({ status: "error", error: new Error("sin red") });
    const { storage, options } = storageOptions();

    await persistQueryClientSave(options);
    const saved = await options.persister.restoreClient();

    const expected = [...publicPersisted, ...(signedIn ? privatePersisted : [])].map((prefix) => [prefix, "admin-a"]);
    expect(saved?.clientState.queries.map((q) => q.queryKey).sort()).toEqual(expected.sort());
    expect(saved?.buster).toBe("private-cache-test");
    expect(storage.getItem("bnbtico-query")).not.toBeNull();
  });

  it("restaura el formato previo y refresca solo las privadas persistibles, sin borrar sus datos", async () => {
    for (const prefix of [...privatePersisted, ...publicPersisted]) client.setQueryData([prefix, "admin-a"], prefix);
    const { options } = storageOptions();
    await persistQueryClientSave(options);
    client.clear();

    await persistQueryClientRestore(options);
    for (const prefix of privateMemoryOnly) expect(client.getQueryState(adminKey(prefix))).toBeUndefined();
    for (const prefix of privateMemoryOnly) client.setQueryData(adminKey(prefix), prefix);
    refreshRestored();

    for (const prefix of privatePersisted) {
      expect(client.getQueryState([prefix, "admin-a"])).toMatchObject({ data: prefix, isInvalidated: true });
    }
    for (const prefix of publicPersisted) {
      expect(client.getQueryState([prefix, "admin-a"])).toMatchObject({ data: prefix, isInvalidated: false });
    }
    for (const prefix of privateMemoryOnly) {
      expect(client.getQueryState(adminKey(prefix))).toMatchObject({ data: prefix, isInvalidated: false });
    }
  });

  it("tras el logout guarda solo lo público y no restaura datos de A al entrar B", async () => {
    for (const prefix of [...privatePersisted, ...privateMemoryOnly]) client.setQueryData([prefix, "admin-a"], prefix);
    client.setQueryData(["listing", "CT-1001"], "pública");
    const { options } = storageOptions();
    await persistQueryClientSave(options);
    const unsubscribe = persistQueryClientSubscribe(options);
    try {
      auth.change(null);
      await vi.waitFor(async () => {
        const saved = await options.persister.restoreClient();
        expect(saved?.clientState.queries.map((q) => q.queryKey)).toEqual([["listing", "CT-1001"]]);
      });
    } finally {
      unsubscribe();
    }
    client.clear();
    auth.change({ userId: "admin-b", aal: "aal2" });

    await persistQueryClientRestore(options);
    refreshRestored();

    expect(client.getQueryCache().getAll().map((q) => q.queryKey)).toEqual([["listing", "CT-1001"]]);
  });

  it.each(["caducada", "otro-build"])("descarta la caché %s y conserva el TTL de 24 horas", async (reason) => {
    expect(persistOptions.maxAge).toBe(24 * 60 * 60_000);
    client.setQueryData(["account", "admin-a"], "cuenta");
    const { storage, options } = storageOptions();
    await persistQueryClientSave(options);
    const saved = (await options.persister.restoreClient())!;
    if (reason === "caducada") saved.timestamp = Date.now() - persistOptions.maxAge - 1;
    else saved.buster = "otro-build";
    await options.persister.persistClient(saved);
    client.clear();

    await persistQueryClientRestore(options);

    expect(client.getQueryCache().getAll()).toEqual([]);
    expect(storage.getItem("bnbtico-query")).toBeNull();
  });

  it("conserva claves y staleTime de las consultas de cuenta y admin", () => {
    expect(accountQuery("admin-a")).toMatchObject({ queryKey: ["account", "admin-a"], staleTime: 5 * 60_000 });
    expect(adminHousesQuery("admin-a")).toMatchObject({ queryKey: ["admin-houses", "admin-a"], staleTime: 0 });
    expect(adminEditsQuery("admin-a")).toMatchObject({ queryKey: ["admin-edits", "admin-a"], staleTime: 0 });
    expect(adminEditQuery("admin-a", "casa-1")).toMatchObject({ queryKey: ["admin-edit", "admin-a", "casa-1"], staleTime: 0 });
    expect(adminQueueQuery("admin-a")).toMatchObject({ queryKey: ["admin-queue", "admin-a"], staleTime: 0 });
    expect(adminListingQuery("admin-a", "casa-1", client)).toMatchObject({ queryKey: ["admin-listing", "admin-a", "casa-1"], staleTime: 0 });
    expect(client.getDefaultOptions()).toMatchObject({ queries: { gcTime: 24 * 60 * 60_000 }, mutations: { networkMode: "always" } });
  });
});
