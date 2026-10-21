"use client";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { I } from "@/components/icons";
import { JITTER_METERS } from "@/lib/listings/geo";

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

/** Pantalla 12: pin terracota arrastrable con el círculo de ~500 m, píldora «Arrastre el pin» y «Usar mi ubicación». */
export function LocationPicker({ province, lat, lng }: { province: string; lat: number | null; lng: number | null }) {
  const box = useRef<HTMLDivElement>(null);
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(lat !== null && lng !== null ? { lat, lng } : null);
  const placeRef = useRef<(p: { lat: number; lng: number }) => void>(() => {});

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
      let circle: import("leaflet").Circle | null = null;
      const place = (p: { lat: number; lng: number }) => {
        const rounded = { lat: Number(p.lat.toFixed(6)), lng: Number(p.lng.toFixed(6)) };
        setPoint(rounded);
        if (!marker) {
          marker = L.marker([p.lat, p.lng], { draggable: true, icon }).addTo(map!);
          marker.on("dragend", () => place(marker!.getLatLng()));
          circle = L.circle([p.lat, p.lng], { radius: JITTER_METERS, color: "#2F5D45", weight: 1.5, fillColor: "#2F5D45", fillOpacity: 0.14 }).addTo(map!);
        } else {
          marker.setLatLng([p.lat, p.lng]);
          circle?.setLatLng([p.lat, p.lng]);
        }
        if (map!.getZoom() < 13) map!.setView([p.lat, p.lng], 13, { animate: false }); // sin animación: desmontar en mitad de un zoom rompe Leaflet
      };
      placeRef.current = place;
      if (point) place(point);
      map.on("click", (e) => place(e.latlng));
    })();
    return () => {
      disposed = true;
      map?.remove();
    };
    // Solo al montar: la provincia inicial decide el encuadre; después manda el pin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const locate = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => placeRef.current({ lat: pos.coords.latitude, lng: pos.coords.longitude }), () => {}, { enableHighAccuracy: true, timeout: 8000 });
  };

  return (
    <div className="stack" style={{ gap: 8 }}>
      <span className="eyebrow" style={{ textTransform: "none", letterSpacing: 0, fontSize: 12 }}>Ubicación en el mapa</span>
      <div style={{ position: "relative" }}>
        <div ref={box} className="map-box" role="application" aria-label="Mapa para marcar la ubicación aproximada" />
        <span className="pill pill-sm" style={{ left: 12, bottom: 12, zIndex: 500 }}>{point ? "Arrastre el pin" : "Toque el mapa"}</span>
        <button type="button" className="icon-btn overlay" aria-label="Usar mi ubicación" onClick={locate} style={{ position: "absolute", right: 10, bottom: 10, zIndex: 500, boxShadow: "var(--shadow)", color: "var(--primary)" }}><I.locate /></button>
      </div>
      <input type="hidden" name="lat" value={point?.lat ?? ""} />
      <input type="hidden" name="lng" value={point?.lng ?? ""} />
      <span className="small muted">En la ficha mostramos solo una zona aproximada de unos 500 m. La dirección exacta la comparte usted por WhatsApp cuando quiera.</span>
    </div>
  );
}
