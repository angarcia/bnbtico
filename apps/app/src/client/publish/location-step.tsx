// Paso 2 «¿Dónde está su casa?» (ubicación por punto): el pin manda. Cada vez que se asienta (toque o arrastre), la
// búsqueda del lugar pide `place_at` y `zones_near`; la línea «{cantón}, {provincia}» no se edita (para cambiarla, se mueve
// el pin) y la zona se elige entre lo cercano o con «Otra…» (Photon a 5 km del pin, o lo escrito tal cual). El buscador de
// arriba solo mueve el mapa: nunca pone el pin ni guarda nada. «Continuar» espera a tener pin, cantón y zona. Todo viaja
// en campos ocultos; la base recalcula provincia, cantón y distrito al enviar.
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { PROVINCE_CENTERS, type LatLng } from "../../domain/geo";
import { DEFAULT_PROVINCE, type Listing, type ListingDraft } from "../../domain/listing";
import { searchZones, ZONE_SUGGESTIONS, ZONE_ZOOM } from "../../domain/place-search";
import { otherChoice, otherName, placeLine, reconcileZone, ZONE_RADIUS_M, zoneOptions, type ZoneChoice } from "../../domain/zones";
import { places } from "../owner";
import { LocationPicker, type PickerHandle } from "./location-picker";
import { createPlaceLookup, type LookupState, type PlaceLookup } from "./place-lookup";
import { PlaceSearch, type PlaceItem } from "./place-search";
import { useStepReady } from "./step-form";
import { ZoneSelect } from "./zone-select";

const NOT_LAND = "Ponga el punto sobre tierra, dentro de Costa Rica";
const same = (a: LatLng | null, b: LatLng | null) => a !== null && b !== null && a.lat === b.lat && a.lng === b.lng;

/** Las zonas de la tabla `zones` (Caribe primero), para el buscador del mapa. Cambian poco: un día de frescura. */
export const zonesQuery = queryOptions({ queryKey: ["zones"], queryFn: async () => (await places()).listZones(), staleTime: 86_400_000 });

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

/** `readOnly` (una edición en revisión): el mapa solo muestra el pin y no sale la indicación de tocarlo. */
export function LocationStep({ listing: _listing, draft, readOnly = false }: { listing: Listing; draft: ListingDraft; readOnly?: boolean }) {
  const start = draft.lat !== null && draft.lng !== null ? { lat: draft.lat, lng: draft.lng } : null;
  const [pin, setPin] = useState<LatLng | null>(start);
  const [state, setState] = useState<LookupState>(start ? { status: "loading", point: start } : { status: "idle" });
  const [choice, setChoice] = useState<ZoneChoice | null>(
    draft.zoneSource && draft.zone.trim() ? { name: draft.zone, source: draft.zoneSource, zoneId: draft.zoneId, anchor: draft.zoneSource === "other" ? start : null } : null,
  );
  const [otherOpen, setOtherOpen] = useState(false);
  const lookup = useRef<PlaceLookup | null>(null);
  const picker = useRef<PickerHandle>(null);
  /** El último punto pedido. */
  const asked = useRef<LatLng | null>(start);
  const zones = useQuery(zonesQuery).data;

  // Un borrador con pin busca su lugar al abrir; después, cada punto nuevo. El adaptador se carga con la primera búsqueda:
  // si no carga (sin red), la línea avisa y «Reintentar» o volver la conexión lo cargan otra vez.
  useEffect(() => {
    const created = createPlaceLookup(places, setState);
    lookup.current = created;
    if (asked.current) created.set(asked.current);
    return () => {
      created.dispose();
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
  // Con «Otra…» abierta la lista dice «Otra…»: «Continuar» espera a que se elija un nombre (o otra zona de la lista).
  useStepReady(!!pin && !!place && !!choice && !otherOpen);

  const zoneItems = (text: string): PlaceItem[] =>
    searchZones(zones ?? [], text, text.trim() ? ZONE_SUGGESTIONS : undefined).map((z) => ({ key: `zone:${z.id}`, name: z.name, detail: "", point: { lat: z.lat, lng: z.lng } }));

  return (
    <>
      <PlaceSearch
        label="Busque un pueblo, playa o barrio"
        placeholder="Busque un pueblo, playa o barrio…"
        local={zoneItems}
        near={() => picker.current?.center() ?? pin ?? PROVINCE_CENTERS[DEFAULT_PROVINCE]!}
        onChoose={(item) => item.point && picker.current?.view(item.point, ZONE_ZOOM)}
      />
      <LocationPicker ref={picker} lat={start?.lat ?? null} lng={start?.lng ?? null} onPick={pick} readOnly={readOnly} />
      {readOnly ? null : (
        <p className="small muted location-hint">
          Toque el mapa o arrastre el punto hasta su casa. <span className="xs">En la ficha solo se ve una zona aproximada de unos 500 m; la dirección exacta la da usted por WhatsApp.</span>
        </p>
      )}
      <PlaceLine state={state} onRetry={() => lookup.current?.retry()} />
      <ZoneSelect options={options} value={choice} other={otherOpen && !!pin} onChange={(c) => (setChoice(c), setOtherOpen(false))} onOther={() => pin && setOtherOpen(true)} />
      {otherOpen && pin ? (
        <PlaceSearch
          label="Otra zona"
          placeholder="Escriba el nombre de la zona"
          local={() => []}
          near={() => pin}
          withinM={ZONE_RADIUS_M}
          extra={(text) => (otherName(text) ? { key: "use", name: otherName(text), label: `Usar "${otherName(text)}"`, detail: "", point: null } : null)}
          onChoose={(item) => {
            setChoice(otherChoice(item.name, options, pin));
            setOtherOpen(false);
          }}
          onCancel={() => setOtherOpen(false)} // Escape: cierra sin cambiar la zona elegida
          autoFocus
        />
      ) : null}
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
