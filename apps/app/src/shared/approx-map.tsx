import { useEffect, useRef } from "react";

/** Círculo de ~500 m sobre OpenStreetMap, sin pin. La caja tiene tamaño fijo: el mapa aparece sin mover la página. */
export function ApproxMap({ lat, lng }: { lat: number; lng: number }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let dispose: (() => void) | null = null;
    let cancelled = false;
    import("./approx-map-leaflet").then(({ drawApproxMap }) => {
      if (!cancelled && box.current) dispose = drawApproxMap(box.current, lat, lng);
    });
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [lat, lng]);
  return (
    <div className="stack gap-6">
      <div ref={box} className="map-box map-box-listing" role="img" aria-label="Mapa con la zona aproximada" data-testid="approx-map" />
      <p className="xs muted">Ubicación aproximada. La dirección exacta la comparte el propietario.</p>
    </div>
  );
}
