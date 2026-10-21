import Link from "next/link";
import { createDraftAction } from "@/actions/listings";
import { I } from "@/components/icons";
import { ShareButton } from "@/components/listing/share-button";
import { StatusBadge } from "@/components/listing/status-badge";
import { RootHeader } from "@/components/shell";
import { relativeDate } from "@/components/ui";
import { auth } from "@/lib/auth";
import { countActiveListings, listOwnListings } from "@/lib/listings/repo";
import { publicUrl } from "@/lib/listings/share";
import { requestShareBase } from "@/lib/listings/share-server";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Inicio" };

const PROMO_SLOTS = 50;

/** Inicio del propietario (pantalla 09): la casa, cómo compartirla y la oferta de lanzamiento. */
export default async function Panel({ searchParams }: { searchParams: Promise<{ "sin-supabase"?: string }> }) {
  const params = await searchParams;
  const [db, account] = await Promise.all([supabaseServer(), (await auth()).current()]);
  // Las tres consultas no dependen entre sí: en paralelo, no en fila.
  const [listings, taken, base] = await Promise.all([db && account ? listOwnListings(db) : [], db ? countActiveListings(db) : 0, requestShareBase()]);
  const active = listings.filter((l) => l.status === "active");
  const inReview = listings.filter((l) => l.status === "review");
  const title = active.length ? "Su casa, en marcha" : inReview.length ? "Su casa, en revisión" : "Publique su casa";
  const featured = active[0] ?? inReview[0] ?? listings.find((l) => l.status === "changes") ?? listings[0];

  return (
    <>
      <RootHeader title={title} greeting={account ? `Hola, ${account.name.split(" ")[0]}` : undefined} home="/propietario" />

      {!db || params["sin-supabase"] ? <div className="note note-arena">Esta pantalla necesita Supabase. En local: <code>pnpm db:start</code>.</div> : null}

      {db && !featured ? (
        <section className="card stack" style={{ gap: 12 }}>
          <h3>Publique su casa en cinco pasos</h3>
          <p className="small muted">Fotos, ubicación aproximada, características y precio. La revisamos a mano y queda visible con su enlace para compartir por WhatsApp.</p>
          <form action={createDraftAction}>
            <button className="btn btn-primary btn-lg btn-block" type="submit">Publicar casa</button>
          </form>
        </section>
      ) : null}

      {featured ? (
        <section className="card stack" style={{ gap: 12 }}>
          <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
            {featured.photos[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={featured.photos[0].url} alt="" className="thumb thumb-sm" />
            ) : (
              <span className="thumb thumb-sm" />
            )}
            <div className="stack" style={{ gap: 4, flex: 1, minWidth: 0 }}>
              <StatusBadge status={featured.status} available={featured.available} />
              <Link href={`/propietario/casas/${featured.id}`} className="display" style={{ fontWeight: 700, fontSize: 18, lineHeight: 1.1, color: "inherit", textDecoration: "none" }}>
                {featured.title || "Borrador sin título"}
              </Link>
              <span className="small muted">
                {featured.status === "active"
                  ? `Publicada ${relativeDate(featured.reviewedAt ?? featured.updatedAt)}`
                  : featured.status === "review"
                    ? `Enviada ${relativeDate(featured.updatedAt)} · le avisamos por WhatsApp`
                    : featured.status === "changes"
                      ? "Le pedimos cambios. Revise la nota en Mis casas."
                      : "Borrador sin enviar"}
              </span>
            </div>
          </div>
          {featured.status === "active" ? (
            <>
              <div className="stack" style={{ gap: 6, padding: "12px 14px", borderRadius: 16, background: "var(--surface-2)" }}>
                <b className="small">Comparta su ficha</b>
                <span className="small">Envíe el enlace por WhatsApp o en sus redes. Quien lo abra puede escribirle directo; solo necesita verificar su WhatsApp.</span>
                <span className="small num primary" style={{ fontWeight: 700 }}>{publicUrl(featured.publicId, base).replace(/^https?:\/\//, "")}</span>
              </div>
              <ShareButton url={publicUrl(featured.publicId, base)} title={featured.title} text={featured.title} label="Compartir ficha por WhatsApp" className="btn btn-primary btn-lg btn-block" icon />
            </>
          ) : featured.status === "draft" ? (
            <Link href={`/propietario/publicar/${featured.id}/1`} className="btn btn-primary btn-lg">Seguir con el borrador</Link>
          ) : null}
        </section>
      ) : null}

      {db ? (
        <section className="card stack" style={{ color: "var(--sun-ink)" }}>
          <div className="row between" style={{ alignItems: "baseline" }}>
            <b className="display" style={{ fontSize: 16 }}>Oferta de lanzamiento</b>
            <span className="xs num" style={{ fontWeight: 700 }}>Quedan {Math.max(0, PROMO_SLOTS - taken)} de {PROMO_SLOTS}</span>
          </div>
          <span className="small ink">
            {active.length ? <>Su casa está entre las primeras {PROMO_SLOTS}: <b>12 meses gratis</b>. Después, ₡9 900 al mes por casa, sin permanencia.</> : <>Las primeras {PROMO_SLOTS} casas publicadas tienen <b>12 meses gratis</b>. Después, ₡9 900 al mes por casa, sin permanencia. No pedimos tarjeta ahora.</>}
          </span>
          <div className="offer-bar"><div style={{ width: `${Math.min(100, Math.round((taken / PROMO_SLOTS) * 100))}%` }} /></div>
          <Link href="/cuenta" className="link small">Ver mi suscripción</Link>
        </section>
      ) : null}

      {listings.length > 1 ? (
        <Link href="/propietario/casas" className="list-item card" style={{ borderRadius: 24 }}>
          <I.house />
          <span className="body">Mis casas<small>{listings.length} en total</small></span>
          <span className="chev"><I.chevron /></span>
        </Link>
      ) : null}
    </>
  );
}
