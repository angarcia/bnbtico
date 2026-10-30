// Mapa de Explorar (maquetas v2 01 y 05): se carga en reposo tras pintar la lista; Leaflet va en su trozo compartido
// (leaflet-*.js) y este módulo en el suyo. Los marcadores son píldoras con el precio, hechas con textContent (nada de HTML).
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { EXPLORE_MAP, exploreMapView, type LatLng } from "../domain/geo";
import { groupLabel, groupPins } from "../domain/map-pins";

const OSM = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Un marcador: el punto aproximado de la casa (listings_public), su precio y su nombre. */
export interface MapMarker { publicId: string; lat: number; lng: number; label: string; title: string }

export interface ExploreMapHandle {
  show(markers: MapMarker[], zone: LatLng | null): void;
  select(publicId: string | null): void;
  dispose(): void;
}

/** `interactive: false` es el mapa pequeño de la lista: sin arrastrar, zoom ni teclado (la página baja con el dedo).
 *  Los marcadores que se pisan van juntos en uno, «N casas» (revisión UX 2026-10-29, C2): en el mapa grande, tocarlo acerca
 *  el mapa a esas casas; en el pequeño, el toque sigue hasta la caja y abre el mapa grande. Se rehace al cambiar el zoom. */
export function drawExploreMap(el: HTMLElement, opts: { interactive: boolean; onMarker(publicId: string): void; onMap(): void }): ExploreMapHandle {
  const still = { dragging: false, scrollWheelZoom: false, touchZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false };
  const map = L.map(el, { zoomControl: false, ...(opts.interactive ? {} : still) });
  L.tileLayer(OSM, { attribution: ATTRIBUTION, maxZoom: 18 }).addTo(map);
  const layer = L.layerGroup().addTo(map);
  const icons = new Map<string, L.Marker>();
  let markers: MapMarker[] = [];
  let selected: string | null = null;
  const [padX, padY] = EXPLORE_MAP.padding;
  const fit = (points: { lat: number; lng: number }[]) =>
    map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { padding: [padX, padY], maxZoom: EXPLORE_MAP.maxZoom });
  map.on("click", () => opts.onMap());

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

  return {
    show(next, zone) {
      markers = next;
      // Primero la vista: hasta tenerla, Leaflet no crea los elementos de los marcadores (getElement() sería undefined).
      const view = exploreMapView(next, zone);
      if ("fit" in view) fit(view.fit);
      else map.setView([view.center.lat, view.center.lng], view.zoom);
      draw();
    },
    select(publicId) {
      selected = publicId;
      // Si la casa va dentro de un grupo, el mapa se acerca hasta que sale sola.
      const m = publicId ? markers.find((x) => x.publicId === publicId) : undefined;
      if (m && !icons.has(m.publicId) && map.getZoom() < EXPLORE_MAP.maxZoom) {
        map.setView([m.lat, m.lng], EXPLORE_MAP.maxZoom, { animate: false });
        draw();
      }
      mark();
    },
    dispose: () => map.remove(),
  };
}
