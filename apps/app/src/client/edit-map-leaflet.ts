// Mapa de la revisión de una edición (zona del admin): el punto aprobado y el nuevo con el nombre de su zona. Se carga bajo
// demanda al abrir la revisión; Leaflet va en su trozo compartido, no en el JS inicial.
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const OSM = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

type Point = { lat: number; lng: number; label: string };

/** La etiqueta como nodo de texto: la zona la escribe el propietario y nunca se interpreta como HTML. */
const text = (s: string) => {
  const el = document.createElement("span");
  el.textContent = s;
  return el;
};

export function drawTwoPoints(el: HTMLElement, before: Point, after: Point): () => void {
  const map = L.map(el, { zoomControl: false, dragging: false, touchZoom: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false });
  L.tileLayer(OSM, { attribution: ATTRIBUTION, maxZoom: 18 }).addTo(map);
  const dot = (p: Point, color: string, prefix: string, direction: "left" | "right") =>
    L.circleMarker([p.lat, p.lng], { radius: 8, color: "#FFFBF2", weight: 2, fillColor: color, fillOpacity: 1 })
      .bindTooltip(text(`${prefix}: ${p.label}`), { permanent: true, direction, offset: [direction === "left" ? -10 : 10, 0] })
      .addTo(map);
  const westFirst = before.lng <= after.lng;
  dot(before, "#5C6B69", "Antes", westFirst ? "left" : "right");
  dot(after, "#2F5D45", "Ahora", westFirst ? "right" : "left");
  map.fitBounds(L.latLngBounds([before.lat, before.lng], [after.lat, after.lng]), { padding: [60, 40], maxZoom: 14, animate: false });
  return () => map.remove();
}
