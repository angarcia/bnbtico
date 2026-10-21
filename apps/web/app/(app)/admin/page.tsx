import Link from "next/link";
import { I } from "@/components/icons";
import { RootHeader } from "@/components/shell";
import { relativeDate } from "@/components/ui";
import { queue } from "@/lib/listings/repo";
import { requireAdmin } from "@/lib/listings/session";
import { formatCRC } from "@/lib/money";

export const metadata = { title: "Anuncios · admin" };

type Tab = "review" | "changes" | "rejected";
const TABS: { key: Tab; label: string }[] = [
  { key: "review", label: "Por revisar" },
  { key: "changes", label: "Cambios pedidos" },
  { key: "rejected", label: "Rechazados" },
];

/** Pantalla 21: casillas de resumen, filtros y la cola de anuncios (las más antiguas primero). */
export default async function Admin({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const [{ db }, params] = await Promise.all([requireAdmin(), searchParams]);
  const items = await queue(db);
  const tab: Tab = params.ver === "changes" || params.ver === "rejected" ? params.ver : "review";
  const count = (s: string) => items.filter((i) => i.listing.status === s).length;
  const shown = items.filter((i) => i.listing.status === tab);
  return (
    <>
      <RootHeader title="Anuncios" home="/admin" tag={<span className="badge badge-admin">Admin</span>} />
      <div className="grid-3">
        <div className="tile tile-review"><b className="num ink">{count("review")}</b><span>por revisar</span></div>
        <div className="tile tile-arena"><b className="num ink">{count("changes")}</b><span>con cambios</span></div>
        <div className="tile tile-soft"><b className="num">{count("active")}</b><span>activas · 30 días</span></div>
      </div>
      <div className="chiprow">
        {TABS.map((t) => (
          <Link key={t.key} href={t.key === "review" ? "/admin" : `/admin?ver=${t.key}`} className="chip chip-sm" aria-current={tab === t.key || undefined}>
            {t.label}{t.key === "review" && count("review") ? ` · ${count("review")}` : ""}
          </Link>
        ))}
      </div>
      {shown.length === 0 ? (
        <section className="card"><p className="muted">{tab === "review" ? "No hay anuncios pendientes." : "Nada por aquí."}</p></section>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          {shown.map(({ listing: l, ownerName }) => (
            <Link key={l.id} href={`/admin/casas/${l.id}`} className="card row" style={{ gap: 12, padding: 12, alignItems: "flex-start", textDecoration: "none", color: "inherit" }}>
              {l.photos[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={l.photos[0].url} alt="" className="thumb" />
              ) : (
                <span className="thumb" />
              )}
              <div className="stack" style={{ gap: 4, flex: 1, minWidth: 0 }}>
                <div className="row between" style={{ gap: 8 }}>
                  <span className="xs muted num">{l.publicId} · {relativeDate(l.updatedAt)}</span>
                  <span className={`badge ${l.reviewedAt && l.status === "review" ? "badge-ok" : "badge-review"}`} style={{ padding: "3px 8px", fontSize: 11 }}>{l.status === "review" ? (l.reviewedAt ? "Corregida" : "Nueva") : l.status === "changes" ? "Cambios pedidos" : "Rechazada"}</span>
                </div>
                <b className="display" style={{ fontSize: 17, lineHeight: 1.1 }}>{l.title || "Sin nombre"}</b>
                <span className="small muted">{ownerName} · WhatsApp verificado</span>
                <span className="small muted">{[l.zone, l.capacity ? `${l.capacity} personas` : null, `${l.photos.length} fotos`, l.nightlyPriceCrc ? formatCRC(l.nightlyPriceCrc) : l.monthlyPriceCrc ? `${formatCRC(l.monthlyPriceCrc)} / mes` : null].filter(Boolean).join(" · ")}</span>
              </div>
              <span className="chev" style={{ alignSelf: "center" }}><I.chevron /></span>
            </Link>
          ))}
        </div>
      )}
      <p className="xs muted" style={{ padding: "0 4px" }}>Las más antiguas primero. El propietario recibe la decisión por WhatsApp y la ve en Mis casas.</p>
    </>
  );
}
