"use client";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";

/** Centro inicial del mapa por provincia (sin pin), zoom 9. Con pin, zoom 13. */
export const PROVINCE_CENTERS: Record<string, [number, number]> = {
  Limón: [9.98, -83.03],
  Guanacaste: [10.63, -85.44],
  Puntarenas: [9.98, -84.84],
  Alajuela: [10.02, -84.21],
  "San José": [9.93, -84.08],
  Heredia: [10.0, -84.12],
  Cartago: [9.86, -83.92],
};

const OSM = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Pin arrastrable sobre OpenStreetMap. Escribe lat/lng en campos ocultos del formulario. */
export function LocationPicker({ province, lat, lng }: { province: string; lat: number | null; lng: number | null }) {
  const box = useRef<HTMLDivElement>(null);
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(lat !== null && lng !== null ? { lat, lng } : null);

  useEffect(() => {
    let disposed = false;
    let map: import("leaflet").Map | null = null;
    (async () => {
      const L = (await import("leaflet")).default;
      if (disposed || !box.current) return;
      const center = point ? [point.lat, point.lng] : (PROVINCE_CENTERS[province] ?? PROVINCE_CENTERS["Limón"]);
      map = L.map(box.current, { zoomControl: true, attributionControl: true }).setView(center as [number, number], point ? 13 : 9);
      L.tileLayer(OSM, { attribution: ATTRIBUTION, maxZoom: 18 }).addTo(map);
      const icon = L.divIcon({ className: "pin-icon", html: "<span></span>", iconSize: [26, 26], iconAnchor: [13, 26] });
      let marker: import("leaflet").Marker | null = null;
      const place = (p: { lat: number; lng: number }) => {
        setPoint({ lat: Number(p.lat.toFixed(6)), lng: Number(p.lng.toFixed(6)) });
        if (!marker) {
          marker = L.marker([p.lat, p.lng], { draggable: true, icon }).addTo(map!);
          marker.on("dragend", () => place(marker!.getLatLng()));
        } else marker.setLatLng([p.lat, p.lng]);
      };
      if (point) place(point);
      map.on("click", (e) => {
        place(e.latlng);
        if (map!.getZoom() < 13) map!.setView(e.latlng, 13, { animate: false }); // sin animación: desmontar en mitad de un zoom rompe Leaflet
      });
    })();
    return () => {
      disposed = true;
      map?.remove();
    };
    // Solo al montar: la provincia inicial decide el encuadre; después manda el pin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="stack" style={{ gap: 6 }}>
      <span className="eyebrow">Ubicación aproximada *</span>
      <div ref={box} className="map-box" role="application" aria-label="Mapa para marcar la ubicación aproximada" />
      <input type="hidden" name="lat" value={point?.lat ?? ""} />
      <input type="hidden" name="lng" value={point?.lng ?? ""} />
      <p className="xs muted">{point ? "Pin colocado. Arrastralo si hace falta." : "Tocá el mapa para colocar el pin."} Mostramos una zona aproximada (radio ~500 m). La dirección exacta solo la compartís vos cuando lo decidás.</p>
    </div>
  );
}
