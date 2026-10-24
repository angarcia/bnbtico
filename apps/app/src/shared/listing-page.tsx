// Ficha pública (pantalla 03 del diseño v1). La renderiza el worker y la hidrata el navegador: el mapa y la moneda
// dependen del navegador y se montan después de hidratar, en cajas de tamaño fijo.
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { Currency } from "../domain/currency";
import { reopenLabel } from "../domain/dates";
import { describe } from "../domain/describe";
import { FEATURE_SHORT, modesLabel, type Feature, type PublicListing } from "../domain/listing";
import { formatCRC, formatMoney, formatUSD, FX_CRC_PER_USD } from "../domain/money";
import { ApproxMap } from "./approx-map";
import { setCurrency, useCurrency } from "./currency";
import { FavoriteButton } from "./favorite-button";
import { HeroGallery } from "./hero-gallery";
import { useHydrated } from "./hydration";
import { I, type IconName } from "./icons";
import { whenIdle } from "./idle";
import { listingDaysQuery, listingQuery } from "./listing-query";
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
export function ListingScreen({ publicId, base, seed, onBack, navigate, openContact }: { publicId: string; base: string; seed?: ListingSeed; onBack?: () => void; navigate?: Navigate; openContact?: boolean }) {
  const { data } = useQuery({ ...listingQuery(publicId), initialData: seed?.listing, initialDataUpdatedAt: seed?.updatedAt });
  if (data === null) return <BlockedPage />;
  if (!data) return null;
  return <ListingPage listing={data} base={base} onBack={onBack} navigate={navigate} openContact={openContact} />;
}

/** Ir a otra ruta: el router en la SPA; en la ficha del servidor (sin router), navegación completa. */
type Navigate = (href: string) => void;
const fullNavigation: Navigate = (href) => location.assign(href);

// La hoja de contacto es un trozo aparte: se pide al tocar el botón y, en reposo, tras hidratar.
const loadSheet = () => import("./contact-sheet");
const ContactSheet = lazy(() => loadSheet().then((m) => ({ default: m.ContactSheet })));

/** El botón de la barra. Mide lo mismo antes y después de hidratar: antes es una caja apagada que aún no responde.
 *  `openOnMount`: la ficha de la SPA al volver de Ingresar con lo escrito (`?contacto=1`). */
function ContactButton({ listing, hydrated, navigate, openOnMount }: { listing: PublicListing; hydrated: boolean; navigate: Navigate; openOnMount?: boolean }) {
  const [open, setOpen] = useState(!!openOnMount);
  const button = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  useEffect(() => {
    if (hydrated && listing.available) whenIdle(() => void loadSheet());
  }, [hydrated, listing.available]);
  // El foco vuelve al botón cuando la hoja ya se desmontó y la página dejó de estar inerte.
  useEffect(() => {
    if (open || !returnFocus.current) return;
    returnFocus.current = false;
    button.current?.focus();
  }, [open]);

  if (!listing.available) {
    const reopen = reopenLabel(listing.reopenAt);
    return (
      <>
        <button className="btn btn-wa" type="button" disabled>
          <I.wa size={22} /> No disponible para consultas
        </button>
        {reopen ? <span className="xs muted cta-note">{reopen}</span> : null}
      </>
    );
  }
  if (!hydrated) {
    return (
      <span className="btn btn-wa is-pending" aria-hidden="true">
        <I.wa size={22} /> Contactar por WhatsApp
      </span>
    );
  }
  return (
    <>
      <button
        ref={button}
        className="btn btn-wa"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          track("whatsapp_tap", listing.publicId);
          setOpen(true);
        }}
      >
        <I.wa size={22} /> Contactar por WhatsApp
      </button>
      {open ? (
        // Mientras llega el trozo de la hoja, la página ya se atenúa: el toque responde al instante.
        <Suspense fallback={<div className="sheet-backdrop" />}>
          <ContactSheet
            listing={listing}
            navigate={navigate}
            onClose={() => {
              returnFocus.current = true;
              setOpen(false);
            }}
          />
        </Suspense>
      ) : null}
    </>
  );
}

// El calendario de la ficha es un trozo aparte: se pide tras hidratar, en reposo o al acercarse la sección a la vista.
const loadCalendar = () => import("./listing-calendar");
const ListingCalendar = lazy(() => loadCalendar().then((m) => ({ default: m.ListingCalendar })));

/** «Disponibilidad». En el HTML del servidor solo la caja, de alto fijo (sin la rejilla: los días van en ssr-data); la
 *  rejilla se monta dentro tras hidratar. Una casa cerrada a consultas muestra «Calendario cerrado» ya en el servidor. */
function Availability({ listing, currency }: { listing: PublicListing; currency: Currency }) {
  const box = useRef<HTMLDivElement>(null);
  const [load, setLoad] = useState(false);
  // Días que no se pudieron leer (null del servidor, o la consulta de la SPA falló): sin sección, ni caja ni error.
  const days = useQuery({ ...listingDaysQuery(listing.publicId), enabled: listing.available });
  const missing = days.data === null || days.isError;
  useEffect(() => {
    if (!listing.available || missing) return;
    const el = box.current;
    const start = () => setLoad(true);
    whenIdle(start);
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && start(), { rootMargin: "600px 0px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [listing.available, missing]);
  if (listing.available && missing) return null;
  const reopen = listing.available ? null : reopenLabel(listing.reopenAt);
  return (
    <div className="stack gap-8">
      <span className="eyebrow">Disponibilidad</span>
      {listing.available ? (
        <div className="listing-calendar" ref={box} aria-hidden={load ? undefined : "true"}>
          {load ? (
            <Suspense fallback={null}>
              <ListingCalendar listing={listing} currency={currency} />
            </Suspense>
          ) : null}
        </div>
      ) : (
        <div className="note note-arena note-col">
          <b>Calendario cerrado</b>
          {reopen ? <span className="small">{reopen}</span> : null}
        </div>
      )}
    </div>
  );
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

export function ListingPage({ listing: l, base, onBack, navigate = fullNavigation, openContact }: { listing: PublicListing; base: string; onBack?: () => void; navigate?: Navigate; openContact?: boolean }) {
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

          <Availability listing={l} currency={currency} />

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
          <ContactButton listing={l} hydrated={hydrated} navigate={navigate} openOnMount={openContact} />
        </div>
      </main>
    </div>
  );
}
