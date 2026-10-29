// Ficha pública (pantalla 03 del diseño v1). La renderiza el worker y la hidrata el navegador: el mapa y la moneda
// dependen del navegador y se montan después de hidratar, en cajas de tamaño fijo.
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { Currency } from "../domain/currency";
import { reopenLabel } from "../domain/dates";
import { describe } from "../domain/describe";
import { FEATURE_SHORT, MONTHLY_LABEL, type Feature, type PublicListing } from "../domain/listing";
import { fxDayLabel, fxRateLabel, type FxRate } from "../domain/fx";
import { formatCRC, formatMoney, formatUSD } from "../domain/money";
import { ApproxMap } from "./approx-map";
import { useCurrency } from "./currency";
import { CurrencySwitchSlot } from "./currency-switch";
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
import { track } from "./beacon";
import { BlockedPage } from "./status-pages";

const FEATURE_ICON: Record<Feature, IconName> = { pool: "pool", pets: "pets", wifi: "wifi", ac: "ac", parking: "parking", ev: "ev", kids_free: "kids", beachfront: "beach", bbq: "bbq" };
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
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
function ContactButton({ listing, hydrated, navigate, openOnMount }: { listing: PublicListing; hydrated: boolean; navigate: Navigate; openOnMount?: OpenSheet }) {
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

  if (!listing.available) {
    const reopen = reopenLabel(listing.reopenAt);
    return (
      <>
        <button className="btn btn-wa" type="button" disabled>
          <I.wa size={22} /> No disponible por ahora
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
 *  rejilla se monta dentro tras hidratar. Una casa cerrada a consultas muestra «Calendario cerrado» ya en el servidor. */
function Availability({ listing, currency, fx }: { listing: PublicListing; currency: Currency; fx: number }) {
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
              <ListingCalendar listing={listing} currency={currency} fx={fx} />
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

/** La otra moneda como referencia, sin botón (ticket 15: la moneda se elige en Explorar o en Cuenta). Ocupa siempre lo
 *  mismo (las dos cifras apiladas, la que no se ve queda oculta debajo): hidratar o cambiar de moneda no mueve la barra. */
function PriceReference({ amountCrc, currency, fx }: { amountCrc: number; currency: Currency; fx: FxRate }) {
  const usd = `≈ ${formatUSD(amountCrc, fx.crcPerUsd)}`;
  const crc = `≈ ${formatCRC(amountCrc)}`;
  return (
    <span className="xs both price-ref" data-testid="price-reference" title={`Orientativo: ≈ ${fxRateLabel(fx.crcPerUsd)} por US$1, tipo de referencia del ${fxDayLabel(fx.day)}`}>
      <span>{currency === "CRC" ? usd : crc}</span>
      <span className="ghost" aria-hidden="true">
        {currency === "CRC" ? crc : usd}
      </span>
    </span>
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

/** `preview`: el borrador visto desde el asistente (revisión UX C4): sin balizas, sin compartir ni favorito, sin calendario
 *  (aún no es público) y con el botón de contacto a la vista pero apagado. */
export function ListingPage({ listing: l, base, onBack, navigate = fullNavigation, openSheet, preview }: { listing: PublicListing; base: string; onBack?: () => void; navigate?: Navigate; openSheet?: OpenSheet; preview?: boolean }) {
  const hydrated = useHydrated();
  const currency = useCurrency();
  const fx = useFx();
  const d = describe(l, { base });
  useEffect(() => {
    // Ni la vista previa ni el propio dueño cuentan como visita (revisión UX A2).
    if (!preview && !isOwnListing(l.publicId)) track("listing_view", l.publicId);
  }, [l.publicId, preview]);
  const main = d.mainPrice;
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
          {/* La moneda, compartir y el corazón dependen del navegador: antes de hidratar, solo sus cajas (mismo tamaño). */}
          <div className="row gap-8">
            {preview ? null : <CurrencySwitchSlot className="overlay" />}
            {hydrated && !preview ? <ShareButton url={d.shareUrl} title={l.title} text={d.previewText} /> : <span className="icon-btn" aria-hidden="true" />}
            {hydrated && !preview ? <FavoriteButton publicId={l.publicId} className="heart-hero" size={20} /> : <span className="icon-btn" aria-hidden="true" />}
          </div>
        </HeroGallery>

        <div className="stack listing-body">
          {l.kind === "habitacion" || !l.available ? (
            <div className="row wrap gap-8">
              {l.kind === "habitacion" ? <span className="badge">Habitación{l.bathroomShared === null ? "" : l.bathroomShared ? " · baño compartido" : " · baño privado"}</span> : null}
              {!l.available ? <span className="badge badge-mute">No disponible por ahora</span> : null}
            </div>
          ) : null}
          <div className="stack gap-4">
            <h1 className={`listing-title${l.title.length > LONG_TITLE ? " is-long" : ""}`}>{l.title}</h1>
            {/* Sin reseñas, la persona verificada es la confianza: va arriba, no al final (revisión UX A10). */}
            <span className="row gap-8 host-line" data-testid="host-line">
              <span className="avatar avatar-xs" aria-hidden="true">
                {initials(l.ownerName)}
              </span>
              <span className="small">
                <b className="ink">{firstName(l.ownerName)}</b>
                {l.ownerWhatsappVerified ? " · WhatsApp verificado" : ""}
              </span>
            </span>
            <span className="row muted gap-6">
              <I.pin size={18} /> {[l.zone, l.canton].filter(Boolean).join(", ")} · ubicación aproximada
            </span>
            <span className="small muted" data-testid="listing-capacity">
              {plural(l.capacity, "persona", "personas")} · {plural(l.bedrooms, "habitación", "habitaciones")} · {plural(l.bathrooms, "baño", "baños")}
            </span>
          </div>
          <p className="listing-description">{l.description}</p>

          {l.features.length || d.monthly ? (
            <div className="feature-tiles">
              {l.features.map((f) => {
                const Icon = I[FEATURE_ICON[f]];
                return (
                  <div key={f}>
                    <Icon size={26} />
                    {f === "parking" && l.parkingPaid !== null ? `Parqueo ${l.parkingPaid ? "de pago" : "gratis"}` : FEATURE_SHORT[f]}
                  </div>
                );
              })}
              {d.monthly ? (
                <div>
                  <I.calendar size={26} />
                  {MONTHLY_LABEL}
                </div>
              ) : null}
            </div>
          ) : null}

          {preview ? null : <Availability listing={l} currency={currency} fx={fx.crcPerUsd} />}

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
                  {formatMoney(main.amount, currency, fx.crcPerUsd)} <small>/ {main.unit}</small>
                </span>
                <span className="ghost" aria-hidden="true">
                  {formatMoney(main.amount, currency === "CRC" ? "USD" : "CRC", fx.crcPerUsd)} <small>/ {main.unit}</small>
                </span>
              </span>
              <span className="xs muted price-note">
                <PriceReference amountCrc={main.amount} currency={currency} fx={fx} /> · orientativo
              </span>
            </div>
          ) : null}
          {d.monthly ? <MonthlyLine monthly={d.monthly} format={(crc) => formatMoney(crc, currency, fx.crcPerUsd)} /> : null}
          {preview ? (
            <span className="btn btn-wa is-pending" aria-disabled="true">
              <I.wa size={22} /> Contactar por WhatsApp
            </span>
          ) : (
            <ContactButton listing={l} hydrated={hydrated} navigate={navigate} openOnMount={openSheet} />
          )}
        </div>
      </main>
    </div>
  );
}
