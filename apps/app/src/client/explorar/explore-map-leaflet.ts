// Mapa de Explorar (maquetas v2 01 y 05): se carga en reposo tras pintar la lista; Leaflet va en su trozo compartido
// (leaflet-*.js) y este módulo en el suyo. Los marcadores son píldoras con el precio, hechas con textContent (nada de HTML).
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { EXPLORE_MAP, exploreMapView, type LatLng } from "../../domain/geo";
import type { MapArea } from "../../domain/filters";
import { groupLabel, groupPins } from "../../domain/map-pins";

const OSM = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Un marcador: el punto aproximado de la casa (listings_public), su precio y su nombre. */
export interface MapMarker { publicId: string; lat: number; lng: number; label: string; title: string }

/** Espera tras el último movimiento antes de buscar el área: una ráfaga de gestos es una sola búsqueda (historia #96). */
export const AREA_SETTLE_MS = 300;

export interface ExploreMapHandle {
  /** `area`: búsqueda por el área del mapa: el encuadre lo eligió el viajero y los resultados no lo mueven. */
  show(markers: MapMarker[], zone: LatLng | null, area: MapArea | null): void;
  select(publicId: string | null): void;
  zoomBy(step: number): void;
  dispose(): void;
}

/** `interactive: false` es el mapa pequeño de la lista: sin arrastrar, zoom ni teclado (la página baja con el dedo).
 *  Los marcadores que se pisan van juntos en uno, «N casas» (revisión UX 2026-10-29, C2): en el mapa grande, tocarlo acerca
 *  el mapa a esas casas; en el pequeño, el toque sigue hasta la caja y abre el mapa grande. Se rehace al cambiar el zoom. */
/** `onArea` recibe los límites como `oeste,sur,este,norte` (el formato de `?area=`; lo lee `parseArea` del dominio). */
export function drawExploreMap(el: HTMLElement, opts: { interactive: boolean; onMarker(publicId: string): void; onMap(): void; insets(): { top: number; bottom: number }; onArea?(bbox: string): void }): ExploreMapHandle {
  const still = { dragging: false, scrollWheelZoom: false, touchZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false };
  const map = L.map(el, { zoomControl: false, ...(opts.interactive ? {} : still) });
  const tiles = L.tileLayer(OSM, { attribution: ATTRIBUTION, maxZoom: 18 }).addTo(map);
  // Las teselas que fallaron sin red se vuelven a pedir al volver la conexión (sin red no es «sin casas»: la lista lo dice).
  const online = () => tiles.redraw();
  addEventListener("online", online);
  // La zona del último encuadre: sin casas en la misma zona (los filtros las quitaron todas), el mapa se queda donde está.
  let shown: string | null = null;
  const layer = L.layerGroup().addTo(map);
  const icons = new Map<string, L.Marker>();
  let markers: MapMarker[] = [];
  let selected: string | null = null;
  const [padX, padY] = EXPLORE_MAP.padding;
  // Los precios, fuera de lo que tapan las tarjetas flotantes de arriba y de abajo (tarjetas flotantes, tanda 1).
  const fit = (points: { lat: number; lng: number }[]) => {
    const { top, bottom } = opts.insets();
    map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { paddingTopLeft: [padX, padY + top], paddingBottomRight: [padX, padY + bottom], maxZoom: EXPLORE_MAP.maxZoom });
  };
  map.on("click", () => opts.onMap());
  const resize = new ResizeObserver(() => map.invalidateSize({ pan: false }));
  resize.observe(el);

  const mark = () => {
    for (const [id, marker] of icons) {
      marker.getElement()?.classList.toggle("is-selected", id === selected);
      marker.setZIndexOffset(id === selected ? 1000 : 0);
    }
  };

  const pill = (text: string, title: string) => {
    const span = document.createElement("span");
    span.textContent = text;
    span.title = title;
    return span;
  };

  function draw() {
    layer.clearLayers();
    icons.clear();
    const byId = new Map(markers.map((m) => [m.publicId, m]));
    const pins = markers.map((m) => ({ id: m.publicId, label: m.label, ...map.latLngToContainerPoint([m.lat, m.lng]) }));
    for (const group of groupPins(pins)) {
      const items = group.ids.map((id) => byId.get(id)!);
      if (items.length === 1) {
        const m = items[0]!;
        const marker = L.marker([m.lat, m.lng], { icon: L.divIcon({ className: "map-price", html: pill(m.label, m.title), iconSize: undefined }), keyboard: opts.interactive, title: m.title });
        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          opts.onMarker(m.publicId);
        });
        layer.addLayer(marker);
        // Con teclado, Leaflet hace el marcador enfocable (role=button) pero Intro no llega como clic: se atiende aquí.
        if (opts.interactive)
          marker.getElement()?.addEventListener("keydown", (e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            e.stopPropagation();
            opts.onMarker(m.publicId);
          });
        icons.set(m.publicId, marker);
        continue;
      }
      const titles = items.map((m) => m.title).join(", ");
      const at = map.containerPointToLatLng([group.x, group.y]);
      const marker = L.marker(at, { icon: L.divIcon({ className: "map-price is-group", html: pill(groupLabel(items.length), titles), iconSize: undefined }), keyboard: opts.interactive, title: titles });
      if (opts.interactive) {
        const closer = () => fit(items);
        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          closer();
        });
        layer.addLayer(marker);
        marker.getElement()?.addEventListener("keydown", (e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          e.stopPropagation();
          closer();
        });
      } else layer.addLayer(marker);
    }
    mark();
  }
  map.on("zoomend", () => {
    if (markers.length) draw();
  });

  // Búsqueda por el área visible (historia #96): solo tras un gesto del viajero (arrastrar, rueda, pellizco, teclado, + y −),
  // nunca tras un encuadre de la app (resultados, zona, casa elegida): así no hay búsquedas en bucle. Se espera a que el
  // mapa se quede quieto AREA_SETTLE_MS y se busca una vez el área final.
  let gesture = false;
  let settle: ReturnType<typeof setTimeout> | undefined;
  const byUser = () => (gesture = true);
  if (opts.interactive && opts.onArea) {
    // pointerdown cubre también el dedo (Pointer Events en todos los navegadores que se soportan).
    for (const type of ["pointerdown", "wheel", "keydown"] as const) el.addEventListener(type, byUser, { passive: true });
    map.on("moveend", () => {
      if (!gesture) return;
      clearTimeout(settle);
      settle = setTimeout(() => {
        gesture = false;
        opts.onArea?.(map.getBounds().toBBoxString());
      }, AREA_SETTLE_MS);
    });
  }
  // Un encuadre de la app: lo que se mueva ahora no lo hizo el viajero.
  const programmatic = () => {
    gesture = false;
    clearTimeout(settle);
  };
  let placed = false;

  return {
    show(next, zone, area) {
      markers = next;
      const zoneKey = area ? `${area.west},${area.south},${area.east},${area.north}` : zone ? `${zone.lat},${zone.lng}` : "";
      // Sin casas en la misma zona: mismo encuadre y zoom, solo se quitan los marcadores. Con el área del mapa, en el mapa
      // que se mueve el encuadre es del viajero: los resultados nunca lo mueven (al abrir con el área en la URL, se coloca
      // una vez). El mapa pequeño de la lista, que no se mueve con el dedo, sigue el área cuando cambia.
      const keep = area ? (opts.interactive ? placed : shown === zoneKey) : !next.length && shown === zoneKey;
      shown = zoneKey;
      // Primero la vista: hasta tenerla, Leaflet no crea los elementos de los marcadores (getElement() sería undefined).
      if (!keep) {
        programmatic();
        if (area) map.fitBounds([[area.south, area.west], [area.north, area.east]]);
        else {
          const view = exploreMapView(next, zone);
          if ("fit" in view) fit(view.fit);
          else map.setView([view.center.lat, view.center.lng], view.zoom);
        }
      }
      placed = true;
      draw();
    },
    select(publicId) {
      selected = publicId;
      // Si la casa va dentro de un grupo, el mapa se acerca hasta que sale sola.
      const m = publicId ? markers.find((x) => x.publicId === publicId) : undefined;
      if (m && !icons.has(m.publicId) && map.getZoom() < EXPLORE_MAP.maxZoom) {
        programmatic();
        map.setView([m.lat, m.lng], EXPLORE_MAP.maxZoom, { animate: false });
        draw();
      }
      mark();
    },
    // «+» y «−» de escritorio están fuera de la caja del mapa: también son un gesto del viajero.
    zoomBy: (step) => {
      byUser();
      map.setZoom(map.getZoom() + step);
    },
    dispose: () => {
      clearTimeout(settle);
      resize.disconnect();
      removeEventListener("online", online);
      map.remove();
    },
  };
}
