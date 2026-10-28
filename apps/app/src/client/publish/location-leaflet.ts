// Mapa del paso 2 («¿Dónde está su casa?») con el pin arrastrable. Se carga bajo demanda al abrir esa pantalla: Leaflet no
// entra en el JS inicial.
// El mapa no sale de Costa Rica y el pin tampoco: un toque o un arrastre fuera del país no lo mueve.
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { APPROX_MAX_METERS, inCostaRica, type LatLng } from "../../domain/geo";

const OSM = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const COSTA_RICA = L.latLngBounds([7.6, -86.4], [11.6, -82.2]);

export interface PickerMap {
  place(p: LatLng): void;
  /** Mueve el mapa sin animación (el buscador); no toca el pin. */
  view(p: LatLng, zoom: number): void;
  dispose(): void;
}

export function drawPicker(el: HTMLElement, start: { point: LatLng | null; center: LatLng; zoom: number }, onPick: (p: LatLng) => void): PickerMap {
  const at = start.point ?? start.center;
  const map = L.map(el, { zoomControl: true, attributionControl: true, maxBounds: COSTA_RICA, maxBoundsViscosity: 1, minZoom: 7 }).setView([at.lat, at.lng], start.point ? 13 : start.zoom);
  L.tileLayer(OSM, { attribution: ATTRIBUTION, maxZoom: 18 }).addTo(map);
  const icon = L.divIcon({ className: "pin-icon", html: "<span></span>", iconSize: [26, 26], iconAnchor: [13, 26] });
  let marker: L.Marker | null = null;
  let circle: L.Circle | null = null;
  let last: LatLng | null = null;

  const place = (p: LatLng) => {
    if (!inCostaRica(p.lat, p.lng)) {
      if (marker && last) marker.setLatLng([last.lat, last.lng]);
      return;
    }
    last = { lat: p.lat, lng: p.lng };
    if (!marker) {
      marker = L.marker([p.lat, p.lng], { draggable: true, icon, keyboard: false }).addTo(map);
      marker.on("dragend", () => place(marker!.getLatLng()));
      circle = L.circle([p.lat, p.lng], { radius: APPROX_MAX_METERS, color: "#2F5D45", weight: 1.5, fillColor: "#2F5D45", fillOpacity: 0.14 }).addTo(map);
    } else {
      marker.setLatLng([p.lat, p.lng]);
      circle?.setLatLng([p.lat, p.lng]);
    }
    // Sin animación: desmontar la pantalla en mitad de un zoom animado rompe Leaflet.
    if (map.getZoom() < 13) map.setView([p.lat, p.lng], 13, { animate: false });
    onPick(last);
  };

  if (start.point) place(start.point);
  map.on("click", (e) => place(e.latlng));
  // La caja del mapa ocupa lo que sobra de la pantalla: si cambia de alto (fuentes, teclado), Leaflet recalcula su tamaño
  // (si no, un toque caería en otro punto que el que se ve).
  const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => map.invalidateSize({ animate: false }));
  resize?.observe(el);
  return {
    place,
    view: (p, zoom) => void map.setView([p.lat, p.lng], zoom, { animate: false }),
    dispose: () => {
      resize?.disconnect();
      map.remove();
    },
  };
}
