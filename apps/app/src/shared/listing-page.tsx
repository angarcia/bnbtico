// Ficha pública (pantalla 03 del diseño v1). La renderiza el worker y la hidrata el navegador: el mapa y la moneda
// dependen del navegador y se montan después de hidratar, en cajas de tamaño fijo.
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { describe } from "../domain/describe";
import { FEATURE_SHORT, modesLabel, type Feature, type PublicListing } from "../domain/listing";
import { formatCRC, formatMoney, formatUSD, FX_CRC_PER_USD } from "../domain/money";
import { ApproxMap } from "./approx-map";
import { setCurrency, useCurrency } from "./currency";
import { FavoriteButton } from "./favorite-button";
import { HeroGallery } from "./hero-gallery";
import { useHydrated } from "./hydration";
import { I, type IconName } from "./icons";
import { listingQuery } from "./listing-query";
import { ShareButton } from "./share-button";
import { track } from "./beacon";
import { BlockedPage } from "./status-pages";

const FEATURE_ICON: Record<Feature, IconName> = { pool: "pool", pets: "pets", wifi: "wifi", ac: "ac", parking: "parking", ev: "ev", kids_free: "kids", beachfront: "beach", bbq: "bbq" };
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export interface ListingSeed {
  listing: PublicListing;
  updatedAt: number;
}

/** La ficha a partir de la caché de Query: sembrada por el worker (SSR) o, al abrirla desde una tarjeta, con la fila del
 *  listado (`seed`), que se pinta antes de que responda su propia petición. */
export function ListingScreen({ publicId, base, seed, onBack }: { publicId: string; base: string; seed?: ListingSeed; onBack?: () => void }) {
  const { data } = useQuery({ ...listingQuery(publicId), initialData: seed?.listing, initialDataUpdatedAt: seed?.updatedAt });
  if (data === null) return <BlockedPage />;
  if (!data) return null;
  return <ListingPage listing={data} base={base} onBack={onBack} />;
}

/** Cambio de moneda. Ocupa siempre lo mismo (las dos cifras apiladas, la que no se ve queda oculta debajo): cambiar de moneda
 *  o hidratar no mueve la barra. Antes de hidratar no es un botón (no haría nada): solo el hueco. */
function PriceToggle({ amountCrc, hydrated }: { amountCrc: number; hydrated: boolean }) {
  const currency = useCurrency();
  const other = currency === "CRC" ? "USD" : "CRC";
  const usd = `≈ ${formatUSD(amountCrc)}`;
  const crc = `≈ ${formatCRC(amountCrc)}`;
  if (!hydrated) {
    return (
      <span className="link xs both" aria-hidden="true">
        <span className="ghost">{usd}</span>
        <span className="ghost">{crc}</span>
      </span>
    );
  }
  return (
    <button type="button" className="link xs both" onClick={() => setCurrency(other)} aria-label={other === "USD" ? "Ver en dólares" : "Ver en colones"} title={`≈ ₡${FX_CRC_PER_USD} por US$1`}>
      <span>{other === "USD" ? usd : crc}</span>
      <span className="ghost" aria-hidden="true">
        {other === "USD" ? crc : usd}
      </span>
    </button>
  );
}

/** La barra fija tapa el final de la página: el espaciador mide lo mismo que ella (menos el margen inferior de la vista). */
function useSpacerMatchingBar() {
  const bar = useRef<HTMLDivElement>(null);
  const spacer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const b = bar.current;
    const s = spacer.current;
    if (!b || !s || typeof ResizeObserver === "undefined") return;
    const fit = () => (s.style.height = `calc(${b.offsetHeight}px - 16px - env(safe-area-inset-bottom))`);
    const observer = new ResizeObserver(fit);
    observer.observe(b);
    return () => observer.disconnect();
  }, []);
  return { bar, spacer };
}

export function ListingPage({ listing: l, base, onBack }: { listing: PublicListing; base: string; onBack?: () => void }) {
  const hydrated = useHydrated();
  const currency = useCurrency();
  const d = describe(l, { base });
  useEffect(() => track("listing_view", l.publicId), [l.publicId]);
  const main = d.mainPrice;
  const { bar, spacer } = useSpacerMatchingBar();
  return (
    <div className="app">
      <main className="view no-nav listing-view">
        <HeroGallery photos={l.photos} title={l.title}>
          <a
            href="/explorar"
            aria-label="Volver a Explorar"
            className="icon-btn overlay"
            onClick={
              onBack
                ? (e) => {
                    e.preventDefault();
                    onBack();
                  }
                : undefined
            }
          >
            <I.back />
          </a>
          {/* Compartir y el corazón dependen del navegador: antes de hidratar, solo sus cajas (mismo tamaño). */}
          <div className="row gap-8">
            {hydrated ? <ShareButton url={d.shareUrl} title={l.title} text={d.previewText} /> : <span className="icon-btn" aria-hidden="true" />}
            {hydrated ? <FavoriteButton publicId={l.publicId} className="heart-hero" size={20} /> : <span className="icon-btn" aria-hidden="true" />}
          </div>
        </HeroGallery>

        <div className="stack listing-body">
          <div className="row wrap gap-8">
            {l.ownerWhatsappVerified ? (
              <span className="badge badge-ok">
                <I.check size={14} /> WhatsApp verificado
              </span>
            ) : null}
            <span className="badge">{modesLabel(l)}</span>
            {l.kind === "habitacion" ? <span className="badge">Habitación{l.bathroomShared === null ? "" : l.bathroomShared ? " · baño compartido" : " · baño privado"}</span> : null}
            {!l.available ? <span className="badge badge-sun">No disponible por ahora</span> : null}
          </div>
          <div className="stack gap-4">
            <h1 className="listing-title">{l.title}</h1>
            <span className="row muted gap-6">
              <I.pin size={18} /> {[l.zone, l.canton].filter(Boolean).join(", ")} · ubicación aproximada
            </span>
            <span className="small muted">
              {plural(l.capacity, "persona", "personas")} · {plural(l.bedrooms, "habitación", "habitaciones")} · {plural(l.bathrooms, "baño", "baños")}
            </span>
          </div>
          <p className="listing-description">{l.description}</p>

          {l.features.length ? (
            <div className="feature-tiles">
              {l.features.map((f) => {
                const Icon = I[FEATURE_ICON[f]];
                return (
                  <div key={f}>
                    <Icon size={22} />
                    {f === "parking" && l.parkingPaid !== null ? `Parqueo ${l.parkingPaid ? "de pago" : "gratis"}` : FEATURE_SHORT[f]}
                  </div>
                );
              })}
            </div>
          ) : null}

          {l.approx ? (
            <div className="stack gap-8">
              <span className="eyebrow">Zona aproximada</span>
              {hydrated ? <ApproxMap lat={l.approx.lat} lng={l.approx.lng} /> : <div className="map-box map-box-listing" aria-hidden="true" />}
            </div>
          ) : null}

          <p className="small muted">
            Publicada por <b className="ink">{l.ownerName}</b>
            {l.ownerWhatsappVerified ? " · WhatsApp verificado" : ""}. Sin comisiones: fechas, precio y pago los acuerda directamente con el propietario. bnbtico no procesa pagos.
          </p>
        </div>

        <div className="cta-spacer" aria-hidden="true" ref={spacer} />
        <div className="cta-bar" ref={bar}>
          {main ? (
            <div className="row between wrap baseline gap-4">
              <span className="price both">
                <span data-testid="main-price">
                  {formatMoney(main.amount, currency)} <small>/ {main.unit}</small>
                </span>
                <span className="ghost" aria-hidden="true">
                  {formatMoney(main.amount, currency === "CRC" ? "USD" : "CRC")} <small>/ {main.unit}</small>
                </span>
              </span>
              <span className="xs muted price-note">
                <PriceToggle amountCrc={main.amount} hydrated={hydrated} /> · el precio final lo acuerda con el propietario
              </span>
            </div>
          ) : null}
          {d.secondaryPrice ? (
            <span className="xs muted">
              Mensual: <b className="ink num">{formatMoney(d.secondaryPrice.amount, currency)}</b> / mes
            </span>
          ) : null}
          {/* Marcador: cuando el contacto funcione, este toque ya cuenta (evento whatsapp_tap). */}
          <button className="btn btn-wa" type="button" disabled onClick={() => track("whatsapp_tap", l.publicId)}>
            <I.wa size={22} /> Contactar por WhatsApp <small className="btn-note">· disponible pronto</small>
          </button>
        </div>
      </main>
    </div>
  );
}
