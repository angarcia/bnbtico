// Los precios del mapa de Explorar mientras llega Leaflet (revisión UX 2026-10-29, C2): en Safari la caja salía lisa y
// vacía hasta 2,4 s. Trozo diferido pequeño, pedido al montar la caja (Leaflet pesa 43 KB).
import { EXPLORE_MAP } from "../domain/geo";
import { groupLabel, groupPins } from "../domain/map-pins";
import type { MapMarker } from "./explore-map";

/** Mientras llega Leaflet, los precios sobre el fondo de la caja, ya juntos si se pisan: una proyección lineal de los
 *  puntos con el mismo relleno que el encuadre (en un trozo tan pequeño del mapa, casi donde Leaflet los pondrá). */
export function PricePreview({ markers, width, height }: { markers: MapMarker[]; width: number; height: number }) {
  if (!markers.length || !width) return null;
  const [padX, padY] = EXPLORE_MAP.padding;
  const lats = markers.map((m) => m.lat);
  const lngs = markers.map((m) => m.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const at = (v: number, min: number, max: number, size: number, pad: number) => (max === min ? size / 2 : pad + ((v - min) / (max - min)) * (size - 2 * pad));
  const pins = markers.map((m) => ({ id: m.publicId, label: m.label, x: at(m.lng, minLng, maxLng, width, padX), y: at(maxLat - m.lat + minLat, minLat, maxLat, height, padY) }));
  const byId = new Map(markers.map((m) => [m.publicId, m]));
  return (
    <div className="map-preview" aria-hidden="true">
      {groupPins(pins).map((g) => (
        // La posición por CSSOM: sin atributos style (CSP style-src 'self').
        <span key={g.ids.join()} className={`map-price${g.ids.length > 1 ? " is-group" : ""}`} ref={(el) => void (el && Object.assign(el.style, { left: `${g.x}px`, top: `${g.y}px` }))}>
          <span>{g.ids.length > 1 ? groupLabel(g.ids.length) : byId.get(g.ids[0]!)!.label}</span>
        </span>
      ))}
    </div>
  );
}

