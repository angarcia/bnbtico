// Se carga bajo demanda tras hidratar: Leaflet no entra en el JS inicial.
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { APPROX_MAX_METERS } from "../domain/geo";

const OSM = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export function drawApproxMap(el: HTMLElement, lat: number, lng: number): () => void {
  const map = L.map(el, { zoomControl: false, dragging: false, scrollWheelZoom: false, touchZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false }).setView([lat, lng], 14);
  L.tileLayer(OSM, { attribution: ATTRIBUTION, maxZoom: 18 }).addTo(map);
  L.circle([lat, lng], { radius: APPROX_MAX_METERS, color: "var(--brand)", weight: 2, fillColor: "var(--brand)", fillOpacity: 0.18 }).addTo(map);
  return () => map.remove();
}
