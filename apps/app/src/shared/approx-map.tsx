import { useEffect, useRef } from "react";
import * as LISTING_PARTS_COPY from "./copy/listing-parts";

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
      <div ref={box} className="map-box map-box-listing" role="img" aria-label={LISTING_PARTS_COPY.approxMap} data-testid="approx-map" />
      <p className="xs muted">{LISTING_PARTS_COPY.approxNote}</p>
    </div>
  );
}
