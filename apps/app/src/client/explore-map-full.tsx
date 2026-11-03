// El mapa de Explorar a pantalla completa (maqueta v2 05, `?mapa=1`): trozo diferido que se pide al abrirlo. Arriba,
// «Volver a la lista», la píldora de búsqueda y los filtros; abajo, «N casas» para volver y, con un marcador tocado, la
// tarjeta compacta de su casa. La lista sigue montada debajo: al volver conserva su posición.
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";
import { cardPrice, describe } from "../domain/describe";
import type { LatLng } from "../domain/geo";
import type { PublicListing } from "../domain/listing";
import { formatMoney } from "../domain/money";
import { housesCount, stayTotalLabel } from "../domain/search";
import { track } from "../shared/beacon";
import { useCurrency } from "../shared/currency";
import { FavoriteButton } from "../shared/favorite-button";
import { useFx } from "../shared/fx";
import { I } from "../shared/icons";
import { Picture } from "../shared/picture";
import { useExploreMap, useMapMarkers } from "./explore-map";

export function MapScreen({ listings, zone, nights, selected, onSelect, onClose, header }: { listings: PublicListing[]; zone: LatLng | null; nights: number; selected: string | null; onSelect(id: string | null): void; onClose(): void; header: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  const markers = useMapMarkers(listings, nights);
  const { handle } = useExploreMap(
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
  // Mientras está abierto: la página no se mueve, lo de debajo no se enfoca ni se lee, y el foco empieza en «Volver».
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("map-open");
    const below = [...(overlay.current?.parentElement?.children ?? [])].filter((el): el is HTMLElement => el !== overlay.current && el instanceof HTMLElement && !el.inert);
    for (const el of below) el.inert = true;
    back.current?.focus({ preventScroll: true });
    return () => {
      root.classList.remove("map-open");
      for (const el of below) el.inert = false;
    };
  }, []);
  const house = selected ? listings.find((l) => l.publicId === selected) : undefined;
  return (
    <div ref={overlay} className="map-full">
      <div ref={box} className="map-full-box" />
      <div className="map-full-top">
        <button ref={back} type="button" className="map-round" aria-label="Volver a la lista" onClick={onClose}>
          <I.back />
        </button>
        {header}
      </div>
      {house ? <MapCard listing={house} nights={nights} /> : null}
      <button type="button" className="map-count" onClick={onClose}>
        <I.list size={20} />
        {housesCount(listings.length)}
      </button>
    </div>
  );
}

/** La casa del marcador tocado: foto cuadrada a la izquierda, nombre, zona, precio y el corazón (fuera del enlace). */
function MapCard({ listing: l, nights }: { listing: PublicListing; nights: number }) {
  const currency = useCurrency();
  const fx = useFx(currency === "USD");
  const cover = l.photos[0];
  const price = cardPrice(l, describe(l, { base: "" }).mainPrice, nights);
  return (
    <div className="map-card">
      <Link to="/casa/$publicId" params={{ publicId: l.publicId }} className="map-card-link">
        <div className="photo">{cover ? <Picture photo={cover} alt="" sizes="96px" width={96} height={96} /> : null}</div>
        <div className="map-card-text">
          <h2>{l.title}</h2>
          <span className="muted">{l.zone}</span>
          {price ? (
            <span className="card-price num">
              {"stayTotalCrc" in price ? (
                <b>{stayTotalLabel(price.stayTotalCrc, price.nights, currency, fx.crcPerUsd)}</b>
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
