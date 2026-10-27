import { useEffect, useRef, useState } from "react";
import { PROVINCE_CENTERS, roundPoint, type LatLng } from "../../domain/geo";
import { ZONE_ZOOM } from "../../domain/zones";
import { DEFAULT_PROVINCE } from "../../domain/listing";
import type { PickerMap } from "./location-leaflet";

const Locate = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </svg>
);

/** Pantalla 3: pin arrastrable con el círculo de ~500 m, «Toque el mapa» / «Arrastre el pin» y «Usar mi ubicación». Sin pin,
 *  abre con zoom en la zona elegida en el paso 2 (`zone`, ticket 22) o, si no hay, en la provincia. */
export function LocationPicker({ province, lat, lng, zone }: { province: string; lat: number | null; lng: number | null; zone: LatLng | null }) {
  const box = useRef<HTMLDivElement>(null);
  const picker = useRef<PickerMap | null>(null);
  const [point, setPoint] = useState<LatLng | null>(lat !== null && lng !== null ? { lat, lng } : null);

  useEffect(() => {
    let cancelled = false;
    const center = zone ?? PROVINCE_CENTERS[province] ?? PROVINCE_CENTERS[DEFAULT_PROVINCE]!;
    import("./location-leaflet").then(({ drawPicker }) => {
      if (cancelled || !box.current) return;
      picker.current = drawPicker(box.current, { point, center, zoom: zone ? ZONE_ZOOM : 9 }, (p) => setPoint(roundPoint(p)));
    });
    return () => {
      cancelled = true;
      picker.current?.dispose();
      picker.current = null;
    };
    // Solo al montar: la provincia y el pin iniciales deciden el encuadre; después manda el pin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const locate = () =>
    navigator.geolocation?.getCurrentPosition((pos) => picker.current?.place({ lat: pos.coords.latitude, lng: pos.coords.longitude }), () => undefined, { enableHighAccuracy: true, timeout: 8000 });

  return (
    <div className="stack grow-col gap-8">
      <div className="map-wrap">
        <div ref={box} className="map-box" role="application" aria-label="Mapa para marcar la ubicación aproximada" />
        <span className="pill pill-sm map-hint">{point ? "Arrastre el pin" : "Toque el mapa"}</span>
        <button type="button" className="icon-btn overlay map-locate" aria-label="Usar mi ubicación" onClick={locate}>
          <Locate />
        </button>
      </div>
      <input type="hidden" name="lat" value={point?.lat ?? ""} />
      <input type="hidden" name="lng" value={point?.lng ?? ""} />
      <span className="small muted">En la ficha solo se ve una zona aproximada de unos 500 m; la dirección exacta la da usted por WhatsApp.</span>
    </div>
  );
}
