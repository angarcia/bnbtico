// El mapa de Explorar en el JS inicial: solo la caja de alto fijo (arriba a todo el ancho, con el alto en CSS: nada salta al
// cargar), su cargador en reposo y la etiqueta flotante «Mapa». Leaflet y los marcadores van en explore-map-leaflet (trozo diferido); el mapa a pantalla
// completa, en explore-map-full (otro trozo, al abrirlo).
import { Suspense, lazy, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type RefObject } from "react";
import { mapPriceLabel } from "../domain/describe";
import type { LatLng } from "../domain/geo";
import type { SearchListing } from "../domain/listing";
import type { Currency } from "../domain/currency";
import { useCurrency } from "../shared/currency";
import { useFx } from "../shared/fx";
import { I } from "../shared/icons";
import { afterPaint, whenIdle } from "../shared/idle";

// Los tipos del trozo de Leaflet sin importarlo (ni siquiera como tipo: la prueba de arquitectura lo vigila).
type ExploreMapHandle = ReturnType<typeof import("./explore-map-leaflet")["drawExploreMap"]>;
export type MapMarker = Parameters<ExploreMapHandle["show"]>[0][number];

/** Las casas con punto aproximado, con la cifra de su tarjeta («₡42 000», «$80»; con llegada y salida, el total de esas noches). */
export function mapMarkers(listings: readonly SearchListing[], nights: number, currency: Currency, fx: number): MapMarker[] {
  return listings.flatMap((l) => (l.approx ? [{ publicId: l.publicId, lat: l.approx.lat, lng: l.approx.lng, label: mapPriceLabel(l, nights, currency, fx), title: l.title }] : []));
}

/** Los marcadores en la moneda elegida, recalculados solo si cambian las casas, las noches o la moneda. */
export function useMapMarkers(listings: readonly SearchListing[], nights: number): MapMarker[] {
  const currency = useCurrency();
  const fx = useFx(currency === "USD").crcPerUsd;
  return useMemo(() => mapMarkers(listings, nights, currency, fx), [listings, nights, currency, fx]);
}

/** Lo que tapan las tarjetas flotantes de arriba y de abajo del mapa, en px: el encuadre deja a los precios fuera. */
export type MapInsets = () => { top: number; bottom: number };

/** Arriba, la cabecera flotante de Explorar sobre el mapa pequeño (arriba de la página). Con su `top` y su alto, no con su
 *  caja en pantalla: al esconderse se desplaza, y el mapa se puede dibujar con ella fuera. */
export function exploreHeaderInsets(box: HTMLElement): { top: number; bottom: number } {
  const header = document.querySelector<HTMLElement>(".explore-top");
  if (!header) return { top: 0, bottom: 0 };
  const boxTop = box.getBoundingClientRect().top + scrollY;
  if (header.closest(".desktop-app")) {
    return { top: Math.max(0, header.getBoundingClientRect().bottom - box.getBoundingClientRect().top), bottom: 0 };
  }
  return { top: Math.max(0, parseFloat(getComputedStyle(header).top) + header.offsetHeight - boxTop), bottom: 0 };
}

/** Dibuja el mapa en `box` cuando Leaflet llega (en reposo); sin red no pasa nada: queda el fondo de la caja. */
export function useExploreMap(
  box: RefObject<HTMLElement | null>,
  opts: { interactive: boolean; onMarker(id: string): void; onMap(): void; insets: MapInsets },
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
          handle.current = drawExploreMap(box.current, {
            interactive: opts.interactive,
            onMarker: (id) => callbacks.current.onMarker(id),
            onMap: () => callbacks.current.onMap(),
            insets: () => callbacks.current.insets(),
          });
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

/** Arriba de Explorar, a todo el ancho y bajo la cabecera flotante: tocarlo (o Intro/Espacio) abre el mapa grande; un marcador,
 *  con su casa. Sin `onOpen` (mientras busca o sin casas) es solo el mapa de la zona. */
export function ExploreMap({ listings, zone, nights, onOpen, onSelect, selected = null, expanded, onExpand, ref }: { listings: SearchListing[]; zone: LatLng | null; nights: number; onOpen: ((publicId: string | null) => void) | null; onSelect?: (publicId: string | null) => void; selected?: string | null; expanded?: boolean; onExpand?: () => void; ref?: RefObject<HTMLDivElement | null> }) {
  const own = useRef<HTMLDivElement>(null);
  const box = ref ?? own;
  const markers = useMapMarkers(listings, nights);
  const insets = () => (box.current ? exploreHeaderInsets(box.current) : { top: 0, bottom: 0 });
  const { handle, ready } = useExploreMap(box, {
    interactive: !!onSelect,
    onMarker: onSelect ?? ((id) => onOpen?.(id)),
    onMap: () => onSelect?.(null),
    insets,
  }, markers, zone);
  useEffect(() => {
    if (onSelect) handle.current?.select(selected);
  }, [handle, ready, markers, onSelect, selected]);
  const [size, setSize] = useState({ width: 0, height: 0, top: 0 });
  useLayoutEffect(() => {
    const el = box.current;
    if (el) setSize({ width: el.clientWidth, height: el.clientHeight, top: exploreHeaderInsets(el).top });
  }, [box]);
  const open = onOpen
    ? {
        role: "button",
        tabIndex: 0,
        "aria-label": "Abrir el mapa de las casas",
        onClick: (e: MouseEvent) => {
          // Los marcadores los atiende Leaflet (un grupo, «N casas», no: abre el mapa grande); la atribución es un enlace.
          if ((e.target as Element).closest(".leaflet-marker-icon:not(.is-group), .leaflet-control")) return;
          onOpen(null);
        },
        onKeyDown: (e: KeyboardEvent) => {
          if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
          e.preventDefault();
          onOpen(null);
        },
      }
    : onSelect ? { role: "region", "aria-label": "Mapa de las casas" } : { "aria-hidden": true };
  return (
    <>
    {/* La clase permanece fija para conservar las clases que añade Leaflet. El estado va en un atributo. */}
    <div ref={box} className="map-box explore-map" data-still={onOpen ? undefined : ""} data-testid="explore-map" {...open}>
      {ready ? null : (
        <Suspense fallback={null}>
          <PricePreview markers={markers} width={size.width} height={size.height} top={size.top} />
        </Suspense>
      )}
    </div>
    {onExpand && (
      <div className="desktop-map-controls" role="group" aria-label="Controles del mapa">
        <button type="button" className="icon-btn float-card" aria-label={expanded ? "Reducir mapa" : "Ampliar mapa"} aria-pressed={expanded} onClick={onExpand}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={expanded ? "m5 19 6-6m-6 0h6v6m8-14-6 6m0-6v6h6" : "m5 19 6-6m-6 0v6h6m8-14-6 6m0-6h6v6"} />
          </svg>
        </button>
        <button type="button" className="icon-btn float-card" aria-label="Acercar mapa" disabled={!ready} onClick={() => handle.current?.zoomBy(1)}><I.plus size={20} /></button>
        <button type="button" className="icon-btn float-card" aria-label="Alejar mapa" disabled={!ready} onClick={() => handle.current?.zoomBy(-1)}>−</button>
      </div>
    )}
    </>
  );
}

/** «Mapa», flotando sobre la barra de pestañas mientras la caja del mapa quedó arriba, fuera de la pantalla, y la lista de
 *  casas sigue pasando por debajo. Se va al acabarse la lista (ronda de Ana 2026-10-30: tapaba «Publicar mi casa gratis»):
 *  una marca sin alto, justo detrás de la rejilla, dice cuándo el final de la lista sube por encima de la zona del botón. */
const LABEL_ZONE = 160;
export function MapLabel({ target, onOpen, hidden = false }: { target: RefObject<HTMLElement | null>; onOpen(): void; hidden?: boolean }) {
  const [above, setAbove] = useState(false);
  const [ended, setEnded] = useState(false);
  const end = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = target.current;
    if (!el || !end.current || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setAbove(!!entry && !entry.isIntersecting && entry.boundingClientRect.bottom < 0));
    io.observe(el);
    const past = new IntersectionObserver(([entry]) => setEnded(!!entry && (entry.isIntersecting || entry.boundingClientRect.top < 0)), {
      rootMargin: `0px 0px -${LABEL_ZONE}px 0px`,
    });
    past.observe(end.current);
    return () => (io.disconnect(), past.disconnect());
  }, [target]);
  const sentinel = <span ref={end} className="map-label-end" aria-hidden="true" />;
  if (!above || ended || hidden) return sentinel;
  return (
    <>
      {sentinel}
      <button type="button" className="map-label" onClick={onOpen}>
        Mapa
        <I.map size={20} />
      </button>
    </>
  );
}
