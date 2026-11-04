// Ficha pública (pantalla 03 del diseño v1). La renderiza el worker y la hidrata el navegador: el mapa, compartir y el
// corazón dependen del navegador y se montan después de hidratar, en cajas de tamaño fijo. La barra de precios no depende
// de la moneda elegida (lleva las dos) y el tipo de cambio lo siembra el worker: el servidor y el navegador pintan lo mismo.
// Las fechas de la pestaña (ronda de Ana 2 nov, ticket 08) solo cuentan tras hidratar: el HTML del servidor no las conoce.
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { Currency } from "../domain/currency";
import { reopenLabel } from "../domain/dates";
import { capacityLine, describe, isNegotiable, type MonthlyPrice, type Price } from "../domain/describe";
import { FEATURE_SHORT, MONTHLY_LABEL, type Feature, type PublicListing } from "../domain/listing";
import { fxDayLabel, fxRateLabel, type FxRate } from "../domain/fx";
import { formatCRC, formatUSD } from "../domain/money";
import type { CalendarDay } from "../domain/calendar";
import { nightsLabel } from "../domain/stay-label";
import { ApproxMap } from "./approx-map";
import { useCurrency } from "./currency";
import { useFx } from "./fx";
import { FavoriteButton } from "./favorite-button";
import { HeroGallery } from "./hero-gallery";
import { MonthlyLine } from "./monthly-line";
import { firstName, initials } from "../domain/person";
import { isOwnListing } from "./own-listings";
import { useHydrated } from "./hydration";
import { I, type IconName } from "./icons";
import { whenIdle } from "./idle";
import { listingDaysQuery, listingQuery } from "./listing-query";
import { ShareButton } from "./share-button";
import { ListingDescription } from "./listing-description";
import { track } from "./beacon";
import { BlockedPage } from "./status-pages";
import type { BarStay } from "./listing-calendar";

const FEATURE_ICON: Record<Feature, IconName> = { pool: "pool", pets: "pets", wifi: "wifi", ac: "ac", parking: "parking", ev: "ev", kids_free: "kids", beachfront: "beach", bbq: "bbq" };
/** A partir de este largo el nombre no cabe en dos líneas a 30 px en un teléfono pequeño: va a 24 px. Por longitud (no
 *  midiendo en el navegador) para que el servidor y la hidratación pinten lo mismo (revisión UX C3). */
const LONG_TITLE = 38;

export interface ListingSeed {
  listing: PublicListing;
  updatedAt: number;
}

/** La ficha a partir de la caché de Query: sembrada por el worker (SSR) o, al abrirla desde una tarjeta, con la fila del
 *  listado (`seed`), que se pinta antes de que responda su propia petición. */
/** `openSheet`: la hoja de contacto abierta al llegar: «return» al volver de verificar (sigue sola hacia WhatsApp), «write»
 *  desde Favoritos (espera el toque). */
export type OpenSheet = "return" | "write";

export function ListingScreen({ publicId, base, seed, onBack, navigate, openSheet }: { publicId: string; base: string; seed?: ListingSeed; onBack?: () => void; navigate?: Navigate; openSheet?: OpenSheet }) {
  const { data } = useQuery({ ...listingQuery(publicId), initialData: seed?.listing, initialDataUpdatedAt: seed?.updatedAt });
  if (data === null) return <BlockedPage />;
  if (!data) return null;
  return <ListingPage listing={data} base={base} onBack={onBack} navigate={navigate} openSheet={openSheet} />;
}

/** Ir a otra ruta: el router en la SPA; en la ficha del servidor (sin router), navegación completa. */
type Navigate = (href: string) => void;
const fullNavigation: Navigate = (href) => location.assign(href);

// La hoja de contacto es un trozo aparte: se pide al tocar el botón y, en reposo, tras hidratar.
const loadSheet = () => import("./contact-sheet");
const ContactSheet = lazy(() => loadSheet().then((m) => ({ default: m.ContactSheet })));

/** El botón de la barra. Mide lo mismo antes y después de hidratar: antes es una caja apagada que aún no responde.
 *  `openOnMount`: la ficha de la SPA al volver de Ingresar con lo escrito (`?contacto=1`). */
/** `days`: los de la casa para la hoja (undefined mientras se leen, null si no se pudieron leer). */
function ContactButton({ listing, days, hydrated, navigate, openOnMount }: { listing: PublicListing; days: CalendarDay[] | null | undefined; hydrated: boolean; navigate: Navigate; openOnMount?: OpenSheet }) {
  const [open, setOpen] = useState(!!openOnMount);
  // Solo la hoja que reabre al volver de verificar sigue sola hacia WhatsApp; si se cierra, la siguiente espera el toque.
  const [autoSend, setAutoSend] = useState(openOnMount === "return");
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

  // «Vuelve a estar disponible el…» va en la tarjeta de precios (PriceCard).
  if (!listing.available) {
    return (
      <button className="btn btn-wa" type="button" disabled>
        <I.wa size={22} /> No disponible por ahora
      </button>
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
            days={days}
            navigate={navigate}
            autoSend={autoSend}
            onClose={() => {
              returnFocus.current = true;
              setAutoSend(false);
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
 *  rejilla se monta dentro tras hidratar. Una casa cerrada a consultas muestra «Calendario cerrado» ya en el servidor.
 *  `missing`: días que no se pudieron leer (null del servidor, o la consulta de la SPA falló): sin sección, ni caja ni error. */
function Availability({ listing, missing, currency, fx, onStay }: { listing: PublicListing; missing: boolean; currency: Currency; fx: number; onStay: (stay: BarStay | null) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [load, setLoad] = useState(false);
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
              <ListingCalendar listing={listing} currency={currency} fx={fx} onStay={onStay} />
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

/** Los precios de la barra de la ficha: colones a la izquierda, dólares a la derecha. Sin fechas, el precio por noche; con
 *  fechas, el total orientativo («≈ ₡285 000 / 3 noches») en la misma línea, y con 30 noches o más, debajo, el mensual (ronda
 *  de Ana 2 nov, ticket 08). No depende de la moneda elegida (densidad y tarjetas, 2026-10-29): lo mismo en el servidor y al
 *  hidratar, donde aún no hay fechas. */
function PriceColumns({ main, monthly, fx, stay }: { main: Price | null; monthly: MonthlyPrice | null; fx: FxRate; stay: BarStay | null }) {
  if (!main && !monthly) return null;
  const showMonthly = !!monthly && (!main || !!stay?.monthly);
  const monthlyAmount = showMonthly && monthly && !isNegotiable(monthly) ? monthly.amount : null;
  const rate = `Orientativo: ≈ ${fxRateLabel(fx.crcPerUsd)} por US$1, tipo de referencia del ${fxDayLabel(fx.day)}`;
  // Con fechas, el total de la estancia en lugar del precio por noche.
  const price = main && (stay ? { amount: stay.totalCrc, unit: nightsLabel(stay.nights) } : main);
  const is = stay ? " is-stay" : "";
  return (
    <div className="cta-prices">
      <div>
        {price ? (
          <span className={`price${is}`} data-testid="main-price">
            {/* Con fechas la cifra baja de tamaño dentro de la misma línea: la barra mide lo mismo. */}
            <span className="price-fig">
              {stay ? "≈ " : ""}
              {formatCRC(price.amount)} <small>/ {price.unit}</small>
            </span>
          </span>
        ) : null}
        {showMonthly && monthly ? <MonthlyLine monthly={monthly} format={formatCRC} /> : null}
      </div>
      {price || monthlyAmount !== null ? (
        <div className="cta-usd">
          {price ? (
            <span className={`price-usd${is}`} data-testid="price-usd" title={rate}>
              {`≈ ${formatUSD(price.amount, fx.crcPerUsd)}`} <small>/ {price.unit}</small>
            </span>
          ) : null}
          {monthlyAmount !== null ? (
            <span className="xs muted num" data-testid="monthly-usd" title={rate}>
              ≈ <b className="ink num">{formatUSD(monthlyAmount, fx.crcPerUsd)}</b> / mes
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** La barra fija tapa el final de la página: el espaciador mide lo mismo que ella más su separación del borde (12 px) y 8 px
 *  de aire, menos el margen inferior de la vista (16 px; el área segura la llevan los dos). */
function useSpacerMatchingBar() {
  const bar = useRef<HTMLDivElement>(null);
  const spacer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const b = bar.current;
    const s = spacer.current;
    if (!b || !s || typeof ResizeObserver === "undefined") return;
    const fit = () => (s.style.height = `calc(${b.getBoundingClientRect().height}px + var(--float-gap) + 8px - 16px)`);
    const observer = new ResizeObserver(fit);
    observer.observe(b);
    return () => observer.disconnect();
  }, []);
  return { bar, spacer };
}

/** `preview`: el borrador visto desde el asistente (revisión UX C4): sin balizas, sin compartir ni favorito, sin calendario
 *  (aún no es público) y con el botón de contacto a la vista pero apagado. */
export function ListingPage({ listing: l, base, onBack, navigate = fullNavigation, openSheet, preview }: { listing: PublicListing; base: string; onBack?: () => void; navigate?: Navigate; openSheet?: OpenSheet; preview?: boolean }) {
  const hydrated = useHydrated();
  const currency = useCurrency();
  const fx = useFx();
  const d = describe(l, { base });
  // Los días de la casa (en la caché: los trae el worker o la consulta de la ficha), para «Disponibilidad» y la hoja; null si
  // no se pudieron leer. El total de las fechas de la pestaña para la barra lo calcula el calendario, que se monta tras hidratar.
  const daysQuery = useQuery({ ...listingDaysQuery(l.publicId), enabled: l.available && !preview });
  const days = daysQuery.isError ? null : daysQuery.data;
  const [stay, setStay] = useState<BarStay | null>(null);
  useEffect(() => {
    // Ni la vista previa ni el propio dueño cuentan como visita (revisión UX A2).
    if (!preview && !isOwnListing(l.publicId)) track("listing_view", l.publicId);
  }, [l.publicId, preview]);
  const main = d.mainPrice;
  const reopen = l.available ? null : reopenLabel(l.reopenAt);
  const { bar, spacer } = useSpacerMatchingBar();
  return (
    <div className="app">
      <main className="view no-nav listing-view">
        <HeroGallery photos={l.photos} title={l.title}>
          {preview ? <span /> : (
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
          )}
          {/* Compartir y el corazón dependen del navegador: antes de hidratar, solo sus cajas (mismo tamaño). */}
          <div className="row gap-8">
            {hydrated && !preview ? <ShareButton url={d.shareUrl} title={l.title} text={d.previewText} /> : <span className="icon-btn" aria-hidden="true" />}
            {hydrated && !preview ? <FavoriteButton publicId={l.publicId} className="heart-hero" size={20} /> : <span className="icon-btn" aria-hidden="true" />}
          </div>
        </HeroGallery>

        <div className="stack listing-body">
          {l.kind === "habitacion" || !l.available ? (
            <div className="row wrap gap-8">
              {l.kind === "habitacion" ? <span className="badge">Habitación</span> : null}
              {!l.available ? <span className="badge badge-mute">No disponible por ahora</span> : null}
            </div>
          ) : null}
          <div className="stack listing-head">
            <h1 className={`listing-title${l.title.length > LONG_TITLE ? " is-long" : ""}`}>{l.title}</h1>
            {/* El pin va en línea, justo antes de la primera palabra: con dos renglones queda junto al primero (ronda de Ana 2026-11-02). */}
            <span className="listing-zone" data-testid="listing-zone">
              <I.pin size={18} />
              {[l.zone, l.canton].filter(Boolean).join(", ")}
            </span>
            <span className="muted" data-testid="listing-capacity">
              {capacityLine(l)}
            </span>
          </div>
          {/* Sin reseñas, la persona verificada es la confianza: justo bajo la cabecera, en su fila entre dos líneas (revisión UX A10; como en Airbnb). */}
          <hr className="divider" />
          <div className="row gap-12 host-line" data-testid="host-line">
            <span className="avatar avatar-sm" aria-hidden="true">
              {initials(l.ownerName)}
            </span>
            <span className="stack host-text">
              <b className="host-name">{firstName(l.ownerName)}</b>
              <span className="muted">{l.ownerWhatsappVerified ? "Anfitrión · WhatsApp verificado" : "Anfitrión"}</span>
            </span>
          </div>
          <hr className="divider" />
          {/* Sin descripción (publicar v2: es opcional), nada en su lugar. */}
          <ListingDescription text={l.description} hydrated={hydrated} />

          {l.features.length || d.monthly ? (
            <div className="feature-tiles">
              {/* «Alquiler mensual» con su precio debajo, en dos columnas: va la primera para no dejar huecos (ronda de Ana 2 nov, ticket 08). */}
              {d.monthly ? (
                <div className="tile-wide">
                  <I.calendar size={26} />
                  <span>{MONTHLY_LABEL}</span>
                  <small>{isNegotiable(d.monthly) ? "A negociar" : `${formatCRC(d.monthly.amount)} / mes`}</small>
                </div>
              ) : null}
              {l.features.map((f) => {
                const Icon = I[FEATURE_ICON[f]];
                return (
                  <div key={f}>
                    <Icon size={26} />
                    {f === "parking" && l.parkingPaid !== null ? `Parqueo ${l.parkingPaid ? "de pago" : "gratis"}` : FEATURE_SHORT[f]}
                  </div>
                );
              })}
            </div>
          ) : null}

          {preview ? null : <Availability listing={l} missing={days === null} currency={currency} fx={fx.crcPerUsd} onStay={setStay} />}

          {l.approx ? (
            <div className="stack gap-8">
              <span className="eyebrow">Zona aproximada</span>
              {hydrated ? <ApproxMap lat={l.approx.lat} lng={l.approx.lng} /> : <div className="map-box map-box-listing" aria-hidden="true" />}
            </div>
          ) : null}

          <p className="small muted">
            Publicada por <b className="ink">{l.ownerName}</b>
            {l.ownerWhatsappVerified ? " · WhatsApp verificado" : ""}. Sin comisiones: fechas, precio y pago los acuerda directamente con el anfitrión. bnbtico no procesa pagos.
          </p>
        </div>

        <div className="cta-spacer" aria-hidden="true" ref={spacer} />
        {/* Tarjetas flotantes, tanda 2 (Daniel, 2026-11-04): dos piezas que flotan y no se esconden, la tarjeta clara con los
            precios y, debajo, el botón verde con su sombra; sin la nota «Precios orientativos…» (las cifras llevan «≈»). */}
        <div className="cta-bar" ref={bar}>
          {main || d.monthly || reopen ? (
            <div className="cta-card float-card is-strong">
              <PriceColumns main={main} monthly={d.monthly} fx={fx} stay={stay} />
              {reopen ? <span className="xs muted cta-note">{reopen}</span> : null}
            </div>
          ) : null}
          {preview ? (
            <span className="btn btn-wa is-pending" aria-disabled="true">
              <I.wa size={22} /> Contactar por WhatsApp
            </span>
          ) : (
            <ContactButton listing={l} days={days} hydrated={hydrated} navigate={navigate} openOnMount={openSheet} />
          )}
        </div>
      </main>
    </div>
  );
}
