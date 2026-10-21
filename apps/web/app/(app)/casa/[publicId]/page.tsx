import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { I, type IconName } from "@/components/icons";
import { ApproxMap } from "@/components/listing/approx-map";
import { ApproxToggle } from "@/components/listing/currency-toggle";
import { HeroGallery } from "@/components/listing/hero-gallery";
import { ShareButton } from "@/components/listing/share-button";
import { FlowHeader } from "@/components/shell";
import { currentCurrency } from "@/lib/currency";
import { getPublic, linkState, type PublicListing } from "@/lib/listings/repo";
import { FEATURE_SHORT, KIND_LABELS, modesLabel, type Feature } from "@/lib/listings/schema";
import { parsePublicId, previewText, publicUrl } from "@/lib/listings/share";
import { requestShareBase } from "@/lib/listings/share-server";
import { formatMoney } from "@/lib/money";
import { SITE_URL } from "@/lib/seo";
import { supabaseServer } from "@/lib/supabase/server";

type Params = Promise<{ publicId: string }>;

const FEATURE_ICON: Record<Feature, IconName> = { pool: "pool", pets: "pets", wifi: "wifi", ac: "ac", parking: "parking", ev: "ev", kids_free: "kids", beachfront: "beach", bbq: "bbq" };

async function load(raw: string): Promise<{ id: string | null; listing: PublicListing | null; state: "active" | "blocked" | null }> {
  const id = parsePublicId(raw);
  const db = id ? await supabaseServer() : null;
  if (!id || !db) return { id, listing: null, state: null };
  const listing = await getPublic(db, id);
  if (listing) return { id, listing, state: "active" };
  return { id, listing: null, state: await linkState(db, id) };
}

const preview = (l: PublicListing) =>
  l.acceptsNightly && l.nightlyPriceCrc
    ? previewText({ kind: l.kind, zone: l.zone, province: l.province, capacity: l.capacity, nightlyPriceCrc: l.nightlyPriceCrc })
    : `${KIND_LABELS[l.kind]} en ${l.zone}, ${l.province} · ${l.capacity} personas${l.monthlyPriceCrc ? ` · ${formatMoney(l.monthlyPriceCrc, "CRC")} por mes` : ""}`;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { publicId } = await params;
  const { id, listing } = await load(publicId);
  if (!listing || !id) return { title: "Ficha no disponible", robots: { index: false } };
  const url = publicUrl(id, SITE_URL);
  const description = preview(listing);
  const cover = listing.photos[0]?.url;
  return {
    title: listing.title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "article", url, title: listing.title, description, images: cover ? [{ url: cover, width: 1200, height: 900, alt: listing.title }] : undefined },
    twitter: { card: "summary_large_image", title: listing.title, description, images: cover ? [cover] : undefined },
  };
}

/** Ficha pública (pantalla 03): hero, etiquetas, nombre y zona, descripción, rejilla de características, zona aproximada y barra fija. */
export default async function Casa({ params }: { params: Params }) {
  const { publicId } = await params;
  const { id, listing, state } = await load(publicId);
  if (!id || state === null) notFound();
  if (!listing) {
    return (
      <>
        <FlowHeader title="Ficha no disponible" back="/explorar" />
        <section className="card stack">
          <h3>Este enlace ya no está activo</h3>
          <p>Este anuncio no está disponible en este momento.</p>
          <p className="small muted">Si ya habló con el propietario por WhatsApp, puede seguir esa conversación por su cuenta.</p>
          <Link href="/explorar" className="btn btn-primary">Explorar otras casas</Link>
        </section>
      </>
    );
  }
  const l = listing;
  const [currency, base] = await Promise.all([currentCurrency(), requestShareBase()]);
  const url = publicUrl(id, base);
  const mainCrc = l.acceptsNightly && l.nightlyPriceCrc ? l.nightlyPriceCrc : l.monthlyPriceCrc ?? 0;
  const mainUnit = l.acceptsNightly && l.nightlyPriceCrc ? "noche" : "mes";
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return (
    <>
      <HeroGallery photos={l.photos} title={l.title}>
        <Link href="/explorar" aria-label="Volver a Explorar" className="icon-btn overlay"><I.back /></Link>
        <ShareButton url={url} title={l.title} text={preview(l)} round />
      </HeroGallery>

      <div className="stack" style={{ gap: 16, paddingTop: 4 }}>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {l.ownerWhatsappVerified ? <span className="badge badge-ok"><I.check size={14} /> WhatsApp verificado</span> : null}
          <span className="badge">{modesLabel(l)}</span>
          {l.kind === "habitacion" ? <span className="badge">Habitación{l.bathroomShared === null ? "" : l.bathroomShared ? " · baño compartido" : " · baño privado"}</span> : null}
          {!l.available ? <span className="badge badge-sun">No disponible por ahora</span> : null}
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <h1 style={{ fontSize: 30 }}>{l.title}</h1>
          <span className="row muted" style={{ gap: 6 }}><I.pin size={18} /> {l.zone}, {l.canton} · ubicación aproximada</span>
          <span className="small muted">{plural(l.capacity, "persona", "personas")} · {plural(l.bedrooms, "habitación", "habitaciones")} · {plural(l.bathrooms, "baño", "baños")}</span>
        </div>
        <p style={{ fontSize: 16, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{l.description}</p>

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

        {l.lat !== null && l.lng !== null ? (
          <div className="stack" style={{ gap: 8 }}>
            <span className="eyebrow">Zona aproximada</span>
            <ApproxMap lat={l.lat} lng={l.lng} />
          </div>
        ) : null}

        <p className="small muted">Publicada por <b className="ink">{l.ownerName}</b> · WhatsApp verificado. Sin comisiones: fechas, precio y pago los acuerda directamente con el propietario. bnbtico no procesa pagos.</p>
      </div>

      <div className="cta-spacer" aria-hidden="true" />
      <div className="cta-bar">
        <div className="row between" style={{ alignItems: "baseline", flexWrap: "wrap", gap: 4 }}>
          <span className="price">
            {formatMoney(mainCrc, currency)} <small>/ {mainUnit}</small>
          </span>
          <span className="xs muted">
            <ApproxToggle currency={currency} amountCrc={mainCrc} next={`/casa/${id}`} /> · el precio final lo acuerda con el propietario
          </span>
        </div>
        {l.acceptsNightly && l.acceptsMonthly && l.monthlyPriceCrc ? <span className="xs muted">Mensual: <b className="ink num">{formatMoney(l.monthlyPriceCrc, currency)}</b> / mes</span> : null}
        <button className="btn btn-wa" type="button" disabled>
          <I.wa size={22} /> Contactar por WhatsApp <small style={{ fontFamily: "var(--body)", fontWeight: 600, fontSize: 12, opacity: 0.8 }}>· disponible pronto</small>
        </button>
      </div>
    </>
  );
}
