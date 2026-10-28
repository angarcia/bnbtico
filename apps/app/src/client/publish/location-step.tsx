// Paso 2 «¿Dónde está su casa?» (ubicación por punto): el pin manda. Cada vez que se asienta (toque o arrastre), la
// búsqueda del lugar pide `place_at` y `zones_near`; la línea «{cantón}, {provincia}» no se edita (para cambiarla, se mueve
// el pin) y la zona se elige entre lo cercano. «Continuar» espera a tener pin, cantón y zona. Todo viaja en campos ocultos;
// la base recalcula provincia, cantón y distrito al enviar.
import { useEffect, useMemo, useRef, useState } from "react";
import type { LatLng } from "../../domain/geo";
import type { Listing, ListingDraft } from "../../domain/listing";
import { placeLine, reconcileZone, zoneOptions, type ZoneChoice } from "../../domain/zones";
import { places } from "../owner";
import { LocationPicker } from "./location-picker";
import { createPlaceLookup, type LookupState, type PlaceLookup } from "./place-lookup";
import { useStepReady } from "./step-form";
import { ZoneSelect } from "./zone-select";

const NOT_LAND = "Ponga el punto sobre tierra, dentro de Costa Rica";
const same = (a: LatLng | null, b: LatLng | null) => a !== null && b !== null && a.lat === b.lat && a.lng === b.lng;

function PlaceLine({ state, onRetry }: { state: LookupState; onRetry(): void }) {
  return (
    <div className="place-line" aria-live="polite">
      {state.status === "loading" ? <span className="muted">Buscando el cantón…</span> : null}
      {state.status === "ready" ? state.place ? <b>{placeLine(state.place)}</b> : <span className="place-off">{NOT_LAND}</span> : null}
      {state.status === "error" ? (
        <>
          <span className="place-off">No pudimos ubicar el punto. Revise su conexión.</span>
          <button type="button" className="btn btn-sm btn-ghost" onClick={onRetry}>
            Reintentar
          </button>
        </>
      ) : null}
    </div>
  );
}

export function LocationStep({ listing: _listing, draft }: { listing: Listing; draft: ListingDraft }) {
  const start = draft.lat !== null && draft.lng !== null ? { lat: draft.lat, lng: draft.lng } : null;
  const [pin, setPin] = useState<LatLng | null>(start);
  const [state, setState] = useState<LookupState>(start ? { status: "loading", point: start } : { status: "idle" });
  const [choice, setChoice] = useState<ZoneChoice | null>(
    draft.zoneSource && draft.zone.trim() ? { name: draft.zone, source: draft.zoneSource, zoneId: draft.zoneId, anchor: draft.zoneSource === "other" ? start : null } : null,
  );
  const lookup = useRef<PlaceLookup | null>(null);
  /** El último punto pedido (o por pedir, mientras se carga el adaptador). */
  const asked = useRef<LatLng | null>(start);

  // Un borrador con pin busca su lugar al abrir; después, cada punto nuevo.
  useEffect(() => {
    let cancelled = false;
    let created: PlaceLookup | null = null;
    places().then(
      (api) => {
        if (cancelled) return;
        created = createPlaceLookup(api, setState);
        lookup.current = created;
        if (asked.current) created.set(asked.current);
      },
      () => {
        if (!cancelled && asked.current) setState({ status: "error", point: asked.current });
      },
    );
    return () => {
      cancelled = true;
      created?.dispose();
      lookup.current = null;
    };
  }, []);

  const options = useMemo(() => (state.status === "ready" ? zoneOptions(state.near, state.place) : []), [state]);
  // Con cada lugar nuevo, la zona elegida se queda si sigue valiendo; si no, la más cercana.
  useEffect(() => {
    if (state.status === "ready") setChoice((c) => reconcileZone(c, state.point, options, state.place));
  }, [state, options]);

  const pick = (p: LatLng) => {
    setPin(p);
    if (same(p, asked.current)) return; // el pin del borrador que el mapa vuelve a poner al abrir
    asked.current = p;
    lookup.current?.set(p);
  };

  const place = state.status === "ready" ? state.place : null;
  useStepReady(!!pin && !!place && !!choice);

  return (
    <>
      <LocationPicker lat={start?.lat ?? null} lng={start?.lng ?? null} onPick={pick} />
      <span className="small muted">Toque el mapa o arrastre el punto hasta su casa.</span>
      <PlaceLine state={state} onRetry={() => lookup.current?.retry()} />
      <ZoneSelect options={options} value={choice} onChange={setChoice} />
      <input type="hidden" name="lat" value={pin?.lat ?? ""} />
      <input type="hidden" name="lng" value={pin?.lng ?? ""} />
      <input type="hidden" name="province" value={place?.province ?? ""} />
      <input type="hidden" name="canton" value={place?.canton ?? ""} />
      <input type="hidden" name="district" value={place?.district ?? ""} />
      <input type="hidden" name="zone" value={choice?.name ?? ""} />
      <input type="hidden" name="zoneId" value={choice?.zoneId ?? ""} />
      <input type="hidden" name="zoneSource" value={choice?.source ?? ""} />
    </>
  );
}
