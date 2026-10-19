import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { I } from "@/components/icons";
import { ApproxMap } from "@/components/listing/approx-map";
import { CurrencyToggle } from "@/components/listing/currency-toggle";
import { Gallery } from "@/components/listing/gallery";
import { ReadonlyCalendar } from "@/components/listing/readonly-calendar";
import { ScreenTitle } from "@/components/shell";
import { currentCurrency } from "@/lib/currency";
import { getPublic, linkState, type PublicListing } from "@/lib/listings/repo";
import { FEATURES, KIND_LABELS } from "@/lib/listings/schema";
import { parsePublicId, previewText, publicUrl, shareBase } from "@/lib/listings/share";
import { FX_CRC_PER_USD, formatMoney } from "@/lib/money";
import { SITE_URL } from "@/lib/seo";
import { supabaseServer } from "@/lib/supabase/server";

type Params = Promise<{ publicId: string }>;

async function load(raw: string): Promise<{ id: string | null; listing: PublicListing | null; state: "active" | "blocked" | null }> {
  const id = parsePublicId(raw);
  const db = id ? await supabaseServer() : null;
  if (!id || !db) return { id, listing: null, state: null };
  const listing = await getPublic(db, id);
  if (listing) return { id, listing, state: "active" };
  return { id, listing: null, state: await linkState(db, id) };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { publicId } = await params;
  const { id, listing } = await load(publicId);
  if (!listing || !id) return { title: "Ficha no disponible", robots: { index: false } };
  const url = publicUrl(id, SITE_URL);
  const description = previewText(listing);
  const cover = listing.photos[0]?.url;
  return {
    title: listing.title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "article", url, title: listing.title, description, images: cover ? [{ url: cover, width: 1200, height: 900, alt: listing.title }] : undefined },
    twitter: { card: "summary_large_image", title: listing.title, description, images: cover ? [cover] : undefined },
  };
}

export default async function Casa({ params }: { params: Params }) {
  const { publicId } = await params;
  const { id, listing, state } = await load(publicId);
  if (!id || state === null) notFound();
  if (!listing) {
    return (
      <>
        <ScreenTitle title="Ficha no disponible" back="/explorar" />
        <section className="card stack">
          <h3>Este enlace ya no está activo</h3>
          <p>Este anuncio no está disponible en este momento.</p>
          <p className="small muted">Si ya hablaste con el propietario por WhatsApp, podés seguir esa conversación por tu cuenta.</p>
          <Link href="/explorar" className="btn btn-primary">Explorar otras casas</Link>
        </section>
      </>
    );
  }
  const l = listing;
  const [currency, headerList] = await Promise.all([currentCurrency(), headers()]);
  const origin = headerList.get("host") ? `${headerList.get("x-forwarded-proto") ?? "http"}://${headerList.get("host")}` : null;
  const url = publicUrl(id, shareBase({ NODE_ENV: process.env.NODE_ENV, NEXT_PUBLIC_STAGE: process.env.NEXT_PUBLIC_STAGE }, origin));
  const price = formatMoney(l.nightlyPriceCrc, currency);
  const firstName = l.ownerName.split(" ")[0];
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const offers: string[] = [
    plural(l.capacity, "persona", "personas"),
    plural(l.bedrooms, "habitación", "habitaciones"),
    plural(l.bathrooms, "baño", "baños"),
    ...FEATURES.filter(([k]) => l.features.includes(k)).map(([k, label]) => (k === "parking" ? `Parqueo · ${l.parkingPaid ? "de pago" : "gratuito"}` : label)),
  ];
  return (
    <>
      <ScreenTitle title="" back="/explorar" right={<span className="xs muted" data-share-url={url}>{KIND_LABELS[l.kind]}</span>} />
      <Gallery photos={l.photos} title={l.title} />
      <div className="stack" style={{ gap: 6 }}>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {l.ownerWhatsappVerified ? <span className="badge badge-ok">✓ WhatsApp verificado</span> : null}
          <span className="badge badge-mute num">Ref {id}</span>
          {!l.available ? <span className="badge badge-warn">No disponible por ahora</span> : null}
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800 }}>{l.title}</h1>
        <div className="row small muted"><I.pin size={16} /> {l.zone}, {l.canton}, {l.province}</div>
      </div>
      <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxWidth: "65ch" }}>{l.description}</p>

      <div className="stack">
        <div className="eyebrow">Lo que ofrece</div>
        <div className="amen">
          {offers.map((o) => (
            <div key={o}><span style={{ color: "var(--primary)" }}>✓</span>{o}</div>
          ))}
        </div>
      </div>

      <div className="stack">
        <div className="row between" style={{ alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div className="eyebrow">Disponibilidad y precio orientativo</div>
          <CurrencyToggle currency={currency} next={`/casa/${id}`} />
        </div>
        <ReadonlyCalendar note={`${price} por noche, salvo los días marcados con otro precio. Precios orientativos.${l.minNights > 1 ? ` Estancia mínima: ${l.minNights} noches.` : ""}`} />
        {currency === "USD" ? <p className="xs muted">Precios convertidos a dólares solo para orientarte (≈ ₡{FX_CRC_PER_USD} por US$1). El propietario cobra en colones.</p> : null}
        {l.acceptsMonthly ? (
          <p className="small"><b>{l.monthlyMode === "contact" || !l.monthlyPriceCrc ? "Mensual: consultar precio con el propietario" : `Mensual: ${formatMoney(l.monthlyPriceCrc, currency)} / mes · orientativo`}</b>{l.minMonths ? ` · mínimo ${plural(l.minMonths, "mes", "meses")}` : ""}</p>
        ) : null}
      </div>

      {l.lat !== null && l.lng !== null ? (
        <div className="stack">
          <div className="eyebrow">Ubicación aproximada</div>
          <ApproxMap lat={l.lat} lng={l.lng} />
        </div>
      ) : null}

      <div className="card row">
        <span className="avatar">{l.ownerName.charAt(0).toUpperCase()}</span>
        <div>
          <b>{l.ownerName}</b>
          <div className="xs muted">WhatsApp verificado · en bnbtico desde {new Date(l.createdAt).getFullYear()}</div>
        </div>
      </div>

      <div className="note small">
        Sin comisiones: fechas, precio y pago los acordás con {firstName} por WhatsApp. bnbtico no procesa pagos; no transfieras sin confirmar la casa. Para escribirle necesitás tu WhatsApp verificado.
      </div>

      <div className="cta-spacer" aria-hidden="true" />
      <div className="cta-bar">
        <div>
          <div className="num" style={{ fontWeight: 800, fontSize: 17 }}>{price}<span className="small muted" style={{ fontWeight: 600 }}> / noche</span></div>
          <div className="xs muted">orientativo</div>
        </div>
        <button className="btn btn-primary" style={{ flex: 1, flexDirection: "column", gap: 0 }} disabled type="button">
          <span className="row"><I.wa size={18} /> Contactar por WhatsApp</span>
          <small style={{ fontWeight: 600, opacity: 0.85 }}>Disponible pronto</small>
        </button>
      </div>
    </>
  );
}
