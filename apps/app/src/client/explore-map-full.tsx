// El mapa de Explorar a pantalla completa (maqueta v2 05, `?mapa=1`): trozo diferido que se pide al abrirlo. Arriba,
// «Volver a la lista», la píldora de búsqueda y los filtros; abajo, «N casas» para volver y, con un marcador tocado, la
// tarjeta compacta de su casa. La lista sigue montada debajo: al volver conserva su posición.
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";
import { NEGOTIABLE_CARD, cardPrice, describe } from "../domain/describe";
import type { LatLng } from "../domain/geo";
import type { PublicListing } from "../domain/listing";
import { formatMoney } from "../domain/money";
import { housesCount } from "../domain/search";
import { track } from "../shared/beacon";
import { useCurrency } from "../shared/currency";
import { FavoriteButton } from "../shared/favorite-button";
import { useFx } from "../shared/fx";
import { I } from "../shared/icons";
import { Picture } from "../shared/picture";
import { useExploreMap, useMapMarkers } from "./explore-map";

export function MapScreen({ listings, zone, monthly, selected, onSelect, onClose, header }: { listings: PublicListing[]; zone: LatLng | null; monthly: boolean; selected: string | null; onSelect(id: string | null): void; onClose(): void; header: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const markers = useMapMarkers(listings, monthly);
  const handle = useExploreMap(
    box,
    {
      interactive: true,
      onMarker: (id) => {
        track("map_marker_tap", id);
        onSelect(id);
      },
      onMap: () => onSelect(null),
    },
    markers,
    zone,
  );
  useEffect(() => {
    handle.current?.select(selected);
  });
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("map-open");
    return () => root.classList.remove("map-open");
  }, []);
  const house = selected ? listings.find((l) => l.publicId === selected) : undefined;
  return (
    <div className="map-full">
      <div ref={box} className="map-full-box" />
      <div className="map-full-top">
        <button type="button" className="map-round" aria-label="Volver a la lista" onClick={onClose}>
          <I.back />
        </button>
        {header}
      </div>
      {house ? <MapCard listing={house} monthly={monthly} /> : null}
      <button type="button" className="map-count" onClick={onClose}>
        <I.list size={20} />
        {housesCount(listings.length)}
      </button>
    </div>
  );
}

/** La casa del marcador tocado: foto cuadrada a la izquierda, nombre, zona, precio y el corazón (fuera del enlace). */
function MapCard({ listing: l, monthly }: { listing: PublicListing; monthly: boolean }) {
  const currency = useCurrency();
  const fx = useFx(currency === "USD");
  const cover = l.photos[0];
  const price = cardPrice(describe(l, { base: "" }), monthly);
  return (
    <div className="map-card">
      <Link to="/casa/$publicId" params={{ publicId: l.publicId }} className="map-card-link">
        <div className="photo">{cover ? <Picture photo={cover} alt="" sizes="96px" width={96} height={96} /> : null}</div>
        <div className="map-card-text">
          <h2>{l.title}</h2>
          <span className="muted">{l.zone}</span>
          {price ? (
            <span className="card-price num">
              {"negotiable" in price ? (
                NEGOTIABLE_CARD
              ) : (
                <>
                  <b>{formatMoney(price.amount, currency, fx.crcPerUsd)}</b> <span className="muted">/ {price.unit}</span>
                </>
              )}
            </span>
          ) : null}
        </div>
      </Link>
      <FavoriteButton publicId={l.publicId} className="heart-card" size={24} />
    </div>
  );
}
