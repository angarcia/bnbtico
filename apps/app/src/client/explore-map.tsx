// El mapa de Explorar en el JS inicial: solo la caja de alto fijo (220 px, nada salta al cargar), su cargador en reposo y
// la etiqueta flotante «Mapa». Leaflet y los marcadores van en explore-map-leaflet (trozo diferido); el mapa a pantalla
// completa, en explore-map-full (otro trozo, al abrirlo).
import { Suspense, lazy, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { mapPriceLabel } from "../domain/describe";
import type { LatLng } from "../domain/geo";
import type { PublicListing } from "../domain/listing";
import type { Currency } from "../domain/currency";
import { useCurrency } from "../shared/currency";
import { useFx } from "../shared/fx";
import { I } from "../shared/icons";
import { afterPaint, whenIdle } from "../shared/idle";

// Los tipos del trozo de Leaflet sin importarlo (ni siquiera como tipo: la prueba de arquitectura lo vigila).
type ExploreMapHandle = ReturnType<typeof import("./explore-map-leaflet")["drawExploreMap"]>;
export type MapMarker = Parameters<ExploreMapHandle["show"]>[0][number];

/** Las casas con punto aproximado, con su precio como en la tarjeta («₡42 000», «$80», el del mes o «A negociar»). */
export function mapMarkers(listings: readonly PublicListing[], monthly: boolean, currency: Currency, fx: number): MapMarker[] {
  return listings.flatMap((l) => (l.approx ? [{ publicId: l.publicId, lat: l.approx.lat, lng: l.approx.lng, label: mapPriceLabel(l, monthly, currency, fx), title: l.title }] : []));
}

/** Los marcadores en la moneda elegida, recalculados solo si cambian las casas, el mensual o la moneda. */
export function useMapMarkers(listings: readonly PublicListing[], monthly: boolean): MapMarker[] {
  const currency = useCurrency();
  const fx = useFx(currency === "USD").crcPerUsd;
  return useMemo(() => mapMarkers(listings, monthly, currency, fx), [listings, monthly, currency, fx]);
}

/** Dibuja el mapa en `box` cuando Leaflet llega (en reposo); sin red no pasa nada: queda el fondo de la caja. */
export function useExploreMap(
  box: RefObject<HTMLElement | null>,
  opts: { interactive: boolean; onMarker(id: string): void; onMap(): void },
  markers: MapMarker[],
  zone: LatLng | null,
): { handle: RefObject<ExploreMapHandle | null>; ready: boolean } {
  const handle = useRef<ExploreMapHandle | null>(null);
  const callbacks = useRef(opts);
  callbacks.current = opts;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      import("./explore-map-leaflet")
        .then(({ drawExploreMap }) => {
          if (cancelled || !box.current) return;
          handle.current = drawExploreMap(box.current, { interactive: opts.interactive, onMarker: (id) => callbacks.current.onMarker(id), onMap: () => callbacks.current.onMap() });
          setReady(true);
        })
        .catch(() => undefined);
    // Safari no tiene requestIdleCallback y whenIdle esperaba 1,5 s con la caja vacía (revisión UX 2026-10-29, C2): allí,
    // en cuanto se pinta la lista.
    if (opts.interactive) void load();
    else if (typeof requestIdleCallback === "function") whenIdle(() => void load());
    else afterPaint(() => void load());
    return () => {
      cancelled = true;
      handle.current?.dispose();
      handle.current = null;
    };
  }, [box, opts.interactive]);
  // La zona cuenta por su valor, no por su objeto (cada render trae uno nuevo).
  const zoneKey = zone ? `${zone.lat},${zone.lng}` : "";
  useEffect(() => {
    if (ready) handle.current?.show(markers, zone);
  }, [ready, markers, zoneKey]);
  return { handle, ready };
}

// Los precios antes de Leaflet, en su propio trozo pequeño (fuera del JS inicial): se pide al montar la caja.
const PricePreview = lazy(() => import("./map-preview").then((m) => ({ default: m.PricePreview })));

/** El primer elemento de la lista: tocarlo (o Intro/Espacio) abre el mapa grande; un marcador, con su casa. */
export function ExploreMap({ listings, zone, monthly, onOpen, ref }: { listings: PublicListing[]; zone: LatLng | null; monthly: boolean; onOpen(publicId: string | null): void; ref?: RefObject<HTMLDivElement | null> }) {
  const own = useRef<HTMLDivElement>(null);
  const box = ref ?? own;
  const markers = useMapMarkers(listings, monthly);
  const { ready } = useExploreMap(box, { interactive: false, onMarker: (id) => onOpen(id), onMap: () => undefined }, markers, zone);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = box.current;
    if (el) setSize({ width: el.clientWidth, height: el.clientHeight });
  }, [box]);
  return (
    <div
      ref={box}
      className="map-box explore-map"
      role="button"
      tabIndex={0}
      aria-label="Abrir el mapa de las casas"
      data-testid="explore-map"
      onClick={(e) => {
        // Los marcadores los atiende Leaflet (un grupo, «N casas», no: abre el mapa grande); la atribución es un enlace.
        if ((e.target as Element).closest(".leaflet-marker-icon:not(.is-group), .leaflet-control")) return;
        onOpen(null);
      }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
        e.preventDefault();
        onOpen(null);
      }}
    >
      {ready ? null : (
        <Suspense fallback={null}>
          <PricePreview markers={markers} width={size.width} height={size.height} />
        </Suspense>
      )}
    </div>
  );
}

/** «Mapa», flotando sobre la barra de pestañas mientras la caja del mapa quedó arriba, fuera de la pantalla. */
export function MapLabel({ target, onOpen, hidden = false }: { target: RefObject<HTMLElement | null>; onOpen(): void; hidden?: boolean }) {
  const [above, setAbove] = useState(false);
  useEffect(() => {
    const el = target.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setAbove(!!entry && !entry.isIntersecting && entry.boundingClientRect.bottom < 0));
    io.observe(el);
    return () => io.disconnect();
  }, [target]);
  if (!above || hidden) return null;
  return (
    <button type="button" className="map-label" onClick={onOpen}>
      Mapa
      <I.map size={20} />
    </button>
  );
}
