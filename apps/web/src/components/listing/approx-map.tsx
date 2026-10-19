"use client";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { JITTER_METERS } from "@/lib/listings/geo";

const OSM = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Círculo de ~500 m sobre OpenStreetMap, sin pin: la ubicación exacta la comparte el propietario. */
export function ApproxMap({ lat, lng }: { lat: number; lng: number }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let disposed = false;
    let map: import("leaflet").Map | null = null;
    (async () => {
      const L = (await import("leaflet")).default;
      if (disposed || !box.current) return;
      map = L.map(box.current, { zoomControl: false, dragging: false, scrollWheelZoom: false, touchZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false }).setView([lat, lng], 14);
      L.tileLayer(OSM, { attribution: ATTRIBUTION, maxZoom: 18 }).addTo(map);
      L.circle([lat, lng], { radius: JITTER_METERS, color: "#D92349", weight: 2, fillColor: "#D92349", fillOpacity: 0.18 }).addTo(map);
    })();
    return () => {
      disposed = true;
      map?.remove();
    };
  }, [lat, lng]);
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div ref={box} className="map-box" style={{ height: 180 }} role="img" aria-label="Mapa con la zona aproximada" />
      <p className="xs muted">Ubicación aproximada. La dirección exacta la comparte el propietario.</p>
    </div>
  );
}
