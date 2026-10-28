// Búsqueda del lugar del pin (ubicación por punto): `place_at` y `zones_near` a la vez, 300 ms después del último punto;
// solo cuenta la respuesta del último punto pedido (las viejas se tiran por número de secuencia); sin red queda en
// `error` y se repite sola al volver la conexión, o con `retry()`. Sin React: la pantalla se suscribe con `onChange`.
import type { LatLng } from "../../domain/geo";
import { PLACE_DEBOUNCE_MS, type NearZone, type Place } from "../../domain/zones";

export type LookupState =
  | { status: "idle" }
  | { status: "loading"; point: LatLng }
  | { status: "ready"; point: LatLng; place: Place | null; near: NearZone[] }
  | { status: "error"; point: LatLng };

export interface PlaceLookup {
  set(point: LatLng): void;
  retry(): void;
  dispose(): void;
}

interface OnlineSource {
  subscribe(cb: () => void): () => void;
}

const windowOnline: OnlineSource = {
  subscribe(cb) {
    if (typeof window === "undefined") return () => {};
    window.addEventListener("online", cb);
    return () => window.removeEventListener("online", cb);
  },
};

export function createPlaceLookup(
  api: { placeAt(lat: number, lng: number): Promise<Place | null>; zonesNear(lat: number, lng: number, km?: number): Promise<NearZone[]> },
  onChange: (s: LookupState) => void,
  opts: { debounceMs?: number; online?: OnlineSource } = {},
): PlaceLookup {
  const debounceMs = opts.debounceMs ?? PLACE_DEBOUNCE_MS;
  let seq = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let point: LatLng | null = null;
  let status: LookupState["status"] = "idle";
  let disposed = false;

  const emit = (s: LookupState) => {
    status = s.status;
    onChange(s);
  };

  const run = () => {
    timer = undefined;
    if (disposed || !point) return;
    const p = point;
    const mine = ++seq;
    if (status !== "loading") emit({ status: "loading", point: p });
    Promise.all([api.placeAt(p.lat, p.lng), api.zonesNear(p.lat, p.lng)]).then(
      ([place, near]) => {
        if (!disposed && mine === seq) emit({ status: "ready", point: p, place, near });
      },
      () => {
        if (!disposed && mine === seq) emit({ status: "error", point: p });
      },
    );
  };

  const clear = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };

  const retry = () => {
    if (disposed || !point) return;
    clear();
    run();
  };

  const unsubscribe = (opts.online ?? windowOnline).subscribe(() => {
    if (status === "error") retry();
  });

  return {
    set(p) {
      if (disposed) return;
      point = p;
      seq++; // lo que esté en vuelo ya no cuenta
      clear();
      emit({ status: "loading", point: p });
      timer = setTimeout(run, debounceMs);
    },
    retry,
    dispose() {
      disposed = true;
      clear();
      unsubscribe();
    },
  };
}
