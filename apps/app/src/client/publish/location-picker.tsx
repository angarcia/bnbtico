import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { PROVINCE_CENTERS, roundPoint, type LatLng } from "../../domain/geo";
import { DEFAULT_PROVINCE } from "../../domain/listing";
import type { PickerMap } from "./location-leaflet";

const Locate = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </svg>
);

/** Lo que la pantalla puede pedirle al mapa: moverlo (el buscador) sin tocar el pin, y su centro (null hasta que carga). */
export interface PickerHandle {
  view(p: LatLng, zoom: number): void;
  center(): LatLng | null;
}

/** Mapa del paso 2: pin arrastrable con el círculo de ~500 m y «Usar mi ubicación». Abre en el pin o, sin pin, en Limón
 *  (Caribe por defecto). Cada toque o arrastre que deja el pin en Costa Rica llama a `onPick` con el punto redondeado.
 *  `readOnly`: el pin no se mueve y no hay «Usar mi ubicación». */
export function LocationPicker({ lat, lng, onPick, readOnly = false, ref }: { lat: number | null; lng: number | null; onPick: (p: LatLng) => void; readOnly?: boolean; ref?: Ref<PickerHandle> }) {
  const box = useRef<HTMLDivElement>(null);
  const picker = useRef<PickerMap | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;
  useImperativeHandle(ref, () => ({ view: (p, zoom) => picker.current?.view(p, zoom), center: () => picker.current?.center() ?? null }), []);

  useEffect(() => {
    let cancelled = false;
    const point = lat !== null && lng !== null ? { lat, lng } : null;
    import("./location-leaflet").then(({ drawPicker }) => {
      if (cancelled || !box.current) return;
      picker.current = drawPicker(box.current, { point, center: PROVINCE_CENTERS[DEFAULT_PROVINCE]!, zoom: 9 }, (p) => pick.current(roundPoint(p)), readOnly);
    });
    return () => {
      cancelled = true;
      picker.current?.dispose();
      picker.current = null;
    };
    // Solo al montar: el pin inicial decide el encuadre; después manda el pin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const locate = () =>
    navigator.geolocation?.getCurrentPosition((pos) => picker.current?.place({ lat: pos.coords.latitude, lng: pos.coords.longitude }), () => undefined, { enableHighAccuracy: true, timeout: 8000 });

  return (
    <div className="map-wrap">
      <div ref={box} className="map-box" role="application" aria-label="Mapa para marcar la ubicación aproximada" />
      {readOnly ? null : (
        <button type="button" className="icon-btn overlay map-locate" aria-label="Usar mi ubicación" onClick={locate}>
          <Locate />
        </button>
      )}
    </div>
  );
}
