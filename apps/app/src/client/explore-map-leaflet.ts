// Mapa de Explorar (maquetas v2 01 y 05): se carga en reposo tras pintar la lista; Leaflet va en su trozo compartido
// (leaflet-*.js) y este módulo en el suyo. Los marcadores son píldoras con el precio, hechas con textContent (nada de HTML).
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { EXPLORE_MAP, exploreMapView, type LatLng } from "../domain/geo";

const OSM = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Un marcador: el punto aproximado de la casa (listings_public), su precio y su nombre. */
export interface MapMarker { publicId: string; lat: number; lng: number; label: string; title: string }

export interface ExploreMapHandle {
  show(markers: MapMarker[], zone: LatLng | null): void;
  select(publicId: string | null): void;
  dispose(): void;
}

/** `interactive: false` es el mapa pequeño de la lista: sin arrastrar, zoom ni teclado (la página baja con el dedo). */
export function drawExploreMap(el: HTMLElement, opts: { interactive: boolean; onMarker(publicId: string): void; onMap(): void }): ExploreMapHandle {
  const still = { dragging: false, scrollWheelZoom: false, touchZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false };
  const map = L.map(el, { zoomControl: false, ...(opts.interactive ? {} : still) });
  L.tileLayer(OSM, { attribution: ATTRIBUTION, maxZoom: 18 }).addTo(map);
  const layer = L.layerGroup().addTo(map);
  const icons = new Map<string, L.Marker>();
  let selected: string | null = null;
  map.on("click", () => opts.onMap());

  const mark = () => {
    for (const [id, marker] of icons) {
      marker.getElement()?.classList.toggle("is-selected", id === selected);
      marker.setZIndexOffset(id === selected ? 1000 : 0);
    }
  };

  return {
    show(markers, zone) {
      layer.clearLayers();
      icons.clear();
      // Primero la vista: hasta tenerla, Leaflet no crea los elementos de los marcadores (getElement() sería undefined).
      const view = exploreMapView(markers, zone);
      if ("fit" in view) map.fitBounds(L.latLngBounds(view.fit.map((p) => [p.lat, p.lng] as [number, number])), { padding: [EXPLORE_MAP.padding, EXPLORE_MAP.padding], maxZoom: EXPLORE_MAP.maxZoom });
      else map.setView([view.center.lat, view.center.lng], view.zoom);
      for (const m of markers) {
        const pill = document.createElement("span");
        pill.textContent = m.label;
        pill.title = m.title;
        const marker = L.marker([m.lat, m.lng], { icon: L.divIcon({ className: "map-price", html: pill, iconSize: undefined }), keyboard: opts.interactive, title: m.title });
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
      }
      mark();
    },
    select(publicId) {
      selected = publicId;
      mark();
    },
    dispose: () => map.remove(),
  };
}
