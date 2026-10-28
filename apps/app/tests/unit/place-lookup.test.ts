import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPlaceLookup, type LookupState } from "../../src/client/publish/place-lookup";
import type { NearZone, Place } from "../../src/domain/zones";

const A = { lat: 9.64, lng: -82.73 };
const B = { lat: 9.99, lng: -83.03 };
const C = { lat: 9.74, lng: -82.84 };
const placeA: Place = { province: "Limón", canton: "Talamanca", district: "Cahuita", districtCode: "70403" };
const placeB: Place = { province: "Limón", canton: "Limón", district: "Limón", districtCode: "70101" };

interface Deferred<T> { resolve(v: T): void; reject(e: unknown): void }

/** API falsa: cada llamada queda pendiente hasta que la prueba la resuelve o la rechaza. */
function fakeApi() {
  const calls: { lat: number; lng: number; place: Deferred<Place | null>; near: Deferred<NearZone[]> }[] = [];
  const api = {
    placeAt: vi.fn((lat: number, lng: number) =>
      new Promise<Place | null>((resolve, reject) => {
        calls.push({ lat, lng, place: { resolve, reject }, near: { resolve: () => {}, reject: () => {} } });
      }),
    ),
    zonesNear: vi.fn((_lat: number, _lng: number) =>
      new Promise<NearZone[]>((resolve, reject) => {
        calls[calls.length - 1]!.near = { resolve, reject };
      }),
    ),
  };
  /** Resuelve la llamada i (las dos peticiones) y deja correr las promesas. */
  const resolve = async (i: number, place: Place | null, near: NearZone[] = []) => {
    calls[i]!.place.resolve(place);
    calls[i]!.near.resolve(near);
    await vi.advanceTimersByTimeAsync(0);
  };
  const reject = async (i: number, e: unknown) => {
    calls[i]!.place.reject(e);
    calls[i]!.near.resolve([]);
    await vi.advanceTimersByTimeAsync(0);
  };
  return { api, calls, resolve, reject };
}

function fakeOnline() {
  const subs = new Set<() => void>();
  return { subscribe: (cb: () => void) => (subs.add(cb), () => subs.delete(cb)), fire: () => subs.forEach((cb) => cb()), subs };
}

let states: LookupState[];
const onChange = (s: LookupState) => states.push(s);
beforeEach(() => {
  vi.useFakeTimers();
  states = [];
});
afterEach(() => vi.useRealTimers());

describe("createPlaceLookup", () => {
  it("espera 300 ms tras el último punto", async () => {
    const { api, calls, resolve } = fakeApi();
    const l = createPlaceLookup(api, onChange, { online: fakeOnline() });
    l.set(A);
    await vi.advanceTimersByTimeAsync(100);
    l.set(C);
    await vi.advanceTimersByTimeAsync(100);
    l.set(B);
    await vi.advanceTimersByTimeAsync(299);
    expect(api.placeAt).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(api.placeAt).toHaveBeenCalledTimes(1);
    expect(api.placeAt).toHaveBeenCalledWith(B.lat, B.lng);
    expect(api.zonesNear).toHaveBeenCalledWith(B.lat, B.lng);
    expect(states.at(-1)).toEqual({ status: "loading", point: B });
    const near = [{ id: "701-centro", name: "Limón centro", distanceM: 400 }];
    await resolve(0, placeB, near);
    expect(calls).toHaveLength(1);
    expect(states.at(-1)).toEqual({ status: "ready", point: B, place: placeB, near });
  });

  it("una respuesta vieja no pisa a la nueva", async () => {
    const { api, resolve } = fakeApi();
    const l = createPlaceLookup(api, onChange, { online: fakeOnline() });
    l.set(A);
    await vi.advanceTimersByTimeAsync(300);
    l.set(B);
    await vi.advanceTimersByTimeAsync(300);
    expect(api.placeAt).toHaveBeenCalledTimes(2);
    await resolve(1, placeB);
    const afterB = states.length;
    await resolve(0, placeA);
    expect(states).toHaveLength(afterB);
    const ready = states.filter((s) => s.status === "ready");
    expect(ready).toEqual([{ status: "ready", point: B, place: placeB, near: [] }]);
  });

  it("una respuesta vieja tampoco pisa al punto nuevo que aún espera", async () => {
    const { api, resolve } = fakeApi();
    const l = createPlaceLookup(api, onChange, { online: fakeOnline() });
    l.set(A);
    await vi.advanceTimersByTimeAsync(300);
    l.set(B);
    await resolve(0, placeA);
    expect(states.at(-1)).toEqual({ status: "loading", point: B });
    expect(api.placeAt).toHaveBeenCalledTimes(1);
  });

  it("sin red: estado error y reintento al volver la conexión", async () => {
    const { api, reject, resolve } = fakeApi();
    const online = fakeOnline();
    const l = createPlaceLookup(api, onChange, { online });
    l.set(B);
    await vi.advanceTimersByTimeAsync(300);
    await reject(0, new TypeError("Failed to fetch"));
    expect(states.at(-1)).toEqual({ status: "error", point: B });
    online.fire();
    expect(api.placeAt).toHaveBeenCalledTimes(2);
    expect(api.placeAt).toHaveBeenLastCalledWith(B.lat, B.lng);
    await resolve(1, placeB);
    expect(states.at(-1)).toEqual({ status: "ready", point: B, place: placeB, near: [] });
    online.fire();
    expect(api.placeAt).toHaveBeenCalledTimes(2);
  });

  it("retry() repite el último punto", async () => {
    const { api, resolve } = fakeApi();
    const l = createPlaceLookup(api, onChange, { online: fakeOnline() });
    l.retry();
    expect(api.placeAt).not.toHaveBeenCalled();
    l.set(A);
    await vi.advanceTimersByTimeAsync(300);
    await resolve(0, placeA);
    l.retry();
    expect(api.placeAt).toHaveBeenCalledTimes(2);
    expect(api.placeAt).toHaveBeenLastCalledWith(A.lat, A.lng);
    expect(states.at(-1)).toEqual({ status: "loading", point: A });
  });

  it("dispose() cancela el temporizador y deja de avisar", async () => {
    const { api, resolve } = fakeApi();
    const online = fakeOnline();
    const l = createPlaceLookup(api, onChange, { online });
    l.set(A);
    await vi.advanceTimersByTimeAsync(300);
    l.set(B);
    l.dispose();
    const before = states.length;
    await vi.advanceTimersByTimeAsync(1000);
    await resolve(0, placeA);
    expect(api.placeAt).toHaveBeenCalledTimes(1);
    expect(states).toHaveLength(before);
    expect(online.subs.size).toBe(0);
    l.set(C);
    await vi.advanceTimersByTimeAsync(1000);
    expect(api.placeAt).toHaveBeenCalledTimes(1);
  });

  it("por defecto escucha el evento online de window, si existe", () => {
    const { api } = fakeApi();
    expect(() => createPlaceLookup(api, onChange).dispose()).not.toThrow();
  });
});
